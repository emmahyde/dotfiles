/**
 * Background monitor engine and its pure pieces.
 *
 * Kept out of index.ts so argument parsing, report decisions, message rendering and output
 * truncation can be tested without an OMP host. Every hard limit lives here so the shell loop
 * the model can start stays a bounded poll rather than an open-ended turn generator.
 */

export type MonitorWhen = "output" | "changed" | "match" | "exit_zero" | "exit_nonzero" | "always";

export const MONITOR_WHEN: readonly MonitorWhen[] = ["output", "changed", "match", "exit_zero", "exit_nonzero", "always"];

/** Adaptive cadence: base interval, doubling while quiet, capped. */
export const MONITOR_BASE_SEC = 5;
export const MONITOR_MAX_SEC = 120;
export const MONITOR_MIN_INTERVAL_SEC = 2;
/** Hard ceilings. A monitor stops itself when it reaches either count. */
export const MONITOR_MAX_CONCURRENT = 4;
export const MONITOR_MAX_RUNS = 120;
export const MONITOR_MAX_REPORTS = 20;
/** Per-stream cap; also bounds regex work on hostile output. */
export const MONITOR_OUTPUT_CAP = 4096;
export const MONITOR_MAX_PATTERN_LEN = 256;

/** Platform timer handle; the host injects setTimer/clearTimer. */
export type MonitorTimer = NodeJS.Timeout | number;

export interface MonitorSpec {
	name: string;
	/** Recipient label. The caller validates it: only the current session or "*" is accepted. */
	to: string;
	/** Fixed poll interval. Omit for adaptive: 5s, doubling while quiet, capped at 120s, reset on activity. */
	intervalSec?: number;
	command: string;
	message?: string;
	when: MonitorWhen;
	pattern?: string;
	once: boolean;
	urgent: boolean;
	/** Wake the agent with a new turn per report. Default false: a report is an aside, not a prompt. */
	wake: boolean;
}

export interface MonitorRun {
	stdout: string;
	stderr: string;
	output: string;
	code: number;
	match: RegExpMatchArray | null;
}

export interface MonitorExecResult {
	stdout: string;
	stderr: string;
	code: number | undefined;
}

export interface MonitorDelivery {
	content: string;
	details: Record<string, unknown>;
	deliverAs: "steer" | "aside";
	triggerTurn: boolean;
}

export interface MonitorDeps {
	exec: (command: string) => Promise<MonitorExecResult>;
	deliver: (delivery: MonitorDelivery) => void;
	setTimer: (callback: () => void, ms: number) => MonitorTimer;
	clearTimer: (timer: MonitorTimer) => void;
}

export interface ActiveMonitor extends MonitorSpec {
	sessionId: string;
	timer: MonitorTimer;
	currentSec: number;
	runCount: number;
	reportCount: number;
	lastRun?: number;
	lastOutput?: string;
	deps: MonitorDeps;
}

export interface MonitorSummary {
	name: string;
	to: string;
	cadence: string;
	when: MonitorWhen;
	pattern?: string;
	once: boolean;
	wake: boolean;
	command: string;
	message?: string;
	runs: number;
	reports: number;
	lastRun: string;
}

/** The subset of a monitor a rendered message needs; a plain object works in tests. */
export interface MonitorMessageSource {
	name: string;
	command?: string;
	message?: string;
	runCount?: number;
	lastOutput?: string;
}

/** Result of starting a monitor: the running monitor plus whether it replaced one, or the reason it did not start. */
export type StartResult =
	| { ok: true; replaced: boolean; monitor: ActiveMonitor }
	| { ok: false; error: string };

const monitorsBySession = new Map<string, Map<string, ActiveMonitor>>();
let messageSeq = 0;

/**
 * Caps a stream at `cap` bytes with a visible marker. Byte-based so an adversarial output
 * cannot blow past the cap by using multi-byte characters.
 */
