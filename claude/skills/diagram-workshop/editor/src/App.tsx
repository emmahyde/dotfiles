import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { NodePanel } from './components/NodePanel';
import { elkLayout } from './lib/layout';
import { parseDiagram, serializeDiagram } from './lib/format';
import type { DiagramJson, NodeType } from './lib/types';

interface ContextMenu {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
}

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;
let nodeCounter = 1;

function diagramToFlow(diagram: DiagramJson): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'default',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: { label: n.label },
  }));

  const edges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.style === 'dashed' || e.style === 'dotted' ? 'dashed' :
          e.style === 'bidirectional' ? 'bidirectional' : 'default',
    data: e.label ? { label: e.label } : {},
    markerEnd: { type: 'arrowclosed' as any },
    ...(e.style === 'bidirectional' ? { markerStart: { type: 'arrowclosed' as any } } : {}),
  }));

  return { nodes, edges };
}

function flowToDiagram(nodes: Node[], edges: Edge[], title: string): DiagramJson {
  return {
    title,
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data.label as string,
      type: (n.type ?? 'default') as NodeType,
      x: n.position.x,
      y: n.position.y,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.data?.label ? { label: e.data.label as string } : {}),
      ...(e.type && e.type !== 'default' ? { style: e.type as any } : {}),
    })),
  };
}

export function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [title, setTitle] = useState('Untitled');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [ready, setReady] = useState(false);
  const reactFlow = useReactFlow();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseRetryDelay = useRef(2000);

  function pushSnapshot(n: Node[], e: Edge[]) {
    setHistory((h) => {
      const base = h.slice(0, historyIndex + 1);
      const next = [...base, { nodes: n, edges: e }].slice(-MAX_HISTORY);
      setHistoryIndex(next.length - 1);
      return next;
    });
  }

  async function loadDiagram(mergePositions?: Map<string, { x: number; y: number }>) {
    try {
      const res = await fetch('/diagram');
      if (!res.ok) return;
      const text = await res.text();
      const diagram = parseDiagram(text);
      setTitle(diagram.title ?? 'Untitled');

      // Apply saved positions before layout, and mergePositions for existing nodes
      const nodesWithMergedPositions = diagram.nodes.map((n) => {
        const saved = mergePositions?.get(n.id);
        if (saved) return { ...n, x: saved.x, y: saved.y };
        return n;
      });

      const positioned = await elkLayout(
        nodesWithMergedPositions,
        diagram.edges,
        diagram.layout ?? {}
      );

      const mergedDiagram: DiagramJson = { ...diagram, nodes: positioned };
      const { nodes: flowNodes, edges: flowEdges } = diagramToFlow(mergedDiagram);
      setNodes(flowNodes);
      setEdges(flowEdges);
      pushSnapshot(flowNodes, flowEdges);
    } catch (err) {
      console.error('Failed to load diagram:', err);
    }
  }

  function connectSSE() {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource('/events');
    sseRef.current = es;

    es.onmessage = () => {
      const existingPositions = new Map(
        nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])
      );
      loadDiagram(existingPositions);
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      const delay = sseRetryDelay.current;
      sseRetryDelay.current = Math.min(delay * 2, 30000);
      setTimeout(connectSSE, delay);
    };

    es.onopen = () => {
      sseRetryDelay.current = 2000;
    };
  }

  useEffect(() => {
    loadDiagram().then(() => setReady(true));
    connectSSE();
    return () => sseRef.current?.close();
  }, []);

  function scheduleSave(n: Node[], e: Edge[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const diagram = flowToDiagram(n, e, title);
        await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serializeDiagram(diagram),
        });
      } catch {
        // silent — not critical
      }
    }, 500);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...connection, type: 'default', markerEnd: { type: 'arrowclosed' as any } }, eds);
        pushSnapshot(nodes, next);
        scheduleSave(nodes, next);
        return next;
      });
    },
    [nodes, setEdges]
  );

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    scheduleSave(nodes, edges);
  }

  function handleUndo() {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }

  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    setNodes(next.nodes);
    setEdges(next.edges);
  }

  function handleFitView() {
    reactFlow.fitView({ padding: 0.1 });
  }

  async function handleRelayout() {
    pushSnapshot(nodes, edges);
    const diagramNodes = nodes.map((n) => ({
      id: n.id,
      label: n.data.label as string,
      type: (n.type ?? 'default') as NodeType,
      // Clear manual positions so ELK lays everything out
    }));
    const diagramEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));
    const positioned = await elkLayout(diagramNodes, diagramEdges);
    const next = nodes.map((n) => {
      const pos = positioned.find((p) => p.id === n.id);
      return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
    });
    setNodes(next);
    scheduleSave(next, edges);
  }

  function handleExportJSON() {
    const diagram = flowToDiagram(nodes, edges, title);
    const blob = new Blob([serializeDiagram(diagram)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'diagram'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPNG() {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return;
    import('html-to-image').then(({ toPng }) => {
      toPng(viewport, { backgroundColor: '#0a0a0a' }).then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'diagram'}.png`;
        a.click();
      });
    }).catch(() => {
      window.print();
    });
  }

  function handleDrop(type: NodeType, position: { x: number; y: number }) {
    pushSnapshot(nodes, edges);
    const id = `node-${nodeCounter++}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: { label: type },
    };
    const next = [...nodes, newNode];
    setNodes(next);
    scheduleSave(next, edges);
  }

  function handleNodeContextMenu(nodeId: string, x: number, y: number) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setContextMenu({
      x,
      y,
      nodeId,
      nodeLabel: node.data.label as string,
      nodeType: (node.type ?? 'default') as NodeType,
    });
  }

  function handleEditLabel(nodeId: string, newLabel: string) {
    pushSnapshot(nodes, edges);
    const next = nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
    );
    setNodes(next);
    scheduleSave(next, edges);
  }

  function handleChangeType(nodeId: string, newType: NodeType) {
    pushSnapshot(nodes, edges);
    const next = nodes.map((n) => (n.id === nodeId ? { ...n, type: newType } : n));
    setNodes(next);
    scheduleSave(next, edges);
  }

  function handleDeleteNode(nodeId: string) {
    pushSnapshot(nodes, edges);
    const nextNodes = nodes.filter((n) => n.id !== nodeId);
    const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    scheduleSave(nextNodes, nextEdges);
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a0a0a', color: '#4b5563', fontFamily: 'monospace', fontSize: 12 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <Toolbar
        title={title}
        onTitleChange={handleTitleChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFit={handleFitView}
        onRelayout={handleRelayout}
        onExportJSON={handleExportJSON}
        onExportPNG={handleExportPNG}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Palette />
        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
          onNodeContextMenu={handleNodeContextMenu}
        />
      </div>

      {contextMenu && (
        <NodePanel
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeLabel={contextMenu.nodeLabel}
          nodeType={contextMenu.nodeType}
          onEditLabel={handleEditLabel}
          onChangeType={handleChangeType}
          onDelete={handleDeleteNode}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
