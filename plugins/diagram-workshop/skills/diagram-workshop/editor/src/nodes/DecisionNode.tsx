import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export function DecisionNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);

  const borderColor = selected ? '#e63946' : '#6b7280';

  return (
    <div
      style={{
        width: 84,
        height: 48,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: '#1a1a1a',
        outline: `1.5px solid ${borderColor}`,
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
            fontSize: 10,
            width: '60%',
            textAlign: 'center',
          }}
        />
      ) : (
        <span style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 54 }}>
          {label}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6b7280' }} />
    </div>
  );
}
