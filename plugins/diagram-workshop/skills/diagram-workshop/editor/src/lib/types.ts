export type NodeType = 'default' | 'service' | 'store' | 'user' | 'decision' | 'terminal' | 'io' | 'external';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'bidirectional';
export type LayoutAlgorithm = 'layered' | 'mrtree' | 'stress' | 'rectpacking';
export type LayoutDirection = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

export interface DiagramNode {
  id: string;
  label: string;
  type?: NodeType;
  x?: number;
  y?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: EdgeStyle;
}

export interface LayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
}

export interface DiagramJson {
  title?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layout?: LayoutOptions;
}
