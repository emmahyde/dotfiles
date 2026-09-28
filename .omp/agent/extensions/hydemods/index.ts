import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { Box, formatMetricRow, Markdown, type MetricSpec, Text, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@oh-my-pi/pi-tui";
// Only host-mapped specifiers share the running instance; a deeper pi-tui path would patch a private copy.
import { ReadToolGroupComponent } from "@oh-my-pi/pi-coding-agent/modes/components";
import { encode as encodeToon } from "@toon-format/toon";
import { parse as parseYaml } from "yaml";
import { MCPManager } from "@oh-my-pi/pi-coding-agent/mcp/manager";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { summarizeCode } from "@oh-my-pi/pi-natives";
import type { Usage } from "@oh-my-pi/pi-ai";
import { formatDuration, formatNumber } from "@oh-my-pi/pi-utils";
import { theme as uiTheme } from "@oh-my-pi/pi-tui/theme";
import { fileHyperlink } from "@oh-my-pi/pi-tui/render/hyperlink";
import { getMarkdownTheme } from "@oh-my-pi/pi-tui/theme";
import type { Theme, ThemeColor } from "@oh-my-pi/pi-tui/theme";
import { toolRenderers } from "@oh-my-pi/pi-tui/tools";
import { renderDefaultToolExecution } from "@oh-my-pi/pi-tui/tools/default-renderer";
import type { ToolRenderer } from "@oh-my-pi/pi-tui/tools/renderer";
import { readSourceFsPath, splitPathAndSel } from "@oh-my-pi/pi-tui/tools/read";
import { outlineSource, recoverOldText, renderEditOutline, renderOutline, renderRange, type Outline } from "./lib/code-outline";
import { referenceLocations } from "./lib/reference-output";
// Keep helper modules below lib/: configured extension roots scan direct .ts files.
import { installMcpPromptRepair } from "./lib/mcp-prompts";
import { decodeNestedJson, formatJsonOutput, formatFileExcerpt, isFileExcerpt, formatSearchOutput, formatCommandText, formatJsonWithFooter, markdownOutput } from "./lib/tool-output";
import { booleanSetting, integerSetting, readSetting, settings, watchSetting } from "./lib/settings";
import type { Setting } from "@oh-my-pi/pi-coding-agent/config/registry";

type TweakCategory = "Workflow" | "Interface" | "Quality of life";

type TweakDef = {
	name: string;
	title: string;
	description: string;
	category: TweakCategory;
	render: () => string;
};

type Tweak = TweakDef & { setting: Setting<boolean> };

/**
 * Add future tweaks here. Each entry owns its label, grouping, and display copy; its on/off state
 * is a persisted OMP setting, `hydemods.<camelName>`, created from the entry.
 */
const TWEAK_DEFS: TweakDef[] = [
	{
		name: "mcp-prompt-commands",
		title: "MCP prompt commands",
		description: "Keeps empty arguments in MCP prompt requests and reports empty server responses.",
		category: "Workflow",
		render: () => "Keep using /server:prompt [key=value], including /ai-game-developer:add-debug-visualization. Requests include empty arguments; empty server responses show errors. The MCP server must be connected and return prompt text.",
	},
	{
		name: "calm-start",
		title: "Calm start",
		description: "Keeps the first screen focused on the work at hand.",
		category: "Quality of life",
		render: () => "A quiet, focused session opening.",
	},
	{
		name: "integrated-tool-expansion",
		title: "Integrated tool cards",
		description: "Draws prettified structured results inside OMP's own tool card; never a second card.",
		category: "Interface",
		render: () => "hydemods fills the result view of OMP's tool card when it has structure to add (commands, files, search hits, JSON/TOON, markdown, links); plain text, errors, streaming results, and JSON that OMP draws as a tree keep the original renderer. Exactly one card per call. Ctrl+O expansion and hidden tool output (Ctrl+Shift+O) apply to it like any native card. Cmd+Opt+O (or Ctrl+Alt+O where the terminal does not report Cmd) toggles hydemods rendering for the session. Set the collapsed limit with /hydemods collapsed-lines N or +/- in this panel; default 5, saved to settings. Expanded lines wrap. Markdown uses OMP rendering; text and source highlighting use OMP theme colors.",
	},
	{
		name: "tool-results-toon",
		title: "TOON for the model, tree or TOON for you",
		description: "Sends JSON tool results to the model as TOON; shows you OMP's JSON tree when available, otherwise TOON.",
		category: "Interface",
		render: () => "The model reads complete JSON tool results (nested JSON strings decoded) as TOON through the provider context hook; persisted results stay JSON. When OMP's native card can draw the result as a JSON tree (tools without a bespoke renderer, one JSON document), that tree is shown and the hydemods card steps aside. Otherwise the hydemods card shows TOON with nested JSON decoded, collapsed to the collapsed-lines limit. Command results use separate blocks with status, exit code, and timing above each body. Incomplete JSON keeps its lines. Artifact pages show content once with source and truncation notes. File and grep excerpts hide source line numbers; path-ID headings are grey; source uses syntax colors. References use clickable paths. Reload OMP after updates.",
	},
	{
		name: "session-identity",
		title: "Session identity & colors",
		description: "Assigns a persistent codename, sigil, and distinct ANSI color to each session.",
		category: "Interface",
		render: () => "Active: session displays a unique codename badge and accent color in the status bar.",
	},
	{
		name: "last-prompt-drawer",
		title: "Last prompt drawer",
		description: "Shows the start of your latest prompt on one line above the editor.",
		category: "Interface",
		render: () => "Active: latest prompt is truncated to the terminal width with an ellipsis.",
	},
	{
		name: "session-irc-monitor",
		title: "IRC comms & System Monitor",
		description: "Enables session communication and deterministic System monitors over the IRC bus.",
		category: "Workflow",
		render: () => "Active: Claude-style monitors execute background checks and message Main as System.",
	},
	{
		name: "heartbeat-command",
		title: "Autonomous /heartbeat exploration",
		description: "Enables /heartbeat to prompt self-directed exploration and goal-setting.",
		category: "Workflow",
		render: () => "Active: /heartbeat triggers a self-directed codebase exploration cycle.",
	},
	{
		name: "session-retro-command",
		title: "Interactive /retro summary",
		description: "Enables /retro to run a structured session retrospective.",
		category: "Workflow",
		render: () => "Active: /retro synthesizes session decisions, friction points, and learnings.",
	},
];

const TWEAKS: Tweak[] = TWEAK_DEFS.map(def => ({ ...def, setting: booleanSetting(def.name, def.title, def.description) }));

const isTweakEnabled = (name: string): boolean => {
	const tweak = TWEAKS.find(t => t.name === name);
	return tweak ? readSetting(tweak.setting) : false;
};

const CATEGORIES: readonly TweakCategory[] = ["Workflow", "Interface", "Quality of life"];

type ThemeLike = {
	fg: (color: ThemeColor, text: string) => string;
	bold: (text: string) => string;
};

type ToolMessage = {
	customType: string;
	content: string | unknown[];
	details?: {
		toolName: string;
		result: unknown;
		isError?: boolean;
		cwd?: string;
	};
};

type RendererOptions = {
	expanded?: boolean;
};

const DEFAULT_COLLAPSED_LINES = 5;
const collapsedLinesSetting = integerSetting(
	"collapsed-lines",
	"Collapsed tool card lines",
	"Lines shown in a collapsed tool card before the omission marker.",
	DEFAULT_COLLAPSED_LINES,
);

type ToolDisplayState = { collapsedLines: number; cardsOn: boolean };

type StructuredFormat = "json" | "yaml" | "toon" | "code" | "file" | "links" | "markdown" | "text" | "command" | "outline" | "edit-outline";

type StructuredText = {
	text: string;
	format: StructuredFormat;
	lang?: string;
	/** Filesystem path the first row names, for hyperlinking in tree layouts. */
	path?: string;
};

const TOON_ENCODER: ((result: unknown) => string) | undefined = encodeToon;

const CODE_KEYWORDS: Record<string, true> = {
	using: true, namespace: true, public: true, private: true, protected: true, internal: true,
	static: true, readonly: true, class: true, struct: true, interface: true, enum: true,
	void: true, return: true, new: true, if: true, else: true, switch: true, case: true,
	break: true, for: true, foreach: true, in: true, while: true, do: true, async: true,
	await: true, try: true, catch: true, finally: true, throw: true, typeof: true,
	override: true, virtual: true, abstract: true, sealed: true, get: true, set: true,
	var: true, is: true, as: true, null: true, true: true, false: true, this: true,
	base: true, import: true, export: true, from: true, const: true, let: true,
	function: true, def: true, elif: true, not: true, and: true, or: true, pass: true,
	yield: true, lambda: true,
};

const CODE_TYPES: Record<string, true> = {
	int: true, float: true, double: true, bool: true, string: true, char: true, byte: true,
	sbyte: true, short: true, ushort: true, uint: true, ulong: true, long: true, decimal: true,
	object: true, void: true, Vector2: true, Vector3: true, Vector4: true, Quaternion: true,
	Matrix4x4: true, Color: true, GameObject: true, Transform: true, MonoBehaviour: true,
	ScriptableObject: true, Mesh: true, Material: true, Texture: true, Action: true, Func: true,
	List: true, Dictionary: true, HashSet: true, Task: true, Promise: true, Array: true, Record: true,
};

function colorizeCodeLine(line: string, theme: ThemeLike): string {
	if (/^\s*(?:\/\/|#|--)/.test(line)) {
		return theme.fg("syntaxComment", line);
	}

	const tokenRegex = /("(?:\\.|[^"\\])*"|'[^'\\]*(?:\\.[^'\\]*)*'|\x60[^\x60\\]*(?:\\.[^\x60\\]*)*\x60|(?:\/\/|#|--).*$|\b\d+(?:\.\d+)?[fFmMdD]?\b|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*\/%=<>!&|^~?:]+)/g;

	return line.replace(tokenRegex, (match) => {
		if (match.startsWith("//") || match.startsWith("#") || match.startsWith("--")) {
			return theme.fg("syntaxComment", match);
		}
		const c = match.charCodeAt(0);
		if (c === 34 || c === 39 || c === 96) {
			return theme.fg("syntaxString", match);
		}
		if (/^\d/.test(match)) {
			return theme.fg("syntaxNumber", match);
		}
		if (CODE_KEYWORDS[match]) {
			return theme.fg("syntaxKeyword", match);
		}
		if (CODE_TYPES[match] || /^[A-Z][a-zA-Z0-9_]+$/.test(match)) {
			return theme.fg("syntaxType", match);
		}
		if (/^[+\-*\/%=<>!&|^~?:]+$/.test(match)) {
			return theme.fg("syntaxOperator", match);
		}
		return match;
	});
}

function parseGrepOutput(rawText: string): unknown {
	const lines = rawText.split(/\r?\n/);
	const matches: Array<{ line: number; match: string }> = [];
	const starMatches: Array<{ line: number; match: string }> = [];

	for (const line of lines) {
		const m = line.match(/^\s*(\*)?\s*(\d+)\|\s*(.*)$/);
		if (m) {
			const isStar = Boolean(m[1]);
			const lineNum = parseInt(m[2], 10);
			const matchText = m[3].trim();
			const item = { line: lineNum, match: matchText };
			if (isStar) starMatches.push(item);
			matches.push(item);
		}
	}

	const items = starMatches.length > 0 ? starMatches : matches;
	if (items.length > 0) {
		return {
			matches: items.slice(0, 16),
		};
	}
	return null;
}

function colorizeAstToonLine(line: string, theme: ThemeLike): string {
	const kvMatch = line.match(/^(\s*)(?:(-\s+))?([a-zA-Z0-9_]+(?:\[\d+\])?(?:\{[^}]+\})?):\s*(.*)$/);
	if (kvMatch) {
		const indent = kvMatch[1];
		const bullet = kvMatch[2] ? theme.fg("accent", "- ") : "";
		const key = kvMatch[3];
		const val = kvMatch[4];
		const coloredKey = theme.fg("syntaxKeyword", key);
		if (!val) return `${indent}${bullet}${coloredKey}:`;

		let coloredVal = val;
		if (val === "class" || val === "struct" || val === "interface" || val === "enum") {
			coloredVal = theme.fg("syntaxKeyword", val);
		} else if (/^[A-Z][a-zA-Z0-9_]+$/.test(val)) {
			coloredVal = theme.fg("syntaxType", val);
		} else {
			coloredVal = colorizeCodeLine(val, theme);
		}
		return `${indent}${bullet}${coloredKey}: ${coloredVal}`;
	}

	return colorizeCodeLine(line, theme);
}

