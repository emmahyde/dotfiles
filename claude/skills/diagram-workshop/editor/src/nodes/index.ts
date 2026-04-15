import type { NodeTypes } from '@xyflow/react';
import { DefaultNode } from './DefaultNode';
import { ServiceNode } from './ServiceNode';
import { StoreNode } from './StoreNode';
import { UserNode } from './UserNode';
import { DecisionNode } from './DecisionNode';
import { TerminalNode } from './TerminalNode';
import { IoNode } from './IoNode';
import { ExternalNode } from './ExternalNode';

export const nodeTypes: NodeTypes = {
  default: DefaultNode,
  service: ServiceNode,
  store: StoreNode,
  user: UserNode,
  decision: DecisionNode,
  terminal: TerminalNode,
  io: IoNode,
  external: ExternalNode,
};

export {
  DefaultNode,
  ServiceNode,
  StoreNode,
  UserNode,
  DecisionNode,
  TerminalNode,
  IoNode,
  ExternalNode,
};
