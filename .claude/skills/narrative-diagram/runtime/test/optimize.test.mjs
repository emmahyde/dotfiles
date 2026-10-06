// optimize.test.mjs — the SVGO preservation boundary modeled on
// docs/diagrams/poc-svgo-contract.html: accessibility, stable hooks, marker
// references, runtime state selectors survive; script and event handlers are
// rejected.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { optimizeSvg, svgoConfig, assertOptimizationContract, collectContractExpectations } from "../src/optimize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");

test("contract fixture survives optimization with all hooks and .drawer.open", () => {
  const raw = fixture("contract-input.svg");
  const out = optimizeSvg(raw, svgoConfig());
  const expected = collectContractExpectations(raw);
  assert.deepEqual(assertOptimizationContract(out, expected), []);
  for (const id of ["title", "desc", "mex-arrow", "n-context", "mex-detail"]) {
    assert.ok(new RegExp(`id="${id}"`).test(out), `missing id ${id} after optimization`);
  }
  assert.match(out, /\.drawer\.open/);
  assert.ok(out.length < raw.length, "optimization should shrink the fixture");
});

test("fixture with script or event handler is rejected by the contract", () => {
  const raw = fixture("unsafe-input.svg");
  const out = optimizeSvg(raw, svgoConfig());
  const failures = assertOptimizationContract(out, collectContractExpectations(raw));
  assert.ok(failures.some((f) => /script/.test(f)), `expected script failure, got ${JSON.stringify(failures)}`);
  assert.ok(failures.some((f) => /event-handler/.test(f)), `expected handler failure, got ${JSON.stringify(failures)}`);
});
