import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type LogType = 'system' | 'opus' | 'sonnet' | 'haiku';

interface LogEntry {
  timestamp: number;
  type: LogType;
  category: 'system' | 'prompt' | 'action' | 'result';
  message: string;
  data?: unknown;
}

interface LogContextValue {
  logs: LogEntry[];
  recordMode: boolean;
  enabledAgents: Set<LogType>;
  addLog: (type: LogType, category: LogEntry['category'], message: string, data?: unknown) => void;
  setRecordMode: (enabled: boolean) => void;
  toggleAgent: (agent: LogType) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextValue | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recordMode, setRecordMode] = useState(false);
  const [enabledAgents, setEnabledAgents] = useState<Set<LogType>>(new Set(['system']));

  const addLog = useCallback((
    type: LogType,
    category: LogEntry['category'],
    message: string,
    data?: unknown
  ) => {
    console.log('[LogContext.addLog] type:', type, 'category:', category, 'enabled:', enabledAgents.has(type));

    if (!enabledAgents.has(type) && type !== 'system') {
      console.log('[LogContext.addLog] Agent not enabled, skipping');
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      category,
      message,
      data,
    };

    console.log('[LogContext.addLog] Adding log entry:', entry);
    setLogs((prev) => [...prev, entry]);
  }, [enabledAgents]);

  const toggleAgent = useCallback((agent: LogType) => {
    setEnabledAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <LogContext.Provider
      value={{
        logs,
        recordMode,
        enabledAgents,
        addLog,
        setRecordMode,
        toggleAgent,
        clearLogs,
      }}
    >
      {children}
    </LogContext.Provider>
  );
}

export function useLog() {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within LogProvider');
  }
  return context;
}
