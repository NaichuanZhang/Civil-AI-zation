interface GameControlsProps {
  status: string;
  round: number;
  result: { winner: string | null; type: string } | null;
  onStartGame: () => void;
}

export function GameControls({ status, round, result, onStartGame }: GameControlsProps) {
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
        disabled={status === 'loading' || status === 'running'}
        style={{
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 'bold',
          border: 'none',
          borderRadius: 6,
          cursor: status === 'loading' || status === 'running' ? 'not-allowed' : 'pointer',
          backgroundColor: status === 'loading' || status === 'running' ? '#334155' : '#8b5cf6',
          color: '#fff',
          transition: 'background-color 0.2s',
        }}
      >
        {status === 'loading' ? 'Starting...' : 'Start New Game'}
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
