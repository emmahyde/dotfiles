#!/usr/bin/env node
// cli.mjs — diagram-runtime: validate / compile / export-mermaid / import-grammy-layout.
// The runtime is standalone and dependency-free beyond elkjs + svgo; it does not
// import or expose mex-agent and carries no telemetry hook.

import { readFile, writeFile } from "node:fs/promises";
import { parseIntent, IntentParseError } from "./intent.mjs";
import { validateIntent } from "./validate.mjs";
import { layoutFlow, layoutSchema } from "./layout.mjs";
import { renderFlow, renderSchema } from "./render-svg.mjs";
import {
  optimizeSvg,
  assertOptimizationContract,
  collectContractExpectations,
  svgoConfig,
} from "./optimize.mjs";
import { exportMermaid, importGrammyLayout, MermaidExportError } from "./mermaid.mjs";

const USAGE = `diagram-runtime — compile DiagramIntent/v1 into accessible static SVG

Commands:
  diagram-runtime validate --input <intent.json> [--report <diagnostics.json>]
  diagram-runtime compile --input <intent.json> --svg <diagram.svg> [--report <diagnostics.json>] [--theme light|dark]
  diagram-runtime export-mermaid --input <intent.json> --out <diagram.mmd>
  diagram-runtime import-grammy-layout --input <intent.json> --mermaid <diagram.mmd> --out <intent-with-layout.json> [--report <diagnostics.json>]
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) args[key] = true;
    else {
      args[key] = value;
      i++;
    }
  }
  return args;
}

class CliError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

async function writeReport(args, data) {
  if (args.report) {
    await writeFile(args.report, JSON.stringify(data, null, 2) + "\n");
  }
  for (const w of data.warnings || []) {
    process.stderr.write(`warning [${w.code}] ${w.message} (${w.path})\n`);
  }
}

async function fail(args, code, message, exitCode = 1) {
  if (args.report) {
    try {
      await writeFile(args.report, JSON.stringify({ ok: false, error: { code, message } }, null, 2) + "\n");
    } catch {
      // Report path is best-effort on failure paths.
    }
  }
  process.stderr.write(`diagram-runtime: ${message}\n`);
  process.exit(exitCode);
}

async function loadIntent(args) {
  if (!args.input) throw new CliError("USAGE", "--input <intent.json> is required");
  const text = await readFile(args.input, "utf8");
  return parseIntent(text);
}

async function cmdValidate(args) {
  const intent = await loadIntent(args);
  const { errors, warnings } = validateIntent(intent);
  await writeReport(args, { ok: errors.length === 0, errors, warnings });
  if (errors.length) process.exit(1);
}

async function cmdCompile(args) {
  const theme = args.theme === "dark" ? "dark" : "light";
  const intent = await loadIntent(args);
  const { errors, warnings } = validateIntent(intent);
  if (errors.length) {
    await writeReport(args, { ok: false, errors, warnings, theme });
    process.exit(1);
  }
  const layout = intent.kind === "flow" ? await layoutFlow(intent) : await layoutSchema(intent);
  const rendered = intent.kind === "flow" ? renderFlow(intent, layout, theme) : renderSchema(intent, layout, theme);
  const expected = collectContractExpectations(rendered);
  const optimized = optimizeSvg(rendered, svgoConfig());
  const contract = assertOptimizationContract(optimized, expected);
  if (contract.length) {
    await writeReport(args, { ok: false, errors: [], warnings, theme, contract });
    process.exit(1);
  }
  if (!args.svg) throw new CliError("USAGE", "--svg <diagram.svg> is required");
  await writeFile(args.svg, optimized);
  await writeReport(args, {
    ok: true,
    errors: [],
    warnings,
    theme,
    contract: "ok",
    svg: args.svg,
    bytes: Buffer.byteLength(optimized),
  });
}

async function cmdExportMermaid(args) {
  const intent = await loadIntent(args);
  const { errors, warnings } = validateIntent(intent);
  if (errors.length) {
    await writeReport(args, { ok: false, errors, warnings });
    process.exit(1);
  }
  try {
    const layout = await layoutFlow(intent);
    const text = exportMermaid(intent, layout);
    if (!args.out) throw new CliError("USAGE", "--out <diagram.mmd> is required");
    await writeFile(args.out, text);
    await writeReport(args, { ok: true, errors: [], warnings });
  } catch (error) {
    if (error instanceof MermaidExportError) {
      await writeReport(args, { ok: false, errors: [], warnings, error: { code: error.code, message: error.message } });
      process.exit(1);
    }
    throw error;
  }
}

async function cmdImportGrammyLayout(args) {
  const intent = await loadIntent(args);
  if (!args.mermaid) throw new CliError("USAGE", "--mermaid <diagram.mmd> is required");
  if (!args.out) throw new CliError("USAGE", "--out <intent-with-layout.json> is required");
  const mermaidText = await readFile(args.mermaid, "utf8");
  const { intent: updated, warnings } = importGrammyLayout(mermaidText, intent);
  await writeFile(args.out, JSON.stringify(updated, null, 2) + "\n");
  await writeReport(args, { ok: true, errors: [], warnings });
}

const COMMANDS = {
  validate: cmdValidate,
  compile: cmdCompile,
  "export-mermaid": cmdExportMermaid,
  "import-grammy-layout": cmdImportGrammyLayout,
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (args.help || !command) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 2);
  }
  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`diagram-runtime: unknown command "${command}"\n\n${USAGE}`);
    process.exit(2);
  }
  try {
    await handler(args);
  } catch (error) {
    if (error instanceof IntentParseError || error instanceof CliError) {
      await fail(args, error.code, error.message, error.exitCode ?? 2);
    }
    await fail(args, "IO_ERROR", error.message, 2);
  }
}

main();
