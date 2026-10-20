// validate.mjs — strict DiagramIntent/v1 validation.
// Every diagnostic carries { code, message, path } where path is an RFC 6901
// JSON pointer. Unknown fields are rejected at every level. Compile proceeds
// only when errors is empty; warnings never block.

import {
  INTENT_VERSION,
  INTENT_KINDS,
  NODE_KINDS,
  RELATIONS,
  PORTS,
  DIRECTIONS,
  ENTITY_ROLES,
  CARDINALITIES,
  LAYOUT_SOURCES,
  FLOW_FIELDS,
  NODE_FIELDS,
  DETAIL_FIELDS,
  EDGE_FIELDS,
  ENDPOINT_FIELDS,
  PRESENTATION_FIELDS,
  LAYOUT_FIELDS,
  LAYOUT_NODE_FIELDS,
  SCHEMA_FIELDS,
  NAMESPACE_FIELDS,
  ENTITY_FIELDS,
  SCHEMA_RELATION_FIELDS,
  isPlainObject,
} from "./intent.mjs";

const ID_RE = /^[a-z][a-z0-9-]*$/;
// Entities/namespaces/relations are table-ish names (snake_case allowed).
const SCHEMA_ID_RE = /^[a-z][a-z0-9_-]*$/;

function escapeSegment(segment) {
  return String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
}

// Build a fresh RFC 6901 pointer from raw segments.
function ptr(...segments) {
  return "/" + segments.map(escapeSegment).join("/");
}

// Append a key to an already-built pointer.
function at(path, key) {
  return path === ""
    ? "/" + escapeSegment(key)
    : path + "/" + escapeSegment(key);
}

function error(code, message, path) {
  return { code, message, path };
}

function warn(code, message, path) {
  return { code, message, path };
}

function checkFields(obj, allowed, path, errors) {
  if (!isPlainObject(obj)) {
    errors.push(error("INVALID_TYPE", "expected an object", path));
    return;
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(
        error("UNKNOWN_FIELD", `unknown field "${key}"`, at(path, key)),
      );
    }
  }
}

function checkId(id, path, errors, duplicates, kindName, schema = false) {
  if (typeof id !== "string") {
    errors.push(error("INVALID_ID", `${kindName} id must be a string`, path));
    return;
  }
  const re = schema ? SCHEMA_ID_RE : ID_RE;
  if (!re.test(id)) {
    errors.push(error("INVALID_ID", `invalid ${kindName} id "${id}"`, path));
    return;
  }
  if (duplicates.has(id)) {
    errors.push(
      error("DUPLICATE_ID", `duplicate ${kindName} id "${id}"`, path),
    );
  }
  duplicates.add(id);
}

function checkText(value, path, errors, what) {
  if (typeof value !== "string") {
    errors.push(error("INVALID_TYPE", `${what} must be a string`, path));
  } else if (value.trim().length === 0) {
    errors.push(error("BLANK_TEXT", `${what} must not be blank`, path));
  }
}

function checkPort(value, path, errors) {
  if (value !== undefined && !PORTS.includes(value)) {
    errors.push(
      error(
        "INVALID_PORT",
        `invalid port "${value}" (expected n, e, s or w)`,
        path,
      ),
    );
  }
}

function checkEndpoint(endpoint, path, errors, knownNodeIds) {
  checkFields(endpoint, ENDPOINT_FIELDS, path, errors);
  if (!isPlainObject(endpoint)) return null;
  const node = endpoint.node;
  if (typeof node !== "string") {
    errors.push(
      error(
        "DANGLING_ENDPOINT",
        "endpoint node must be a string",
        at(path, "node"),
      ),
    );
    return null;
  }
  if (!knownNodeIds.has(node)) {
    errors.push(
      error(
        "DANGLING_ENDPOINT",
        `endpoint references unknown node "${node}"`,
        at(path, "node"),
      ),
    );
  }
  checkPort(endpoint.port, at(path, "port"), errors);
  return node;
}