/* -------------------------------------------------------------------------- */
/*                               Session Identity                             */
/* -------------------------------------------------------------------------- */

interface SessionColor {
	name: string;
	ansi: string;
	hex: string;
	themeColor: "accent" | "success" | "warning" | "error" | "info" | "muted";
}

const SESSION_PALETTE: readonly SessionColor[] = [
	{ name: "Cyan", ansi: "\x1b[96m", hex: "#06b6d4", themeColor: "accent" },
	{ name: "Emerald", ansi: "\x1b[92m", hex: "#10b981", themeColor: "success" },
	{ name: "Amber", ansi: "\x1b[93m", hex: "#f59e0b", themeColor: "warning" },
	{ name: "Violet", ansi: "\x1b[95m", hex: "#8b5cf6", themeColor: "accent" },
	{ name: "Coral", ansi: "\x1b[91m", hex: "#f43f5e", themeColor: "error" },
	{ name: "Azure", ansi: "\x1b[36m", hex: "#38bdf8", themeColor: "info" },
	{ name: "Indigo", ansi: "\x1b[34m", hex: "#6366f1", themeColor: "accent" },
	{ name: "Mint", ansi: "\x1b[32m", hex: "#14b8a6", themeColor: "success" },
	{ name: "Rose", ansi: "\x1b[35m", hex: "#ec4899", themeColor: "accent" },
	{ name: "Orange", ansi: "\x1b[33m", hex: "#f97316", themeColor: "warning" },
	{ name: "Lime", ansi: "\x1b[92m", hex: "#84cc16", themeColor: "success" },
	{ name: "Sky", ansi: "\x1b[94m", hex: "#0ea5e9", themeColor: "info" },
];

const CODENAMES = [
	"Vigil", "Beacon", "Chronos", "Horizon", "Pioneer", "Zephyr",
	"Aegis", "Solstice", "Polaris", "Kepler", "Nexus", "Prometheus",
	"Orion", "Helios", "Astral", "Vanguard", "Eclipse", "Cygnus",
	"Mirage", "Zenith", "Specter", "Nova", "Titan", "Aurora"
] as const;

const SIGILS = ["◆", "▲", "●", "◈", "✦", "⬡", "★", "⬢"] as const;

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

function getSessionIdentity(sessionId: string) {
	const hash = hashString(sessionId || "default-session");
	const color = SESSION_PALETTE[hash % SESSION_PALETTE.length];
	const codename = CODENAMES[(hash >> 3) % CODENAMES.length];
	const sigil = SIGILS[(hash >> 6) % SIGILS.length];
	return { color, codename, sigil, id: sessionId };
}

/* -------------------------------------------------------------------------- */
/*                              System Monitors                               */
/* -------------------------------------------------------------------------- */

type MonitorWhen = "output" | "changed" | "match" | "exit_zero" | "exit_nonzero" | "always";
const MONITOR_WHEN: readonly MonitorWhen[] = ["output", "changed", "match", "exit_zero", "exit_nonzero", "always"];

interface MonitorSpec {
	name: string;
	to: string;
	from: string;
	/** Fixed poll interval. Omit for adaptive: 5s, doubling while quiet, capped at 120s, reset on activity. */
	intervalSec?: number;
	command?: string;
	message?: string;
	when: MonitorWhen;
	pattern?: string;
	once: boolean;
	urgent: boolean;
}

const MONITOR_BASE_SEC = 5;
const MONITOR_MAX_SEC = 120;

interface ActiveMonitor extends MonitorSpec {
	timer: NodeJS.Timeout | number;
	currentSec: number;
	runCount: number;
	reportCount: number;
	lastRun?: number;
	lastOutput?: string;
}

interface MonitorRun {
	stdout: string;
	stderr: string;
	output: string;
	code: number;
	match: RegExpMatchArray | null;
}

const activeMonitors = new Map<string, ActiveMonitor>();

// Decides whether one tick earns a report. `changed` compares against the last tick's
// output, so the first tick reports only when there is output to compare later.
function monitorShouldReport(mon: ActiveMonitor, run: MonitorRun): boolean {
	switch (mon.when) {
		case "always": return true;
		case "output": return run.output.length > 0;
		case "changed": return mon.lastOutput !== undefined && run.output !== mon.lastOutput;
		case "match": return run.match !== null;
		case "exit_zero": return run.code === 0;
		case "exit_nonzero": return run.code !== 0;
	}
}

// Fills `{var}` slots in the message template from the tick's context.
// Unknown slots are left as written so a typo is visible in the delivered message.
function renderMonitorMessage(mon: ActiveMonitor, run: MonitorRun): string {
	const template = mon.message || (mon.command ? "{output}" : "Monitor {name} heartbeat.");
	const vars: Record<string, string> = {
		name: mon.name,
		command: mon.command ?? "",
		stdout: run.stdout,
		stderr: run.stderr,
		output: run.output,
		code: String(run.code),
		run: String(mon.runCount),
		time: new Date().toLocaleTimeString(),
		match: run.match?.[0] ?? "",
		prev: mon.lastOutput ?? "",
	};
	run.match?.forEach((group, index) => { vars[String(index)] = group ?? ""; });
	if (run.match?.groups) { Object.assign(vars, run.match.groups); }
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (slot, key: string) => (key in vars ? vars[key] : slot));
}

function stopMonitor(name: string): boolean {
	const existing = activeMonitors.get(name);
	if (!existing) return false;
	clearTimeout(existing.timer);
	activeMonitors.delete(name);
	return true;
}

function listMonitors() {
	return Array.from(activeMonitors.values()).map((m) => ({
		name: m.name,
		to: m.to,
		from: m.from,
		cadence: m.intervalSec === undefined ? `adaptive (now ${m.currentSec}s)` : `${m.intervalSec}s`,
		when: m.when,
		pattern: m.pattern,
		once: m.once,
		command: m.command,
		message: m.message,
		runs: m.runCount,
		reports: m.reportCount,
		lastRun: m.lastRun ? new Date(m.lastRun).toLocaleTimeString() : "none",
	}));
}

function startMonitor(pi: ExtensionAPI, spec: MonitorSpec): ActiveMonitor {
	stopMonitor(spec.name);
	const regex = spec.pattern ? new RegExp(spec.pattern) : null;

	const tick = async () => {
		const mon = activeMonitors.get(spec.name);
		if (!mon) return;
		mon.runCount++;
		mon.lastRun = Date.now();

		let run: MonitorRun = { stdout: "", stderr: "", output: "", code: 0, match: null };
		if (mon.command) {
			try {
				const result = await pi.exec("sh", ["-c", mon.command], { timeout: 15_000 });
				const stdout = (result.stdout || "").trim();
				const stderr = (result.stderr || "").trim();
				run = { stdout, stderr, output: stdout || stderr, code: result.code ?? 0, match: null };
			} catch (err) {
				const stderr = err instanceof Error ? err.message : String(err);
				run = { stdout: "", stderr, output: stderr, code: -1, match: null };
			}
		}
		if (regex) { run.match = run.output.match(regex); }

		const report = monitorShouldReport(mon, run);
		const body = report ? renderMonitorMessage(mon, run) : "";
		const changed = mon.lastOutput !== undefined && run.output !== mon.lastOutput;
		mon.lastOutput = run.output;
		// Adaptive cadence: anything interesting snaps back to the base; silence backs off fast.
		if (mon.intervalSec === undefined) {
			mon.currentSec = report || changed ? MONITOR_BASE_SEC : Math.min(MONITOR_MAX_SEC, mon.currentSec * 2);
		}
		if (activeMonitors.get(mon.name) === mon) { mon.timer = setTimeout(tick, mon.currentSec * 1000); }
		if (!report) return;

		mon.reportCount++;
		if (mon.once) { stopMonitor(mon.name); }

		pi.sendMessage(
			{
				customType: "irc:incoming",
				content: `[Monitor:${mon.name} (${mon.from})] ${body}`,
				details: {
					id: `mon_${mon.name}_${Date.now()}`,
					from: mon.from,
					to: mon.to,
					message: body,
					monitor: mon.name,
					code: run.code,
					stopped: mon.once,
				},
				display: true,
			},
			{
				deliverAs: mon.urgent ? "steer" : "aside",
				triggerTurn: true,
			},
		);
	};

	const currentSec = spec.intervalSec ?? MONITOR_BASE_SEC;
	const mon: ActiveMonitor = { ...spec, timer: 0, currentSec, runCount: 0, reportCount: 0 };
	mon.timer = setTimeout(tick, currentSec * 1000);
	activeMonitors.set(spec.name, mon);
	return mon;
}

/* -------------------------------------------------------------------------- */
/*                          Structured Results & Panels                       */
/* -------------------------------------------------------------------------- */

function prettifyYaml(value: string): string {
	const lines = value.trim().split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ""));
	const contentLines = lines.filter((line) => line.trim().length > 0);
	if (contentLines.length === 0) return "";
	const minimumIndent = Math.min(
		...contentLines.map((line) => (line.match(/^[ \t]*/) ?? [""])[0].replace(/\t/g, "  ").length),
	);
	return lines.map((line) => line.slice(Math.min(minimumIndent, line.length))).join("\n");
}

function isLikelyCode(text: string): boolean {
	return /(?:;\s*$|[{}]|\b(?:using|namespace|class|interface|public|private|protected|import|export|function|const|let|var|def|fn|return)\b|\/\/|\/\*)/m.test(text);
}

interface ToolResultBlock {
	type?: string;
	text?: string;
}

interface ToolResultEnvelope {
	content?: ToolResultBlock[];
	details?: {
		jsonOutputs?: unknown[];
		data?: unknown;
		result?: unknown;
		[key: string]: unknown;
	};
}

