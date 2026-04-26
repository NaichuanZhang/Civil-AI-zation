import { useGameState } from './hooks/useGameState';
import { usePersistedState } from './hooks/usePersistedState';
import { Grid } from './components/Grid';
import { AgentPanel } from './components/AgentPanel';
import { LogViewer } from './components/LogViewer';
import { GameControls } from './components/GameControls';
import { Settings } from './components/Settings';
import { Narrator } from './components/Narrator';
import { NarratorProvider } from './contexts/NarratorContext';
import { AGENT_INITIAL_HP, AGENT_STATS, UI_CONFIG, THEME } from './config';

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
          maxWidth: UI_CONFIG.maxWidth,
          margin: '0 auto',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: THEME.background.primary,
          minHeight: '100vh',
          color: THEME.text.secondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: 0, color: '#f1f5f9' }}>
            Civil-AI-zation
          </h1>
          <Settings debugMode={debugMode} onDebugModeChange={setDebugMode} />
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px 0' }}>
          Turn-based AI arena battle
        </p>

        <GameControls
          status={state.status}
          round={state.round}
          result={state.result}
          isPaused={isPaused}
          onStartGame={startGame}
          onTogglePause={handleTogglePause}
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
    </NarratorProvider>
  );
}
