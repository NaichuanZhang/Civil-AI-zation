import { Pause, Play } from 'lucide-react';
import { AGENT_NAMES } from '../config';

interface GameControlsProps {
  status: string;
  round: number;
  result: { winner: string | null; type: string } | null;
  isPaused: boolean;
  onStartGame: () => void;
  onTogglePause: () => void;
}

export function GameControls({ status, round, result, isPaused, onStartGame, onTogglePause }: GameControlsProps) {
  const isCompleted = status === 'completed';
  const isDisabled = status === 'loading' || status === 'running';

  const getButtonColor = () => {
    if (isDisabled) return '#334155';
    if (isCompleted) return '#22c55e'; // Green for restart
    return '#8b5cf6'; // Purple for new game
  };

  const getButtonText = () => {
    if (status === 'loading') return 'Starting...';
    if (isCompleted) return 'Restart Game';
    return 'Start New Game';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
      }}
    >
      <button
        onClick={onStartGame}
        disabled={isDisabled}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 'bold',
          border: 'none',
          borderRadius: 6,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          backgroundColor: getButtonColor(),
          color: '#fff',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = isCompleted ? '#16a34a' : '#7c3aed';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = getButtonColor();
          }
        }}
      >
        {getButtonText()}
      </button>

      {status === 'running' && (
        <>
          <button
            onClick={onTogglePause}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 'bold',
              border: '1px solid #334155',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: isPaused ? '#eab308' : '#334155',
              color: '#fff',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isPaused ? '#ca8a04' : '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isPaused ? '#eab308' : '#334155';
            }}
          >
            {isPaused ? (
              <>
                <Play size={16} />
                Resume
              </>
            ) : (
              <>
                <Pause size={16} />
                Pause
              </>
            )}
          </button>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>
            Round {round} / 30
            {isPaused && (
              <span
                style={{
                  color: '#eab308',
                  marginLeft: 8,
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              >
                ⏸ PAUSED - Will pause after this round completes
              </span>
            )}
          </span>
        </>
      )}

      {status === 'completed' && result && (
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            backgroundColor: result.winner ? '#16a34a' : '#eab308',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          {result.winner
            ? `${AGENT_NAMES[result.winner] ?? result.winner.toUpperCase()} wins! (${result.type})`
            : `Draw! (${result.type})`}
        </div>
      )}
    </div>
  );
}
