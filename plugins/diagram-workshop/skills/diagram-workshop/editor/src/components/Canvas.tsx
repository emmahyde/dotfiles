import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type NodeMouseHandler,
  type Node,
  type Edge,
} from '@xyflow/react';

import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges';
import type { NodeType } from '../lib/types';

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onDrop: (type: NodeType, position: { x: number; y: number }) => void;
  onNodeContextMenu: (nodeId: string, x: number, y: number) => void;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
  onNodeContextMenu,
}: CanvasProps) {
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/diagram-node-type') as NodeType;
      if (!nodeType) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = reactFlow.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      onDrop(nodeType, position);
    },
    [reactFlow, onDrop]
  );

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (e, node) => {
      e.preventDefault();
      onNodeContextMenu(
        node.id,
        e.clientX,
        e.clientY,
      );
    },
    [onNodeContextMenu]
  );

  const zoom = reactFlow.getZoom();

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, position: 'relative', background: '#0a0a0a' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'default', markerEnd: { type: 'arrowclosed' as any } }}
        deleteKeyCode="Delete"
        fitView
        style={{ background: '#0a0a0a' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#1a1a1a"
          gap={24}
          size={1.5}
        />
      </ReactFlow>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 28,
          background: '#0f0f0f',
          borderTop: '1px solid #1f1f1f',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 12px',
          fontFamily: 'monospace',
          fontSize: 9,
          color: '#4b5563',
          pointerEvents: 'none',
        }}
      >
        <span>{nodes.length} nodes</span>
        <span>{edges.length} edges</span>
        <span>{Math.round(zoom * 100)}%</span>
        <span style={{ marginLeft: 'auto' }}>
          Del: delete selected · Dbl-click node: edit label · Right-click node: menu
        </span>
      </div>
    </div>
  );
}
