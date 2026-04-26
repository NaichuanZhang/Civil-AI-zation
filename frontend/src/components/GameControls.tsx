interface GameControlsProps {
  status: string;
  round: number;
  result: { winner: string | null; type: string } | null;
  onStartGame: () => void;
}

export function GameControls({ status, round, result, onStartGame }: GameControlsProps) {
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
        <span style={{ color: '#94a3b8', fontSize: 14 }}>
          Round {round} / 30
        </span>
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
            ? `${result.winner.toUpperCase()} wins! (${result.type})`
            : `Draw! (${result.type})`}
        </div>
      )}
    </div>
  );
}
