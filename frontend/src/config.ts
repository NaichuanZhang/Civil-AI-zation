/**
 * Frontend Configuration
 * Centralizes all magic numbers and configuration values for the UI
 */

/**
 * Agent Initial HP
 * Should match backend configuration
 */
export const AGENT_INITIAL_HP: Record<string, number> = {
  opus: 25,
  sonnet: 20,
  haiku: 15,
} as const;

/**
 * Agent Visual Configuration
 */
export const AGENT_COLORS: Record<string, string> = {
  opus: '#8b5cf6',    // Purple
  sonnet: '#3b82f6',  // Blue
  haiku: '#22c55e',   // Green
} as const;

export const AGENT_MODELS: Record<string, string> = {
  opus: 'GPT-4o Mini',
  sonnet: 'GPT-4o Mini',
  haiku: 'GPT-4o Mini',
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
