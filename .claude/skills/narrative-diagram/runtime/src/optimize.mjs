// optimize.mjs — SVGO preservation boundary. After optimization the compile
// revalidates an explicit contract: accessibility hooks, stable prefixed IDs,
// marker/aria references, data-* node hooks, and the absence of script or
// event-handler attributes. compile fails when the contract fails.

import { optimize } from "svgo";

export function svgoConfig() {
  return {
    multipass: false,
    floatPrecision: 3,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            inlineStyles: false,
            minifyStyles: false,
            removeHiddenElems: false,
            removeEmptyText: false,
            removeUnknownsAndDefaults: { keepRoleAttr: true },
            // cleanupIds does not treat aria-labelledby as a reference, so
            // title/desc ids would be dropped as "unused" otherwise.
            cleanupIds: {
              preservePrefixes: ["n-", "e-", "mex-"],
              preserve: ["title", "desc"],
            },
            convertPathData: { floatPrecision: 3 },
          },
        },
      },
    ],
  };
}

export function optimizeSvg(svg, config = svgoConfig()) {
  return optimize(svg, config).data;
}

// What the renderer produced, captured before optimization so the post-pass can
// assert nothing was lost.
export function collectContractExpectations(svg) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  return {
    ids: ids.filter((id) => /^(n-|e-|mex-)/.test(id)),
    nodeHooks: [...svg.matchAll(/\bdata-node-id="([^"]+)"/g)].map((m) => m[1]),
    roles: [...svg.matchAll(/\bdata-role="([^"]+)"/g)].map((m) => m[1]),
    entities: [...svg.matchAll(/\bdata-entity-id="([^"]+)"/g)].map((m) => m[1]),
  };
}

export function assertOptimizationContract(svg, expected = {}) {
  const failures = [];
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

  for (const id of expected.ids || []) {
    if (!ids.has(id)) failures.push(`missing id "${id}" after optimization`);
  }
  for (const hook of expected.nodeHooks || []) {
    if (!svg.includes(`data-node-id="${hook}"`)) {
      failures.push(`missing data-node-id hook "${hook}" after optimization`);
    }
  }
  for (const role of expected.roles || []) {
    if (!svg.includes(`data-role="${role}"`)) {
      failures.push(`missing data-role hook "${role}" after optimization`);
    }
  }
  for (const id of expected.entities || []) {
    if (!svg.includes(`data-entity-id="${id}"`)) {
      failures.push(`missing data-entity-id hook "${id}" after optimization`);
    }
  }

  if (!/<svg[^>]*\brole="/.test(svg)) {
    failures.push('root svg is missing role="..."');
  }
  if (!/<svg[^>]*\baria-labelledby=/.test(svg)) {
    failures.push("root svg is missing aria-labelledby");
  }

  const title = svg.match(/<title[^>]*>([^<]*)<\/title>/);
  if (!title || !title[1].trim()) failures.push("title is missing or empty");
  const desc = svg.match(/<desc[^>]*>([^<]*)<\/desc>/);
  if (!desc || !desc[1].trim()) failures.push("desc is missing or empty");

  for (const m of svg.matchAll(/\bmarker-end="url\(#([^)]+)\)"/g)) {
    if (!ids.has(m[1]))
      failures.push(`marker-end references missing id "${m[1]}"`);
  }
  const labelledby = svg.match(/\baria-labelledby="([^"]+)"/);
  if (labelledby) {
    for (const token of labelledby[1].split(/\s+/)) {
      if (!ids.has(token))
        failures.push(`aria-labelledby references missing id "${token}"`);
    }
  }

  if (/<script/i.test(svg)) failures.push("svg contains a script element");
  if (/\son[a-z]+\s*=/i.test(svg))
    failures.push("svg contains an event-handler attribute");
  return failures;
}
