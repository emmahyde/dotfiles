import { useState } from 'react';

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onRelayout: () => void;
  onExportJSON: () => void;
  onExportPNG: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #2a2a2a',
  borderRadius: 3,
  color: '#9ca3af',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
  transition: 'color 0.1s, border-color 0.1s',
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnStyle,
  color: '#4b5563',
  cursor: 'not-allowed',
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: '#e63946',
  border: '1px solid #e63946',
  color: '#f0f0f0',
};

export function Toolbar({
  title,
  onTitleChange,
  onUndo,
  onRedo,
  onFit,
  onRelayout,
  onExportJSON,
  onExportPNG,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  function commitTitle() {
    setEditingTitle(false);
    onTitleChange(draftTitle);
  }

  return (
    <div
      style={{
        height: 44,
        background: '#0f0f0f',
        borderBottom: '1px solid #1f1f1f',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        flexShrink: 0,
      }}
    >
      {editingTitle ? (
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') commitTitle();
          }}
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 3,
            color: '#f0f0f0',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: '2px 8px',
            outline: 'none',
            minWidth: 120,
          }}
        />
      ) : (
        <span
          onDoubleClick={() => { setDraftTitle(title); setEditingTitle(true); }}
          style={{
            color: '#f0f0f0',
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: 'text',
            minWidth: 80,
            userSelect: 'none',
          }}
          title="Double-click to edit"
        >
          {title || 'Untitled'}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button style={canUndo ? btnStyle : btnDisabledStyle} onClick={onUndo} disabled={!canUndo} title="Undo">
        Undo
      </button>
      <button style={canRedo ? btnStyle : btnDisabledStyle} onClick={onRedo} disabled={!canRedo} title="Redo">
        Redo
      </button>

      <div style={{ width: 1, height: 20, background: '#2a2a2a' }} />

      <button style={btnStyle} onClick={onFit} title="Fit view">
        Fit
      </button>
      <button style={btnStyle} onClick={onRelayout} title="Auto-layout">
        Relayout
      </button>

      <div style={{ width: 1, height: 20, background: '#2a2a2a' }} />

      <button style={btnStyle} onClick={onExportJSON} title="Export as JSON">
        JSON
      </button>
      <button style={btnPrimaryStyle} onClick={onExportPNG} title="Export as PNG">
        PNG
      </button>
    </div>
  );
}