export function truncateOutput(text: string, cap = MONITOR_OUTPUT_CAP): string {
	const bytes = Buffer.byteLength(text, "utf8");
	if (bytes <= cap) return text;
	const head = Buffer.from(text, "utf8").subarray(0, cap).toString("utf8").replace(/\uFFFD+$/, "");
	return `${head}\n… (${bytes - cap} bytes truncated)`;
}

// Decides whether one tick earns a report. `changed` compares against the last tick's
// output, so the first tick reports only when there is output to compare later.
export function monitorShouldReport(
	mon: { when: MonitorWhen; lastOutput?: string },
	run: MonitorRun,
): boolean {
	switch (mon.when) {
		case "always": return true;
		case "output": return run.output.length > 0;
		case "changed": return mon.lastOutput !== undefined && run.output !== mon.lastOutput;
		case "match": return run.match !== null;
		case "exit_zero": return run.code === 0;
		case "exit_nonzero": return run.code !== 0;
	}
}

/**
 * Renders a report as delimited data, never in the harness's own voice: the sender label is
 * `[Monitor:name]` and the default template fences the raw command output. A custom `message`
 * template fills `{name} {command} {stdout} {stderr} {output} {code} {run} {time} {match} {prev}`
 * plus capture groups; unknown slots are left as written so a typo stays visible.
 */
export function renderMonitorMessage(mon: MonitorMessageSource, run: MonitorRun, note?: string): string {
	const vars: Record<string, string> = {
		name: mon.name,
		command: mon.command ?? "",
		stdout: run.stdout,
		stderr: run.stderr,
		output: run.output,
		code: String(run.code),
		run: String(mon.runCount ?? 0),
		time: new Date().toLocaleTimeString(),
		match: run.match?.[0] ?? "",
		prev: mon.lastOutput ?? "",
	};
	run.match?.forEach((group, index) => { vars[String(index)] = group ?? ""; });
	if (run.match?.groups) { Object.assign(vars, run.match.groups); }
	const body = mon.message === undefined
		? `\`\`\`text\n${run.output}\n\`\`\``
		: mon.message.replace(/\{([a-zA-Z0-9_]+)\}/g, (slot, key: string) => (key in vars ? vars[key] : slot));
	return `[Monitor:${mon.name}] ${note ?? `exit ${run.code}`}\n${body}`;
}

/** Validates a spec built by either entry point. Returns the reason it is unusable, if any. */
export function validateMonitorSpec(spec: MonitorSpec): string | undefined {
	if (!spec.name.trim()) return "a monitor name is required";
	if (!spec.command.trim()) return "a command is required";
	if (spec.intervalSec !== undefined && (!Number.isInteger(spec.intervalSec) || spec.intervalSec < MONITOR_MIN_INTERVAL_SEC)) {
		return `invalid every=${spec.intervalSec}; use a whole number of seconds of at least ${MONITOR_MIN_INTERVAL_SEC}`;
	}
	if (spec.when === "match" && !spec.pattern) return "when=match requires a pattern";
	if (spec.pattern !== undefined) {
		if (spec.pattern.length > MONITOR_MAX_PATTERN_LEN) return `pattern is too long; the limit is ${MONITOR_MAX_PATTERN_LEN} characters`;
		try {
			new RegExp(spec.pattern);
		} catch (err) {
			return `invalid pattern: ${err instanceof Error ? err.message : String(err)}`;
		}
	}
	return undefined;
}

/**
 * Parses `/monitor start <name> [key=value …] [flags] -- <command>` into a spec.
 * Shares `validateMonitorSpec` with the tool, so both entry points accept the same input.
 */