function extractToolPayload(event: { toolName: string; result: unknown }): unknown {
	const result = event.result;
	if (!result || typeof result !== "object") return result;

	const envelope = result as ToolResultEnvelope;
	if (Array.isArray(envelope.content)) {
		const textParts = envelope.content
			.filter((c): c is ToolResultBlock & { text: string } => c?.type === "text" && typeof c.text === "string")
			.map((c) => c.text);
		const rawText = textParts.join("\n");

		if (event.toolName === "eval" && Array.isArray(envelope.details?.jsonOutputs)) {
			const jsonOutputs = envelope.details.jsonOutputs;
			if (jsonOutputs.length > 0) {
				if (jsonOutputs.length === 1) {
					const item = jsonOutputs[0];
					if (
						item &&
						typeof item === "object" &&
						"text" in item &&
						Object.keys(item).length === 1
					) {
						const textVal = (item as Record<string, unknown>).text;
						if (typeof textVal === "string" && textVal.includes("\n")) {
							return textVal;
						}
					}
					return item;
				}
				return jsonOutputs;
			}
		}

		const displayMatch = /^display\[\d+\]:\s*\n([\s\S]*)$/.exec(rawText.trim());
		if (displayMatch) {
			const body = displayMatch[1].trim();
			try {
				const parsed: unknown = JSON.parse(body);
				if (
					parsed &&
					typeof parsed === "object" &&
					"text" in parsed &&
					Object.keys(parsed).length === 1
				) {
					const textVal = (parsed as Record<string, unknown>).text;
					if (typeof textVal === "string" && textVal.includes("\n")) {
						return textVal;
					}
				}
				return parsed;
			} catch {
				return body;
			}
		}

		if (event.toolName === "grep") {
			const grepParsed = parseGrepOutput(rawText);
			if (grepParsed) return grepParsed;
		}

		const trimmedRaw = rawText.trim();
		if (trimmedRaw.startsWith("{") || trimmedRaw.startsWith("[")) {
			try {
				return JSON.parse(trimmedRaw);
			} catch {
				// Not JSON, fall through
			}
		}

		if (rawText.length > 0) return rawText;
	}

	if (envelope.details && typeof envelope.details === "object") {
		if (envelope.details.data !== undefined) return envelope.details.data;
		if (envelope.details.result !== undefined) return envelope.details.result;
	}

	return result;
}

function structuredResult(result: unknown): StructuredText {
	if (typeof result === "string") {
		const search = formatSearchOutput(result);
		if (search !== undefined) return { text: search, format: "text" };
	}
	if (typeof result === "string" && isFileExcerpt(result)) {
		return { text: formatFileExcerpt(result), format: "text" };
	}
	const target = decodeNestedJson(result);
	const useToon = isTweakEnabled("tool-results-toon");

	if (target !== null && typeof target === "object") {
		if (useToon && TOON_ENCODER) {
			try {
				return formatJsonOutput(target);
			} catch {
				// Fall through
			}
		}
		try {
			return { text: JSON.stringify(target, null, 2) ?? String(target), format: "json" };
		} catch {
			return { text: String(target), format: "text" };
		}
	}

	if (typeof result === "string") {
		if (useToon && TOON_ENCODER) {
			const timedJson = formatJsonWithFooter(result);
			if (timedJson) return timedJson;
		}
		if (!isLikelyCode(result) && (result.trim().startsWith("---") || /^(?:[a-zA-Z0-9_-]+:\s.*|[ \t]*-\s.*)$/m.test(result))) {
			try {
				const parsedYaml = parseYaml(result);
				if (parsedYaml !== null && typeof parsedYaml === "object") {
					if (useToon && TOON_ENCODER) {
						try {
							return formatJsonOutput(decodeNestedJson(parsedYaml));
						} catch {}
					}
					return { text: prettifyYaml(result), format: "yaml" };
				}
			} catch {
				// Preserve malformed or ambiguous text verbatim.
			}
		}

		// Output that reads as code keeps syntax colour but is never rewritten: real outlines
		// come from the tree-sitter read/edit cards, not from guessing at command output.
		if (isLikelyCode(result)) return { text: result, format: "code" };
	}

	return { text: String(result), format: "text" };
}

// Joined text blocks of a tool result: the same view the native card and the model start from.
function toolResultText(content: unknown): string | undefined {
	if (!Array.isArray(content)) return undefined;
	const texts: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object" || !("type" in block) || block.type !== "text" || !("text" in block)) continue;
		if (typeof block.text === "string") texts.push(block.text);
	}
	return texts.length === 0 ? undefined : texts.join("\n");
}

