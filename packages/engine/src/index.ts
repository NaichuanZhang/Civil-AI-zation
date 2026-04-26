export type {
  Direction,
  AgentId,
  AgentStatus,
  HitZone,
  GameStatus,
  GameResult,
  ActionType,
  Position,
  AgentConfig,
  AgentState,
  MoveAction,
  AttackAction,
  TurnAction,
  RestAction,
  InvalidAction,
  AgentAction,
  ResolvedAction,
  MoveResult,
  AttackResult,
  TurnResult,
  RestResult,
  InvalidResult,
  ActionResult,
  TurnRecord,
  GameConfig,
  GameState,
  RoundSummary,
  SharedGameView,
  PublicAgentView,
  EliminatedAgentView,
  PersonalAgentView,
  WinConditionResult,
} from './types.js';

export { DEFAULT_GAME_CONFIG } from './config.js';

export {
  HIT_ZONE_MODIFIERS,
  ACTION_COSTS,
  BACKEND_CONFIG,
  AGENT_PERSONALITIES,
  AGENT_CONFIG_MAP,
  AGENT_INITIAL_HP,
  UI_CONFIG,
  AGENT_COLORS,
  AGENT_MODELS,
} from './game-config.js';

export type {
  AgentConfigSchema,
  HitZoneModifiersSchema,
  ActionCostsSchema,
  BackendConfigSchema,
  GameConfigSchema,
  UIConfigSchema,
  AgentVisualConfigSchema,
  ThemeConfigSchema,
  AnimationConfigSchema,
  CompleteConfigSchema,
} from './config-schema.js';

export {
  isInBounds,
  getAdjacentPosition,
  isAdjacent,
  getDirectionBetween,
  isPositionOccupied,
  getValidMoveDirections,
} from './grid.js';

export {
  getOppositeDirection,
  getHitZone,
  getDamageModifier,
} from './orientation.js';

export { calculateDamage } from './combat.js';
export type { DamageResult } from './combat.js';

export {
  createInitialState,
  updateAgent,
  eliminateAgent,
  buildSharedView,
  buildPersonalView,
} from './state.js';

export { appendMemory, buildMemoryEntry, buildTargetMemoryEntry } from './memory.js';

export {
  validateMove,
  validateAttack,
  validateTurn,
  validateRest,
  executeAction,
} from './actions.js';
export type { ActionValidation } from './actions.js';

export { getTurnOrder, resetEpForTurn } from './turn.js';

export { processRound } from './round.js';
export type { ActionDecider } from './round.js';

export { checkWinCondition } from './win-condition.js';

export {
  buildSystemPrompt,
  buildUserMessage,
  buildToolDefinitions,
  parseToolCall,
} from './agent-prompt.js';
export type { ToolDefinition } from './agent-prompt.js';

export { buildSummaryPrompt } from './summary.js';
