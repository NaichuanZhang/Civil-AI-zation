/**
 * Configuration Schema
 * Defines the structure for all game configuration
 */

import type { AgentId, Direction, HitZone } from './types.js';

/**
 * Agent Configuration Schema
 * Per-agent settings indexed by agent ID
 */
export interface AgentConfigSchema {
  modelId: string;
  speed: number;
  hp: number;
  startPosition: { x: number; y: number };
  startOrientation: Direction;
}

/**
 * Hit Zone Modifiers Schema
 */
export interface HitZoneModifiersSchema {
  front: number;
  side: number;
  back: number;
}

/**
 * Action Costs Schema
 * Energy cost for each action type
 */
export interface ActionCostsSchema {
  move: number;
  turn: number;
  attack: number;
  rest: number;
}

/**
 * Backend Configuration Schema
 */
export interface BackendConfigSchema {
  summaryModel: string;
  turnDelayMs: number;
  gameLoopDelayMs: number;
}

/**
 * Game Configuration Schema
 * Core game rules
 */
export interface GameConfigSchema {
  mapWidth: number;
  mapHeight: number;
  maxRounds: number;
  baseAttackDamage: number;
  restEpBonus: number;
  memoryCap: number;
  energyPoints: number;
  agents: Record<AgentId, AgentConfigSchema>;
  hitZoneModifiers: HitZoneModifiersSchema;
  actionCosts: ActionCostsSchema;
}

/**
 * UI Configuration Schema
 */
export interface UIConfigSchema {
  maxWidth: number;
  cellSize: number;
  agentPanelMinWidth: number;
  eventLogHeight: number;
  gridGap: number;
}

/**
 * Agent Visual Configuration Schema
 */
export interface AgentVisualConfigSchema {
  color: string;
  modelDisplayName: string;
}

/**
 * Theme Configuration Schema
 */
export interface ThemeConfigSchema {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    disabled: string;
  };
  border: {
    default: string;
    active: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
    acting: string;
  };
  hp: {
    high: string;
    medium: string;
    low: string;
  };
}

/**
 * Animation Configuration Schema
 */
export interface AnimationConfigSchema {
  transitionDuration: string;
  hoverDuration: string;
  scrollBehavior: 'smooth' | 'auto';
}

/**
 * Complete Configuration Schema
 * Combines all configuration sections
 */
export interface CompleteConfigSchema {
  game: GameConfigSchema;
  backend: BackendConfigSchema;
  ui: UIConfigSchema;
  agents: Record<AgentId, AgentVisualConfigSchema>;
  theme: ThemeConfigSchema;
  animation: AnimationConfigSchema;
}
