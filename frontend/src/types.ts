export interface AgentUIState {
  agentId: string;
  position: { x: number; y: number };
  hp: number;
  ep?: number;
  orientation: string;
  status: string;
  speed: number;
  eliminatedAtRound: number | null;
  lastAction?: { type: string; direction?: string; target?: string };
}

export interface EventLogEntry {
  type: 'turn' | 'summary' | 'elimination';
  round: number;
  agentId?: string;
  action?: { type: string; direction?: string; target?: string };
  result?: {
    type: string;
    damage?: number;
    hitZone?: string;
    targetEliminated?: boolean;
    target?: string;
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    newOrientation?: string;
  };
  text?: string;
  eliminatedBy?: string;
}

export interface GameUIState {
  gameId: string | null;
  status: 'idle' | 'loading' | 'running' | 'completed';
  round: number;
  agents: AgentUIState[];
  eventLog: EventLogEntry[];
  result: { winner: string | null; type: string } | null;
  currentTurnAgent: string | null;
}
