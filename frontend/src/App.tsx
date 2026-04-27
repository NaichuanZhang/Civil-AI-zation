import { useGameState } from './hooks/useGameState';
import { usePersistedState } from './hooks/usePersistedState';
import { Grid } from './components/Grid';
import { AgentPanel } from './components/AgentPanel';
import { LogViewer } from './components/LogViewer';
import { GameControls, GameStartButton } from './components/GameControls';
import logoUrl from '@assets/logo.png';
import dashboardBgUrl from '@assets/dashboard-bg.png';
import { Settings } from './components/Settings';
import { Narrator } from './components/Narrator';
import { NarratorProvider } from './contexts/NarratorContext';
import { AGENT_INITIAL_HP, AGENT_STATS, AGENT_NAMES, AGENT_COLORS } from './config';

const AGENT_IDS = Object.keys(AGENT_STATS) as Array<keyof typeof AGENT_STATS>;

export function App() {
  const { state, startGame } = useGameState();
  const [debugMode, setDebugMode] = usePersistedState('civil-ai-zation:debugMode', false);
  const [isPaused, setIsPaused] = usePersistedState('civil-ai-zation:isPaused', false);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    console.log(isPaused ? 'Resuming game...' : 'Pausing game...');
  };

  const agentPanels =
    state.agents.length > 0
      ? state.agents.map((agent) => (
          <div key={agent.agentId} style={{ width: '100%', minWidth: 0 }}>
            <AgentPanel
              agent={agent}
              isCurrentTurn={agent.agentId === state.currentTurnAgent}
              isAttacked={state.attackedAgents.includes(agent.agentId)}
              maxHp={AGENT_INITIAL_HP[agent.agentId as keyof typeof AGENT_INITIAL_HP] ?? 20}
              debugMode={debugMode}
            />
          </div>
        ))
      : AGENT_IDS.map((id) => (
          <div key={id} style={{ width: '100%', minWidth: 0 }}>
            <AgentPanel
              agent={{
                agentId: id,
                position: { x: 0, y: 0 },
                hp: AGENT_STATS[id].hp,
                orientation: 'N',
                status: 'alive',
                speed: AGENT_STATS[id].speed,
                eliminatedAtRound: null,
              }}
              isCurrentTurn={false}
              maxHp={AGENT_STATS[id].hp}
              debugMode={debugMode}
            />
          </div>
        ));

  return (
    <NarratorProvider gameState={state}>
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          fontFamily: "'Patrick Hand', cursive, system-ui, sans-serif",
          color: '#334155',
        }}
      >
        {/* Full-screen map + grid */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Grid agents={state.agents} chests={state.chests} currentTurnAgent={state.currentTurnAgent} attackedAgents={state.attackedAgents} debugMode={debugMode} />
        </div>

        {/* Top bar: logo, start, settings */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '8px 16px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
            <img
              src={logoUrl}
              alt="civilAIzation"
              style={{ height: 56, width: 'auto', maxWidth: 'min(100%, 360px)', objectFit: 'contain' }}
            />
            <GameStartButton status={state.status} onStartGame={startGame} />
          </div>
          <div style={{ pointerEvents: 'auto' }}>
            <Settings debugMode={debugMode} onDebugModeChange={setDebugMode} />
          </div>
        </div>

        {/* Game controls */}
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 16,
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <GameControls
            status={state.status}
            round={state.round}
            result={state.result}
            isPaused={isPaused}
            onStartGame={startGame}
            onTogglePause={handleTogglePause}
            showStartButton={false}
          />
        </div>

        {/* Agent panels — bottom right */}
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'stretch',
            width: 'min(300px, 38%)',
            maxHeight: '60vh',
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
        >
          {agentPanels}
        </div>

        {/* Log viewer — bottom left (debug only) */}
        {debugMode && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 10,
              width: 'min(400px, 50%)',
              maxHeight: '30vh',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            <LogViewer systemLogs={state.eventLog} debugMode={debugMode} />
          </div>
        )}

        {/* Game end overlay */}
        {state.status === 'completed' && state.result && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                backgroundImage: `url(${dashboardBgUrl})`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                borderRadius: 16,
                padding: '36px 48px',
                textAlign: 'center',
                minWidth: 320,
                maxWidth: 440,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2c1810', marginBottom: 8 }}>
                {state.result.winner ? 'Victory!' : 'Draw!'}
              </div>
              {state.result.winner && (
                <div style={{
                  fontSize: 20,
                  color: AGENT_COLORS[state.result.winner] ?? '#2c1810',
                  fontWeight: 'bold',
                  marginBottom: 4,
                }}>
                  {AGENT_NAMES[state.result.winner] ?? state.result.winner}
                </div>
              )}
              <div style={{ fontSize: 14, color: '#6b5344', marginBottom: 24 }}>
                {state.result.type === 'elimination' ? 'Last one standing' : `After ${state.round} rounds`}
              </div>
              <button
                type="button"
                onClick={startGame}
                style={{
                  padding: '12px 32px',
                  fontSize: 16,
                  fontWeight: 'bold',
                  borderRadius: 10,
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  backgroundImage: `url(${dashboardBgUrl})`,
                  backgroundSize: 'auto 100%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  border: '2px solid rgba(68, 55, 40, 0.4)',
                  color: '#2c1810',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                  transition: 'filter 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        <Narrator />
      </div>
    </NarratorProvider>
  );
}
