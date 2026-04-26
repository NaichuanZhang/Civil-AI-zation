import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { Grid } from './components/Grid';
import { AgentPanel } from './components/AgentPanel';
import { LogViewer } from './components/LogViewer';
import { GameControls } from './components/GameControls';
import { Settings } from './components/Settings';
import { AGENT_INITIAL_HP, UI_CONFIG, THEME } from './config';

export function App() {
  const { state, startGame } = useGameState();
  const [debugMode, setDebugMode] = useState(false);

  return (
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
        onStartGame={startGame}
      />

      <div style={{ display: 'flex', gap: UI_CONFIG.gridGap, marginTop: 16 }}>
        <div>
          <Grid agents={state.agents} currentTurnAgent={state.currentTurnAgent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {state.agents.length > 0
            ? state.agents.map((agent) => (
                <AgentPanel
                  key={agent.agentId}
                  agent={agent}
                  isCurrentTurn={agent.agentId === state.currentTurnAgent}
                  maxHp={AGENT_INITIAL_HP[agent.agentId] ?? 20}
                  debugMode={debugMode}
                />
              ))
            : ['opus', 'sonnet', 'haiku'].map((id) => (
                <AgentPanel
                  key={id}
                  agent={{
                    agentId: id,
                    position: { x: 0, y: 0 },
                    hp: AGENT_INITIAL_HP[id] ?? 20,
                    orientation: 'N',
                    status: 'alive',
                    speed: id === 'haiku' ? 4 : id === 'sonnet' ? 3 : 2,
                    eliminatedAtRound: null,
                  }}
                  isCurrentTurn={false}
                  maxHp={AGENT_INITIAL_HP[id] ?? 20}
                  debugMode={debugMode}
                />
              ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <LogViewer systemLogs={state.eventLog} debugMode={debugMode} />
      </div>
    </div>
  );
}
