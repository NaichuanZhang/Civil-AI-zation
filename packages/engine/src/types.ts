export type Direction = 'N' | 'S' | 'E' | 'W';
export type AgentId = 'opus' | 'sonnet' | 'haiku';
export type AgentStatus = 'alive' | 'eliminated';
export type HitZone = 'front' | 'side' | 'back';
export type GameStatus = 'pending' | 'running' | 'completed';
export type GameResult = 'elimination' | 'highest_hp' | 'draw';
export type ActionType = 'move' | 'attack' | 'rest' | 'invalid';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface AgentConfig {
  readonly agentId: AgentId;
  readonly modelId: string;
  readonly speed: number;
  readonly hp: number;
  readonly position: Position;
  readonly orientation: Direction;
}

export interface AgentState {
  readonly agentId: AgentId;
  readonly modelId: string;
  readonly speed: number;
  readonly hp: number;
  readonly ep: number;
  readonly position: Position;
  readonly orientation: Direction;
  readonly status: AgentStatus;
  readonly eliminatedAtRound: number | null;
  readonly memory: readonly string[];
  readonly turnOrder: number;
}

export interface MoveAction {
  readonly type: 'move';
  readonly direction: Direction;
}

export interface AttackAction {
  readonly type: 'attack';
  readonly target: AgentId;
}

export interface RestAction {
  readonly type: 'rest';
}

export interface InvalidAction {
  readonly type: 'invalid';
  readonly reason: string;
}

export type AgentAction = MoveAction | AttackAction | RestAction;
export type ResolvedAction = AgentAction | InvalidAction;

export interface MoveResult {
  readonly type: 'move';
  readonly from: Position;
  readonly to: Position;
  readonly newOrientation: Direction;
}

export interface AttackResult {
  readonly type: 'attack';
  readonly target: AgentId;
  readonly hitZone: HitZone;
  readonly damage: number;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
  readonly targetEliminated: boolean;
}

export interface RestResult {
  readonly type: 'rest';
  readonly epBonusNextTurn: number;
}

export interface InvalidResult {
  readonly type: 'invalid';
  readonly reason: string;
  readonly fallbackAction: RestResult;
}

export type ActionResult = MoveResult | AttackResult | RestResult | InvalidResult;

export interface TurnRecord {
  readonly roundNumber: number;
  readonly agentId: AgentId;
  readonly action: ResolvedAction;
  readonly result: ActionResult;
}

export interface GameConfig {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly maxRounds: number;
  readonly baseAttackDamage: number;
  readonly restEpBonus: number;
  readonly memoryCap: number;
  readonly energyPoints: number;
  readonly agents: readonly AgentConfig[];
}

export interface GameState {
  readonly round: number;
  readonly status: GameStatus;
  readonly config: GameConfig;
  readonly agents: readonly AgentState[];
  readonly turnRecords: readonly TurnRecord[];
  readonly roundSummaries: readonly RoundSummary[];
  readonly result: GameResult | null;
  readonly winnerAgentId: AgentId | null;
}

export interface RoundSummary {
  readonly roundNumber: number;
  readonly summary: string;
  readonly stateSnapshot: SharedGameView;
}

export interface SharedGameView {
  readonly round: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly agents: readonly PublicAgentView[];
  readonly eliminatedAgents: readonly EliminatedAgentView[];
  readonly previousRoundSummary: string | null;
}

export interface PublicAgentView {
  readonly agentId: AgentId;
  readonly position: Position;
  readonly hp: number;
  readonly orientation: Direction;
}

export interface EliminatedAgentView {
  readonly agentId: AgentId;
  readonly eliminatedAtRound: number;
}

export interface PersonalAgentView {
  readonly agentId: AgentId;
  readonly hp: number;
  readonly ep: number;
  readonly position: Position;
  readonly orientation: Direction;
  readonly memory: readonly string[];
}

export interface WinConditionResult {
  readonly gameOver: boolean;
  readonly result: GameResult | null;
  readonly winnerAgentId: AgentId | null;
}
