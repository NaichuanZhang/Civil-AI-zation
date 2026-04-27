import type { AgentUIState } from '../types';
import { AGENT_COLORS, AGENT_NAMES, AGENT_MODELS } from '../config';
import dashboardBgUrl from '@assets/dashboard-bg.png';
import glmLogoUrl from '@assets/logo/glm.png';
import gptLogoUrl from '@assets/logo/gpt.png';
import claudeLogoUrl from '@assets/logo/claude.png';

const MAX_EP = 3;

const AGENT_AVATARS: Record<string, string> = {
  opus: glmLogoUrl,
  sonnet: gptLogoUrl,
  haiku: claudeLogoUrl,
};

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
  isAttacked?: boolean;
  maxHp: number;
  debugMode?: boolean;
}

export function AgentPanel({ agent, isCurrentTurn, isAttacked = false, maxHp, debugMode = false }: AgentPanelProps) {
  const hpPercent = maxHp > 0 ? (agent.hp / maxHp) * 100 : 0;
  const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444';
  const ep = agent.ep ?? 0;
  const epPercent = MAX_EP > 0 ? (ep / MAX_EP) * 100 : 0;
  const eliminated = agent.status === 'eliminated';
  const avatarUrl = AGENT_AVATARS[agent.agentId];

  const borderColor = isAttacked
    ? '#ef4444'
    : isCurrentTurn
      ? AGENT_COLORS[agent.agentId] ?? '#666'
      : 'rgba(68, 55, 40, 0.4)';

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: 12,
        backgroundImage: `url(${dashboardBgUrl})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        overflow: 'hidden',
        opacity: eliminated ? 0.6 : 1,
        minWidth: 160,
        boxShadow: isAttacked ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
        animation: isAttacked ? 'shake-panel 0.6s ease-in-out' : 'none',
      }}
    >
      {/* Name row with avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={AGENT_NAMES[agent.agentId] ?? agent.agentId}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${AGENT_COLORS[agent.agentId] ?? '#666'}`,
              backgroundColor: '#f5f0e8',
            }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: AGENT_COLORS[agent.agentId] ?? '#666',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 'bold', color: '#2c1810', fontSize: 13 }}>
            {AGENT_NAMES[agent.agentId] ?? agent.agentId.toUpperCase()}
          </span>
          <div style={{ fontSize: 9, color: '#6b5344' }}>
            Speed {agent.speed}
          </div>
        </div>
        {isCurrentTurn && (
          <span style={{ fontSize: 10, color: '#b45309', fontWeight: 'bold' }}>ACTING</span>
        )}
      </div>

      {/* Health bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b5344' }}>
          <span>Health</span>
          <span>{agent.hp}/{maxHp}</span>
        </div>
        <div style={{ height: 8, backgroundColor: 'rgba(68, 55, 40, 0.2)', borderRadius: 4, overflow: 'hidden' }}>
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

      {/* Energy bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b5344' }}>
          <span>Energy</span>
          <span>{ep}/{MAX_EP}</span>
        </div>
        <div style={{ height: 8, backgroundColor: 'rgba(68, 55, 40, 0.2)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${epPercent}%`,
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Last action badge */}
      {agent.lastAction && (
        <div style={{ marginBottom: 4 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 'bold',
              color: '#6b3a10',
              backgroundColor: '#c9956b',
              border: '1px solid #a0724a',
              borderRadius: 10,
              padding: '2px 8px',
            }}
          >
            {formatAction(agent.lastAction)}
          </span>
        </div>
      )}

      {/* Facing — always visible */}
      <div style={{ fontSize: 11, color: '#6b5344' }}>
        Facing: {agent.orientation}
      </div>

      {/* Debug-only: position */}
      {debugMode && (
        <div style={{ fontSize: 11, color: '#6b5344', marginTop: 2 }}>
          Pos: ({agent.position.x},{agent.position.y})
        </div>
      )}

      {eliminated && agent.eliminatedAtRound != null && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 'bold' }}>
          ELIMINATED (Round {agent.eliminatedAtRound})
        </div>
      )}
    </div>
  );
}
