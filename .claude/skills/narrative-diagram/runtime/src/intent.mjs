// intent.mjs — DiagramIntent/v1: the canonical, diagram-native semantic language.
// This module owns the version constant, the strict field vocabulary, and the
// normalization boundary (defaults applied before validation). It never renders.

export const INTENT_VERSION = "diagram-intent/v1";
export const INTENT_KINDS = ["flow", "schema"];
export const NODE_KINDS = [
  "event",
  "activity",
  "decision",
  "store",
  "external",
];
export const RELATIONS = ["flow", "branch"];
export const PORTS = ["n", "e", "s", "w"];
export const DIRECTIONS = ["TB", "BT", "LR", "RL"];
export const ENTITY_ROLES = [
  "core",
  "secondary",
  "dependency",
  "runtime",
  "new",
];
export const CARDINALITIES = [
  "one-to-one",
  "one-to-many",
  "many-to-one",
  "many-to-many",
];
export const LAYOUT_SOURCES = ["auto", "grammy"];

export const FLOW_FIELDS = [
  "version",
  "kind",
  "title",
  "description",
  "direction",
  "nodes",
  "edges",
  "presentation",
];
export const NODE_FIELDS = ["id", "kind", "label", "detail"];
export const DETAIL_FIELDS = ["summary", "source", "contract"];
export const EDGE_FIELDS = ["id", "from", "to", "relation", "label"];
export const ENDPOINT_FIELDS = ["node", "port"];
export const PRESENTATION_FIELDS = ["layout"];
export const LAYOUT_FIELDS = ["source", "nodes"];
export const LAYOUT_NODE_FIELDS = ["x", "y"];
export const SCHEMA_FIELDS = [
  "version",
  "kind",
  "title",
  "description",
  "namespaces",
  "relations",
  "presentation",
];
export const NAMESPACE_FIELDS = ["id", "label", "entities"];
export const ENTITY_FIELDS = ["id", "stereotype", "fields", "role"];
export const SCHEMA_RELATION_FIELDS = [
  "id",
  "from",
  "to",
  "cardinality",
  "label",
];

// Built-in words that would break unquoted mermaid node ids.
export const MERMAID_RESERVED = new Set([
  "end",
  "subgraph",
  "graph",
  "flowchart",
  "direction",
  "class",
  "click",
  "style",
  "linkStyle",
  "title",
  "accTitle",
  "accDescr",
]);

// Shape tokens per flow node kind, in Mermaid notation ([ ]) { } [( )] [[ ]] ([ ]).
export const MERMAID_SHAPES = {
  event: ["([", "])"],
  activity: ["[", "]"],
  decision: ["{", "}"],
  store: ["[(", ")]"],
  external: ["[[", "]]"],
};

export class IntentParseError extends Error {
  constructor(message) {
    super(message);
    this.code = "INPUT_JSON_SYNTAX";
    this.name = "IntentParseError";
  }
}

export function parseIntent(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new IntentParseError(`input is not valid JSON: ${error.message}`);
  }
  return normalizeIntent(raw);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defaultPresentation() {
  return { layout: { source: "auto", nodes: {} } };
}

function generatedId(prefix, from, to, taken) {
  let base = `${prefix}-${from}-${to}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// Apply defaults and generate missing edge/relation ids. Unknown fields are
// preserved here; validate.mjs rejects them. The returned object is a fresh
// deep-ish clone so callers can never mutate the caller's input.
export function normalizeIntent(raw) {
  if (!isPlainObject(raw)) {
    throw new IntentParseError("intent must be a JSON object");
  }
  const out = { ...raw };
  // Only flow intents carry a direction; schema intents must not be polluted
  // by a default that strict validation would then reject.
  if (out.kind === "flow" && out.direction === undefined) out.direction = "TB";
  if (out.presentation === undefined) out.presentation = defaultPresentation();
  else if (
    isPlainObject(out.presentation) &&
    out.presentation.layout === undefined
  ) {
    out.presentation = {
      ...out.presentation,
      layout: defaultPresentation().layout,
    };
  }

  const taken = new Set();
  if (Array.isArray(out.nodes)) {
    out.nodes = out.nodes.map((node) => {
      const copy = isPlainObject(node) ? { ...node } : node;
      if (isPlainObject(copy.detail)) copy.detail = { ...copy.detail };
      return copy;
    });
  }
  if (Array.isArray(out.edges)) {
    out.edges = out.edges.map((edge) => {
      const copy = isPlainObject(edge) ? { ...edge } : edge;
      if (isPlainObject(copy.from)) copy.from = { ...copy.from };
      if (isPlainObject(copy.to)) copy.to = { ...copy.to };
      if (copy.id === undefined) {
        copy.id = generatedId("e", copy.from?.node, copy.to?.node, taken);
      } else {
        taken.add(copy.id);
      }
      return copy;
    });
  }
  if (Array.isArray(out.namespaces)) {
    out.namespaces = out.namespaces.map((ns) => {
      const copy = isPlainObject(ns) ? { ...ns } : ns;
      if (Array.isArray(copy.entities)) {
        copy.entities = copy.entities.map((entity) =>
          isPlainObject(entity)
            ? {
                ...entity,
                fields: Array.isArray(entity.fields)
                  ? [...entity.fields]
                  : entity.fields,
              }
            : entity,
        );
      }
      return copy;
    });
  }
  if (Array.isArray(out.relations)) {
    out.relations = out.relations.map((rel) => {
      const copy = isPlainObject(rel) ? { ...rel } : rel;
      if (copy.id === undefined)
        copy.id = generatedId("r", copy.from, copy.to, taken);
      else taken.add(copy.id);
      return copy;
    });
  }
  return out;
}

export { isPlainObject };
