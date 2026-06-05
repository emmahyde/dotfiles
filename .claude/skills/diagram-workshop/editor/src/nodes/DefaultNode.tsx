import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

const style: React.CSSProperties = {
  width: 100,
  height: 36,
  background: '#1a1a1a',
  border: '1.5px solid #6b7280',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#f0f0f0',
  cursor: 'default',
  position: 'relative',
};

const selectedStyle: React.CSSProperties = {
  ...style,
  border: '1.5px solid #e63946',
};

export function DefaultNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);

  return (
    <div style={selected ? selectedStyle : style} onDoubleClick={() => setEditing(true)}>
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
            width: '80%',
            textAlign: 'center',
          }}
        />
      ) : (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 6px' }}>
          {label}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6b7280' }} />
    </div>
  );
}
