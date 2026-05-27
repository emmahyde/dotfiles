// Source-outline helpers shared by the sector_design / sector_ast MCP tools.
// JSX/JS outlining uses the acorn AST; C# outlining is done by Sector.Cli (Roslyn).

import { readFileSync } from "fs";
import { Parser } from "acorn";
import jsxPlugin from "acorn-jsx";

export interface OutlineSym {
  kind: string;
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  depth?: number;
}

const JsxParser = Parser.extend((jsxPlugin as any)());

/** Outline a JSX/JS file into top-level symbols via the acorn AST. */
export function outlineJsx(absPath: string): OutlineSym[] {
  const src = readFileSync(absPath, "utf-8");
  const srcLines = src.split("\n");
  const ast: any = JsxParser.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const syms: OutlineSym[] = [];
  const sigOf = (node: any): string =>
    (srcLines[node.loc.start.line - 1] ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  const add = (kind: string, name: string, node: any): void => {
    syms.push({ kind, name, signature: sigOf(node), startLine: node.loc.start.line, endLine: node.loc.end.line });
  };
  for (const top of ast.body) {
    let d: any = top;
    if ((d.type === "ExportNamedDeclaration" || d.type === "ExportDefaultDeclaration") && d.declaration) {
      d = d.declaration;
    }
    if (d.type === "FunctionDeclaration" && d.id) {
      add("function", d.id.name, d);
    } else if (d.type === "ClassDeclaration" && d.id) {
      add("class", d.id.name, d);
    } else if (d.type === "VariableDeclaration") {
      for (const decl of d.declarations) {
        if (decl.id?.type !== "Identifier") continue;
        const init: any = decl.init;
        const kind = init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
          ? "function"
          : init && init.type === "ObjectExpression" ? "object" : "const";
        add(kind, decl.id.name, decl);
      }
    }
  }
  return syms;
}

/** Render a symbol outline, indented by declaration depth. */
export function formatOutline(file: string, syms: OutlineSym[]): string {
  if (!syms.length) return `${file}\n  (no symbols)`;
  const rows = syms.map(s => {
    const indent = "  ".repeat((s.depth ?? 0) + 1);
    const range = `${s.startLine}-${s.endLine}`.padEnd(11);
    return `${indent}${range} ${s.kind} ${s.name}`;
  });
  return `${file}\n${rows.join("\n")}`;
}

/** Read a file (or a 'start-end' range of it) with a line cap. */
export function readFileWithRange(
  absPath: string,
  label: string,
  lines?: string,
  limit?: number,
): { text: string } | { error: string } {
  const all = readFileSync(absPath, "utf-8").split("\n");
  let start = 1;
  let end = all.length;
  if (lines) {
    const m = lines.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return { error: `Bad lines range "${lines}" — expected 'start-end' (e.g. '120-200').` };
    start = Math.max(1, parseInt(m[1]!, 10));
    end = Math.min(all.length, parseInt(m[2]!, 10));
  }
  const HARD_CAP = 600;
  const requested = end - start + 1;
  const cap = Math.min(limit && limit > 0 ? Math.min(limit, requested) : requested, HARD_CAP);
  const sliceEnd = start + cap - 1;
  const body = all.slice(start - 1, sliceEnd).map((l, i) => `${start + i}\t${l}`).join("\n");
  const more = sliceEnd < end ? ` (capped — pass lines='${sliceEnd + 1}-${end}' for the rest)` : "";
  return { text: `${label} lines ${start}-${sliceEnd} of ${all.length}${more}:\n${body}` };
}

/**
 * Render a multi-file outline capped to a total symbol budget. Files are emitted
 * in order; symbols beyond `limit` (or `defaultCap`) are dropped with a marker.
 */
export function capOutline(
  entries: { file: string; symbols: OutlineSym[] }[],
  limit?: number,
  defaultCap = 300,
): string {
  const cap = limit && limit > 0 ? limit : defaultCap;
  const total = entries.reduce((n, e) => n + e.symbols.length, 0);
  const blocks: string[] = [];
  let used = 0;
  for (const e of entries) {
    if (used >= cap) break;
    const slice = e.symbols.slice(0, cap - used);
    blocks.push(formatOutline(e.file, slice));
    used += slice.length;
  }
  let text = blocks.join("\n\n");
  if (total > cap) {
    text += `\n\n…[${total - cap} of ${total} symbols hidden — narrow with query=<pat> or raise limit=<n>]`;
  }
  return text;
}

/** Cap a flat list of query-hit lines, appending a truncation marker. */
export function capHits(hits: string[], limit?: number, defaultCap = 100): string {
  const cap = limit && limit > 0 ? limit : defaultCap;
  if (hits.length <= cap) return hits.join("\n");
  return hits.slice(0, cap).join("\n")
    + `\n…[${hits.length - cap} of ${hits.length} hits hidden — refine query or raise limit=<n>]`;
}

/**
 * Cap a flat symbol list to a budget for a structured payload. Returns the list
 * unchanged when within `cap`; otherwise slices it and flags `truncated`.
 */
export function capSymbols<T>(flat: T[], cap: number): { symbols: T[]; truncated?: boolean } {
  return flat.length > cap ? { symbols: flat.slice(0, cap), truncated: true } : { symbols: flat };
}

/** Compile a query into a case-insensitive RegExp, falling back to a literal match. */
export function compileQuery(query: string): RegExp {
  try {
    return new RegExp(query, "i");
  } catch {
    return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}
