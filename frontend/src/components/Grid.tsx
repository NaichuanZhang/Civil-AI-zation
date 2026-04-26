import type { AgentUIState } from '../types';

const AGENT_COLORS: Record<string, string> = {
  opus: '#8b5cf6',
  sonnet: '#3b82f6',
  haiku: '#22c55e',
};

const DIR_ARROWS: Record<string, string> = {
  N: '↑',
  S: '↓',
  E: '→',
  W: '←',
};

interface GridProps {
  agents: AgentUIState[];
  currentTurnAgent: string | null;
  gridSize?: number;
}

export function Grid({ agents, currentTurnAgent, gridSize = 3 }: GridProps) {
  const cells = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = agents.find(
        (a) => a.status === 'alive' && a.position.x === x && a.position.y === y,
      );
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
            backgroundColor: '#1e293b',
            position: 'relative',
          }}
        >
          {agent && (
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
              <span style={{ fontSize: 9 }}>{agent.agentId[0]?.toUpperCase()}</span>
            </div>
          )}
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
