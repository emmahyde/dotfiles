import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Box, Text, truncateToWidth } from "@oh-my-pi/pi-tui";
import { encode as encodeToon } from "@toon-format/toon";
import { parse as parseYaml } from "yaml";

type TweakCategory = "Workflow" | "Interface" | "Quality of life";

type Tweak = {
 name: string;
 title: string;
 description: string;
 category: TweakCategory;
 enabled: boolean;
 render: () => string;
};

/**
 * Add future tweaks here. Each entry owns its label, grouping, state, and
 * display copy so the panel does not need to know about individual tweaks.
 */
const TWEAKS: readonly Tweak[] = [
 {
  name: "calm-start",
  title: "Calm start",
  description: "Keeps the first screen focused on the work at hand.",
  category: "Quality of life",
  enabled: true,
  render: () => "A quiet, focused session opening.",
 },
 {
  name: "integrated-tool-expansion",
  title: "Integrated tool expansion",
  description: "Shows prettified structured results in compact rows and expanded output.",
  category: "Interface",
  enabled: true,
  render: () => "JSON and YAML are syntax-colored; terminal hover is unavailable, so the global tools-expand key is used.",
 },
 {
  name: "tool-results-toon",
  title: "Map tool results to TOON",
  description: "Encodes structured JSON/YAML tool results as TOON before display.",
  category: "Interface",
  enabled: true,
  render: () => "Active: structured JSON/YAML results are encoded as TOON before display.",
 },
];

const CATEGORIES: readonly TweakCategory[] = ["Workflow", "Interface", "Quality of life"];

type ThemeLike = {
 fg: (color: string, text: string) => string;
 bold: (text: string) => string;
};

type ToolMessage = {
 customType: string;
 content: string | unknown[];
 details?: {
  toolName: string;
  result: unknown;
  isError?: boolean;
 };
};

type RendererOptions = {
 expanded?: boolean;
};

type StructuredFormat = "json" | "yaml" | "text";

type StructuredText = {
 text: string;
 format: StructuredFormat;
};

const TOON_ENCODER: ((result: unknown) => string) | undefined = encodeToon;

function prettifyYaml(value: string): string {
 const lines = value.trim().split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ""));
 const contentLines = lines.filter((line) => line.trim().length > 0);
 if (contentLines.length === 0) return "";
 const minimumIndent = Math.min(
  ...contentLines.map((line) => (line.match(/^[ \t]*/) ?? [""])[0].replace(/\t/g, "  ").length),
 );
 return lines.map((line) => line.slice(Math.min(minimumIndent, line.length))).join("\n");
}

function structuredResult(result: unknown): StructuredText {
 if (typeof result !== "string") {
  try {
   return { text: JSON.stringify(result, null, 2) ?? String(result), format: "json" };
  } catch {
   return { text: String(result), format: "text" };
  }
 }

 try {
  return { text: JSON.stringify(JSON.parse(result), null, 2), format: "json" };
 } catch {
  // YAML detection is deliberately narrow: require a mapping/sequence marker
  // and a non-scalar parse result so ordinary text is never rewritten.
  if (/^\s*(?:[-?]\s+|[^\n:#]+:\s*(?:\S|$))/m.test(result)) {
   try {
    return { text: prettifyYaml(result), format: "yaml" };
   } catch {
    // Preserve malformed or ambiguous text verbatim.
   }
  }
  return { text: result, format: "text" };
 }
}

function colorizeStructuredLine(line: string, format: StructuredFormat, theme: ThemeLike): string {
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
   return theme.fg(literal === "null" ? "muted" : "info", literal);
  },
 );
 return indent + colored;
}

