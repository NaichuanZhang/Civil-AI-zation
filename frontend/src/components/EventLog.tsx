import { useEffect, useRef } from 'react';
import type { EventLogEntry } from '../types';
import { AGENT_NAMES, AGENT_COLORS } from '../config';

const agentName = (id: string) => AGENT_NAMES[id] ?? id;

interface EventLogProps {
  entries: EventLogEntry[];
}

function formatEntry(entry: EventLogEntry): string {
  if (entry.type === 'summary') {
    return entry.text ?? '';
  }

  if (entry.type === 'elimination') {
    return `${agentName(entry.agentId ?? '')} was eliminated by ${agentName(entry.eliminatedBy ?? '')}!`;
  }

  const r = entry.result;
  if (!r) return `${agentName(entry.agentId ?? '')} acted.`;

  switch (r.type) {
    case 'move':
      return `${agentName(entry.agentId ?? '')} moved ${r.newOrientation} to (${r.to?.x},${r.to?.y}).`;
    case 'attack': {
      const elim = r.targetEliminated ? ` ${agentName(r.target ?? '')} eliminated!` : '';
      return `${agentName(entry.agentId ?? '')} attacked ${agentName(r.target ?? '')} (${r.hitZone}) for ${r.damage} damage.${elim}`;
    }
    case 'rest':
      return `${agentName(entry.agentId ?? '')} rested.`;
    case 'invalid':
      return `${agentName(entry.agentId ?? '')} attempted invalid action, rested instead.`;
    default:
      return `${agentName(entry.agentId ?? '')} acted.`;
  }
}

export function EventLog({ entries }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div
      style={{
        border: '1px solid #334155',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#0f172a',
        height: 240,
        overflowY: 'auto',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: 8 }}>Event Log</div>
      {entries.length === 0 && (
        <div style={{ color: '#475569' }}>Waiting for game to start...</div>
      )}
      {entries.map((entry, i) => {
        const isSummary = entry.type === 'summary';
        const isElimination = entry.type === 'elimination';
        const color = isElimination
          ? '#ef4444'
          : isSummary
            ? '#94a3b8'
            : AGENT_COLORS[entry.agentId ?? ''] ?? '#e2e8f0';

        return (
          <div
            key={i}
            style={{
              color,
              fontStyle: isSummary ? 'italic' : 'normal',
              fontWeight: isElimination ? 'bold' : 'normal',
            }}
          >
            <span style={{ color: '#475569' }}>R{entry.round} </span>
            {formatEntry(entry)}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
