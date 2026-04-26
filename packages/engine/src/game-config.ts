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
  move: 1,    // Moving to adjacent cell
  turn: 0,    // Rotating to face different direction (free)
  attack: 2,  // Attacking adjacent target
  rest: 0,    // Resting to recover energy (free)
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
 * Agent Configuration Map
 * Per-agent settings indexed by agent ID
 */
export const AGENT_CONFIG_MAP = {
  opus: {
    modelId: 'openai/gpt-4o-mini',
    speed: 2,
    hp: 25,
    startPosition: { x: 0, y: 2 },
    startOrientation: 'N' as const,
  },
  sonnet: {
    modelId: 'openai/gpt-4o-mini',
    speed: 3,
    hp: 20,
    startPosition: { x: 2, y: 2 },
    startOrientation: 'W' as const,
  },
  haiku: {
    modelId: 'openai/gpt-4o-mini',
    speed: 4,
    hp: 15,
    startPosition: { x: 1, y: 0 },
    startOrientation: 'S' as const,
  },
} as const;

/**
 * Agent Initial HP (derived from AGENT_CONFIG_MAP)
 * For backwards compatibility
 */
export const AGENT_INITIAL_HP = {
  opus: AGENT_CONFIG_MAP.opus.hp,
  sonnet: AGENT_CONFIG_MAP.sonnet.hp,
  haiku: AGENT_CONFIG_MAP.haiku.hp,
} as const;

/**
 * Default Game Configuration
 * Core game rules and map settings
 * Uses AGENT_CONFIG_MAP to generate agent array
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 3,
  mapHeight: 3,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  agents: [
    {
      agentId: 'opus' as const,
      modelId: AGENT_CONFIG_MAP.opus.modelId,
      speed: AGENT_CONFIG_MAP.opus.speed,
      hp: AGENT_CONFIG_MAP.opus.hp,
      position: AGENT_CONFIG_MAP.opus.startPosition,
      orientation: AGENT_CONFIG_MAP.opus.startOrientation,
    },
    {
      agentId: 'sonnet' as const,
      modelId: AGENT_CONFIG_MAP.sonnet.modelId,
      speed: AGENT_CONFIG_MAP.sonnet.speed,
      hp: AGENT_CONFIG_MAP.sonnet.hp,
      position: AGENT_CONFIG_MAP.sonnet.startPosition,
      orientation: AGENT_CONFIG_MAP.sonnet.startOrientation,
    },
    {
      agentId: 'haiku' as const,
      modelId: AGENT_CONFIG_MAP.haiku.modelId,
      speed: AGENT_CONFIG_MAP.haiku.speed,
      hp: AGENT_CONFIG_MAP.haiku.hp,
      position: AGENT_CONFIG_MAP.haiku.startPosition,
      orientation: AGENT_CONFIG_MAP.haiku.startOrientation,
    },
  ],
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
  opus: 'GPT-4o Mini',
  sonnet: 'GPT-4o Mini',
  haiku: 'GPT-4o Mini',
} as const;
