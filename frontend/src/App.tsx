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
import { AGENT_INITIAL_HP, AGENT_STATS } from './config';

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
          boxSizing: 'border-box',
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          margin: 0,
          fontFamily: "'Patrick Hand', cursive, system-ui, sans-serif",
          backgroundColor: '#fdf8f6',
          color: '#334155',
        }}
      >
        <div
          style={{
            boxSizing: 'border-box',
            width: '100%',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            padding: '0 16px 16px',
            margin: 0,
            backgroundColor: '#fdf8f6',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              flexShrink: 0,
              margin: 0,
              padding: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                minWidth: 0,
                margin: 0,
                padding: 0,
              }}
            >
              <img
                src={logoUrl}
                alt="civilAIzation"
                style={{ height: 72, width: 'auto', maxWidth: 'min(100%, 420px)', objectFit: 'contain' }}
              />
              <GameStartButton status={state.status} onStartGame={startGame} />
            </div>
            <Settings debugMode={debugMode} onDebugModeChange={setDebugMode} />
          </div>

          <div style={{ flexShrink: 0, margin: 0, padding: 0 }}>
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

          <div
            style={{
              flex: 4,
              minHeight: 0,
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              margin: 0,
              padding: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
                padding: 0,
              }}
            >
              <Grid agents={state.agents} chests={state.chests} currentTurnAgent={state.currentTurnAgent} />
            </div>
            <div
              style={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'stretch',
                width: 'min(320px, 42%)',
                maxHeight: 'min(90%, calc(100% - 16px))',
                overflowY: 'auto',
                zIndex: 2,
                pointerEvents: 'auto',
                margin: 0,
                padding: 0,
              }}
            >
              {agentPanels}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              marginTop: 8,
              marginBottom: 0,
              padding: 0,
            }}
          >
            <LogViewer systemLogs={state.eventLog} debugMode={debugMode} />
          </div>

          <Narrator />
        </div>
      </div>
    </NarratorProvider>
  );
}
