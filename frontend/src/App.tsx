import { useGameState } from './hooks/useGameState';
import { usePersistedState } from './hooks/usePersistedState';
import { Grid } from './components/Grid';
import { AgentPanel } from './components/AgentPanel';
import { LogViewer } from './components/LogViewer';
import { GameControls, GameStartButton } from './components/GameControls';
import logoUrl from '@assets/logo.png';
import { Settings } from './components/Settings';
import { Narrator } from './components/Narrator';
import { NarratorProvider } from './contexts/NarratorContext';
import { AGENT_INITIAL_HP, AGENT_STATS, UI_CONFIG } from './config';

// Get agent IDs dynamically from config
const AGENT_IDS = Object.keys(AGENT_STATS) as Array<keyof typeof AGENT_STATS>;

export function App() {
  const { state, startGame } = useGameState();
  const [debugMode, setDebugMode] = usePersistedState('civil-ai-zation:debugMode', false);
  const [isPaused, setIsPaused] = usePersistedState('civil-ai-zation:isPaused', false);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    // TODO: Implement actual pause logic in backend
    console.log(isPaused ? 'Resuming game...' : 'Pausing game...');
  };

  return (
    <NarratorProvider gameState={state}>
      <div
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: '100%',
          padding: 0,
          fontFamily: "'Patrick Hand', cursive, system-ui, sans-serif",
          backgroundColor: '#fdf8f6',
          color: '#334155',
        }}
      >
        <div
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: '100%',
            padding: '20px 24px 32px',
            backgroundColor: '#fdf8f6',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', minWidth: 0 }}>
              <img
                src={logoUrl}
                alt="civilAIzation"
                style={{ height: 72, width: 'auto', maxWidth: 'min(100%, 420px)', objectFit: 'contain' }}
              />
              <GameStartButton status={state.status} onStartGame={startGame} />
            </div>
            <Settings debugMode={debugMode} onDebugModeChange={setDebugMode} />
          </div>

          <GameControls
            status={state.status}
            round={state.round}
            result={state.result}
            isPaused={isPaused}
            onStartGame={startGame}
            onTogglePause={handleTogglePause}
            showStartButton={false}
          />

        <div style={{ display: 'flex', gap: UI_CONFIG.gridGap, marginTop: 16 }}>
          <div>
            <Grid agents={state.agents} chests={state.chests} currentTurnAgent={state.currentTurnAgent} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {state.agents.length > 0
              ? state.agents.map((agent) => (
                  <AgentPanel
                    key={agent.agentId}
                    agent={agent}
                    isCurrentTurn={agent.agentId === state.currentTurnAgent}
                    maxHp={AGENT_INITIAL_HP[agent.agentId as keyof typeof AGENT_INITIAL_HP] ?? 20}
                    debugMode={debugMode}
                  />
                ))
              : AGENT_IDS.map((id) => (
                  <AgentPanel
                    key={id}
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
                ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <LogViewer systemLogs={state.eventLog} debugMode={debugMode} />
        </div>

        <Narrator />
        </div>
      </div>
    </NarratorProvider>
  );
}
