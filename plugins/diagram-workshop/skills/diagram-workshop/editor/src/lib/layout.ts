import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramNode, DiagramEdge, LayoutOptions } from './types';

const elk = new ELK();

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

export interface PositionedNode extends DiagramNode {
  x: number;
  y: number;
}

export async function elkLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: LayoutOptions = {}
): Promise<PositionedNode[]> {
  const algorithm = options.algorithm ?? 'layered';
  const direction = options.direction ?? 'DOWN';

  // Separate nodes that already have explicit positions from those that need layout
  const manualNodes = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  const autoNodes = nodes.filter((n) => n.x === undefined || n.y === undefined);

  if (autoNodes.length === 0) {
    // All nodes are manually positioned — nothing to compute
    return nodes.map((n) => ({ ...n, x: n.x!, y: n.y! }));
  }

  // Only run ELK over the auto-layout nodes
  const autoNodeIds = new Set(autoNodes.map((n) => n.id));
  const relevantEdges = edges.filter(
    (e) => autoNodeIds.has(e.source) && autoNodeIds.has(e.target)
  );

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': algorithm,
      'elk.direction': direction,
      'elk.spacing.nodeNode': '60',
      'elk.spacing.edgeNode': '30',
    },
    children: autoNodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: relevantEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const laid = await elk.layout(graph);

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of laid.children ?? []) {
    positionMap.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
    });
  }

  return nodes.map((n) => {
    if (n.x !== undefined && n.y !== undefined) {
      return { ...n, x: n.x, y: n.y };
    }
    const pos = positionMap.get(n.id) ?? { x: 0, y: 0 };
    return { ...n, x: pos.x, y: pos.y };
  });
}
