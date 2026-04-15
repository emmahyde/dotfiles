import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export function ExternalNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);

  return (
    <div
      style={{
        width: 100,
        height: 36,
        background: '#1a1a1a',
        boxShadow: `inset 0 0 0 3px #1a1a1a, 0 0 0 1.5px ${selected ? '#e63946' : '#6b7280'}, inset 0 0 0 5px ${selected ? '#e63946' : '#6b7280'}`,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#f0f0f0',
        cursor: 'default',
        position: 'relative',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6b7280' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#6b7280' }} />
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
            width: '70%',
            textAlign: 'center',
          }}
        />
      ) : (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 10px' }}>
          {label}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6b7280' }} />
    </div>
  );
}
