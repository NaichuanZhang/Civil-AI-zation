import type { AgentUIState } from '../types';
import { AGENT_COLORS, AGENT_NAMES, AGENT_MODELS, THEME } from '../config';

function formatAction(action: { type: string; direction?: string; target?: string }): string {
  switch (action.type) {
    case 'move':
      return `Move ${action.direction || '?'}`;
    case 'attack':
      return `Attack ${action.target || '?'}`;
    case 'turn':
      return `Turn ${action.direction || '?'}`;
    case 'rest':
      return 'Rest';
    case 'invalid':
      return 'Invalid';
    default:
      return action.type;
  }
}

interface AgentPanelProps {
  agent: AgentUIState;
  isCurrentTurn: boolean;
  maxHp: number;
  debugMode?: boolean;
}

export function AgentPanel({ agent, isCurrentTurn, maxHp, debugMode = false }: AgentPanelProps) {
  const hpPercent = maxHp > 0 ? (agent.hp / maxHp) * 100 : 0;
  const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444';
  const eliminated = agent.status === 'eliminated';

  return (
    <div
      style={{
        border: `2px solid ${isCurrentTurn ? AGENT_COLORS[agent.agentId] ?? '#666' : '#334155'}`,
        borderRadius: 8,
        padding: 12,
        backgroundColor: eliminated ? '#1a1a2e' : '#1e293b',
        opacity: eliminated ? 0.6 : 1,
        minWidth: 160,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: AGENT_COLORS[agent.agentId] ?? '#666',
          }}
        />
        <span style={{ fontWeight: 'bold', color: '#f1f5f9', fontSize: 14 }}>
          {AGENT_NAMES[agent.agentId] ?? agent.agentId.toUpperCase()}
        </span>
        {isCurrentTurn && (
          <span style={{ fontSize: 10, color: '#fbbf24', marginLeft: 'auto' }}>ACTING</span>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
        {AGENT_MODELS[agent.agentId] ?? 'Unknown'} | Speed {agent.speed}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
          <span>HP</span>
          <span>{agent.hp}/{maxHp}</span>
        </div>
        <div style={{ height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${hpPercent}%`,
              backgroundColor: hpColor,
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 12 }}>
        <span>Pos: ({agent.position.x},{agent.position.y})</span>
        <span>Facing: {agent.orientation}</span>
      </div>

      {debugMode && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: '#0f172a',
            borderRadius: 4,
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 'bold', marginBottom: 4 }}>
            DEBUG INFO
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Energy: {agent.ep !== undefined ? agent.ep : 'N/A'}
          </div>
          {agent.lastAction && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Last Action: {formatAction(agent.lastAction)}
            </div>
          )}
        </div>
      )}

      {eliminated && agent.eliminatedAtRound != null && (
        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 'bold' }}>
          ELIMINATED (Round {agent.eliminatedAtRound})
        </div>
      )}
    </div>
  );
}
