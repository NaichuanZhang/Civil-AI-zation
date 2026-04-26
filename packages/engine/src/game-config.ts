import type { GameConfig } from './types.js';

/**
 * Hit Zone Damage Modifiers
 * Controls how much damage is dealt based on attack angle
 */
export const HIT_ZONE_MODIFIERS = {
  front: 0.5,  // Attacking from front: 50% damage (target is facing you)
  side: 1.0,   // Attacking from side: 100% damage (flanking)
  back: 1.5,   // Attacking from back: 150% damage (backstab bonus)
} as const;

/**
 * Action Energy Costs
 * Each action consumes energy points (EP)
 */
export const ACTION_COSTS = {
  move: 1,
  turn: 1,
  attack: 1,
  rest: 0,
} as const;

/**
 * Backend Configuration
 * Controls server-side behavior
 */
export const BACKEND_CONFIG = {
  summaryModel: 'openai/gpt-4o-mini',  // Model for round summaries
  turnDelayMs: 1500,                    // Delay between turns (for UI readability)
  gameLoopDelayMs: 2000,                // Initial delay before game loop starts
} as const;

/**
 * Agent Personalities
 * Personality descriptions for system prompts
 */
export const AGENT_PERSONALITIES = {
  opus: 'You are Opus, a strategic and patient warrior. You think several moves ahead, value positioning, and prefer to attack from advantageous angles.',
  sonnet: 'You are Sonnet, a balanced and adaptive fighter. You assess the situation pragmatically, adapting your strategy to the current board state.',
  haiku: 'You are Haiku, an aggressive and impulsive combatant. You favor direct action, closing distance quickly and attacking whenever possible.',
} as const;

/**
 * Agent Configuration Map
 * Per-agent settings indexed by agent ID
 */
export const AGENT_CONFIG_MAP = {
  opus: {
    modelId: 'zai/glm-5-turbo',
    speed: 2,
    hp: 25,
    startPosition: { x: 0, y: 2 },
    startOrientation: 'up' as const,
    maxTokens: 500,
  },
  sonnet: {
    modelId: 'openai/gpt-4o-mini',
    speed: 3,
    hp: 20,
    startPosition: { x: 2, y: 2 },
    startOrientation: 'left' as const,
    maxTokens: 500,
  },
  haiku: {
    modelId: 'anthropic/claude-haiku-4.5',
    speed: 4,
    hp: 15,
    startPosition: { x: 1, y: 0 },
    startOrientation: 'down' as const,
    maxTokens: 500,
  },
} as const;

/**
 * Agent Initial HP (derived from AGENT_CONFIG_MAP)
 * For backwards compatibility
 */
export const AGENT_INITIAL_HP = Object.fromEntries(
  Object.entries(AGENT_CONFIG_MAP).map(([id, config]) => [id, config.hp])
) as Record<keyof typeof AGENT_CONFIG_MAP, number>;

/**
 * Treasure Chest Configuration
 * Controls chest spawning and item effects
 */
export const CHEST_CONFIG = {
  enabled: true,                          // Enable/disable chest feature
  spawnRounds: [2, 7, 12, 17, 22, 27],  // First chest at round 2, then every 5 rounds
  hpBoostAmount: 5,                      // HP gained from hp_boost item
  hpDrainAmount: -5,                     // HP lost from hp_drain item
  maxOnBoard: 2,                         // Max unopened chests on the board at once
} as const;

/**
 * Default Game Configuration
 * Core game rules and map settings
 * Dynamically generates agent array from AGENT_CONFIG_MAP
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 3,
  mapHeight: 3,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  maxEp: 3,
  agents: Object.entries(AGENT_CONFIG_MAP).map(([agentId, config]) => ({
    agentId: agentId as keyof typeof AGENT_CONFIG_MAP,
    modelId: config.modelId,
    speed: config.speed,
    hp: config.hp,
    position: config.startPosition,
    orientation: config.startOrientation,
  })),
  chests: CHEST_CONFIG,
  actionCosts: ACTION_COSTS,
};

/**
 * UI Configuration
 * Frontend display settings
 */
export const UI_CONFIG = {
  maxWidth: 900,
  cellSize: 80,
  agentPanelMinWidth: 160,
  eventLogHeight: 240,
  transitionDuration: '0.5s',
} as const;

/**
 * Agent Visual Configuration
 * Colors and display settings for each agent
 */
export const AGENT_COLORS = {
  opus: '#8b5cf6',    // Purple
  sonnet: '#3b82f6',  // Blue
  haiku: '#22c55e',   // Green
} as const;

/**
 * Agent Model Display Names
 * Human-readable model names for UI
 */
export const AGENT_MODELS = {
  opus: 'GLM-5 Turbo',
  sonnet: 'GPT-4o Mini',
  haiku: 'Claude Haiku 4.5',
} as const;
