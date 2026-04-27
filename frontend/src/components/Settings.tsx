import { useState } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import dashboardBgUrl from '@assets/dashboard-bg.png';

interface SettingsProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
}

export function Settings({ debugMode, onDebugModeChange }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'transparent',
          backgroundImage: `url(${dashboardBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#1c1917',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'filter 0.2s, box-shadow 0.2s',
          boxShadow: 'inset 0 0 0 1px rgba(68, 55, 40, 0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'brightness(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = '';
        }}
        title="Settings"
      >
        <SettingsIcon size={18} />
      </button>

      {/* Settings Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1001,
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#1e293b',
              border: '2px solid #334155',
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 480,
              zIndex: 1002,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#f1f5f9', margin: 0 }}>
                Settings
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e293b';
                  e.currentTarget.style.color = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f172a';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Debug Mode Toggle */}
            <div
              style={{
                padding: 16,
                backgroundColor: '#0f172a',
                borderRadius: 8,
                border: '1px solid #334155',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: '600', color: '#f1f5f9', marginBottom: 4 }}>
                    Debug Mode
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Show energy points and last action for each player
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => onDebugModeChange(!debugMode)}
                  role="switch"
                  aria-checked={debugMode}
                  style={{
                    position: 'relative',
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    border: 'none',
                    backgroundColor: debugMode ? '#22c55e' : '#475569',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: debugMode ? 23 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