// Complete JSON tool output, including `display[N]:`-prefixed eval results, encoded as TOON for
// the model. Undefined when the text is not one JSON document or when TOON would not be a plain
// body (command results, artifact previews, excerpts), so those results reach the model verbatim.
function toonForModel(text: string): string | undefined {
	const trimmed = text.trim();
	if (!/^(?:display\[\d+\]:\s*)?[\[{]/.test(trimmed)) return undefined;
	const decoded = decodeNestedJson(trimmed);
	if (decoded === null || typeof decoded !== "object") return undefined;
	try {
		const output = formatJsonOutput(decoded);
		return output.format === "toon" ? output.text : undefined;
	} catch {
		return undefined;
	}
}

// True when OMP's own card already draws this result as a JSON tree: the tool (or the xd://
// device behind a write) has no bespoke renderer and the text is one JSON document.
function nativeRendersJsonTree(toolName: string, args: unknown, text: string | undefined): boolean {
	if (text === undefined) return false;
	const trimmed = text.trimEnd();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
	try { JSON.parse(trimmed); } catch { return false; }
	let rendererName = toolName;
	if (toolName === "write" && args && typeof args === "object" && "path" in args && typeof args.path === "string" && args.path.startsWith("xd://")) {
		rendererName = args.path.slice("xd://".length).split(/[/?#]/)[0] || toolName;
	}
	return !(rendererName in toolRenderers);
}

function colorizeOutlineLine(line: string, theme: ThemeLike): string {
	const header = /^(\S[^·]*?)( · .*)$/.exec(line);
	if (header) return `${theme.fg("accent", header[1])}${theme.fg("dim", header[2])}`;
	const fold = /^(\s*)(⋯\d+)$/.exec(line);
	if (fold) return `${fold[1]}${theme.fg("muted", fold[2])}`;
	const row = /^(\s*)(.*?)(  ⋯\d+)?$/.exec(line);
	if (row) return `${row[1]}${colorizeCodeLine(row[2], theme)}${row[3] ? theme.fg("muted", row[3]) : ""}`;
	return line;
}

const EDIT_MARKER_COLOR: Record<string, ThemeColor> = { "~": "warning", "+": "success", "−": "error", "→": "accent" };

function colorizeEditOutlineLine(line: string, theme: ThemeLike): string {
	const header = /^(\S[^·]*?)( · .*)$/.exec(line);
	if (header) return `${theme.fg("accent", header[1])}${theme.fg("dim", header[2])}`;
	const diagnosticsHeading = /^ ! (Diagnostics.*)$/.exec(line);
	if (diagnosticsHeading) return ` ${theme.fg("error", "!")} ${theme.fg("warning", diagnosticsHeading[1])}`;
	const diagnostic = /^(\s{5})([✖⚠ℹ·]) (.*)$/.exec(line);
	if (diagnostic) {
		const color: ThemeColor = diagnostic[2] === "✖" ? "error" : diagnostic[2] === "⚠" ? "warning" : "dim";
		return `${diagnostic[1]}${theme.fg(color, diagnostic[2])} ${theme.fg(color, diagnostic[3])}`;
	}
	const detail = /^(\s{3,})([+−→]) (.*)$/.exec(line);
	if (detail) return `${detail[1]}${theme.fg(EDIT_MARKER_COLOR[detail[2]], detail[2])} ${colorizeCodeLine(detail[3], theme)}`;
	const row = /^ ([~+− ]) (\s*)(.*?)(  \([+−][\d −+]*\))?$/.exec(line);
	if (row) {
		const marker = row[1] === " " ? " " : theme.fg(EDIT_MARKER_COLOR[row[1]], row[1]);
		const signature = row[1] === " " || row[3] === "(top level)" ? theme.fg("dim", row[3]) : colorizeCodeLine(row[3], theme);
		return ` ${marker} ${row[2]}${signature}${row[4] ? theme.fg(EDIT_MARKER_COLOR[row[1]], row[4]) : ""}`;
	}
	return line;
}

function colorizeStructuredLine(line: string, format: StructuredFormat, theme: ThemeLike): string {
	if (format === "links") return line;
	if (format === "outline") return colorizeOutlineLine(line, theme);
	if (format === "edit-outline") return colorizeEditOutlineLine(line, theme);
	if (format === "command") {
		if (/^\s*Result(?: \d+)?(?:;|$)/.test(line)) return theme.fg(/; failed(?:;|$)/.test(line) ? "error" : "accent", line);
		return line;
	}
	if (/^\s*(?:\[[^\]\r\n]+#[\da-f]+\]|#{1,6} .+#[\da-f]+|#{1,6} .+\/)\s*$/i.test(line)) return theme.fg("dim", line);
	if (/^\s*\[(?:Showing lines|truncated;|Source:)/.test(line) || /^\s*(?:…|\.\.\.)\s*$/.test(line)) return theme.fg("dim", line);
	if (format === "file") {
		return /^\s*[\w$]+(?:\[\d+\])?(?:\{[^}]+\})?:\s/.test(line)
			? colorizeAstToonLine(line, theme) : colorizeCodeLine(line, theme);
	}
	if (format === "toon") {
		return colorizeAstToonLine(line, theme);
	}
	if (format === "code") {
		return colorizeCodeLine(line, theme);
	}
	const token = /^(\s*)(.*)$/.exec(line);
	if (!token) return line;
	const [, indent, value] = token;
	const colored = value.replace(
		format === "yaml"
			? /^(\s*(?:-\s+)?)([^:#\n]+)(:)(.*)$/
			: /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g,
		(...matches: string[]) => {
			if (format === "yaml") {
				const [, prefix, key, colon, rest] = matches;
				return `${prefix}${theme.fg("accent", key.trim())}${colon}${rest}`;
			}
			const [, key, string, number, literal] = matches;
			if (key) return theme.fg("accent", key);
			if (string) return theme.fg("success", string);
			if (number) return theme.fg("warning", number);
			return theme.fg(literal === "null" ? "muted" : "syntaxKeyword", literal);
		},
	);
	return indent + colored;
}

// Tool-card styling. Truecolor lime label (#84cc16) on a deep blue block (#0f1d3a);
// the theme palette has neither slot.
const TOOL_NAME_ANSI = "\x1b[1;38;2;132;204;22m";
const TOOL_BLOCK_BG = "\x1b[48;2;15;29;58m";
const ANSI_RESET = "\x1b[0m";

// Paints one card line edge to edge: pad to the full width, and re-arm the background
// after every full reset that inner theme colors emit.
function paintToolBlockLine(line: string, width: number): string {
	const visible = visibleWidth(line);
	const padded = line + " ".repeat(Math.max(0, width - visible));
	const rearmed = padded.replace(/\x1b\[(?:0|49)m/g, (m) => `${m}${TOOL_BLOCK_BG}`);
	return `${TOOL_BLOCK_BG}${rearmed}${ANSI_RESET}`;
}

type ToolCardDetails = NonNullable<ToolMessage["details"]>;

// Which hydemods layout a result gets. "text" means hydemods has nothing structural to add.
function structureToolResult(details: ToolCardDetails | undefined): StructuredText {
	const result = details?.result;
	const references = referenceLocations(result);
	const markdownText = markdownOutput(result);
	const structured: StructuredText = references ? {
		text: references.locations.map(location => {
			const path = location.path.startsWith("~/") ? resolve(homedir(), location.path.slice(2)) : resolve(details?.cwd ?? process.cwd(), location.path);
			return fileHyperlink(path, `${location.path}:${location.line}:${location.column}`, { line: location.line });
		}).concat(references.incomplete ? ["…"] : []).join("\n"),
		format: "links",
	} : markdownText !== undefined ? { text: markdownText, format: "markdown" } : structuredResult(result);
	if (structured.format === "text" && markdownOutput(structured.text) !== undefined) structured.format = "markdown";
	if (structured.format !== "links" && structured.format !== "markdown" && structured.format !== "command" && isFileExcerpt(structured.text)) structured.format = "file";
	return structured;
}

function toolMessageRenderer(message: ToolMessage, options: RendererOptions, theme: Theme, display: ToolDisplayState, structured: StructuredText = structureToolResult(message.details)) {
	const details = message.details;
	const toolName = details?.toolName || "tool";
	const error = details?.isError;
	const pretty = structured.text.trim() || "(empty)";
	const rawLines = pretty
		.split(/\r?\n/)
		.map((line) => line.replace(/\t/g, "  ").trimEnd())
		.filter((line) => structured.format === "command" || line.length > 0);

	const prefixSymbol = error ? "✖" : "▶";
	const label = `${theme.fg(error ? "error" : "accent", prefixSymbol)} ${TOOL_NAME_ANSI}${toolName}${ANSI_RESET}`;
	const coloredPrefix = `${label} `;
	// Continuation lines hang under the first content column (visible width of "▶ name ").
	const hangingIndent = " ".repeat(`${prefixSymbol} ${toolName} `.length);

	const markdown = structured.format === "markdown"
		? new Markdown(pretty.replace(/^(\[[^\]\r\n]+#[\da-f]+\]|\[(?:Source:|Showing lines|truncated;)[^\r\n]*\])$/gim, line => theme.fg("dim", line)), 0, 0, getMarkdownTheme(), { color: text => theme.fg("text", text) })
		: undefined;
	// A failed result keeps the standard layout; the error colour is what says it failed.
	const contentLines = markdown ? [] : rawLines.map(line => error ? theme.fg("error", line) : colorizeStructuredLine(line, structured.format, theme));
	const heading = `${label} · expanded ${structured.lang || structured.format} output`;
	return {
		render(width: number): readonly string[] {
			const expanded = options.expanded === true;
			const renderedContent = markdown
				? markdown.render(Math.max(1, width - (expanded ? 2 : visibleWidth(coloredPrefix))))
				: contentLines;
			if (expanded) {
				return [heading, ...renderedContent.map(line => `  ${line}`)]
					.flatMap(line => wrapTextWithAnsi(line, width))
					.map(line => paintToolBlockLine(line, width));
			}
			const limit = display.collapsedLines;
			// Collapsed edit cards are the declaration tree; the change lines wait for expansion.
			// Diagnostics sit below the tree and stay visible: the heading and the first few messages.
			const diagnosticsAt = structured.format === "edit-outline" ? rawLines.findIndex(line => /^ ! Diagnostics/.test(line)) : -1;
			const tree = diagnosticsAt >= 0 ? renderedContent.slice(0, diagnosticsAt) : renderedContent;
			let selected = structured.format === "edit-outline"
				? tree.filter((_, index) => !/^\s{3,}[+−→] /.test(rawLines[index]))
				: tree;
			if (selected.length > limit) {
				if (structured.format === "outline" || structured.format === "edit-outline") {
					// Outline rows are a list: the last row carries no summary, so count the rest.
					const shown = Math.max(1, limit - 1);
					selected = [...selected.slice(0, shown), theme.fg("muted", `… ${selected.length - shown} more`)];
				} else {
					const omission = theme.fg("muted", "…");
					selected = limit < 3
						? [...renderedContent.slice(0, limit - 1), omission]
						: [...renderedContent.slice(0, limit - 2), omission, renderedContent[renderedContent.length - 1]];
				}
			}
			if (diagnosticsAt >= 0) {
				const messages = renderedContent.slice(diagnosticsAt + 1);
				const kept = messages.slice(0, 3);
				selected = [...selected, renderedContent[diagnosticsAt], ...kept];
				if (messages.length > kept.length) selected.push(theme.fg("muted", `       … ${messages.length - kept.length} more`));
			}
			return selected.map((line, index) =>
				paintToolBlockLine(truncateToWidth(`${index === 0 ? coloredPrefix : hangingIndent}${line}`, width), width));
		},
		invalidate() { markdown?.invalidate(); },
	};
}

// A context_notes write acknowledges with one line; the notebook itself is what the card
// should show. Reads already return the notebook as the result.
function notebookPayload(toolName: string, args: unknown, isError: boolean | undefined): string | undefined {
	if (isError || toolName !== "context_notes") return;
	const text = (args as { text?: unknown } | undefined)?.text;
	return typeof text === "string" && text.trim() ? text : undefined;
}

/* ------------------------- declaration outlines ------------------------- */

// Outlines are pure functions of file content; keep the latest few so repaints and history
// replays do not re-parse.
const OUTLINE_MEMO_LIMIT = 64;
const outlineMemo = new Map<string, Outline | undefined>();

function memoOutline(key: string, code: string, path: string | undefined): Outline | undefined {
	if (outlineMemo.has(key)) return outlineMemo.get(key);
	let outline: Outline | undefined;
	try {
		outline = outlineSource(code, { path }, summarizeCode);
	} catch {
		outline = undefined;
	}
	if (outlineMemo.size >= OUTLINE_MEMO_LIMIT) outlineMemo.delete(outlineMemo.keys().next().value!);
	outlineMemo.set(key, outline);
	return outline;
}

function displayPath(path: string): string {
	const cwd = process.cwd();
	if (path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
	const home = homedir();
	return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

type ReadOutlineDetails = {
	kind?: string;
	resolvedPath?: string;
	displayTarget?: string;
	totalLines?: number;
	truncation?: { truncated?: boolean };
	displayContent?: { text: string; startLine?: number; lineNumbers?: Array<number | null> };
	meta?: { source?: { type?: string; value?: unknown } };
};

// Once a read has an outline it keeps it: the transcript repaints the same result object long
// after the file it came from has been edited again.
const readOutlineByResult = new WeakMap<object, StructuredText>();

// A file read as a declaration outline. Whole-file reads outline the returned text; ranges
// outline the file on disk, but only where the disk still holds the lines the read returned.
function readOutlineStructured(result: { content: unknown; details?: unknown }, args: unknown): StructuredText | undefined {
	const remembered = readOutlineByResult.get(result);
	if (remembered) return remembered;
	const structured = computeReadOutline(result, args);
	if (structured) readOutlineByResult.set(result, structured);
	return structured;
}

function computeReadOutline(result: { content: unknown; details?: unknown }, args: unknown): StructuredText | undefined {
	const details = (result.details ?? undefined) as ReadOutlineDetails | undefined;
	const text = details?.displayContent?.text;
	if (typeof text !== "string" || !text.trim() || (details?.kind && details.kind !== "file")) return undefined;
	const rawPath = (args as { path?: unknown; file_path?: unknown } | undefined);
	const target = typeof rawPath?.path === "string" ? rawPath.path : typeof rawPath?.file_path === "string" ? rawPath.file_path : "";
	const split = splitPathAndSel(target);
	const source = readSourceFsPath(details as Parameters<typeof readSourceFsPath>[0]) ?? details?.resolvedPath ?? details?.displayTarget ?? split.path;
	if (!source || /^[a-z][a-z0-9+.-]*:\/\//i.test(source)) return undefined;
	const fsPath = source.startsWith("~/") ? resolve(homedir(), source.slice(2)) : resolve(source);
	const label = displayPath(split.path.startsWith("~/") ? resolve(homedir(), split.path.slice(2)) : resolve(split.path));
	// A range ending on a blank line ends the text with "\n"; `lineNumbers` counts that row.
	const shown = text.split("\n");
	if (!details?.displayContent?.lineNumbers && shown[shown.length - 1] === "") shown.pop();
	const startLine = details?.displayContent?.startLine ?? 1;
	const whole = startLine === 1 && !details?.truncation?.truncated && (details?.totalLines === undefined || Math.abs(details.totalLines - shown.length) <= 1);
	if (whole) {
		const outline = memoOutline(`text:${fsPath}:${Bun.hash(text)}`, text, fsPath);
		if (!outline || outline.declarations.length === 0) return undefined;
		return { text: renderOutline(outline, label).join("\n"), format: "outline", lang: outline.language, path: fsPath };
	}
	let disk: string;
	let stamp: string;
	try {
		const stat = statSync(fsPath);
		stamp = `${stat.size}:${stat.mtimeMs}`;
		disk = readFileSync(fsPath, "utf8");
	} catch {
		return undefined;
	}
	const diskLines = disk.split(/\r?\n/);
	// OMP pads a range with context and elides the gap as a `…` row; `lineNumbers` maps each
	// shown row to its source line (null for the elision).
	const numbers = details?.displayContent?.lineNumbers ?? shown.map((_, index) => startLine + index);
	if (numbers.length !== shown.length) return undefined;
	const numbered = numbers.filter((line): line is number => line !== null);
	if (numbered.length === 0) return undefined;
	// The requested lines, not the padded ones: `:50-60`, `:50`, `:50+10`, or several joined by commas.
	const parts = (split.sel ?? "").split(",").map(part => /^(\d+)(?:-(\d+)|\+(\d+))?$/.exec(part.trim())).filter((part): part is RegExpExecArray => part !== null);
	const requestedStart = Math.max(parts.length ? Math.min(...parts.map(part => Number(part[1]))) : -Infinity, Math.min(...numbered));
	const requestedEnd = Math.min(parts.length
		? Math.max(...parts.map(part => part[2] ? Number(part[2]) : part[3] ? Number(part[1]) + Number(part[3]) - 1 : Number(part[1])))
		: Infinity, Math.max(...numbered));
	if (requestedStart > requestedEnd) return undefined;
	// Only the requested lines must still be on disk; the padding is context OMP added and an
	// edit right beside the range rewrites it without touching what was read.
	const requested = numbers.map((line, index) => line !== null && line >= requestedStart && line <= requestedEnd ? index : -1).filter(index => index >= 0);
	if (requested.length === 0) return undefined;
	// Each contiguous run of requested lines is located on its own: an edit between two ranges
	// of one read moves the later range without touching the earlier one.
	const segments: number[][] = [];
	for (const index of requested) {
		const current = segments[segments.length - 1];
		if (current && numbers[index] === numbers[current[current.length - 1]]! + 1) current.push(index);
		else segments.push([index]);
	}
	const locate = (segment: number[]): number | undefined => {
		const matchesAt = (offset: number) => segment.every(index => {
			const at = numbers[index]! + offset;
			return at >= 1 && at <= diskLines.length && diskLines[at - 1].trimEnd() === shown[index].trimEnd();
		});
		if (matchesAt(0)) return 0;
		const anchorIndex = segment.find(index => shown[index].trim().length > 0);
		if (anchorIndex === undefined) return undefined;
		const anchorLine = numbers[anchorIndex]!;
		const anchorText = shown[anchorIndex].trimEnd();
		for (let line = 1; line <= diskLines.length; line++) {
			if (diskLines[line - 1].trimEnd() === anchorText && matchesAt(line - anchorLine)) return line - anchorLine;
		}
		return undefined;
	};
	const offsets = segments.map(locate);
	if (offsets.some(offset => offset === undefined)) return undefined;
	const first = segments[0];
	const last = segments[segments.length - 1];
	const rangeStart = numbers[first[0]]! + offsets[0]!;
	const endLine = numbers[last[last.length - 1]]! + offsets[offsets.length - 1]!;
	const outline = memoOutline(`disk:${fsPath}:${stamp}`, disk, fsPath);
	if (!outline) return undefined;
	const rows = renderRange(outline, diskLines, rangeStart, endLine, label);
	return rows ? { text: rows.join("\n"), format: "outline", lang: outline.language, path: fsPath } : undefined;
}

type EditOutlineDetails = {
	diff?: string;
	path?: string;
	oldText?: string;
	newText?: string;
	snapshotsPruned?: boolean;
	perFileResults?: Array<{ diagnostics?: DiagnosticsLike }>;
	diagnostics?: DiagnosticsLike;
};

type DiagnosticsLike = { summary?: string; messages?: string[]; errored?: boolean };

const DIAGNOSTIC_GLYPH: Record<string, string> = { error: "✖", warning: "⚠", information: "ℹ", info: "ℹ", hint: "·" };

// LSP diagnostics as rows under the outline: a `!` heading with the summary, then one row per
// message with a severity glyph. The file is dropped from messages about the edited file, since
// the card heading already names it.
function diagnosticsRows(diagnostics: DiagnosticsLike | undefined, path: string | undefined): string[] {
	const messages = diagnostics?.messages ?? [];
	if (messages.length === 0) return [];
	const rows = [` ! Diagnostics${diagnostics?.summary ? ` (${diagnostics.summary})` : ""}`];
	for (const message of messages) {
		const parsed = /^(.+?):(\d+):(\d+) \[(\w+)\] (.*)$/.exec(message);
		if (!parsed) {
			rows.push(`     · ${message}`);
			continue;
		}
		const [, file, line, column, severity, text] = parsed;
		const own = path !== undefined && (path.endsWith(file) || file.endsWith(path));
		rows.push(`     ${DIAGNOSTIC_GLYPH[severity.toLowerCase()] ?? "·"} ${own ? "" : `${file}:`}${line}:${column} ${text}`);
	}
	return rows;
}

const editOutlineMemo = new Map<string, StructuredText | undefined>();

// An edit as the declarations it touched. Multi-file batches keep the native card. When the
// engine pruned the snapshots (large files), the file on disk stands in for the new text and
// the old text is rebuilt from it and the diff, as long as the diff still fits the disk.
function editOutlineStructured(result: { content: unknown; details?: unknown }): StructuredText | undefined {
	const details = (result.details ?? undefined) as EditOutlineDetails | undefined;
	if (!details || typeof details.diff !== "string" || !details.diff.trim() || (details.perFileResults?.length ?? 0) > 1) return undefined;
	const path = typeof details.path === "string" ? details.path : undefined;
	const diagnostics = details.diagnostics ?? details.perFileResults?.[0]?.diagnostics;
	// Diagnostics can be filled in after the edit settles, so they are part of the memo key.
	const diagnosticsKey = Bun.hash(JSON.stringify(diagnostics?.messages ?? [])).toString();
	let newText = details.newText;
	let oldText = details.oldText;
	let key: string;
	if (typeof newText === "string") {
		key = `${path ?? ""}:${Bun.hash(details.diff)}:${Bun.hash(newText)}:${diagnosticsKey}`;
	} else {
		if (!path) return undefined;
		try {
			const stat = statSync(path);
			key = `${path}:${Bun.hash(details.diff)}:disk:${stat.size}:${stat.mtimeMs}:${diagnosticsKey}`;
			if (editOutlineMemo.has(key)) return editOutlineMemo.get(key);
			newText = readFileSync(path, "utf8");
		} catch {
			return undefined;
		}
		oldText = recoverOldText(newText, details.diff);
		if (oldText === undefined) return undefined;
	}
	if (editOutlineMemo.has(key)) return editOutlineMemo.get(key);
	let structured: StructuredText | undefined;
	try {
		const rows = renderEditOutline({ oldText: oldText ?? "", newText, diff: details.diff, path }, path ? displayPath(path) : "edit", summarizeCode);
		structured = rows ? { text: [...rows, ...diagnosticsRows(diagnostics, path)].join("\n"), format: "edit-outline", path } : undefined;
	} catch {
		structured = undefined;
	}
	if (editOutlineMemo.size >= OUTLINE_MEMO_LIMIT) editOutlineMemo.delete(editOutlineMemo.keys().next().value!);
	editOutlineMemo.set(key, structured);
	return structured;
}

/* --------------------------- grouped read cards --------------------------- */

type ReadResultLike = { content: Array<{ type: string; text?: string }>; details?: unknown; isError?: boolean };
type ReadGroupState = {
	entries: Map<string, { args: unknown; result?: ReadResultLike }>;
	usage: Map<string, { usage: Usage; durationMs?: number; ttftMs?: number; timestamp?: number; turnElapsedMs?: number }>;
	expanded: boolean;
	visible: boolean;
};

// OMP folds consecutive reads into ReadToolGroupComponent, which draws its own summary rows and
// never consults toolRenderers. Record what each group is told, and draw the group as OMP does
// (`Read path` or `Read (N)` plus a tree) with each read's declaration outline nested under its
// path. Reads without an outline keep a bare path row; the group draws itself while any read is
// still pending. The class must come from `@oh-my-pi/pi-tui`: only host-mapped specifiers share
// the running instance, and a deeper import would patch a private copy.
function installReadGroupTakeover(takeover: CardTakeover): void {
	const states = new WeakMap<ReadToolGroupComponent, ReadGroupState>();
	const stateOf = (group: ReadToolGroupComponent): ReadGroupState => {
		let state = states.get(group);
		if (!state) {
			state = { entries: new Map(), usage: new Map(), expanded: false, visible: true };
			states.set(group, state);
		}
		return state;
	};
	const proto = ReadToolGroupComponent.prototype;
	const original = {
		updateArgs: proto.updateArgs,
		updateResult: proto.updateResult,
		renameEntry: proto.renameEntry,
		removeEntry: proto.removeEntry,
		attachUsage: proto.attachUsage,
		setExpanded: proto.setExpanded,
		setToolActivityVisible: proto.setToolActivityVisible,
		render: proto.render,
	};
	proto.updateArgs = function (args, toolCallId) {
		if (toolCallId) {
			const state = stateOf(this);
			const entry = state.entries.get(toolCallId);
			if (entry) entry.args = args;
			else state.entries.set(toolCallId, { args });
		}
		return original.updateArgs.call(this, args, toolCallId);
	};
	proto.updateResult = function (result, isPartial, toolCallId) {
		if (toolCallId && !isPartial) {
			const entry = stateOf(this).entries.get(toolCallId);
			if (entry) entry.result = result;
		}
		return original.updateResult.call(this, result, isPartial, toolCallId);
	};
	proto.renameEntry = function (oldId, newId) {
		const state = stateOf(this);
		const entry = state.entries.get(oldId);
		if (entry && oldId !== newId && !state.entries.has(newId)) {
			const reordered = [...state.entries].map(([key, value]) => [key === oldId ? newId : key, value] as const);
			state.entries = new Map(reordered);
		}
		return original.renameEntry.call(this, oldId, newId);
	};
	proto.removeEntry = function (toolCallId) {
		stateOf(this).entries.delete(toolCallId);
		return original.removeEntry.call(this, toolCallId);
	};
	proto.attachUsage = function (toolCallIds, usage, durationMs, ttftMs, timestamp, turnElapsedMs) {
		const state = stateOf(this);
		let anchor: string | undefined;
		for (const id of toolCallIds) if (state.entries.has(id)) anchor = id;
		if (anchor) state.usage.set(anchor, { usage, durationMs, ttftMs, timestamp, turnElapsedMs });
		return original.attachUsage.call(this, toolCallIds, usage, durationMs, ttftMs, timestamp, turnElapsedMs);
	};
	proto.setExpanded = function (expanded) {
		stateOf(this).expanded = expanded;
		return original.setExpanded.call(this, expanded);
	};
	proto.setToolActivityVisible = function (visible) {
		stateOf(this).visible = visible;
		return original.setToolActivityVisible.call(this, visible);
	};
	proto.render = function (width) {
		const state = states.get(this);
		if (!state || !state.visible || !takeover.active() || state.entries.size === 0) return original.render.call(this, width);
		const rows: ReadTreeRow[] = [];
		for (const [id, entry] of state.entries) {
			if (!entry.result || entry.result.isError) return original.render.call(this, width);
			rows.push({ id, ...readTreeRow(entry.result, entry.args) });
		}
		if (!rows.some(row => row.outline)) return original.render.call(this, width);
		return renderReadTree(rows, state, uiTheme, takeover.display, width);
	};
}

type ReadTreeRow = { id: string; header: string; outline?: string[] };

// One read as a tree row: the path line (hyperlinked when it names a file) and, when the read
// parses, its outline rows beneath.
function readTreeRow(result: ReadResultLike, args: unknown): Omit<ReadTreeRow, "id"> {
	const structured = readOutlineStructured(result, args);
	if (structured) {
		const [header, ...outline] = structured.text.split("\n");
		const colored = colorizeOutlineLine(header, uiTheme);
		return { header: structured.path ? fileHyperlink(structured.path, colored) : colored, outline };
	}
	const rawPath = args as { path?: unknown; file_path?: unknown } | undefined;
	const target = typeof rawPath?.path === "string" ? rawPath.path : typeof rawPath?.file_path === "string" ? rawPath.file_path : "";
	const split = splitPathAndSel(target);
	const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(split.path) ? target : `${displayPath(split.path.startsWith("~/") ? resolve(homedir(), split.path.slice(2)) : resolve(split.path))}${split.sel ? `:${split.sel}` : ""}`;
	return { header: uiTheme.fg("accent", shown) };
}

// Collapsed outlines keep the first rows and count the rest; expanded shows every row.
function outlineRows(outline: string[], expanded: boolean, limit: number, theme: Theme): string[] {
	const colored = outline.map(line => colorizeOutlineLine(line, theme));
	if (expanded || colored.length <= limit) return colored;
	const shown = Math.max(1, limit - 1);
	return [...colored.slice(0, shown), theme.fg("muted", `… ${colored.length - shown} more`)];
}

// Mirrors pi-tui's usage row, but against the theme handed to the renderer. The
// `overlays/usage-row` subpath is not host-mapped, so its copy of the theme
// singleton is never initialised and reading `theme.icon` there throws.
function formatUsageRow(theme: Theme, usage: Usage, durationMs?: number, ttftMs?: number, timestamp?: number, turnElapsedMs?: number): string {
	const specs: MetricSpec[] = [];
	if (timestamp !== undefined && Number.isFinite(timestamp) && timestamp > 0) {
		const d = new Date(timestamp);
		const pad = (n: number): string => String(n).padStart(2, "0");
		specs.push({ value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` });
	}
	if (turnElapsedMs !== undefined && turnElapsedMs > 0) specs.push({ value: `Δ ${formatDuration(Math.round(turnElapsedMs))}` });
	specs.push({ leading: theme.icon.input, value: formatNumber(usage.input + usage.cacheWrite) });
	specs.push({ leading: theme.icon.output, value: formatNumber(usage.output) });
	if (usage.cacheRead > 0) specs.push({ leading: theme.icon.cache, value: formatNumber(usage.cacheRead) });
	if (ttftMs && ttftMs > 0) specs.push({ leading: theme.icon.time, value: `${(ttftMs / 1000).toFixed(1)}s` });
	if (durationMs && durationMs > 100 && usage.output > 0) {
		specs.push({ leading: theme.icon.throughput, value: `${((usage.output / durationMs) * 1000).toFixed(1)}/s` });
	}
	return formatMetricRow(specs, { separator: "  " });
}

function renderReadTree(rows: ReadTreeRow[], state: ReadGroupState, theme: Theme, display: ToolDisplayState, width: number): string[] {
	const title = theme.fg("toolTitle", theme.bold("Read"));
	const usageLines = (id: string, prefix: string): string[] => {
		const row = state.usage.get(id);
		return row ? [theme.fg("dim", `${prefix}${formatUsageRow(theme, row.usage, row.durationMs, row.ttftMs, row.timestamp, row.turnElapsedMs)}`)] : [];
	};
	const lines: string[] = [];
	if (rows.length === 1) {
		const [row] = rows;
		lines.push(` ${theme.format.bullet} ${title} ${row.header}`);
		for (const line of outlineRows(row.outline ?? [], state.expanded, display.collapsedLines, theme)) lines.push(`   ${line}`);
		lines.push(...usageLines(row.id, "   "));
	} else {
		lines.push(` ${theme.format.bullet} ${title}${theme.fg("dim", ` (${rows.length})`)}`);
		rows.forEach((row, index) => {
			const last = index === rows.length - 1;
			const connector = last ? theme.tree.last : theme.tree.branch;
			const guide = last ? " ".repeat(visibleWidth(connector)) : `${theme.tree.vertical}${" ".repeat(Math.max(0, visibleWidth(connector) - visibleWidth(theme.tree.vertical)))}`;
			lines.push(`   ${theme.fg("dim", connector)} ${row.header}`);
			for (const line of outlineRows(row.outline ?? [], state.expanded, display.collapsedLines, theme)) lines.push(`   ${theme.fg("dim", guide)} ${line}`);
			lines.push(...usageLines(row.id, `   ${guide} `));
		});
	}
	return lines.map(line => truncateToWidth(line, width));
}

type CardTakeover = { active: () => boolean; display: ToolDisplayState };

// LSP diagnostics ride along in edit/write details (top level, in `meta`, or per file). The
// edit outline draws its own; any other hydemods view would drop them, so those results keep
// the native card and its diagnostics tree.
function carriesDiagnostics(details: unknown): boolean {
	if (!details || typeof details !== "object") return false;
	const record = details as { diagnostics?: unknown; meta?: { diagnostics?: unknown }; perFileResults?: unknown[] };
	if (record.diagnostics || record.meta?.diagnostics) return true;
	return Array.isArray(record.perFileResults) && record.perFileResults.some(carriesDiagnostics);
}

// The hydemods view of one settled result, or undefined when the native renderer should draw it:
// takeover off, still streaming, plain text hydemods cannot improve, or a JSON document OMP
// already shows as a tree. Failures get the same card in error colour rather than a different one.
function hydemodsResultComponent(toolName: string, result: { content: unknown; details?: unknown; isError?: boolean }, options: { expanded: boolean; isPartial: boolean }, theme: Theme, args: unknown, takeover: CardTakeover) {
	if (!takeover.active() || options.isPartial) return undefined;
	const outline = toolName === "read" ? readOutlineStructured(result, args) : toolName === "edit" ? editOutlineStructured(result) : undefined;
	if (!outline && carriesDiagnostics(result.details)) return undefined;
	if (outline) {
		const details: ToolCardDetails = { toolName, result: outline.text, isError: false, cwd: process.cwd() };
		return toolMessageRenderer({ customType: "integrated-tool-expansion", content: "", details }, { expanded: options.expanded }, theme, takeover.display, outline);
	}
	// An edit that cannot be outlined is better shown as OMP's diff than as a file excerpt.
	if (toolName === "edit") return undefined;
	if (nativeRendersJsonTree(toolName, args, toolResultText(result.content))) return undefined;
	const payload = notebookPayload(toolName, args, result.isError) ?? extractToolPayload({ toolName, result });
	const details: ToolCardDetails = { toolName, result: payload, isError: result.isError, cwd: process.cwd() };
	const structured = structureToolResult(details);
	// Plain shell text still carries a Wall-time footer worth lifting into a heading.
	if (structured.format === "text" && toolName === "bash") {
		const command = formatCommandText(structured.text);
		if (command) return toolMessageRenderer({ customType: "integrated-tool-expansion", content: "", details }, { expanded: options.expanded }, theme, takeover.display, command);
	}
	if (structured.format === "text") return undefined;
	return toolMessageRenderer({ customType: "integrated-tool-expansion", content: "", details }, { expanded: options.expanded }, theme, takeover.display, structured);
}

// Draw hydemods results inside OMP's own tool card instead of beside it. Every bespoke
// renderer is wrapped so its result view defers to hydemods when hydemods applies; tools that
// fall to OMP's generic card keep it, except the ones listed in EXTRA_CARD_TOOLS. Because the
// native component owns the card, Ctrl+O expansion and hidden tool output apply unchanged.
const EXTRA_CARD_TOOLS = ["context_notes"];
// Tools whose native card is already the better view; hydemods never replaces these.
const NATIVE_CARD_TOOLS: Record<string, true> = { find: true };

function installNativeCardTakeover(takeover: CardTakeover): void {
	for (const [name, original] of Object.entries(toolRenderers)) {
		if (NATIVE_CARD_TOOLS[name]) continue;
		const wrapped: ToolRenderer = {
			...original,
			renderResult(result, options, theme, args) {
				return hydemodsResultComponent(name, result, options, theme, args, takeover)
					?? original.renderResult(result, options, theme, args);
			},
		};
		toolRenderers[name] = wrapped;
	}
	for (const name of EXTRA_CARD_TOOLS) {
		if (name in toolRenderers) continue;
		const fallback = (args: unknown, result: { content: unknown; isError?: boolean } | undefined, options: { expanded: boolean; isPartial: boolean }, theme: Theme) =>
			renderDefaultToolExecution({
				label: name,
				args,
				result: result ? { output: toolResultText(result.content) ?? "", isError: result.isError } : undefined,
				options,
			}, theme);
		toolRenderers[name] = {
			mergeCallAndResult: true,
			renderCall: (args, options, theme) => fallback(args, undefined, options, theme),
			renderResult: (result, options, theme, args) =>
				hydemodsResultComponent(name, result, options, theme, args, takeover) ?? fallback(args, result, options, theme),
		};
	}
}

const COLLAPSED_LINE_PRESETS = [1, 3, 5, 10];

// The collapsed-lines control is a row in the panel's selection order (after the Interface
// tweaks); it is distinguished from tweaks by identity rather than by a tweak-shaped stub.
const COLLAPSED_LINES_ROW = Symbol("collapsed-lines");

function panelComponent(theme: ThemeLike, done: (result: undefined) => void, display: ToolDisplayState, onToggle?: () => void) {
	const groups: Record<TweakCategory, readonly Tweak[]> = {
		Workflow: TWEAKS.filter((tweak) => tweak.category === "Workflow"),
		Interface: TWEAKS.filter((tweak) => tweak.category === "Interface"),
		"Quality of life": TWEAKS.filter((tweak) => tweak.category === "Quality of life"),
	};
	const selectable: Array<Tweak | typeof COLLAPSED_LINES_ROW> = CATEGORIES.flatMap((category) =>
		category === "Interface" ? [...groups[category], COLLAPSED_LINES_ROW] : [...groups[category]]);
	const body = new Box(2, 1);
	const content = new Text();
	let selectedIndex = 0;

	const collapsedLinesRow = (selected: boolean): string[] => {
		const marker = selected ? theme.fg("accent", "❯") : " ";
		const options = COLLAPSED_LINE_PRESETS.map(preset => preset === display.collapsedLines
			? theme.fg("accent", theme.bold(`[${preset}]`))
			: theme.fg("muted", ` ${preset} `));
		const custom = COLLAPSED_LINE_PRESETS.includes(display.collapsedLines) ? "" : theme.fg("accent", theme.bold(`[${display.collapsedLines}]`));
		const chooser = [...options, custom].filter(Boolean).join(theme.fg("muted", "·"));
		return [
			` ${marker} ${chooser}  ${theme.bold("Collapsed card lines")}`,
			theme.fg("muted", "           Lines a collapsed tool card shows before the omission marker."),
			"           ←/→ pick a preset; +/- step by one; also /hydemods collapsed-lines N.",
		];
	};

	const paint = () => {
		const lines: string[] = [
			theme.fg("accent", theme.bold("HYDEMODS")),
			theme.fg("muted", "A visual home for small, composable session tweaks"),
			theme.fg("muted", "Saved to settings.yaml; expansion uses the native manual toggle"),
			"",
		];

		for (const category of CATEGORIES) {
			const tweaks = groups[category];
			lines.push(theme.fg("accent", theme.bold(category)));
			if (tweaks.length === 0) {
				lines.push(theme.fg("muted", "  No tweaks yet"));
				lines.push("");
				continue;
			}
			for (const tweak of tweaks) {
				const selected = selectable[selectedIndex] === tweak;
				const marker = selected ? theme.fg("accent", "❯") : " ";
				const state = readSetting(tweak.setting) ? theme.fg("success", "● enabled") : theme.fg("muted", "○ disabled");
				lines.push(` ${marker} ${state}  ${theme.bold(tweak.title)}`);
				lines.push(theme.fg("muted", `           ${tweak.description}`));
				lines.push(`           ${tweak.render()}`);
			}
			if (category === "Interface") lines.push(...collapsedLinesRow(selectable[selectedIndex] === COLLAPSED_LINES_ROW));
			lines.push("");
		}

		lines.push(theme.fg("border", "────────────────────────────────────────"));
		lines.push(theme.fg("muted", "↑/↓ or j/k select  ·  Space/Enter toggle or cycle  ·  ←/→ or +/- collapsed lines  ·  Esc/q close"));
		content.setText(lines.join("\n"));
		body.invalidate();
	};

	const moveSelection = (delta: number) => {
		if (selectable.length === 0) return;
		selectedIndex = (selectedIndex + delta + selectable.length) % selectable.length;
		paint();
	};

	const setCollapsedLines = (next: number) => {
		if (next < 1 || next === display.collapsedLines) return;
		display.collapsedLines = next;
		collapsedLinesSetting.set(settings, next);
		paint();
		onToggle?.();
	};

	// Presets in order; a custom value steps to the next preset above it (or wraps).
	const cyclePreset = (direction: 1 | -1) => {
		const current = COLLAPSED_LINE_PRESETS.indexOf(display.collapsedLines);
		if (current >= 0) {
			setCollapsedLines(COLLAPSED_LINE_PRESETS[(current + direction + COLLAPSED_LINE_PRESETS.length) % COLLAPSED_LINE_PRESETS.length]);
			return;
		}
		const above = COLLAPSED_LINE_PRESETS.find(preset => preset > display.collapsedLines);
		const below = [...COLLAPSED_LINE_PRESETS].reverse().find(preset => preset < display.collapsedLines);
		setCollapsedLines((direction === 1 ? above ?? COLLAPSED_LINE_PRESETS[0] : below ?? COLLAPSED_LINE_PRESETS[COLLAPSED_LINE_PRESETS.length - 1]));
	};

	const toggleSelected = () => {
		const row = selectable[selectedIndex];
		if (row === COLLAPSED_LINES_ROW) {
			cyclePreset(1);
			return;
		}
		if (!row) return;
		row.setting.set(settings, !readSetting(row.setting));
		paint();
		onToggle?.();
	};

	body.addChild(content);
	paint();

	return {
		render(width: number): readonly string[] {
			return body.render(width).map((line) => truncateToWidth(line, width));
		},
		invalidate() {
			body.invalidate();
		},
		handleInput(data: string) {
			if (data === "\u001b" || data === "q" || data === "Q") {
				done(undefined);
				return;
			}
			if (data === "\u001b[A" || data === "k" || data === "K") {
				moveSelection(-1);
				return;
			}
			if (data === "\u001b[B" || data === "j" || data === "J") {
				moveSelection(1);
				return;
			}
			if (data === "\u001b[C" || data === "l" || data === "L") {
				cyclePreset(1);
				return;
			}
			if (data === "\u001b[D" || data === "h" || data === "H") {
				cyclePreset(-1);
				return;
			}
			if (data === "+" || data === "=") {
				setCollapsedLines(display.collapsedLines + 1);
				return;
			}
			if (data === "-" || data === "_") {
				setCollapsedLines(display.collapsedLines - 1);
				return;
			}
			if (data === " " || data === "\r" || data === "\n") toggleSelected();
		},
	};
}

/* -------------------------------------------------------------------------- */
/*                               Extension Entry                              */
/* -------------------------------------------------------------------------- */

export default function hydemods(pi: ExtensionAPI): void {
	const z = pi.zod;
	const display: ToolDisplayState = { collapsedLines: readSetting(collapsedLinesSetting), cardsOn: true };
	const repaintToolCards = (ctx: ExtensionContext) => {
		if (ctx.hasUI) ctx.ui.setToolsExpanded(ctx.ui.getToolsExpanded());
	};
	let lastCtx: ExtensionContext | undefined;
	const restoreToolDisplay = (_event: unknown, ctx: ExtensionContext) => {
		lastCtx = ctx;
		display.collapsedLines = readSetting(collapsedLinesSetting);
		repaintToolCards(ctx);
	};
	pi.on("session_start", restoreToolDisplay);
	pi.on("session_switch", restoreToolDisplay);
	pi.on("session_branch", restoreToolDisplay);
	pi.on("session_tree", restoreToolDisplay);
	watchSetting(collapsedLinesSetting, value => {
		display.collapsedLines = value;
		if (lastCtx) repaintToolCards(lastCtx);
	});
	let promptManager: MCPManager | undefined;
	let releasePromptRepair: (() => void) | undefined;
	const syncPromptRepair = () => {
		const manager = isTweakEnabled("mcp-prompt-commands") ? MCPManager.instance() : undefined;
		if (manager === promptManager) return;
		releasePromptRepair?.();
		promptManager = manager;
		releasePromptRepair = manager ? installMcpPromptRepair(manager) : undefined;
	};
	pi.on("session_start", syncPromptRepair);
	pi.on("session_switch", syncPromptRepair);
	pi.on("session_shutdown", () => { releasePromptRepair?.(); releasePromptRepair = undefined; promptManager = undefined; });

	// hydemods draws inside OMP's tool card (never beside it). One native card per call; Ctrl+O
	// expansion and hidden tool output apply to it as usual. The hotkey below toggles whether
	// hydemods or the original renderer fills the result view for the session.
	const takeover: CardTakeover = { display, active: () => display.cardsOn && isTweakEnabled("integrated-tool-expansion") };
	installNativeCardTakeover(takeover);
	installReadGroupTakeover(takeover);
	const toggleCards = (ctx: ExtensionContext) => {
		display.cardsOn = !display.cardsOn;
		repaintToolCards(ctx);
		if (ctx.hasUI) ctx.ui.notify(`hydemods cards ${display.cardsOn ? "on" : "off"}`, "info");
	};
	pi.registerShortcut("super+alt+o", { description: "Toggle hydemods tool cards", handler: toggleCards });
	pi.registerShortcut("ctrl+alt+o", { description: "Toggle hydemods tool cards (terminals without Cmd reporting)", handler: toggleCards });

	// Sessions saved before the takeover carry a hydemods card message per tool call; the native
	// card now shows that content, so those messages render as nothing.
	pi.registerMessageRenderer("integrated-tool-expansion", () => ({ render: () => [], invalidate() {} }));

	/* ------------------------- TOON for the model ------------------------- */

	// The model reads JSON tool results as TOON; the persisted result and every card keep the
	// original JSON. Encoded per call id and re-used until the result text changes (pruning).
	const toonByCallId = new Map<string, { source: string; toon: string | undefined }>();
	const TOON_CACHE_LIMIT = 2000;

	pi.on("context", (event) => {
		if (!isTweakEnabled("tool-results-toon")) return;
		let changed = false;
		const messages = event.messages.map((message) => {
			if (message.role !== "toolResult" || message.isError) return message;
			const source = toolResultText(message.content);
			if (source === undefined) return message;
			let cached = toonByCallId.get(message.toolCallId);
			if (!cached || cached.source !== source) {
				if (toonByCallId.size >= TOON_CACHE_LIMIT) toonByCallId.clear();
				cached = { source, toon: toonForModel(source) };
				toonByCallId.set(message.toolCallId, cached);
			}
			if (cached.toon === undefined) return message;
			changed = true;
			const images = message.content.filter((block) => block.type !== "text");
			return { ...message, content: [{ type: "text" as const, text: cached.toon }, ...images] };
		});
		return changed ? { messages } : undefined;
	});

	/* --------------------------- Session Identity --------------------------- */

	let lastPrompt = "";

	// One-line preview of the prompt: code fences, tags, and newlines collapsed.
	const flattenPrompt = (text: string): string =>
		text
			.replace(/```[\s\S]*?```/g, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();

	// Drawer above the editor: as much of the latest prompt as fits, then an ellipsis.
	const refreshLastPromptDrawer = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		const preview = flattenPrompt(lastPrompt);
		if (!isTweakEnabled("last-prompt-drawer") || !preview) {
			ctx.ui.setWidget("hydemods:last-prompt", undefined);
			return;
		}
		ctx.ui.setWidget(
			"hydemods:last-prompt",
			(_tui, theme) => ({
				render(width: number): readonly string[] {
					const body = truncateToWidth(preview, Math.max(1, width - 2), "…");
					return [`${theme.fg("muted", "❯ ")}${theme.fg("dim", body)}`];
				},
				invalidate() {},
			}),
			{ placement: "aboveEditor" },
		);
	};

	const latestUserPrompt = (ctx: ExtensionContext): string => {
		const entries = ctx.sessionManager.getEntries();
		for (let i = entries.length - 1; i >= 0; i--) {
			const e = entries[i];
			if (e.type !== "message") continue;
			const m = (e as { message?: { role?: string; content?: string | unknown[] } }).message;
			if (m?.role !== "user") continue;
			if (typeof m.content === "string") return m.content;
			if (Array.isArray(m.content)) {
				return m.content
					.filter((c: unknown): c is { type: "text"; text: string } => typeof c === "object" && c !== null && (c as { type?: string }).type === "text")
					.map((c) => c.text)
					.join(" ");
			}
		}
		return "";
	};

	// Session naming is owned by the harness title generator (tiny model, online
	// fallback). It only runs while the session is unnamed, so this extension
	// never sets a name itself.
	// Intent of the tool call in flight (the `i` argument); cleared when the turn ends.
	let currentIntent = "";

	const refreshSessionIdentity = async (ctx: ExtensionContext) => {
		if (!isTweakEnabled("session-identity")) {
			if (ctx.hasUI) {
				ctx.ui.setStatus("hydemods:identity", undefined);
				ctx.ui.setWidget("hydemods:identity", undefined);
			}
			return;
		}

		const sessionId = ctx.sessionManager.getSessionId();
		const identity = getSessionIdentity(sessionId);

		const badge = `${identity.color.ansi}${identity.sigil} [${identity.codename}]\x1b[0m`;

		if (ctx.hasUI) {
			ctx.ui.setStatus("hydemods:identity", badge);
			const activity = currentIntent ? `\x1b[1m${currentIntent}\x1b[0m` : "\x1b[2midle\x1b[0m";
			ctx.ui.setWidget("hydemods:identity", [` ${badge} ${activity}`], { placement: "aboveEditor" });
			ctx.ui.setTitle(`${identity.sigil} [${identity.codename}] ${pi.getSessionName() || "Session"}`);
		}
	};

	pi.on("tool_execution_start", async (event, ctx) => {
		const args = event.args as { i?: unknown } | undefined;
		const intent = event.intent || (typeof args?.i === "string" ? args.i : "");
		currentIntent = intent.trim() || event.toolName;
		await refreshSessionIdentity(ctx);
	});

	pi.on("session_start", async (_event, ctx) => {
		lastPrompt = latestUserPrompt(ctx);
		refreshLastPromptDrawer(ctx);
		await refreshSessionIdentity(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		lastPrompt = latestUserPrompt(ctx);
		refreshLastPromptDrawer(ctx);
		await refreshSessionIdentity(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const prompt = typeof event.prompt === "string" ? event.prompt : "";
		if (prompt.trim().length > 0) {
			lastPrompt = prompt;
			refreshLastPromptDrawer(ctx);
		}
		await refreshSessionIdentity(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		currentIntent = "";
		await refreshSessionIdentity(ctx);
	});

	/* ----------------------------- Monitor Tool ----------------------------- */

	pi.registerTool({
		name: "monitor",
		label: "Monitor",
		description: "Run a shell command on an interval and report back only when a condition holds. Same engine as the /monitor command. `when` gates the report; `message` is a template over {output} {stdout} {stderr} {code} {name} {command} {run} {time} {match} {1}..{n} {prev}. `once` stops the monitor after its first report. Also sends direct IRC messages with action 'send'.",
		parameters: z.object({
			action: z.enum(["start", "stop", "list", "send"]).describe("'start' a monitor, 'stop' one by name, 'list' active monitors, or 'send' a direct IRC message"),
			name: z.string().optional().describe("Monitor name (required for start/stop)"),
			command: z.string().optional().describe("Shell command run each interval via sh -c"),
			interval_sec: z.number().optional().describe("Fixed seconds between runs (minimum 2). Omit for adaptive: 5s, doubling while quiet up to 120s, reset on any change or report."),
			when: z.enum(MONITOR_WHEN as [MonitorWhen, ...MonitorWhen[]]).optional().describe("Report condition: output (stdout non-empty, default) | changed (output differs from last run) | match (pattern matches output) | exit_zero | exit_nonzero | always"),
			pattern: z.string().optional().describe("Regex tested against output; required for when=match; capture groups fill {1}..{n} and named groups"),
			message: z.string().optional().describe("Report template. Default '{output}'. For 'send', the message body."),
			once: z.boolean().optional().describe("Stop the monitor after its first report"),
			to: z.string().optional().describe("Recipient agent/session (default 'Main')"),
			from: z.string().optional().describe("Sender identity (default 'System')"),
			urgent: z.boolean().optional().describe("Deliver as an interrupting steer instead of an aside"),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			if (!isTweakEnabled("session-irc-monitor")) {
				return {
					content: [{ type: "text", text: "Error: 'session-irc-monitor' tweak is currently disabled in Hydemods." }],
					details: { error: "tweak_disabled" },
				};
			}

			const to = params.to || "Main";
			const from = params.from || "System";

			if (params.action === "send") {
				if (!params.message) {
					return { content: [{ type: "text", text: "Error: 'message' is required when action is 'send'." }] };
				}
				onUpdate?.({ content: [{ type: "text", text: `Sending IRC message from ${from} to ${to}...` }] });
				pi.sendMessage(
					{
						customType: "irc:incoming",
						content: `[IRC: ${from} → ${to}]\n${params.message}`,
						details: { id: `mon_${Date.now()}`, from, to, message: params.message },
						display: true,
					},
					{ deliverAs: params.urgent ? "steer" : "aside", triggerTurn: true },
				);
				ctx.ui.notify(`IRC message sent from ${from} to ${to}`, "info");
				return {
					content: [{ type: "text", text: `Delivered IRC message from "${from}" to "${to}".` }],
					details: { to, from, message: params.message },
				};
			}

			if (params.action === "list") {
				const list = listMonitors();
				return {
					content: [{ type: "text", text: list.length === 0 ? "No active monitors." : JSON.stringify(list, null, 2) }],
					details: { monitors: list },
				};
			}

			if (params.action === "stop") {
				if (!params.name) {
					return { content: [{ type: "text", text: "Error: 'name' is required to stop a monitor." }] };
				}
				if (!stopMonitor(params.name)) {
					return { content: [{ type: "text", text: `No active monitor named "${params.name}".` }] };
				}
				ctx.ui.notify(`Monitor "${params.name}" stopped.`, "info");
				return { content: [{ type: "text", text: `Monitor "${params.name}" stopped.` }], details: { stopped: params.name } };
			}

			if (params.action === "start") {
				if (!params.name) {
					return { content: [{ type: "text", text: "Error: 'name' is required to start a monitor." }] };
				}
				const when = params.when ?? (params.pattern ? "match" : "output");
				if (when === "match" && !params.pattern) {
					return { content: [{ type: "text", text: "Error: when=match requires 'pattern'." }] };
				}
				if (params.pattern) {
					try { new RegExp(params.pattern); } catch (err) {
						return { content: [{ type: "text", text: `Error: invalid pattern: ${err instanceof Error ? err.message : String(err)}` }] };
					}
				}
				const spec: MonitorSpec = {
					name: params.name,
					to,
					from,
					intervalSec: params.interval_sec === undefined ? undefined : Math.max(2, params.interval_sec),
					command: params.command,
					message: params.message,
					when,
					pattern: params.pattern,
					once: params.once ?? false,
					urgent: params.urgent ?? false,
				};
				startMonitor(pi, spec);
				const summary = `Monitor "${spec.name}" ${spec.intervalSec === undefined ? "adaptive cadence (5s, backing off)" : `every ${spec.intervalSec}s`}, reports when=${spec.when}${spec.pattern ? ` /${spec.pattern}/` : ""}${spec.once ? ", once" : ""}, to ${to}.`;
				ctx.ui.notify(summary, "info");
				return { content: [{ type: "text", text: summary }], details: { ...spec } };
			}

			return { content: [{ type: "text", text: `Unknown action "${params.action}".` }] };
		},
	});

	/* ------------------------------ Commands -------------------------------- */

	pi.registerCommand("irc", {
		description: "Send an IRC message to an agent/session (Usage: /irc <to> <message>)",
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/);
			if (parts.length < 2) {
				ctx.ui.notify("Usage: /irc <to> <message>", "warning");
				return;
			}
			const to = parts[0];
			const message = parts.slice(1).join(" ");
			const identity = getSessionIdentity(ctx.sessionManager.getSessionId());

			pi.sendMessage(
				{
					customType: "irc:incoming",
					content: `[IRC: ${identity.codename} → ${to}]\n${message}`,
					details: {
						from: identity.codename,
						to,
						message,
					},
					display: true,
				},
				{ deliverAs: "aside", triggerTurn: true },
			);
			ctx.ui.notify(`Message sent to ${to}`, "info");
		},
	});

	// Splits `key=value key="quoted value" -- command` into options and the command tail.
	function parseMonitorArgs(input: string): { options: Record<string, string>; command?: string } {
		const split = input.indexOf(" -- ");
		const head = split === -1 ? input : input.slice(0, split);
		const command = split === -1 ? undefined : input.slice(split + 4).trim() || undefined;
		const options: Record<string, string> = {};
		const re = /(\w+)=(?:"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+))/g;
		for (const m of head.matchAll(re)) {
			options[m[1]] = (m[2] ?? m[3] ?? m[4] ?? "").replace(/\\"/g, '"');
		}
		return { options, command };
	}

	pi.registerCommand("monitor", {
		description: 'Background monitors. Usage: /monitor [list] | stop <name> | start <name> [every=<sec>] [when=output|changed|match|exit_zero|exit_nonzero|always] [match=<regex>] [once] [urgent] [msg="template with {output} {code} {1}…"] -- <shell command>. Without every=, cadence is adaptive: 5s, backing off to 120s while quiet.',
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const sub = trimmed.split(/\s+/)[0] || "list";

			if (sub === "stop") {
				const target = trimmed.split(/\s+/)[1];
				if (!target) {
					ctx.ui.notify("Usage: /monitor stop <name>", "warning");
					return;
				}
				const stopped = stopMonitor(target);
				ctx.ui.notify(stopped ? `Monitor "${target}" stopped` : `No active monitor named "${target}"`, stopped ? "info" : "warning");
				return;
			}

			if (sub === "start") {
				const rest = trimmed.slice("start".length).trim();
				const name = rest.split(/\s+/)[0];
				if (!name || name.includes("=") || name === "--") {
					ctx.ui.notify("Usage: /monitor start <name> [every=<sec>] [when=…] [match=…] [once] [urgent] [msg=\"…\"] -- <command>", "warning");
					return;
				}
				const optionText = rest.slice(name.length);
				const { options, command } = parseMonitorArgs(optionText);
				const head = optionText.includes(" -- ") ? optionText.slice(0, optionText.indexOf(" -- ")) : optionText;
				const flags = new Set(head.split(/\s+/));
				const pattern = options.match;
				const whenRaw = options.when ?? (pattern ? "match" : "output");
				const when = MONITOR_WHEN.find((w) => w === whenRaw);
				if (!when) {
					ctx.ui.notify(`Unknown when=${whenRaw}. Use one of: ${MONITOR_WHEN.join(", ")}`, "warning");
					return;
				}
				if (when === "match" && !pattern) {
					ctx.ui.notify("when=match needs match=<regex>", "warning");
					return;
				}
				if (pattern) {
					try { new RegExp(pattern); } catch (err) {
						ctx.ui.notify(`Invalid match regex: ${err instanceof Error ? err.message : String(err)}`, "warning");
						return;
					}
				}
				const spec: MonitorSpec = {
					name,
					to: options.to || "Main",
					from: options.from || "System",
					intervalSec: options.every === undefined ? undefined : Math.max(2, Number(options.every) || MONITOR_BASE_SEC),
					command,
					message: options.msg ?? options.message,
					when,
					pattern,
					once: flags.has("once") || options.once === "true",
					urgent: flags.has("urgent") || options.urgent === "true",
				};
				startMonitor(pi, spec);
				ctx.ui.notify(`Monitor "${name}" ${spec.intervalSec === undefined ? "adaptive cadence" : `every ${spec.intervalSec}s`}, when=${when}${pattern ? ` /${pattern}/` : ""}${spec.once ? ", once" : ""}`, "info");
				return;
			}

			const list = listMonitors();
			if (list.length === 0) {
				ctx.ui.notify("No active monitors.", "info");
				return;
			}
			ctx.ui.notify(`Active monitors (${list.length}): ${list.map((m) => `${m.name} [${m.when}, ${m.cadence}, ${m.reports}/${m.runs} reported]`).join("; ")}`, "info");
		},
	});

	pi.registerCommand("rename", {
		description: "Rename the current session and refresh identity badge",
		handler: async (args, ctx) => {
			const name = args.trim();
			if (!name) {
				ctx.ui.notify("Usage: /rename <title>", "warning");
				return;
			}
			await pi.setSessionName(name);
			await refreshSessionIdentity(ctx);
			ctx.ui.notify(`Session renamed to "${name}"`, "info");
		},
	});

	pi.registerCommand("heartbeat", {
		description: "Prompt the agent to establish intrinsic goals and explore the codebase (Usage: /heartbeat [optional topic])",
		handler: async (args, ctx) => {
			if (!isTweakEnabled("heartbeat-command")) {
				ctx.ui.notify("Error: 'heartbeat-command' is disabled in /hydemods.", "warning");
				return;
			}

			const focus = args.trim();
			const focusText = focus
				? `Focus your curiosity on this domain: "${focus}".`
				: "Survey recent commits, project structure, open notes, and code that catches your attention.";

			const prompt = [
				"💓 [Autonomous Heartbeat Cycle]",
				focusText,
				"",
				"Instructions:",
				"1. Review the current state of the workspace.",
				"2. Formulate 1 to 3 explicit intrinsic goals you want to explore.",
				"3. Perform a read-only investigation using discovery tools (read, grep, glob).",
				"4. Share your findings and observations concisely (following ASD-STE100 principles). If you discover actionable improvements, propose them before mutating files.",
			].join("\n");

			pi.sendUserMessage(prompt, { deliverAs: "steer" });
			ctx.ui.notify(focus ? `Heartbeat pulse: ${focus}` : "Autonomous heartbeat dispatched", "info");
		},
	});

	pi.registerCommand("retro", {
		description: "Trigger a structured session retrospective (Usage: /retro)",
		handler: async (_args, ctx) => {
			if (!isTweakEnabled("session-retro-command")) {
				ctx.ui.notify("Error: 'session-retro-command' is disabled in /hydemods.", "warning");
				return;
			}

			const prompt = [
				"🧭 [Session Retrospective]",
				"Conduct a structured retrospective of the work completed in this session:",
				"1. What goals were established and what was achieved?",
				"2. What technical friction or unexpected obstacles occurred, and how were they resolved?",
				"3. What durable insights, conventions, or architectural decisions should be remembered?",
				"Format the response clearly with headers, bullet points, and ASD-STE100 principles.",
			].join("\n");

			pi.sendUserMessage(prompt, { deliverAs: "steer" });
			ctx.ui.notify("Retrospective cycle dispatched", "info");
		},
	});

	pi.on("session_shutdown", () => {
		for (const monitor of activeMonitors.values()) {
			clearInterval(monitor.timer);
		}
		activeMonitors.clear();
	});

	pi.registerCommand("hydemods", {
		description: "Open the tweak panel or set collapsed-lines N (default 5, saved to settings)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;
			const [command, value, ...extra] = args.trim().split(/\s+/);
			if (command) {
				if (command === "collapsed-lines" && value === undefined) {
					ctx.ui.notify(`Collapsed line limit: ${display.collapsedLines}; default: ${DEFAULT_COLLAPSED_LINES}`, "info");
					return;
				}
				const next = Number(value);
				if (command !== "collapsed-lines" || !value || !/^\d+$/.test(value) || extra.length || !Number.isInteger(next) || next < 1) {
					ctx.ui.notify("Use /hydemods collapsed-lines N, where N is a positive whole number.", "warning");
					return;
				}
				collapsedLinesSetting.set(settings, next);
				display.collapsedLines = next;
				repaintToolCards(ctx);
				ctx.ui.notify(`Collapsed line limit set to ${next}; saved to settings.`, "info");
				return;
			}
			await ctx.ui.custom(
				(_tui, theme, keybindings, done) => {
					const component = panelComponent(
						theme,
						done,
						display,
						() => {
							syncPromptRepair();
							refreshSessionIdentity(ctx);
						},
					);
					return {
						...component,
						handleInput(data: string) {
							if (keybindings.matches(data, "app.interrupt") || data === "q" || data === "Q") {
								done(undefined);
								return;
							}
							component.handleInput(data);
						},
					};
				},
				{ overlay: true },
			);
		},
	});
}
