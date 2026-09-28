import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { mock } from "bun:test";

// Hydemods uses the running OMP's modules, not a second installed SDK copy.
// Standalone tests resolve those same peer imports from the installed launcher.
const executable = Bun.which("omp");
if (!executable) throw new Error("Hydemods tests require omp on PATH.");
const hostDirectory = dirname(realpathSync(executable));
const specifier = "@oh-my-pi/pi-coding-agent/mcp/manager";
const hostModule = await import(Bun.resolveSync(specifier, hostDirectory));
// Alias only: use the real host implementation, with no mocked behavior.
mock.module(specifier, () => hostModule);
