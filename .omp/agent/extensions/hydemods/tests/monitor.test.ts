import { afterEach, expect, test } from "bun:test";
import {
	listMonitors,
	monitorShouldReport,
	monitorTick,
	parseMonitorArgs,
	renderMonitorMessage,
	startMonitor,
	stopAllMonitors,
	stopMonitor,
	stopMonitorsForOtherSessions,
	truncateOutput,
	MONITOR_MAX_CONCURRENT,
	MONITOR_MAX_PATTERN_LEN,
	MONITOR_MAX_REPORTS,
	MONITOR_MAX_RUNS,
	MONITOR_OUTPUT_CAP,
	type ActiveMonitor,
	type MonitorDelivery,
	type MonitorDeps,
	type MonitorExecResult,
	type MonitorSpec,
} from "../lib/monitor";

afterEach(() => {
	stopAllMonitors();
});

function spec(overrides: Partial<MonitorSpec> = {}): MonitorSpec {
	return { name: "check", to: "*", command: "true", when: "output", once: false, urgent: false, wake: false, ...overrides };
}

function harness(source: MonitorExecResult | (() => Promise<MonitorExecResult>) = { stdout: "", stderr: "", code: 0 }) {
	const deliveries: MonitorDelivery[] = [];
	const deps: MonitorDeps = {
		exec: typeof source === "function" ? source : async () => source,
		deliver: (delivery) => { deliveries.push(delivery); },
		setTimer: () => 0,
		clearTimer: () => {},
	};
	return { deliveries, deps };
}

function startedMonitor(sessionId: string, monitor: MonitorSpec, deps: MonitorDeps): ActiveMonitor {
	const started = startMonitor(sessionId, monitor, deps);
	if (!started.ok) throw new Error(started.error);
	return started.monitor;
}

test("output over the cap is truncated with a byte marker", () => {
	const long = "a".repeat(MONITOR_OUTPUT_CAP + 500);
	const cut = truncateOutput(long);
	expect(cut.length).toBeLessThan(long.length);
	expect(cut).toContain("(500 bytes truncated)");
	expect(truncateOutput("short")).toBe("short");
});

test("a default report fences the raw output and labels the sender as data", () => {
	const run = { stdout: "boom", stderr: "", output: "boom", code: 2, match: null };
	const message = renderMonitorMessage({ name: "logs", runCount: 3 }, run);
	expect(message.startsWith("[Monitor:logs] ")).toBe(true);
	expect(message).toContain("exit 2");
	expect(message).toContain("```text\nboom\n```");
});

test("a custom template fills slots and leaves unknown slots visible", () => {
	const run = { stdout: "line", stderr: "", output: "line", code: 0, match: null };
	expect(renderMonitorMessage({ name: "n", command: "cmd", message: "{name}:{code}:{output}:{nope}" }, run))
		.toBe("[Monitor:n] exit 0\nn:0:line:{nope}");
});

test("an unknown exit code fails exit_zero and passes exit_nonzero", () => {
	const run = { stdout: "", stderr: "", output: "", code: -1, match: null };
	expect(monitorShouldReport({ when: "exit_zero" }, run)).toBe(false);
	expect(monitorShouldReport({ when: "exit_nonzero" }, run)).toBe(true);
});

test("parseMonitorArgs accepts a full command line", () => {
	const parsed = parseMonitorArgs('disk every=10 when=output msg="used {output}" -- df -h /');
	expect("spec" in parsed).toBe(true);
	if (!("spec" in parsed)) return;
	expect(parsed.spec).toMatchObject({ name: "disk", intervalSec: 10, when: "output", command: "df -h /", message: "used {output}", to: "*" });
});

test("parseMonitorArgs rejects bad cadence, empty command, long patterns and unknown when", () => {
	expect(parseMonitorArgs("x every=abc -- true")).toHaveProperty("error");
	expect(parseMonitorArgs("x every=1 -- true")).toHaveProperty("error");
	expect(parseMonitorArgs("x every=2")).toHaveProperty("error");
	expect(parseMonitorArgs(`x match=${"a".repeat(MONITOR_MAX_PATTERN_LEN + 1)} -- true`)).toHaveProperty("error");
	expect(parseMonitorArgs("x when=nope -- true")).toHaveProperty("error");
});