function checkPresentation(intent, errors, warnings) {
  const presentation = intent.presentation;
  checkFields(presentation, PRESENTATION_FIELDS, "/presentation", errors);
  if (!isPlainObject(presentation) || !isPlainObject(presentation.layout)) {
    if (!errors.some((d) => d.code === "INVALID_TYPE")) {
      errors.push(
        error(
          "INVALID_TYPE",
          "presentation.layout must be an object",
          "/presentation/layout",
        ),
      );
    }
    return;
  }
  const layout = presentation.layout;
  checkFields(layout, LAYOUT_FIELDS, "/presentation/layout", errors);
  const source = layout.source;
  if (source !== undefined && !LAYOUT_SOURCES.includes(source)) {
    errors.push(
      error(
        "UNSUPPORTED_LAYOUT_SOURCE",
        `unsupported layout source "${source}" (expected auto or grammy)`,
        "/presentation/layout/source",
      ),
    );
  }
  if (!isPlainObject(layout.nodes)) {
    errors.push(
      error(
        "INVALID_TYPE",
        "presentation.layout.nodes must be an object",
        "/presentation/layout/nodes",
      ),
    );
    return;
  }

  const known = new Set(
    intent.kind === "flow" ? (intent.nodes || []).map((n) => n.id) : [],
  );
  let used = false;
  for (const id of Object.keys(layout.nodes)) {
    const entry = layout.nodes[id];
    used = true;
    const entryPath = ptr("presentation", "layout", "nodes", id);
    checkFields(entry, LAYOUT_NODE_FIELDS, entryPath, errors);
    if (intent.kind === "schema" || !known.has(id)) {
      warnings.push(
        warn(
          "LAYOUT_UNKNOWN_NODE",
          `layout node "${id}" does not exist in the intent`,
          entryPath,
        ),
      );
      continue;
    }
    for (const axis of ["x", "y"]) {
      if (typeof entry[axis] !== "number" || !Number.isFinite(entry[axis])) {
        warnings.push(
          warn(
            "LAYOUT_INVALID_COORD",
            `layout node "${id}" has a non-finite ${axis} coordinate`,
            at(entryPath, axis),
          ),
        );
      }
    }
  }
  if (intent.kind === "flow" && source === "auto" && used) {
    warnings.push(
      warn(
        "LAYOUT_IGNORED",
        "layout nodes are ignored when source is auto",
        "/presentation/layout/nodes",
      ),
    );
  }
  if (
    intent.kind === "flow" &&
    source === "grammy" &&
    Array.isArray(intent.nodes)
  ) {
    const provided = new Set(Object.keys(layout.nodes));
    for (const node of intent.nodes) {
      if (!provided.has(node.id)) {
        warnings.push(
          warn(
            "LAYOUT_OMITS_NODE",
            `grammy layout omits node "${node.id}"`,
            "/presentation/layout/nodes",
          ),
        );
      }
    }
    const invalid = intent.nodes.some((node) => {
      const entry = layout.nodes[node.id];
      return (
        !isPlainObject(entry) ||
        typeof entry.x !== "number" ||
        !Number.isFinite(entry.x) ||
        typeof entry.y !== "number" ||
        !Number.isFinite(entry.y)
      );
    });
    const omitted = intent.nodes.some((node) => !provided.has(node.id));
    if (invalid || omitted) {
      warnings.push(
        warn(
          "LAYOUT_FALLBACK_AUTO",
          "grammy layout is incomplete; falling back to auto layout",
          "/presentation/layout",
        ),
      );
    }
  }
}

