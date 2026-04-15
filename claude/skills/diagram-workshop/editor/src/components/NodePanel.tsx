import { useEffect, useRef, useState } from 'react';
import type { NodeType } from '../lib/types';

interface NodePanelProps {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  onEditLabel: (nodeId: string, newLabel: string) => void;
  onChangeType: (nodeId: string, newType: NodeType) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const NODE_TYPES: NodeType[] = [
  'default', 'service', 'store', 'user', 'decision', 'terminal', 'io', 'external'
];

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: 4,
  padding: '4px 0',
  minWidth: 160,
  zIndex: 1000,
  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '5px 12px',
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#f0f0f0',
  cursor: 'pointer',
  gap: 8,
  transition: 'background 0.1s',
};

const dangerItemStyle: React.CSSProperties = {
  ...itemStyle,
  color: '#e63946',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: '#1f1f1f',
  margin: '3px 0',
};

export function NodePanel({
  x,
  y,
  nodeId,
  nodeLabel,
  nodeType,
  onEditLabel,
  onChangeType,
  onDelete,
  onClose,
}: NodePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(nodeLabel);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  function commitLabel() {
    setEditingLabel(false);
    onEditLabel(nodeId, draftLabel);
    onClose();
  }

  return (
    <div ref={ref} style={{ ...menuStyle, left: x, top: y }}>
      {editingLabel ? (
        <div style={{ padding: '4px 8px' }}>
          <input
            autoFocus
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') { setEditingLabel(false); onClose(); }
            }}
            style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 3,
              color: '#f0f0f0',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '3px 6px',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
      ) : (
        <div
          style={itemStyle}
          onClick={() => { setDraftLabel(nodeLabel); setEditingLabel(true); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: '#4b5563', fontSize: 10 }}>✎</span>
          Edit label
        </div>
      )}

      <div
        style={itemStyle}
        onMouseEnter={(e) => { (e.currentTarget.style.background = '#1a1a1a'); setShowTypeMenu(true); }}
        onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); }}
      >
        <span style={{ color: '#4b5563', fontSize: 10 }}>⬡</span>
        Change type
        <span style={{ marginLeft: 'auto', color: '#4b5563' }}>›</span>

        {showTypeMenu && (
          <div
            style={{
              ...menuStyle,
              left: '100%',
              top: -4,
              marginLeft: 2,
            }}
            onMouseEnter={() => setShowTypeMenu(true)}
            onMouseLeave={() => setShowTypeMenu(false)}
          >
            {NODE_TYPES.map((t) => (
              <div
                key={t}
                style={{
                  ...itemStyle,
                  color: t === nodeType ? '#e63946' : '#f0f0f0',
                }}
                onClick={() => { onChangeType(nodeId, t); onClose(); }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {t}
                {t === nodeType && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={separatorStyle} />

      <div
        style={dangerItemStyle}
        onClick={() => { onDelete(nodeId); onClose(); }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 10 }}>✕</span>
        Delete
      </div>
    </div>
  );
}
