import { useSearchParams, Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useSpectate } from '../hooks/useSpectate';
import { NarratorProvider } from '../contexts/NarratorContext';
import { Narrator } from '../components/Narrator';
import { AgentPanel } from '../components/AgentPanel';
import { THEME, AGENT_INITIAL_HP, AGENT_NAMES, AGENT_COLORS } from '../config';
import type { EventLogEntry } from '../types';
import logoUrl from '@assets/logo.png';
import dashboardBgUrl from '@assets/dashboard-bg.png';

const SPEED_OPTIONS = [1, 2, 4] as const;

const agentName = (id: string) => AGENT_NAMES[id] ?? id;

function formatEntry(entry: EventLogEntry): string {
  if (entry.type === 'summary') return entry.text ?? '';
  if (entry.type === 'elimination') {
    return `${agentName(entry.agentId ?? '')} was eliminated by ${agentName(entry.eliminatedBy ?? '')}!`;
  }
  const r = entry.result;
  if (!r) return `${agentName(entry.agentId ?? '')} acted.`;
  switch (r.type) {
    case 'move':
      return `${agentName(entry.agentId ?? '')} moved ${r.newOrientation ?? ''} to (${r.to?.x},${r.to?.y}).`;
    case 'attack': {
      const elim = r.targetEliminated ? ` ${agentName(r.target ?? '')} eliminated!` : '';
      return `${agentName(entry.agentId ?? '')} attacked ${agentName(r.target ?? '')} (${r.hitZone}) for ${r.damage} dmg.${elim}`;
    }
    case 'rest':
      return `${agentName(entry.agentId ?? '')} rested.`;
    case 'invalid':
      return `${agentName(entry.agentId ?? '')} attempted invalid action.`;
    default:
      return `${agentName(entry.agentId ?? '')} acted.`;
  }
}

