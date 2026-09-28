import { encode } from "@toon-format/toon";

function parseJsonDocuments(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error) {
		const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
		if (lines.length < 2) throw error;
		// JSON Lines is complete only when every record parses; never drop a bad row.
		return lines.map(line => JSON.parse(line));
	}
}

export function decodeNestedJson(value: unknown): unknown {
	if (isTruncatedPreview(value) || artifactPreview(value) || isCommandResult(value)) return value;
	if (typeof value === "string") {
		const text = value.trim().replace(/^display\[\d+\]:\s*/, "");
		if (text.startsWith("{") || text.startsWith("[") || text.startsWith('"') || (/^(?:-?\d|true\b|false\b|null\b)/.test(text) && /[\r\n]/.test(text))) {
			try {
				const parsed = parseJsonDocuments(text);
				if (parsed !== null && (typeof parsed === "object" || typeof parsed === "string")) {
					const decoded = decodeNestedJson(parsed);
					if (decoded !== null && typeof decoded === "object") return decoded;
				}
			} catch {
				// Incomplete JSON and ordinary text must remain unchanged.
			}
		}
		return value;
	}
	if (Array.isArray(value)) return value.map(decodeNestedJson);
	if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeNestedJson(item)]));
	}
	return value;
}

function isTruncatedPreview(value: unknown): value is { preview: string; truncated: true; totalBytes: number } {
	return value !== null && typeof value === "object" &&
		"preview" in value && typeof value.preview === "string" &&
		"truncated" in value && value.truncated === true &&
		"totalBytes" in value && typeof value.totalBytes === "number" &&
		Object.keys(value).every(key => ["preview", "truncated", "totalBytes"].includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

type CommandResult = Record<string, unknown> & { text: string };

function isCommandResult(value: unknown): value is CommandResult {
	if (!isRecord(value) || typeof value.text !== "string") return false;
	const details = value.details;
	return (isRecord(details) && ["exitCode", "wallTimeMs", "timeoutSeconds"].some(key => typeof details[key] === "number")) ||
		(typeof value.hasError === "boolean" && splitCommandFooter(value.text) !== undefined);
}

function splitCommandFooter(text: string) {
	const match = /^([\s\S]*?)(?:\r?\n|^)([ \t]*Wall time: (\d+(?:\.\d+)?) seconds(?:\s*\r?\n[ \t]*Command exited with code (-?\d+))?[ \t\r\n]*)$/.exec(text);
	if (!match) return;
	return {
		body: match[1].replace(/(?:\r?\n[ \t]*)+$/, ""),
		text: match[2].trim(),
		seconds: Number(match[3]),
		exitCode: match[4] === undefined ? undefined : Number(match[4]),
	};
}

function formatCommandResult(value: CommandResult, label = "Result"): { text: string; format: "command" } {
	const details = isRecord(value.details) ? value.details : {};
	const footer = splitCommandFooter(value.text);
	const exitCode = typeof details.exitCode === "number" ? details.exitCode : footer?.exitCode;
	const seconds = typeof details.wallTimeMs === "number" ? details.wallTimeMs / 1000 : footer?.seconds;
	const status = value.hasError === true || (exitCode !== undefined && exitCode !== 0) ? "failed"
		: exitCode === 0 ? "succeeded" : undefined;
	const heading = [label];
	if (status) heading.push(status);
	if (exitCode !== undefined) heading.push(`exit ${exitCode}`);
	if (seconds !== undefined) heading.push(`${Number(seconds.toFixed(2))} s`);
	if (typeof details.timeoutSeconds === "number") heading.push(`timeout ${details.timeoutSeconds} s`);
	const source = footer?.body ?? value.text;
	const decoded = decodeNestedJson(source);
	const body = typeof decoded === "string" ? decoded : formatJsonOutput(decoded).text;
	const extra = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "text" && key !== "details" && !(key === "hasError" && typeof value.hasError === "boolean")));
	const remainingDetails = Object.fromEntries(Object.entries(details).filter(([key, item]) =>
		!["exitCode", "wallTimeMs", "timeoutSeconds"].includes(key) || typeof item !== "number"));
	if (Object.keys(remainingDetails).length) extra.details = remainingDetails;
	if (value.details !== undefined && !isRecord(value.details)) extra.details = value.details;
	// Keep conflicting footer data rather than silently choosing one report.
	if (footer && ((footer.exitCode !== undefined && footer.exitCode !== exitCode) ||
		(seconds !== undefined && Math.abs(footer.seconds - seconds) > 0.01))) extra.footer = footer.text;
	const metadata = Object.keys(extra).length ? `\n\nMetadata:\n${formatJsonOutput(extra).text}` : "";
	return { text: `${heading.join("; ")}\n${body || "(no output)"}${metadata}`, format: "command" };
}

