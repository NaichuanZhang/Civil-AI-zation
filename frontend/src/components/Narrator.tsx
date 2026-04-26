import { Volume2, VolumeX, SkipForward, Minimize2, Mic } from 'lucide-react';
import { useNarratorContext } from '../contexts/NarratorContext';
import { THEME } from '../config';

export function Narrator() {
  const {
    enabled,
    narratorState,
    avatarContainerRef,
    setMuted,
    setVolume,
    setIsMinimized,
    skipCurrent,
  } = useNarratorContext();

  if (!enabled) return null;

  if (narratorState.isMinimized) {
    return <NarratorMinimized onExpand={() => setIsMinimized(false)} />;
  }

  const isSpeaking = narratorState.status === 'speaking';
  const isLoading = narratorState.status === 'loading';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 1000,
        width: 280,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: THEME.background.secondary,
        border: `1px solid ${isSpeaking ? THEME.status.info : THEME.border.default}`,
        boxShadow: isSpeaking
          ? `0 0 20px ${THEME.status.info}40`
          : '0 8px 32px rgba(0, 0, 0, 0.4)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={avatarContainerRef}
          style={{
            width: 280,
            height: 200,
            backgroundColor: THEME.background.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!narratorState.avatarReady && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: THEME.text.disabled,
              }}
            >
              <Mic size={32} />
              <span style={{ fontSize: 11 }}>Narrator</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            borderRadius: 4,
            padding: 4,
            cursor: 'pointer',
            color: THEME.text.muted,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Minimize2 size={14} />
        </button>

        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: 16,
              height: 16,
              border: `2px solid ${THEME.text.disabled}`,
              borderTopColor: THEME.status.info,
              borderRadius: '50%',
              animation: 'narrator-spin 0.8s linear infinite',
            }}
          />
        )}

        {narratorState.subtitleText && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '8px 12px',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
              color: THEME.text.primary,
              fontSize: 12,
              lineHeight: 1.4,
              maxHeight: 52,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {narratorState.subtitleText}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderTop: `1px solid ${THEME.border.default}`,
        }}
      >
        <button
          onClick={() => setMuted(!narratorState.isMuted)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: narratorState.isMuted ? THEME.status.error : THEME.text.muted,
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
          title={narratorState.isMuted ? 'Unmute' : 'Mute'}
        >
          {narratorState.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {!narratorState.isMuted && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={narratorState.volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{
              flex: 1,
              height: 4,
              accentColor: THEME.status.info,
              cursor: 'pointer',
            }}
          />
        )}

        <button
          onClick={skipCurrent}
          disabled={narratorState.status === 'idle'}
          style={{
            background: 'none',
            border: 'none',
            cursor: narratorState.status === 'idle' ? 'default' : 'pointer',
            color:
              narratorState.status === 'idle'
                ? THEME.text.disabled
                : THEME.text.muted,
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            marginLeft: 'auto',
          }}
          title="Skip"
        >
          <SkipForward size={16} />
        </button>

        {narratorState.queueLength > 0 && (
          <span
            style={{
              fontSize: 10,
              color: THEME.text.disabled,
              minWidth: 16,
              textAlign: 'center',
            }}
          >
            {narratorState.queueLength}
          </span>
        )}
      </div>

      <style>{`
        @keyframes narrator-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function NarratorMinimized({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 1000,
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: THEME.background.secondary,
        border: `1px solid ${THEME.border.default}`,
        color: THEME.text.muted,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      }}
      title="Show narrator"
    >
      <Mic size={18} />
    </button>
  );
}