export function parseMonitorArgs(raw: string): { spec: MonitorSpec } | { error: string } {
	const trimmed = raw.trim();
	const name = trimmed.split(/\s+/)[0] ?? "";
	if (!name || name.includes("=") || name === "--") {
		return { error: 'usage: start <name> [every=<sec>] [when=…] [match=…] [once] [urgent] [wake] [msg="…"] -- <command>' };
	}
	const optionText = trimmed.slice(name.length);
	const split = optionText.indexOf(" -- ");
	const head = split === -1 ? optionText : optionText.slice(0, split);
	const command = split === -1 ? "" : optionText.slice(split + 4).trim();
	const options: Record<string, string> = {};
	const assignment = /(\w+)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+))/g;
	for (const match of head.matchAll(assignment)) {
		options[match[1]] = (match[2] ?? match[3] ?? match[4] ?? "").replace(/\\(["'])/g, "$1");
	}
	const flags = new Set(head.replace(assignment, " ").split(/\s+/).filter(Boolean));
	const whenRaw = options.when ?? (options.match ? "match" : "output");
	const when = MONITOR_WHEN.find((candidate) => candidate === whenRaw);
	if (!when) return { error: `unknown when=${whenRaw}; use one of: ${MONITOR_WHEN.join(", ")}` };
	const spec: MonitorSpec = {
		name,
		to: options.to ?? "*",
		intervalSec: options.every === undefined ? undefined : Number(options.every),
		command,
		message: options.msg ?? options.message,
		when,
		pattern: options.match,
		once: flags.has("once") || options.once === "true",
		urgent: flags.has("urgent") || options.urgent === "true",
		wake: flags.has("wake") || options.wake === "true",
	};
	const error = validateMonitorSpec(spec);
	return error ? { error } : { spec };
}

function deliver(mon: ActiveMonitor, run: MonitorRun, note: string | undefined, stopped: boolean): void {
	const content = renderMonitorMessage(mon, run, note);
	mon.deps.deliver({
		content,
		details: {
			id: `mon_${mon.name}_${Date.now()}_${messageSeq++}`,
			from: `monitor:${mon.name}`,
			to: mon.to,
			message: content,
			monitor: mon.name,
			code: run.code,
			runs: mon.runCount,
			reports: mon.reportCount,
			stopped,
		},
		deliverAs: mon.urgent ? "steer" : "aside",
		triggerTurn: mon.wake,
	});
}

/** One poll. Exported so a test can drive ticks without waiting on real timers. */
export async function monitorTick(mon: ActiveMonitor, regex: RegExp | null): Promise<void> {
	if (monitorsBySession.get(mon.sessionId)?.get(mon.name) !== mon) return;
	mon.runCount++;
	mon.lastRun = Date.now();

	let run: MonitorRun = { stdout: "", stderr: "", output: "", code: 0, match: null };
	try {
		const result = await mon.deps.exec(mon.command);
		const stdout = truncateOutput((result.stdout || "").trim());
		const stderr = truncateOutput((result.stderr || "").trim());
		run = { stdout, stderr, output: stdout || stderr, code: result.code ?? -1, match: null };
	} catch (err) {
		const stderr = truncateOutput(err instanceof Error ? err.message : String(err));
		run = { stdout: "", stderr, output: stderr, code: -1, match: null };
	}
	// The match runs on the event loop. The caps (256-char pattern, MONITOR_OUTPUT_CAP input) limit
	// how long a pathological pattern such as `(a+)+b` can stall the TUI; they do not rule it out,
	// since JS offers no regex timeout. The pattern comes from the model, not from tool output.
	if (regex) run.match = run.output.match(regex);

	// A stop (or tweak disable, or session switch) during exec cancels both the report and the timer.
	if (monitorsBySession.get(mon.sessionId)?.get(mon.name) !== mon) return;

	const limitReached = mon.runCount >= MONITOR_MAX_RUNS || mon.reportCount >= MONITOR_MAX_REPORTS;
	const report = !limitReached && monitorShouldReport(mon, run);
	const changed = mon.lastOutput !== undefined && run.output !== mon.lastOutput;
	mon.lastOutput = run.output;
	// Adaptive cadence: anything interesting snaps back to the base; silence backs off fast.
	if (mon.intervalSec === undefined) {
		mon.currentSec = report || changed ? MONITOR_BASE_SEC : Math.min(MONITOR_MAX_SEC, mon.currentSec * 2);
	}

	if (limitReached) {
		const reason = mon.runCount >= MONITOR_MAX_RUNS
			? `run limit (${mon.runCount} runs)`
			: `report limit (${mon.reportCount} reports)`;
		stopMonitor(mon.sessionId, mon.name);
		deliver(mon, run, `stopped: ${reason}`, true);
		return;
	}
	if (report) mon.reportCount++;
	const stopping = report && mon.once;
	if (stopping) stopMonitor(mon.sessionId, mon.name);
	else mon.timer = mon.deps.setTimer(() => { void monitorTick(mon, regex); }, mon.currentSec * 1000);
	if (!report) return;
	deliver(mon, run, undefined, stopping);
}

export function startMonitor(sessionId: string, spec: MonitorSpec, deps: MonitorDeps): StartResult {
	let map = monitorsBySession.get(sessionId);
	if (!map) {
		map = new Map();
		monitorsBySession.set(sessionId, map);
	}
	const existing = map.get(spec.name);
	if (!existing && map.size >= MONITOR_MAX_CONCURRENT) {
		return { ok: false, error: `the limit of ${MONITOR_MAX_CONCURRENT} concurrent monitors for this session is reached; stop one first` };
	}
	if (existing) {
		deps.clearTimer(existing.timer);
		map.delete(spec.name);
	}
	const regex = spec.pattern ? new RegExp(spec.pattern) : null;
	const mon: ActiveMonitor = { ...spec, sessionId, timer: 0, currentSec: spec.intervalSec ?? MONITOR_BASE_SEC, runCount: 0, reportCount: 0, deps };
	mon.timer = deps.setTimer(() => { void monitorTick(mon, regex); }, mon.currentSec * 1000);
	map.set(spec.name, mon);
	return { ok: true, replaced: Boolean(existing), monitor: mon };
}

export function stopMonitor(sessionId: string, name: string): boolean {
	const map = monitorsBySession.get(sessionId);
	const mon = map?.get(name);
	if (!map || !mon) return false;
	mon.deps.clearTimer(mon.timer);
	map.delete(name);
	if (map.size === 0) monitorsBySession.delete(sessionId);
	return true;
}

export function listMonitors(sessionId: string): MonitorSummary[] {
	const map = monitorsBySession.get(sessionId);
	if (!map) return [];
	return Array.from(map.values()).map((mon) => ({
		name: mon.name,
		to: mon.to,
		cadence: mon.intervalSec === undefined ? `adaptive (now ${mon.currentSec}s)` : `${mon.intervalSec}s`,
		when: mon.when,
		pattern: mon.pattern,
		once: mon.once,
		wake: mon.wake,
		command: mon.command,
		message: mon.message,
		runs: mon.runCount,
		reports: mon.reportCount,
		lastRun: mon.lastRun ? new Date(mon.lastRun).toLocaleTimeString() : "none",
	}));
}

/** Stops every monitor started by a different session; called on session switches. */
export function stopMonitorsForOtherSessions(sessionId: string): number {
	let stopped = 0;
	for (const [owner, map] of monitorsBySession) {
		if (owner === sessionId) continue;
		for (const mon of map.values()) {
			mon.deps.clearTimer(mon.timer);
			stopped++;
		}
		monitorsBySession.delete(owner);
	}
	return stopped;
}

export function stopAllMonitors(): number {
	let stopped = 0;
	for (const map of monitorsBySession.values()) {
		for (const mon of map.values()) {
			mon.deps.clearTimer(mon.timer);
			stopped++;
		}
	}
	monitorsBySession.clear();
	return stopped;
}