test("a monitor stops at the run limit and says why", async () => {
	const { deliveries, deps } = harness({ stdout: "", stderr: "", code: 0 });
	const mon = startedMonitor("run-limit", spec({ name: "quiet" }), deps);
	for (let i = 0; i < MONITOR_MAX_RUNS; i++) await monitorTick(mon, null);
	expect(deliveries).toHaveLength(1);
	expect(deliveries[0].content).toContain("run limit");
	expect(deliveries[0].details.stopped).toBe(true);
	expect(listMonitors("run-limit")).toHaveLength(0);
	await monitorTick(mon, null);
	expect(deliveries).toHaveLength(1);
});

test("a monitor stops at the report limit and says why", async () => {
	const { deliveries, deps } = harness({ stdout: "tick", stderr: "", code: 0 });
	const mon = startedMonitor("report-limit", spec({ name: "loud", when: "always" }), deps);
	for (let i = 0; i < MONITOR_MAX_REPORTS; i++) await monitorTick(mon, null);
	expect(deliveries).toHaveLength(MONITOR_MAX_REPORTS);
	await monitorTick(mon, null);
	expect(deliveries).toHaveLength(MONITOR_MAX_REPORTS + 1);
	expect(deliveries.at(-1)?.content).toContain("report limit");
	expect(listMonitors("report-limit")).toHaveLength(0);
});

test("oversized output is truncated in the stored output and the report", async () => {
	const big = "x".repeat(MONITOR_OUTPUT_CAP + 2048);
	const { deliveries, deps } = harness({ stdout: big, stderr: "", code: 0 });
	const mon = startedMonitor("big-output", spec({ name: "big" }), deps);
	await monitorTick(mon, null);
	expect(mon.lastOutput).toContain("bytes truncated");
	expect(deliveries[0].content).toContain("bytes truncated");
	expect(Buffer.byteLength(deliveries[0].content)).toBeLessThan(big.length);
});

test("a missing exit code counts as failure", async () => {
	const { deliveries, deps } = harness({ stdout: "", stderr: "", code: undefined });
	const mon = startedMonitor("no-code", spec({ name: "nocode", when: "exit_nonzero" }), deps);
	await monitorTick(mon, null);
	expect(deliveries[0].details.code).toBe(-1);
});

test("a monitor stopped while exec is in flight sends no report", async () => {
	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const { deliveries, deps } = harness(async () => {
		await gate;
		return { stdout: "late", stderr: "", code: 0 };
	});
	const mon = startedMonitor("midflight", spec({ name: "slow" }), deps);
	const tick = monitorTick(mon, null);
	stopMonitor("midflight", "slow");
	release?.();
	await tick;
	expect(deliveries).toHaveLength(0);
});

test("the concurrency limit is enforced and a repeat name reports replacement", () => {
	const { deps } = harness();
	for (let i = 0; i < MONITOR_MAX_CONCURRENT; i++) {
		expect(startMonitor("concurrency", spec({ name: `m${i}` }), deps).ok).toBe(true);
	}
	expect(startMonitor("concurrency", spec({ name: "extra" }), deps).ok).toBe(false);
	const replaced = startMonitor("concurrency", spec({ name: "m0" }), deps);
	expect(replaced.ok).toBe(true);
	if (replaced.ok) expect(replaced.replaced).toBe(true);
});

test("monitors are scoped to their session", () => {
	const { deps } = harness();
	startMonitor("session-a", spec({ name: "a" }), deps);
	startMonitor("session-b", spec({ name: "b" }), deps);
	stopMonitorsForOtherSessions("session-b");
	expect(listMonitors("session-a")).toHaveLength(0);
	expect(listMonitors("session-b")).toHaveLength(1);
	stopAllMonitors();
	expect(listMonitors("session-b")).toHaveLength(0);
});

test("a report turns the agent only when wake is set", async () => {
	const quiet = harness({ stdout: "job done", stderr: "", code: 0 });
	const quietMonitor = startedMonitor("no-wake", spec({ name: "nowake" }), quiet.deps);
	await monitorTick(quietMonitor, null);
	expect(quiet.deliveries[0].triggerTurn).toBe(false);

	const waking = harness({ stdout: "job done", stderr: "", code: 0 });
	const wakeMonitor = startedMonitor("wake", spec({ name: "wake", wake: true }), waking.deps);
	await monitorTick(wakeMonitor, null);
	expect(waking.deliveries[0].triggerTurn).toBe(true);
});