/**
 * A shell result whose body is plain text: `Result; exit N; T s` heading from the Wall-time
 * footer, then the body verbatim. Undefined without the footer, since then there is nothing
 * to lift out of the text.
 */
export function formatCommandText(text: string): { text: string; format: "command" } | undefined {
	const footer = splitCommandFooter(text);
	if (!footer) return;
	const heading = ["Result"];
	if (footer.exitCode !== undefined) heading.push(footer.exitCode === 0 ? "succeeded" : "failed", `exit ${footer.exitCode}`);
	heading.push(`${Number(footer.seconds.toFixed(2))} s`);
	return { text: `${heading.join("; ")}\n${footer.body || "(no output)"}`, format: "command" };
}


function artifactPreview(value: unknown) {
	if (!isRecord(value) || typeof value.text !== "string" || !isRecord(value.details)) return;
	const { details } = value;
	const display = details.displayContent;
	const meta = details.meta;
	if (!isRecord(display) || display.text !== value.text || !isRecord(meta) || !isRecord(meta.source)) return;
	if (meta.source.type !== "internal" || typeof meta.source.value !== "string" || !meta.source.value.startsWith("artifact://")) return;
	const notes = [`Source: ${meta.source.value}`];
	if (typeof display.startLine === "number") notes.push(`page starts at line ${display.startLine}`);
	if (typeof details.totalLines === "number") notes.push(`total lines: ${details.totalLines}`);
	const limits = meta.limits;
	if (isRecord(limits) && isRecord(limits.columnTruncated) && typeof limits.columnTruncated.maxColumn === "number") {
		notes.push(`source lines clipped at ${limits.columnTruncated.maxColumn} ${typeof limits.columnTruncated.unit === "string" ? limits.columnTruncated.unit : "columns"}`);
	}
	return { text: value.text, notice: `[${notes.join("; ")}]` };
}