function mapToolResultToToon(result: unknown): unknown {
 const enabled = TWEAKS.some((tweak) => tweak.name === "tool-results-toon" && tweak.enabled);
 if (!enabled || !TOON_ENCODER) return result;

 if (typeof result === "string") {
  try {
   const parsedJson = JSON.parse(result);
   if (parsedJson !== null && typeof parsedJson === "object") return TOON_ENCODER(parsedJson);
  } catch {
   if (/^\s*(?:[-?]\s+|[^\n:#]+:\s*(?:\S|$))/m.test(result)) {
    try {
     const parsedYaml = parseYaml(result);
     if (parsedYaml !== null && typeof parsedYaml === "object") return TOON_ENCODER(parsedYaml);
    } catch {
     // Preserve malformed or ambiguous text.
    }
   }
  }
  return result;
 }

 if (result !== null && typeof result === "object") return TOON_ENCODER(result);
 return result;
}

function toolMessageRenderer(message: ToolMessage, options: RendererOptions, theme: ThemeLike) {
 const details = message.details;
 const toolName = details?.toolName || "tool";
 const result = details?.result;
 const error = details?.isError;
 const structured = structuredResult(result);
 const pretty = structured.text.trim() || "(empty)";
 const compactBody = pretty
  .split("\n")
  .map((line) => colorizeStructuredLine(line, structured.format, theme))
  .join(" ")
  .replace(/\s+/g, " ")
  .trim() || "(empty)";
 const compactPrefix = `${error ? "✖" : "▶"} ${toolName} [Ctrl+O: expand] · `;
 const compact = [
  theme.fg(error ? "error" : "accent", compactPrefix),
  `${" ".repeat(compactPrefix.length)}${compactBody}`,
 ];
 const lines = options.expanded
  ? [
   `${error ? "✖" : "▶"} ${theme.bold(toolName)} · expanded ${structured.format} output`,
   ...pretty.split("\n").map((line) => colorizeStructuredLine(line, structured.format, theme)),
   theme.fg("muted", "Press Ctrl+O to collapse; terminal hover is not available to extensions."),
  ]
  : compact;

 return {
  render(width: number): readonly string[] {
   return lines.map((line) => truncateToWidth(line, width));
  },
  invalidate() { },
 };
}

function panelComponent(theme: ThemeLike, done: (result: undefined) => void) {
 const groups: Record<TweakCategory, readonly Tweak[]> = {
  Workflow: TWEAKS.filter((tweak) => tweak.category === "Workflow"),
  Interface: TWEAKS.filter((tweak) => tweak.category === "Interface"),
  "Quality of life": TWEAKS.filter((tweak) => tweak.category === "Quality of life"),
 };
 const selectable = CATEGORIES.flatMap((category) => [...groups[category]]);
 const body = new Box(2, 1);
 const content = new Text();
 let selectedIndex = 0;

 const paint = () => {
  const lines: string[] = [
   theme.fg("accent", theme.bold("HYDEMODS")),
   theme.fg("muted", "A visual home for small, composable session tweaks"),
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
    const state = tweak.enabled ? theme.fg("success", "● enabled") : theme.fg("muted", "○ disabled");
    lines.push(` ${marker} ${state}  ${theme.bold(tweak.title)}`);
    lines.push(theme.fg("muted", `           ${tweak.description}`));
    lines.push(`           ${tweak.render()}`);
   }
   lines.push("");
  }

  lines.push(theme.fg("border", "────────────────────────────────────────"));
  lines.push(theme.fg("muted", "↑/↓ or j/k select  ·  Space/Enter toggle  ·  Esc/q close"));
  content.setText(lines.join("\n"));
  body.invalidate();
 };

 const moveSelection = (delta: number) => {
  if (selectable.length === 0) return;
  selectedIndex = (selectedIndex + delta + selectable.length) % selectable.length;
  paint();
 };

 const toggleSelected = () => {
  const tweak = selectable[selectedIndex];
  if (!tweak) return;
  tweak.enabled = !tweak.enabled;
  paint();
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
   if (data === " " || data === "\r" || data === "\n") toggleSelected();
  },
 };
}

export default function hydemods(pi: ExtensionAPI): void {
 pi.registerMessageRenderer("integrated-tool-expansion", (message, options, theme) =>
  toolMessageRenderer(
   message as ToolMessage,
   options as RendererOptions,
   {
    fg: (color, text) => theme.fg(color as Parameters<typeof theme.fg>[0], text),
    bold: (text) => theme.bold(text),
   },
  ),
 );

 pi.on("tool_execution_end", (event) => {
  if (!TWEAKS.some((tweak) => tweak.name === "integrated-tool-expansion" && tweak.enabled)) return;
  const result = mapToolResultToToon(event.result);
  pi.sendMessage({
   customType: "integrated-tool-expansion",
   content: `Tool ${event.toolName} completed.`,
   details: {
    toolName: event.toolName,
    result,
    isError: event.isError,
   },
   display: true,
  });
 });

 pi.registerCommand("hydemods", {
  description: "Open the Hydemods visual tweak panel",
  handler: async (_args, ctx) => {
   if (!ctx.hasUI) return;
   await ctx.ui.custom(
    (_tui, theme, keybindings, done) => {
     const component = panelComponent(
      {
       fg: (color, text) => {
        // Theme's color union is narrower than the registry's category labels.
        const themeColor = color as Parameters<typeof theme.fg>[0];
        return theme.fg(themeColor, text);
       },
       bold: (text) => theme.bold(text),
      },
      done,
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
