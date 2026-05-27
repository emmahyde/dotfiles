import { test, expect } from "bun:test";
import { join } from "path";
import { writeFileSync, mkdtempSync, existsSync } from "fs";
import { tmpdir } from "os";
import { $ } from "bun";
import {
  outlineJsx, formatOutline, readFileWithRange, compileQuery,
  capOutline, capHits, capSymbols, type OutlineSym,
} from "./outline.ts";

const PANELS = join(import.meta.dir, "../../.claude/design/sector-hud/panels.jsx");

test("outlineJsx extracts top-level symbols from panels.jsx", () => {
  const syms = outlineJsx(PANELS);
  const byName = new Map(syms.map(s => [s.name, s]));

  // The dossier panel component — the case that motivated the tool.
  const panel = byName.get("CharacterPanel");
  expect(panel).toBeDefined();
  expect(panel!.kind).toBe("function");
  expect(panel!.startLine).toBe(25);
  expect(panel!.endLine).toBe(215);

  // const arrays, function declarations, and a style object all classified.
  expect(byName.get("BELIEF_AXES")?.kind).toBe("const");
  expect(byName.get("SectionHead")?.kind).toBe("function");
  expect(byName.get("charStyles")?.kind).toBe("object");
});

test("formatOutline indents by depth", () => {
  const out = formatOutline("x.cs", [
    { kind: "namespace", name: "N", signature: "namespace N", startLine: 1, endLine: 9, depth: 0 },
    { kind: "class", name: "C", signature: "class C", startLine: 2, endLine: 8, depth: 1 },
    { kind: "method", name: "M", signature: "void M()", startLine: 3, endLine: 7, depth: 2 },
  ]);
  const lines = out.split("\n");
  expect(lines[0]).toBe("x.cs");
  expect(lines[1].startsWith("  ")).toBe(true);   // depth 0 -> 1 indent unit
  expect(lines[2].startsWith("    ")).toBe(true);  // depth 1 -> 2 units
  expect(lines[3].startsWith("      ")).toBe(true); // depth 2 -> 3 units
});

