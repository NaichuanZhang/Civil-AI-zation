import type { AgentUIState } from '../types';

const AGENT_COLORS: Record<string, string> = {
  opus: '#8b5cf6',
  sonnet: '#3b82f6',
  haiku: '#22c55e',
};

const AGENT_MODELS: Record<string, string> = {
  opus: 'Claude Sonnet 4.5',
  sonnet: 'DeepSeek v3.2',
  haiku: 'GPT-4o Mini',
};

interface AgentPanelProps {
  agent: AgentUIState;
  isCurrentTurn: boolean;
  maxHp: number;
}

export function AgentPanel({ agent, isCurrentTurn, maxHp }: AgentPanelProps) {
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
          {agent.agentId.toUpperCase()}
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

      {eliminated && agent.eliminatedAtRound != null && (
        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 'bold' }}>
          ELIMINATED (Round {agent.eliminatedAtRound})
        </div>
      )}
    </div>
  );
}