function checkFlow(intent, errors, warnings) {
  checkFields(intent, FLOW_FIELDS, "", errors);

  if (
    intent.direction !== undefined &&
    !DIRECTIONS.includes(intent.direction)
  ) {
    errors.push(
      error(
        "UNSUPPORTED_DIRECTION",
        `unsupported direction "${intent.direction}" (expected TB, BT, LR or RL)`,
        "/direction",
      ),
    );
  }

  const nodes = intent.nodes;
  if (!Array.isArray(nodes)) {
    errors.push(error("INVALID_TYPE", "nodes must be an array", "/nodes"));
    return;
  }
  const nodeIds = new Set();
  nodes.forEach((node, i) => {
    const path = ptr("nodes", i);
    checkFields(node, NODE_FIELDS, path, errors);
    if (!isPlainObject(node)) return;
    checkId(node.id, at(path, "id"), errors, nodeIds, "node");
    if (node.kind !== undefined && !NODE_KINDS.includes(node.kind)) {
      errors.push(
        error(
          "UNSUPPORTED_NODE_KIND",
          `unsupported node kind "${node.kind}"`,
          at(path, "kind"),
        ),
      );
    }
    checkText(node.label, at(path, "label"), errors, "node label");
    if (node.detail !== undefined) {
      const detailPath = at(path, "detail");
      checkFields(node.detail, DETAIL_FIELDS, detailPath, errors);
      if (isPlainObject(node.detail)) {
        for (const key of DETAIL_FIELDS) {
          if (
            node.detail[key] !== undefined &&
            typeof node.detail[key] !== "string"
          ) {
            errors.push(
              error(
                "INVALID_TYPE",
                `detail.${key} must be a string`,
                at(detailPath, key),
              ),
            );
          }
        }
      }
    }
  });

  const edges = intent.edges;
  if (!Array.isArray(edges)) {
    errors.push(error("INVALID_TYPE", "edges must be an array", "/edges"));
    return;
  }
  const edgeIds = new Set();
  const branchCounts = new Map();
  edges.forEach((edge, i) => {
    const path = ptr("edges", i);
    checkFields(edge, EDGE_FIELDS, path, errors);
    if (!isPlainObject(edge)) return;
    if (edge.id !== undefined)
      checkId(edge.id, at(path, "id"), errors, edgeIds, "edge");
    const from = checkEndpoint(edge.from, at(path, "from"), errors, nodeIds);
    const to = checkEndpoint(edge.to, at(path, "to"), errors, nodeIds);
    if (from !== null && to !== null && from === to) {
      errors.push(
        error("SELF_LINK", `edge "${from}" links a node to itself`, path),
      );
    }
    if (edge.relation !== undefined && !RELATIONS.includes(edge.relation)) {
      errors.push(
        error(
          "UNSUPPORTED_EDGE_ROLE",
          `unsupported edge relation "${edge.relation}" (expected flow or branch)`,
          at(path, "relation"),
        ),
      );
    }
    if (edge.relation === "branch" && from !== null) {
      const source = nodes.find((n) => n.id === from);
      if (source && source.kind !== "decision") {
        errors.push(
          error(
            "UNSUPPORTED_EDGE_ROLE",
            `branch edges must leave a decision node ("${from}" is ${source.kind})`,
            at(path, "relation"),
          ),
        );
      }
      branchCounts.set(from, (branchCounts.get(from) || 0) + 1);
      if (branchCounts.get(from) > 3) {
        errors.push(
          error(
            "TOO_MANY_BRANCHES",
            `decision "${from}" has more than three outgoing branch edges`,
            at(path, "relation"),
          ),
        );
      }
    }
    if (edge.label !== undefined && typeof edge.label !== "string") {
      errors.push(
        error("INVALID_TYPE", "edge label must be a string", at(path, "label")),
      );
    }
  });

  // Flow root: at least one node with no incoming edge.
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    if (
      isPlainObject(edge) &&
      isPlainObject(edge.to) &&
      indegree.has(edge.to.node)
    ) {
      indegree.set(edge.to.node, indegree.get(edge.to.node) + 1);
    }
  }
  const roots = nodes.filter((n) => (indegree.get(n.id) || 0) === 0);
  if (roots.length === 0) {
    errors.push(
      error(
        "MISSING_FLOW_ROOT",
        "flow has no root node (every node has an incoming edge)",
        "",
      ),
    );
  }
  // Flow terminal: at least one node with no outgoing edge.
  const outdegree = new Map(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    if (
      isPlainObject(edge) &&
      isPlainObject(edge.from) &&
      outdegree.has(edge.from.node)
    ) {
      outdegree.set(edge.from.node, outdegree.get(edge.from.node) + 1);
    }
  }
  if (nodes.filter((n) => (outdegree.get(n.id) || 0) === 0).length === 0) {
    errors.push(
      error(
        "MISSING_FLOW_TERMINAL",
        "flow has no terminal node (every node has an outgoing edge)",
        "",
      ),
    );
  }

  // Reachability from every root (warnings).
  const reachable = new Set(roots.map((n) => n.id));
  let frontier = roots.map((n) => n.id);
  while (frontier.length) {
    const next = new Set();
    for (const edge of edges) {
      if (
        isPlainObject(edge) &&
        reachable.has(edge.from?.node) &&
        !reachable.has(edge.to?.node)
      ) {
        reachable.add(edge.to.node);
        next.add(edge.to.node);
      }
    }
    frontier = [...next];
  }
  nodes.forEach((node, i) => {
    if (!reachable.has(node.id)) {
      warnings.push(
        warn(
          "UNREACHABLE_NODE",
          `node "${node.id}" is not reachable from a flow root`,
          ptr("nodes", i),
        ),
      );
    }
  });
}

