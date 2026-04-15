import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export function UserNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);

  const color = selected ? '#e63946' : '#9ca3af';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'default',
        position: 'relative',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#9ca3af' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#9ca3af' }} />
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
        <circle cx="14" cy="9" r="7" stroke={color} strokeWidth="1.5" fill="#1a1a1a" />
        <path
          d="M2 30c0-6.627 5.373-12 12-12s12 5.373 12 12"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
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
            color,
            fontFamily: 'monospace',
            fontSize: 10,
            width: 80,
            textAlign: 'center',
          }}
        />
      ) : (
        <span style={{ color, fontFamily: 'monospace', fontSize: 10, textAlign: 'center', maxWidth: 80 }}>
          {label}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#9ca3af' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#9ca3af' }} />
    </div>
  );
}
