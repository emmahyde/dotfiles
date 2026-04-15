import type { NodeType } from '../lib/types';

interface PaletteItem {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
}

function DefaultIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <rect x="1" y="1" width="38" height="18" rx="2" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function ServiceIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <rect x="1" y="1" width="38" height="18" rx="5" fill="#1a1a1a" stroke="#e63946" strokeWidth="1.5" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="40" height="26" viewBox="0 0 40 26">
      <ellipse cx="20" cy="6" rx="19" ry="5" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
      <rect x="1" y="6" width="38" height="14" fill="#1a1a1a" />
      <line x1="1" y1="6" x2="1" y2="20" stroke="#6b7280" strokeWidth="1.5" />
      <line x1="39" y1="6" x2="39" y2="20" stroke="#6b7280" strokeWidth="1.5" />
      <path d="M1 20 Q20 26 39 20" fill="none" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28">
      <circle cx="12" cy="8" r="6" fill="#1a1a1a" stroke="#9ca3af" strokeWidth="1.5" />
      <path d="M2 27c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DecisionIcon() {
  return (
    <svg width="40" height="24" viewBox="0 0 40 24">
      <polygon points="20,1 39,12 20,23 1,12" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="36" height="18" viewBox="0 0 36 18">
      <rect x="1" y="1" width="34" height="16" rx="8" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function IoIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <polygon points="6,1 40,1 34,19 0,19" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <rect x="1" y="1" width="38" height="18" rx="2" fill="#1a1a1a" stroke="#6b7280" strokeWidth="1.5" />
      <rect x="4" y="4" width="32" height="12" rx="1" fill="none" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

const ITEMS: PaletteItem[] = [
  { type: 'default', label: 'Default', icon: <DefaultIcon /> },
  { type: 'service', label: 'Service', icon: <ServiceIcon /> },
  { type: 'store', label: 'Store', icon: <StoreIcon /> },
  { type: 'user', label: 'User', icon: <UserIcon /> },
  { type: 'decision', label: 'Decision', icon: <DecisionIcon /> },
  { type: 'terminal', label: 'Terminal', icon: <TerminalIcon /> },
  { type: 'io', label: 'I/O', icon: <IoIcon /> },
  { type: 'external', label: 'External', icon: <ExternalIcon /> },
];

export function Palette() {
  function handleDragStart(e: React.DragEvent, nodeType: NodeType) {
    e.dataTransfer.setData('application/diagram-node-type', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div
      style={{
        width: 140,
        background: '#0f0f0f',
        borderRight: '1px solid #1f1f1f',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 4px',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          color: '#4b5563',
          fontFamily: 'monospace',
          fontSize: 9,
          padding: '0 6px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Nodes
      </div>
      {ITEMS.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => handleDragStart(e, item.type)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '6px 4px',
            borderRadius: 4,
            cursor: 'grab',
            userSelect: 'none',
            border: '1px solid transparent',
            transition: 'background 0.1s, border-color 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
            (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
          }}
        >
          {item.icon}
          <span
            style={{
              color: '#9ca3af',
              fontFamily: 'monospace',
              fontSize: 10,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
