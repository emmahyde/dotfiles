import type { EdgeTypes } from '@xyflow/react';
import { DefaultEdge } from './DefaultEdge';
import { DashedEdge } from './DashedEdge';
import { BidirectionalEdge } from './BidirectionalEdge';

export const edgeTypes: EdgeTypes = {
  default: DefaultEdge,
  dashed: DashedEdge,
  dotted: DashedEdge,
  bidirectional: BidirectionalEdge,
};

export { DefaultEdge, DashedEdge, BidirectionalEdge };