function Chronicle({ entries }: { entries: EventLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div style={{
        color: '#8a7a66',
        fontSize: 14,
        fontStyle: 'italic',
        padding: '40px 0',
        textAlign: 'center',
      }}>
        The chronicle awaits its first entry...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.map((entry, i) => {
        const isSummary = entry.type === 'summary';
        const isElimination = entry.type === 'elimination';
        const isRoundDivider = isSummary && entry.text?.startsWith('---');

        if (isRoundDivider) {
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '10px 0 6px',
              userSelect: 'none',
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(92, 74, 50, 0.25)' }} />
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#8a7a66',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                Round {entry.round}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(92, 74, 50, 0.25)' }} />
            </div>
          );
        }

        const agentColor = AGENT_COLORS[entry.agentId ?? ''] ?? '#8a7a66';
        const textColor = isElimination
          ? '#b91c1c'
          : isSummary
            ? '#6b5e4f'
            : '#3d2e1a';

        return (
          <div key={i} style={{
            padding: '3px 0',
            fontSize: 13,
            lineHeight: 1.55,
            color: textColor,
            fontWeight: isElimination ? 700 : 400,
            fontStyle: isSummary && !isRoundDivider ? 'italic' : 'normal',
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
          }}>
            {!isSummary && entry.agentId && (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: agentColor,
                flexShrink: 0,
                display: 'inline-block',
                position: 'relative',
                top: -1,
              }} />
            )}
            <span>{formatEntry(entry)}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export function ExplainPage() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId') ?? undefined;
  const { state, isLoading, error, isReplay, replaySpeed, setReplaySpeed } = useSpectate(gameId);

  if (isLoading) {
    return (
      <div style={rootStyle}>
        <div style={centerStyle}>
          <div style={spinnerStyle} />
          <span style={{ color: '#8a7a66', fontSize: 15 }}>Fetching battle records...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={rootStyle}>
        <div style={centerStyle}>
          <span style={{ color: THEME.status.error, fontSize: 16 }}>Failed to load game</span>
          <span style={{ color: THEME.text.muted, fontSize: 13 }}>{error}</span>
          <Link to="/" style={linkBtnStyle}>Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!state.gameId) {
    return (
      <div style={rootStyle}>
        <div style={centerStyle}>
          <span style={{ color: '#d4c8b5', fontSize: 20 }}>No battles recorded</span>
          <span style={{ color: '#8a7a66', fontSize: 14 }}>Start a game from the arena to spectate it here.</span>
          <Link to="/game" style={linkBtnStyle}>Enter the Arena</Link>
        </div>
      </div>
    );
  }

  const isLive = state.status === 'running';
  const statusText = isLive
    ? `Round ${state.round}`
    : state.result
      ? state.result.winner
        ? `${AGENT_NAMES[state.result.winner] ?? state.result.winner} Wins`
        : 'Draw'
      : 'Completed';

  return (
    <NarratorProvider gameState={state}>
      <div style={rootStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
              <img src={logoUrl} alt="Civil-AI-zation" style={{ height: 36, width: 'auto' }} />
            </Link>
            <div style={{
              width: 1,
              height: 20,
              background: 'rgba(92, 74, 50, 0.2)',
            }} />
            <span style={{
              fontSize: 13,
              color: '#8a7a66',
              letterSpacing: 0.5,
            }}>
              Explainer
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isReplay && (
              <div style={{
                display: 'flex',
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid rgba(92, 74, 50, 0.2)',
              }}>
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setReplaySpeed(speed)}
                    style={{
                      background: replaySpeed === speed
                        ? 'rgba(92, 74, 50, 0.15)'
                        : 'transparent',
                      color: replaySpeed === speed ? '#5c4a32' : '#8a7a66',
                      border: 'none',
                      borderRight: '1px solid rgba(92, 74, 50, 0.12)',
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: replaySpeed === speed ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}

            {isLive && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: THEME.status.success,
                  animation: 'explain-pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 12, color: THEME.status.success, fontWeight: 600 }}>LIVE</span>
              </div>
            )}

            <span style={{
              fontSize: 13,
              color: '#5c4a32',
              fontWeight: 600,
            }}>
              {statusText}
            </span>
          </div>
        </header>

        {/* Main content */}
        <div style={mainStyle}>
          {/* Left: Narrator + Agents */}
          <div style={leftColumnStyle}>
            <div style={{
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid rgba(92, 74, 50, 0.2)',
              backgroundColor: THEME.background.secondary,
            }}>
              <Narrator inline />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}>
              {state.agents.map((agent) => (
                <AgentPanel
                  key={agent.agentId}
                  agent={agent}
                  isCurrentTurn={agent.agentId === state.currentTurnAgent}
                  maxHp={AGENT_INITIAL_HP[agent.agentId as keyof typeof AGENT_INITIAL_HP] ?? 20}
                />
              ))}
            </div>
          </div>

          {/* Right: Battle Chronicle */}
          <div style={rightColumnStyle}>
            <div style={parchmentStyle}>
              <div style={parchmentHeaderStyle}>
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#5c4a32',
                }}>
                  Battle Chronicle
                </span>
                <span style={{
                  fontSize: 11,
                  color: '#8a7a66',
                }}>
                  {state.eventLog.length} entries
                </span>
              </div>

              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '0 16px 16px',
              }}>
                <Chronicle entries={state.eventLog} />
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes explain-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes explain-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </NarratorProvider>
  );
}

const rootStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  backgroundColor: '#f5f0e8',
  backgroundImage: `url(${dashboardBgUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  fontFamily: "'Patrick Hand', cursive, system-ui, sans-serif",
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 20px',
  borderBottom: '1px solid rgba(92, 74, 50, 0.15)',
  backgroundColor: 'rgba(255, 252, 245, 0.6)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  flexShrink: 0,
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  gap: 16,
  padding: 16,
  minHeight: 0,
  overflow: 'hidden',
};

const leftColumnStyle: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  overflow: 'hidden',
};

const rightColumnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const parchmentStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: 'rgba(255, 252, 245, 0.65)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  border: '1px solid rgba(92, 74, 50, 0.18)',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(92, 74, 50, 0.06)',
};

const parchmentHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(92, 74, 50, 0.12)',
  flexShrink: 0,
};

const linkBtnStyle: React.CSSProperties = {
  color: '#5c4a32',
  textDecoration: 'none',
  fontSize: 14,
  padding: '8px 20px',
  borderRadius: 8,
  border: '1px solid rgba(92, 74, 50, 0.25)',
  backgroundColor: 'rgba(255, 252, 245, 0.5)',
  transition: 'all 0.2s',
};

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '2px solid rgba(92, 74, 50, 0.15)',
  borderTopColor: '#8a7a66',
  borderRadius: '50%',
  animation: 'explain-spin 0.8s linear infinite',
};