function checkSchema(intent, errors, warnings) {
  checkFields(intent, SCHEMA_FIELDS, "", errors);

  const namespaces = intent.namespaces;
  if (!Array.isArray(namespaces)) {
    errors.push(
      error("INVALID_TYPE", "namespaces must be an array", "/namespaces"),
    );
    return;
  }
  const nsIds = new Set();
  const entityIds = new Set();
  namespaces.forEach((ns, i) => {
    const path = ptr("namespaces", i);
    checkFields(ns, NAMESPACE_FIELDS, path, errors);
    if (!isPlainObject(ns)) return;
    checkId(ns.id, at(path, "id"), errors, nsIds, "namespace", true);
    checkText(ns.label, at(path, "label"), errors, "namespace label");
    if (!Array.isArray(ns.entities)) {
      errors.push(
        error(
          "INVALID_TYPE",
          "entities must be an array",
          at(path, "entities"),
        ),
      );
      return;
    }
    ns.entities.forEach((entity, j) => {
      const epath = at(at(path, "entities"), j);
      checkFields(entity, ENTITY_FIELDS, epath, errors);
      if (!isPlainObject(entity)) return;
      checkId(entity.id, at(epath, "id"), errors, entityIds, "entity", true);
      checkText(
        entity.stereotype,
        at(epath, "stereotype"),
        errors,
        "entity stereotype",
      );
      if (entity.role !== undefined && !ENTITY_ROLES.includes(entity.role)) {
        errors.push(
          error(
            "UNSUPPORTED_NODE_ROLE",
            `unsupported entity role "${entity.role}" (expected core, secondary, dependency, runtime or new)`,
            at(epath, "role"),
          ),
        );
      }
      if (!Array.isArray(entity.fields)) {
        errors.push(
          error("INVALID_TYPE", "fields must be an array", at(epath, "fields")),
        );
        return;
      }
      entity.fields.forEach((field, k) => {
        checkText(field, at(at(epath, "fields"), k), errors, "entity field");
      });
    });
  });

  const relations = intent.relations;
  if (!Array.isArray(relations)) {
    errors.push(
      error("INVALID_TYPE", "relations must be an array", "/relations"),
    );
    return;
  }
  const relIds = new Set();
  relations.forEach((rel, i) => {
    const path = ptr("relations", i);
    checkFields(rel, SCHEMA_RELATION_FIELDS, path, errors);
    if (!isPlainObject(rel)) return;
    if (rel.id !== undefined)
      checkId(rel.id, at(path, "id"), errors, relIds, "relation", true);
    for (const side of ["from", "to"]) {
      if (typeof rel[side] !== "string") {
        errors.push(
          error(
            "DANGLING_ENDPOINT",
            `relation ${side} must be an entity id`,
            at(path, side),
          ),
        );
      } else if (!entityIds.has(rel[side])) {
        errors.push(
          error(
            "DANGLING_ENDPOINT",
            `relation references unknown entity "${rel[side]}"`,
            at(path, side),
          ),
        );
      }
    }
    if (
      typeof rel.from === "string" &&
      typeof rel.to === "string" &&
      rel.from === rel.to
    ) {
      errors.push(
        error(
          "SELF_LINK",
          `relation "${rel.from}" links an entity to itself`,
          path,
        ),
      );
    }
    if (
      rel.cardinality !== undefined &&
      !CARDINALITIES.includes(rel.cardinality)
    ) {
      errors.push(
        error(
          "UNSUPPORTED_CARDINALITY",
          `unsupported cardinality "${rel.cardinality}"`,
          at(path, "cardinality"),
        ),
      );
    }
    if (rel.label !== undefined && typeof rel.label !== "string") {
      errors.push(
        error(
          "INVALID_TYPE",
          "relation label must be a string",
          at(path, "label"),
        ),
      );
    }
  });
}

export function validateIntent(intent) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(intent)) {
    errors.push(error("INVALID_TYPE", "intent must be an object", ""));
    return { errors, warnings };
  }
  if (intent.version !== INTENT_VERSION) {
    errors.push(
      error(
        "UNSUPPORTED_VERSION",
        `unsupported version "${intent.version}" (expected ${INTENT_VERSION})`,
        "/version",
      ),
    );
  }
  if (intent.kind === undefined || !INTENT_KINDS.includes(intent.kind)) {
    errors.push(
      error(
        "UNSUPPORTED_KIND",
        `unsupported intent kind "${intent.kind}" (expected flow or schema)`,
        "/kind",
      ),
    );
    return { errors, warnings };
  }
  checkText(intent.title, "/title", errors, "title");
  checkText(intent.description, "/description", errors, "description");

  if (intent.kind === "flow") checkFlow(intent, errors, warnings);
  else checkSchema(intent, errors, warnings);
  checkPresentation(intent, errors, warnings);
  return { errors, warnings };
}
