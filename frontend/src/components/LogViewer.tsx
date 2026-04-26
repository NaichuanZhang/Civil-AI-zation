import { useState, useEffect } from 'react';
import { Bug, Circle, Play, Pause, SkipForward } from 'lucide-react';
import { useLog } from '../contexts/LogContext';
import { AGENT_NAMES } from '../config';

type LogType = 'system' | 'opus' | 'sonnet' | 'haiku';

interface LogViewerProps {
  systemLogs: Array<{ type: string; round: number; text?: string; agentId?: string; action?: unknown; result?: unknown }>;
  debugMode: boolean;
}

export function LogViewer({ systemLogs, debugMode }: LogViewerProps) {
  const { logs: recordedLogs, recordMode, enabledAgents, setRecordMode, toggleAgent, clearLogs } = useLog();
  const [activeTab, setActiveTab] = useState<LogType>('system');
  const [replayMode, setReplayMode] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  // Reset to system tab when debug mode is turned off
  useEffect(() => {
    if (!debugMode && activeTab !== 'system') {
      setActiveTab('system');
    }
  }, [debugMode, activeTab]);

  const tabs: Array<{ id: LogType; label: string }> = debugMode
    ? [
        { id: 'system', label: 'System' },
        { id: 'opus', label: AGENT_NAMES['opus'] ?? 'Opus' },
        { id: 'sonnet', label: AGENT_NAMES['sonnet'] ?? 'Sonnet' },
        { id: 'haiku', label: AGENT_NAMES['haiku'] ?? 'Haiku' },
      ]
    : [{ id: 'system', label: 'System' }];

  const startRecording = () => {
    clearLogs();
    setRecordMode(true);
    setReplayMode(false);
    setReplayStep(0);
  };

  const stopRecording = () => {
    setRecordMode(false);
  };

  const startReplay = () => {
    if (recordedLogs.length === 0) return;
    setReplayMode(true);
    setReplayStep(0);
  };

  const stopReplay = () => {
    setReplayMode(false);
    setReplayStep(0);
  };

  const nextStep = () => {
    if (replayStep < recordedLogs.length - 1) {
      setReplayStep(replayStep + 1);
    }
  };

  const getFilteredLogs = () => {
    if (replayMode) {
      return recordedLogs.slice(0, replayStep + 1).filter((log) => log.type === activeTab);
    }

    if (activeTab === 'system') {
      return systemLogs.map((log, i) => ({
        timestamp: Date.now() - (systemLogs.length - i) * 1000,
        type: 'system' as LogType,
        category: 'system' as const,
        message: log.text || `${log.type} event`,
        data: log,
      }));
    }

    return recordedLogs.filter((log) => log.type === activeTab);
  };

  const filteredLogs = getFilteredLogs();

  return (
    <div
      style={{
        border: '1px solid #334155',
        borderRadius: 8,
        backgroundColor: '#0f172a',
        overflow: 'hidden',
      }}
    >
      {/* Tabs Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', flex: 1 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isEnabled = enabledAgents.has(tab.id);

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#0f172a' : 'transparent',
                  borderRight: '1px solid #334155',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  color: isActive ? '#f1f5f9' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: isActive ? '600' : 'normal',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#334155';
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAgent(tab.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={isEnabled ? 'Logging enabled' : 'Logging disabled'}
                >
                  <Bug size={14} color={isEnabled ? '#22c55e' : '#64748b'} />
                </button>
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>

        {/* Record/Replay Controls */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '4px 12px',
            borderLeft: '1px solid #334155',
          }}
        >
          {!replayMode && (
            <button
              onClick={recordMode ? stopRecording : startRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                border: '1px solid #334155',
                borderRadius: 4,
                backgroundColor: recordMode ? '#ef4444' : '#1e293b',
                color: '#e2e8f0',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={recordMode ? 'Stop recording' : 'Start recording'}
            >
              <Circle size={12} fill={recordMode ? '#ef4444' : 'none'} />
              <span>{recordMode ? 'Recording' : 'Record'}</span>
            </button>
          )}

          {!recordMode && recordedLogs.length > 0 && (
            <>
              <button
                onClick={replayMode ? stopReplay : startReplay}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  backgroundColor: replayMode ? '#3b82f6' : '#1e293b',
                  color: '#e2e8f0',
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {replayMode ? <Pause size={12} /> : <Play size={12} />}
                <span>{replayMode ? 'Stop' : 'Replay'}</span>
              </button>

              {replayMode && (
                <button
                  onClick={nextStep}
                  disabled={replayStep >= recordedLogs.length - 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    backgroundColor: '#1e293b',
                    color: replayStep >= recordedLogs.length - 1 ? '#64748b' : '#e2e8f0',
                    fontSize: 11,
                    cursor: replayStep >= recordedLogs.length - 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <SkipForward size={12} />
                  <span>Step ({replayStep + 1}/{recordedLogs.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Log Content */}
      <div
        style={{
          height: 240,
          overflowY: 'auto',
          padding: 12,
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: 'monospace',
        }}
      >
        {filteredLogs.length === 0 && (
          <div style={{ color: '#475569' }}>
            {replayMode
              ? 'No replay data'
              : enabledAgents.has(activeTab)
                ? 'Waiting for logs...'
                : 'Logging disabled for this agent'}
          </div>
        )}

        {filteredLogs.map((log, i) => {
          const categoryColor =
            log.category === 'prompt'
              ? '#3b82f6'
              : log.category === 'action'
                ? '#8b5cf6'
                : log.category === 'result'
                  ? '#22c55e'
                  : '#94a3b8';

          return (
            <div
              key={i}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#64748b', fontSize: 10 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: categoryColor,
                    fontSize: 10,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}
                >
                  {log.category}
                </span>
              </div>
              <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{log.message}</div>
              {log.data != null ? (
                <details style={{ marginTop: 4 }}>
                  <summary
                    style={{
                      color: '#64748b',
                      fontSize: 10,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    View data
                  </summary>
                  <pre
                    style={{
                      marginTop: 4,
                      padding: 8,
                      backgroundColor: '#1e293b',
                      borderRadius: 4,
                      fontSize: 10,
                      color: '#94a3b8',
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)
                    }}
                  />
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
