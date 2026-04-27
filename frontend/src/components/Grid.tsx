import type { AgentUIState, ChestUIState } from '../types';
import { AGENT_NAMES } from '../config';
import mapUrl from '@assets/map.png';

const AGENT_COLORS: Record<string, string> = {
  opus: '#8b5cf6',
  sonnet: '#3b82f6',
  haiku: '#22c55e',
};

const DIR_ARROWS: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

interface GridProps {
  agents: AgentUIState[];
  chests: ChestUIState[];
  currentTurnAgent: string | null;
  gridSize?: number;
}

export function Grid({ agents, chests, currentTurnAgent, gridSize = 3 }: GridProps) {
  const cells = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = agents.find(
        (a) => a.status === 'alive' && a.position.x === x && a.position.y === y,
      );
      const chest = chests.find((c) => c.position.x === x && c.position.y === y);
      const isActive = agent?.agentId === currentTurnAgent;

      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            border: '1px solid rgba(51, 65, 85, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              chest && !agent ? 'rgba(42, 31, 10, 0.72)' : 'rgba(30, 41, 59, 0.45)',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          {agent ? (
            <div
              style={{
                width: 'clamp(32px, 40%, 48px)',
                height: 'clamp(32px, 40%, 48px)',
                borderRadius: '50%',
                backgroundColor: AGENT_COLORS[agent.agentId] ?? '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#fff',
                fontSize: 'clamp(8px, 2.8vw, 11px)',
                fontWeight: 'bold',
                boxShadow: isActive
                  ? `0 0 12px 4px ${AGENT_COLORS[agent.agentId] ?? '#666'}`
                  : 'none',
                transition: 'box-shadow 0.3s',
              }}
            >
              <span style={{ fontSize: 'clamp(12px, 4vw, 16px)' }}>
                {DIR_ARROWS[agent.orientation] ?? '?'}
              </span>
              <span style={{ fontSize: 'clamp(7px, 2vw, 9px)' }}>
                {(AGENT_NAMES[agent.agentId] ?? agent.agentId)[0]?.toUpperCase()}
              </span>
            </div>
          ) : chest ? (
            <span style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>📦</span>
          ) : null}
          <span
            style={{
              position: 'absolute',
              bottom: 2,
              right: 4,
              fontSize: 'clamp(7px, 1.8vw, 9px)',
              color: '#e2e8f0',
              textShadow: '0 0 4px rgba(0,0,0,0.85)',
            }}
          >
            {x},{y}
          </span>
        </div>,
      );
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        maxHeight: '100%',
        aspectRatio: '1',
        margin: '0 auto',
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        gap: 1,
        backgroundColor: '#0f172a',
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        border: '2px solid rgba(51, 65, 85, 0.85)',
        borderRadius: 8,
        padding: 4,
        boxSizing: 'border-box',
      }}
    >
      {cells}
    </div>
  );
}
