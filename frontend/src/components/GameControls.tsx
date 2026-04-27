import { Pause, Play } from 'lucide-react';
import { AGENT_NAMES } from '../config';
import dashboardBgUrl from '@assets/dashboard-bg.png';

interface GameStartButtonProps {
  status: string;
  onStartGame: () => void;
}

export function GameStartButton({ status, onStartGame }: GameStartButtonProps) {
  const isCompleted = status === 'completed';
  const isDisabled = status === 'loading' || status === 'running';

  const getButtonText = () => {
    if (status === 'loading') return 'Starting...';
    if (isCompleted) return 'Restart Game';
    return 'Start';
  };

  return (
    <button
      type="button"
      onClick={onStartGame}
      disabled={isDisabled}
      style={{
        padding: '10px 22px',
        fontSize: 15,
        fontWeight: 'bold',
        borderRadius: 10,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        backgroundColor: '#ebe4d8',
        backgroundImage: `url(${dashboardBgUrl})`,
        backgroundSize: 'auto 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        border: isCompleted ? '2px solid #15803d' : '1px solid rgba(68, 55, 40, 0.35)',
        color: isCompleted ? '#14532d' : '#292524',
        opacity: isDisabled ? 0.55 : 1,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
        transition: 'filter 0.2s, opacity 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.filter = 'brightness(1.06)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = '';
      }}
    >
      {getButtonText()}
    </button>
  );
}

interface GameControlsProps {
  status: string;
  round: number;
  result: { winner: string | null; type: string } | null;
  isPaused: boolean;
  onStartGame: () => void;
  onTogglePause: () => void;
  /** When false, the primary start control is omitted (e.g. rendered beside the logo). */
  showStartButton?: boolean;
}

export function GameControls({
  status,
  round,
  result,
  isPaused,
  onStartGame,
  onTogglePause,
  showStartButton = true,
}: GameControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
        flexWrap: 'wrap',
      }}
    >
      {showStartButton && <GameStartButton status={status} onStartGame={onStartGame} />}

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
