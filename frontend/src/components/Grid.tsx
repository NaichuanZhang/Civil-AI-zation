import type { AgentUIState, ChestUIState } from '../types';
import { AGENT_NAMES } from '../config';

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
            width: 72,
            height: 72,
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: chest && !agent ? '#2a1f0a' : '#1e293b',
            position: 'relative',
          }}
        >
          {agent ? (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: AGENT_COLORS[agent.agentId] ?? '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
                boxShadow: isActive
                  ? `0 0 12px 4px ${AGENT_COLORS[agent.agentId] ?? '#666'}`
                  : 'none',
                transition: 'box-shadow 0.3s',
              }}
            >
              <span style={{ fontSize: 16 }}>{DIR_ARROWS[agent.orientation] ?? '?'}</span>
              <span style={{ fontSize: 9 }}>{(AGENT_NAMES[agent.agentId] ?? agent.agentId)[0]?.toUpperCase()}</span>
            </div>
          ) : chest ? (
            <span style={{ fontSize: 24 }}>📦</span>
          ) : null}
          <span
            style={{
              position: 'absolute',
              bottom: 2,
              right: 4,
              fontSize: 9,
              color: '#475569',
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
        gridTemplateColumns: `repeat(${gridSize}, 72px)`,
        gridTemplateRows: `repeat(${gridSize}, 72px)`,
        gap: 1,
        backgroundColor: '#0f172a',
        border: '2px solid #334155',
        borderRadius: 8,
        padding: 4,
      }}
    >
      {cells}
    </div>
  );
}
