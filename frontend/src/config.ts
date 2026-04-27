/**
 * Frontend Configuration
 * Centralizes all magic numbers and configuration values for the UI
 */

/**
 * Get list of all agent IDs
 */
export const getAgentIds = () => Object.keys(AGENT_STATS) as Array<keyof typeof AGENT_STATS>;

/**
 * Agent Stats
 * Should match backend AGENT_CONFIG_MAP
 */
export const AGENT_STATS = {
  opus: { hp: 25, speed: 2 },
  sonnet: { hp: 20, speed: 3 },
  haiku: { hp: 15, speed: 4 },
} as const;

/**
 * Agent Initial HP (derived from AGENT_STATS)
 * For backwards compatibility
 */
export const AGENT_INITIAL_HP = Object.fromEntries(
  Object.entries(AGENT_STATS).map(([id, stats]) => [id, stats.hp])
) as Record<keyof typeof AGENT_STATS, number>;

/**
 * Agent Visual Configuration
 */
export const AGENT_COLORS: Record<string, string> = {
  opus: '#3b82f6',    // Blue (GLM)
  sonnet: '#22c55e',  // Green (GPT)
  haiku: '#f97316',   // Orange (Claude)
} as const;

export const AGENT_NAMES: Record<string, string> = {
  opus: 'GLM-5 Turbo',
  sonnet: 'GPT-4o Mini',
  haiku: 'Claude Haiku',
} as const;

export const AGENT_MODELS: Record<string, string> = {
  opus: 'GLM-5 Turbo',
  sonnet: 'GPT-4o Mini',
  haiku: 'Claude Haiku 4.5',
} as const;

/**
 * Layout Configuration
 */
export const UI_CONFIG = {
  maxWidth: 900,
  cellSize: 80,
  agentPanelMinWidth: 160,
  eventLogHeight: 240,
  gridGap: 24,
} as const;

/**
 * Theme Colors
 */
export const THEME = {
  background: {
    primary: '#0f172a',
    secondary: '#1e293b',
    tertiary: '#334155',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#e2e8f0',
    muted: '#94a3b8',
    disabled: '#64748b',
  },
  border: {
    default: '#334155',
    active: '#475569',
  },
  status: {
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',
    info: '#3b82f6',
    acting: '#fbbf24',
  },
  hp: {
    high: '#22c55e',
    medium: '#eab308',
    low: '#ef4444',
  },
} as const;

/**
 * Animation Timings
 */
export const ANIMATION = {
  transitionDuration: '0.5s',
  hoverDuration: '0.2s',
  scrollBehavior: 'smooth' as const,
} as const;

/**
 * Game Constants
 */
export const GAME_CONFIG = {
  maxRounds: 30,
  mapSize: 3,
} as const;

/**
 * Narrator Configuration
 */
export const NARRATOR_CONFIG = {
  containerWidth: 280,
  avatarHeight: 200,
  subtitleMaxLines: 2,
  subtitleDismissMs: 3500,
  queueMaxTTSItems: 3,
  staleThresholdMs: 30_000,
  pcmSampleRate: 16000,
  pcmChunkSize: 4096,
} as const;
