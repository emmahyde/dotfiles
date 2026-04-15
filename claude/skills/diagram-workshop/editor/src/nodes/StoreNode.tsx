import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export function StoreNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);

  const containerStyle: React.CSSProperties = {
    width: 100,
    height: 52,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const ellipseStyle: React.CSSProperties = {
    width: 100,
    height: 16,
    background: '#1a1a1a',
    border: `1.5px solid ${selected ? '#e63946' : '#6b7280'}`,
    borderRadius: '50%',
    position: 'absolute',
    top: 0,
    zIndex: 1,
  };

  const bodyStyle: React.CSSProperties = {
    width: 100,
    height: 44,
    background: '#1a1a1a',
    border: `1.5px solid ${selected ? '#e63946' : '#6b7280'}`,
    borderTop: 'none',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#f0f0f0',
    cursor: 'default',
  };

  return (
    <div style={containerStyle} onDoubleClick={() => setEditing(true)}>
      <Handle type="target" position={Position.Top} style={{ top: 0, background: '#6b7280', zIndex: 2 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#6b7280' }} />
      <div style={ellipseStyle} />
      <div style={bodyStyle}>
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              setEditing(false);
              (data as Record<string, unknown>).label = label;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setEditing(false);
                (data as Record<string, unknown>).label = label;
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f0f0f0',
              fontFamily: 'monospace',
              fontSize: 11,
              width: '80%',
              textAlign: 'center',
            }}
          />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 6px' }}>
            {label}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6b7280' }} />
    </div>
  );
}
