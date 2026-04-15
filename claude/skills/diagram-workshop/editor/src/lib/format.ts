import type { DiagramJson, DiagramNode, DiagramEdge } from './types';

const XYFLOW_INTERNAL_FIELDS = new Set([
  'position', 'measured', 'positionAbsolute', 'dragging',
  'selected', 'resizing', 'draggable', 'selectable',
  'connectable', 'deletable', 'focusable', 'width', 'height',
  'internals', 'data', 'origin', 'extent',
]);

export function parseDiagram(json: string): DiagramJson {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Diagram must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.nodes)) {
    throw new Error('Diagram must have a "nodes" array');
  }
  if (!Array.isArray(obj.edges)) {
    throw new Error('Diagram must have an "edges" array');
  }

  const nodes: DiagramNode[] = (obj.nodes as unknown[]).map((n, i) => {
    if (typeof n !== 'object' || n === null) {
      throw new Error(`Node at index ${i} must be an object`);
    }
    const node = n as Record<string, unknown>;
    if (typeof node.id !== 'string') throw new Error(`Node at index ${i} must have a string id`);
    if (typeof node.label !== 'string') throw new Error(`Node at index ${i} must have a string label`);
    return {
      id: node.id,
      label: node.label,
      type: (node.type as DiagramNode['type']) ?? 'default',
      ...(node.x !== undefined ? { x: node.x as number } : {}),
      ...(node.y !== undefined ? { y: node.y as number } : {}),
    };
  });

  const edges: DiagramEdge[] = (obj.edges as unknown[]).map((e, i) => {
    if (typeof e !== 'object' || e === null) {
      throw new Error(`Edge at index ${i} must be an object`);
    }
    const edge = e as Record<string, unknown>;
    if (typeof edge.id !== 'string') throw new Error(`Edge at index ${i} must have a string id`);
    if (typeof edge.source !== 'string') throw new Error(`Edge at index ${i} must have a string source`);
    if (typeof edge.target !== 'string') throw new Error(`Edge at index ${i} must have a string target`);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label !== undefined ? { label: edge.label as string } : {}),
      style: (edge.style as DiagramEdge['style']) ?? 'solid',
    };
  });

  const layout = obj.layout as DiagramJson['layout'] | undefined;

  return {
    ...(obj.title !== undefined ? { title: obj.title as string } : {}),
    nodes,
    edges,
    layout: {
      algorithm: layout?.algorithm ?? 'layered',
      direction: layout?.direction ?? 'DOWN',
    },
  };
}

export function serializeDiagram(diagram: DiagramJson): string {
  const clean: DiagramJson = {
    ...(diagram.title !== undefined ? { title: diagram.title } : {}),
    nodes: diagram.nodes.map((n) => {
      const node: DiagramNode = {
        id: n.id,
        label: n.label,
        type: n.type,
      };
      // Only keep x/y for user-positioned nodes (they have explicit coordinates)
      if (n.x !== undefined) node.x = n.x;
      if (n.y !== undefined) node.y = n.y;
      return node;
    }),
    edges: diagram.edges.map((e) => {
      const edge: DiagramEdge = {
        id: e.id,
        source: e.source,
        target: e.target,
        style: e.style,
      };
      if (e.label !== undefined) edge.label = e.label;
      return edge;
    }),
    layout: diagram.layout,
  };

  return JSON.stringify(clean, sortedReplacer, 2);
}

function sortedReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}