test("readFileWithRange slices, caps via limit, and rejects bad ranges", () => {
  const dir = mkdtempSync(join(tmpdir(), "outline-"));
  const file = join(dir, "f.txt");
  writeFileSync(file, Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n"));

  const ranged = readFileWithRange(file, "f.txt", "10-20");
  expect("text" in ranged && ranged.text).toContain("f.txt lines 10-20 of 50");

  const capped = readFileWithRange(file, "f.txt", "10-20", 3);
  expect("text" in capped && capped.text).toContain("lines 10-12 of 50 (capped");

  const bad = readFileWithRange(file, "f.txt", "nope");
  expect("error" in bad).toBe(true);
});

test("compileQuery falls back to literal match on invalid regex", () => {
  expect(compileQuery("Character").test("CharacterPanel")).toBe(true);
  // Unbalanced paren is not valid regex — must not throw, matches literally.
  const rx = compileQuery("foo(");
  expect(rx.test("foo(bar")).toBe(true);
});

function sym(name: string, line: number): OutlineSym {
  return { kind: "method", name, signature: `void ${name}()`, startLine: line, endLine: line, depth: 1 };
}

test("capOutline caps total symbols across files and marks the remainder", () => {
  const entries = [
    { file: "a.cs", symbols: [sym("A1", 1), sym("A2", 2), sym("A3", 3)] },
    { file: "b.cs", symbols: [sym("B1", 1), sym("B2", 2)] },
  ];
  // Under cap — everything shown, no marker.
  expect(capOutline(entries, undefined, 10)).not.toContain("hidden");
  // Over cap — 5 total, cap 3 → 2 hidden, second file partially dropped.
  const capped = capOutline(entries, 3);
  expect(capped).toContain("…[2 of 5 symbols hidden");
  expect(capped).toContain("A3");
  expect(capped).not.toContain("B2");
});

test("capHits caps a flat hit list and marks the remainder", () => {
  const hits = Array.from({ length: 12 }, (_, i) => `f.cs:${i}-${i}  method M${i}`);
  expect(capHits(hits, undefined, 100)).not.toContain("hidden");
  const capped = capHits(hits, 5);
  expect(capped).toContain("…[7 of 12 hits hidden");
  expect(capped.split("\n").filter(l => l.startsWith("f.cs")).length).toBe(5);
});

test("capSymbols leaves a within-budget list untouched, no truncated flag", () => {
  const flat = [{ name: "A" }, { name: "B" }];
  const out = capSymbols(flat, 5);
  expect(out.symbols).toEqual(flat);
  expect(out.truncated).toBeUndefined();
});

test("capSymbols slices an over-budget list and sets truncated", () => {
  const flat = Array.from({ length: 10 }, (_, i) => ({ name: `S${i}` }));
  const out = capSymbols(flat, 3);
  expect(out.symbols.length).toBe(3);
  expect(out.symbols.map((s) => s.name)).toEqual(["S0", "S1", "S2"]);
  expect(out.truncated).toBe(true);
});

test("capSymbols does not truncate when length exactly equals the cap", () => {
  const flat = [{ name: "A" }, { name: "B" }, { name: "C" }];
  const out = capSymbols(flat, 3);
  expect(out.symbols).toEqual(flat);
  expect(out.truncated).toBeUndefined();
});

// Integration: exercises the Roslyn outliner edge cases (delegate, event,
// operator, indexer, generics). Skips when Sector.Cli is not built.
const CLI_DLL = join(import.meta.dir, "../../Sector.Cli/bin/Debug/net10.0/Sector.Cli.dll");
const csTest = existsSync(CLI_DLL) ? test : test.skip;

csTest("sector_ast outliner handles delegates, events, operators, indexers, generics", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ast-"));
  const file = join(dir, "Edge.cs");
  writeFileSync(file, [
    "namespace Edge {",
    "  public delegate void Notify<T>(T value);",
    "  public sealed class Box<TItem> {",
    "    public event Notify<TItem>? Changed;",
    "    public TItem this[int i] => default!;",
    "    public static Box<TItem> operator +(Box<TItem> a, Box<TItem> b) => a;",
    "    public TResult Map<TResult>(System.Func<TItem, TResult> f) => default!;",
    "  }",
    "}",
  ].join("\n"));

  const result = await $`dotnet ${CLI_DLL} ast --path ${file}`.quiet().nothrow();
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout.toString()) as { symbols: OutlineSym[] }[];
  const byKind = new Map<string, OutlineSym[]>();
  for (const s of parsed[0]!.symbols) {
    (byKind.get(s.kind) ?? byKind.set(s.kind, []).get(s.kind)!).push(s);
  }
  expect(byKind.get("delegate")?.[0]?.name).toBe("Notify<T>");
  expect(byKind.get("class")?.[0]?.name).toBe("Box<TItem>");
  expect(byKind.get("event")?.[0]?.name).toBe("Changed");
  expect(byKind.get("indexer")?.[0]?.name).toBe("this[]");
  expect(byKind.get("operator")?.[0]?.name).toBe("operator +");
  expect(byKind.get("method")?.[0]?.name).toBe("Map<TResult>");
}, 60_000);

csTest("sector_ast --refs finds the definition and cross-file references of a symbol", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ast-refs-"));
  writeFileSync(join(dir, "Widget.cs"), [
    "namespace R {",
    "  public static class Widget {",
    "    public static int Compute(int x) => x + 1;",
    "  }",
    "}",
  ].join("\n"));
  writeFileSync(join(dir, "Caller.cs"), [
    "namespace R {",
    "  public static class Caller {",
    "    public static int Use() => Widget.Compute(41) + Widget.Compute(0);",
    "  }",
    "}",
  ].join("\n"));

  const result = await $`dotnet ${CLI_DLL} ast --path ${dir} --refs Compute`.quiet().nothrow();
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout.toString()) as { file: string; symbols: OutlineSym[] }[];
  const flat = parsed.flatMap((e) => e.symbols);
  const kinds = flat.map((s) => s.kind).sort();
  expect(kinds.filter((k) => k === "definition").length).toBe(1);
  expect(kinds.filter((k) => k === "reference").length).toBe(2);
  expect(flat.every((s) => s.name === "Compute")).toBe(true);
}, 60_000);
