import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { mock } from "bun:test";

// Hydemods uses the running OMP's modules, not a second installed SDK copy.
// Standalone tests resolve those same peer imports from the installed launcher.
const executable = Bun.which("omp");
if (!executable) {
	// Without a host there is nothing to exercise; skip the suite with a clear reason instead of
	// failing every file on an unresolvable `@oh-my-pi/*` import. `bun run typecheck` still runs.
	console.warn("\nhydemods tests skipped: `omp` is not on PATH (the tests run against the installed OMP).\n");
	process.exit(0);
}
const hostDirectory = dirname(realpathSync(executable));
const specifier = "@oh-my-pi/pi-coding-agent/mcp/manager";
const hostModule = await import(Bun.resolveSync(specifier, hostDirectory));
// Alias only: use the real host implementation, with no mocked behavior.
mock.module(specifier, () => hostModule);