function isMultilineJson(value: unknown): value is string {
	return typeof value === "string" && /^\s*(?:[\[{]|"(?:\\.|[^"\\])*"\s*:|display\[\d+\]:)/.test(value) && /[\r\n]/.test(value);
}

function needsTextLayout(value: unknown): boolean {
	if (isTruncatedPreview(value) || artifactPreview(value) || isMultilineJson(value) || isCommandResult(value)) return true;
	if (typeof value === "string" && formatSearchOutput(value) !== undefined) return true;
	if (markdownOutput(value) !== undefined) return true;
	return value !== null && typeof value === "object" && Object.values(value).some(needsTextLayout);
}

export function isFileExcerpt(text: string): boolean {
	return /^(?:\[[^\]\r\n]+#[\da-f]+\]|#{1,6} [^\r\n]+#[\da-f]+)\r?$/im.test(text);
}

export function markdownOutput(value: unknown): string | undefined {
	if (isCommandResult(value)) return;
	if (isTruncatedPreview(value)) {
		const body = markdownOutput(previewText(value.preview) ?? value.preview);
		return body === undefined ? undefined : `${body}\n\n[truncated; original size: ${value.totalBytes} bytes]`;
	}
	const artifact = artifactPreview(value);
	const text = typeof value === "string" ? value : isRecord(value) && typeof value.text === "string" ? value.text : undefined;
	if (text === undefined) return;
	if (formatSearchOutput(text) !== undefined) return;
	let body = text;
	if (isFileExcerpt(text)) {
		const headers = text.match(/^(?:\[[^\]\r\n]+#[\da-f]+\]|#{1,6} [^\r\n]+#[\da-f]+)\r?$/gim) ?? [];
		if (!headers.every(header => /\.(?:md|markdown)#[\da-f]+\]?\r?$/i.test(header))) return;
		body = stripSourceLineNumbers(text);
	} else {
		if (/^\s*(?:\{|\[\s*(?:\r?\n|[\[{"\d])|"(?:\\.|[^"\\])*"\s*:|display\[\d+\]:)/.test(text)) return;
		const block = /^(?:[ \t]{0,3}#{1,6}\s+\S|[ \t]{0,3}(?:`{3,}|~{3,})|[ \t]{0,3}>[ \t]+\S)/m;
		const list = /(?:^|\r?\n[ \t]*\r?\n)[ \t]{0,3}(?:[-+*]|\d+[.)])[ \t]+\S/;
		const table = /^.*\|.*\r?\n[ \t]*\|?[ \t]*:?-{3,}.*\|/m;
		const inline = /(?:\*\*[^\r\n]+\*\*|\[[^\]\r\n]+\]\([^\s)]+\))/;
		const setext = /^[^\r\n]+\r?\n[ \t]{0,3}(?:={3,}|-{3,})[ \t]*$/m;
		if (!block.test(text) && !list.test(text) && !table.test(text) && !inline.test(text) && !setext.test(text)) return;
	}
	return artifact ? `${body}\n\n${artifact.notice}` : body;
}

export function formatSearchOutput(text: string): string | undefined {
	if (!/^\d+ hit\(s\) for .+ in .+/m.test(text)) return;
	return text.replace(
		/^([ \t]*)([^\r\n]+:\d+(?:-\d+)?)[ \t]+(\d+\.\d+)[ \t]+([^\r\n]*)/gm,
		(_match, indent: string, path: string, score: string, excerpt: string) => `${indent}${path}  [score ${score}]\n${indent}  ${excerpt}`,
	);
}

function stripSourceLineNumbers(text: string): string {
	if (!isFileExcerpt(text)) return text;
	return text.replace(/^[ \t]*\*?\d+(?:-\d+)?:/gm, "");
}

export function formatFileExcerpt(text: string): string {
	const clean = stripSourceLineNumbers(text);
	const headerEnd = clean.indexOf("\n");
	if (headerEnd < 0) return clean;
	const body = clean.slice(headerEnd + 1).trim();
	if (body.startsWith("{") || body.startsWith("[")) {
		try {
			const value = decodeNestedJson(JSON.parse(body));
			return `${clean.slice(0, headerEnd)}\n${encode(inlineStringValues(value))}`;
		} catch {
			// Partial excerpts remain readable text, without inventing missing fields.
		}
	}
	const objectExcerpt = /^\{\s*\n([\s\S]*)\n\s*\},?$/.exec(body);
	if (objectExcerpt) {
		const fields: string[] = [];
		let hasField = false;
		for (const line of objectExcerpt[1].split(/\r?\n/)) {
			const field = line.trim();
			if (!field) continue;
			if (field === "…" || field === "...") {
				fields.push(field);
				continue;
			}
			const property = /^([a-zA-Z_$][\w$]*|"(?:\\.|[^"\\])*")\s*:\s*(.+?)(?:,)?$/.exec(field);
			if (!property) return clean;
			const [, key, source] = property;
			try {
				const name = key.charCodeAt(0) === 34 ? JSON.parse(key) : key;
				fields.push(encode(inlineStringValues({ [name]: decodeNestedJson(JSON.parse(source)) })));
			} catch {
				// Expressions stay source text. Never execute code to format a preview.
				fields.push(`${key}: ${source}`);
			}
			hasField = true;
		}
		if (hasField) return `${clean.slice(0, headerEnd)}\n${fields.join("\n")}`;
	}
	return clean;
}

function inlineText(text: string): string {
	const lines = text.split(/\r\n|\r|\n/);
	return lines.map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("; ");
}

function inlineStringValues(value: unknown): unknown {
	if (typeof value === "string") return inlineText(stripSourceLineNumbers(value));
	if (Array.isArray(value)) return value.map(inlineStringValues);
	if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inlineStringValues(item)]));
	}
	return value;
}

function previewText(preview: string): string | undefined {
	const textField = /^\s*(?:display\[\d+\]:\s*)?\{\s*"text"\s*:\s*"((?:\\[^\r\n]|[^"\\\r\n])*)/.exec(preview);
	if (!textField) return;
	// Decode available string characters only; the outer JSON can be incomplete.
	const fragment = textField[1].replace(/\\u[\da-f]{0,3}$/i, "");
	try {
		const text: string = JSON.parse(`"${fragment}"`);
		if (isFileExcerpt(text)) return formatFileExcerpt(text);
		const decoded = decodeNestedJson(text);
		if (decoded !== null && typeof decoded === "object") return formatJsonOutput(decoded).text;
		const timedJson = formatJsonWithFooter(text);
		if (timedJson) return timedJson.text;
		const markdown = markdownOutput(text);
		if (markdown !== undefined) return markdown;
		return isMultilineJson(text) ? text : inlineText(text);
	} catch {
		// Keep invalid escapes visible in the original preview.
		return;
	}
}

export function formatJsonWithFooter(text: string): { text: string; format: "toon" | "text" | "command" } | undefined {
	const footer = splitCommandFooter(text);
	if (!footer) return;
	try {
		const value = parseJsonDocuments(footer.body.trim().replace(/^display\[\d+\]:\s*/, ""));
		if (value === null || typeof value !== "object") return;
		const body = formatJsonOutput(decodeNestedJson(value));
		return { text: `${body.text}\n${footer.text}`, format: body.format };
	} catch {
		// A timing footer does not make an incomplete or malformed JSON body valid.
		return;
	}
}

export function formatJsonOutput(value: unknown): { text: string; format: "toon" | "text" | "command" } {
	if (isCommandResult(value)) return formatCommandResult(value);
	if (Array.isArray(value) && value.some(isCommandResult)) {
		return {
			text: value.map((item, index) => isCommandResult(item)
				? formatCommandResult(item, `Result ${index + 1}`).text
				: `Result ${index + 1}\n${formatJsonOutput(item).text}`).join("\n\n"),
			format: "command",
		};
	}
	const artifact = artifactPreview(value);
	if (artifact) {
		const decoded = decodeNestedJson(artifact.text);
		const output = typeof decoded === "string"
			? formatJsonWithFooter(decoded) ?? { text: previewText(decoded) ?? decoded, format: "text" as const }
			: formatJsonOutput(decoded);
		return { ...output, text: `${output.text}\n${artifact.notice}` };
	}
	// Preview envelopes have already lost data. Do not parse them as complete values.
	if (isTruncatedPreview(value)) {
		const text = previewText(value.preview);
		if (text !== undefined) {
			return { text: `${text}\n[truncated; original size: ${value.totalBytes} bytes]`, format: "text" };
		}
		const preview = value.preview.replace(/"(?:\\.|[^"\\])*"?/g, token =>
			token.replace(/\\r\\n|\\[\s\S]/g, escape =>
				escape === "\\n" || escape === "\\r" || escape === "\\r\\n" ? "; " : escape,
			),
		);
		return { text: `${preview}\n[truncated; original size: ${value.totalBytes} bytes]`, format: "text" };
	}
	if (value && typeof value === "object" && "text" in value && typeof value.text === "string" &&
		isFileExcerpt(value.text)) {
		return { text: formatFileExcerpt(value.text), format: "text" };
	}
	const text = typeof value === "string" ? value : isRecord(value) && typeof value.text === "string" ? value.text : undefined;
	const search = text === undefined ? undefined : formatSearchOutput(text);
	if (search !== undefined) return { text: search, format: "text" };
	const timedJson = typeof value === "string" ? formatJsonWithFooter(value) : undefined;
	if (timedJson) return timedJson;
	const markdown = markdownOutput(value);
	if (markdown !== undefined) return { text: markdown, format: "text" };
	if (isMultilineJson(value)) return { text: value, format: "text" };
	if (!needsTextLayout(value)) return { text: encode(inlineStringValues(value)), format: "toon" };

	// Keep available values readable beside incomplete previews, without claiming
	// that the mixed display is a valid TOON document.
	const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as object);
	let format: "text" | "command" = "text";
	const mixedText = entries.map(([key, item]) => {
		const label = encode({ [key]: null }).replace(/: null$/, ":");
		const output = formatJsonOutput(item);
		if (output.format === "command") format = "command";
		return `${label}\n${output.text.split("\n").map(line => `  ${line}`).join("\n")}`;
	}).join("\n");
	return { text: mixedText, format };
}
