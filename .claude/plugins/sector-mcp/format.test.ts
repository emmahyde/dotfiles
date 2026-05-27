import { test, expect } from "bun:test";
import { formatInputResult, buildStatusResult } from "./format.ts";

const base = {
  targetLabel: "widget=Foo ",
  injected: { ok: true },
  beforePath: "/tmp/before.png",
  afterPath: "/tmp/after.png",
};

test("formatInputResult — no before-frame, terse vs verbose", () => {
  const terse = formatInputResult({ ...base, verbose: false, changedPct: null, region: null });
  expect(terse).toBe("widget=Foo injected · no before-frame");

  const verbose = formatInputResult({ ...base, verbose: true, changedPct: null, region: null });
  expect(JSON.parse(verbose)).toEqual({ injected: { ok: true }, after: "/tmp/after.png" });
});

test("formatInputResult — no visible change, terse vs verbose", () => {
  const terse = formatInputResult({ ...base, verbose: false, changedPct: 0, region: null });
  expect(terse).toBe("widget=Foo injected · no visible change (0%)");

  const verbose = formatInputResult({ ...base, verbose: true, changedPct: 0, region: null });
  expect(JSON.parse(verbose)).toEqual({
    injected: { ok: true },
    changed_pct: 0,
    before: "/tmp/before.png",
    after: "/tmp/after.png",
  });
});

test("formatInputResult — changed region, terse vs verbose", () => {
  const region = { x: 12, y: 34, w: 56, h: 78 };
  const terse = formatInputResult({ ...base, verbose: false, changedPct: 4.2, region });
  expect(terse).toBe(
    "widget=Foo changed 4.2% · region [12,34 56x78] · native=(cropX+12,cropY+34)"
  );

  const verbose = formatInputResult({ ...base, verbose: true, changedPct: 4.2, region });
  expect(JSON.parse(verbose)).toEqual({
    injected: { ok: true },
    changed_pct: 4.2,
    changed_region: region,
    crop_to_native: "native = (crop_x + 12, crop_y + 34)",
    before: "/tmp/before.png",
    after: "/tmp/after.png",
  });
});

test("formatInputResult — empty targetLabel produces no leading prefix", () => {
  const terse = formatInputResult({
    ...base, targetLabel: "", verbose: false, changedPct: null, region: null,
  });
  expect(terse).toBe("injected · no before-frame");
});

test("buildStatusResult — all fields present", () => {
  const { text, structured } = buildStatusResult({ port: 19800, pid: 4242, scene: "Piloting" });
  expect(text).toBe("port=19800 pid=4242 scene=Piloting");
  expect(structured).toEqual({ running: true, port: 19800, pid: 4242, scene: "Piloting" });
});

test("buildStatusResult — partial fields omit the absent ones", () => {
  const { text, structured } = buildStatusResult({ port: 19800 });
  expect(text).toBe("port=19800");
  expect(structured).toEqual({ running: true, port: 19800 });
  expect("pid" in structured).toBe(false);
  expect("scene" in structured).toBe(false);
});

test("buildStatusResult — no recognised fields falls back to raw JSON text", () => {
  const raw = { weird: "shape" };
  const { text, structured } = buildStatusResult(raw);
  expect(text).toBe(JSON.stringify(raw));
  expect(structured).toEqual({ running: true });
});

test("buildStatusResult — port=0 still carried (null-check, not falsy-check)", () => {
  const { text, structured } = buildStatusResult({ port: 0 });
  expect(text).toBe("port=0");
  expect(structured.port).toBe(0);
});
