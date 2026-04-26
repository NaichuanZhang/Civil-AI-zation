# Configuration Guide

This document describes all configurable values in the Civil-AI-zation codebase.

## Configuration Files

### Backend/Engine Configuration

**File:** `packages/engine/src/game-config.ts`

All game mechanics, combat rules, and backend behavior are centralized here.

#### Game Mechanics
```typescript
DEFAULT_GAME_CONFIG = {
  mapWidth: 3,              // Grid width
  mapHeight: 3,             // Grid height
  maxRounds: 30,            // Maximum rounds before draw
  baseAttackDamage: 5,      // Base damage before modifiers
  restEpBonus: 1,           // EP bonus for resting
  memoryCap: 10,            // Max memory entries per agent
  energyPoints: 1,          // Starting EP per turn
}
```

#### Hit Zone Damage Modifiers
```typescript
HIT_ZONE_MODIFIERS = {
  front: 0.5,   // 50% damage (target sees you coming)
  side: 1.0,    // 100% damage (flanking)
  back: 1.5,    // 150% damage (backstab bonus)
}
```

#### Action Energy Costs (for multi-action system)
```typescript
ACTION_COSTS = {
  move: 1,      // Moving to adjacent cell
  turn: 0,      // Rotating (free)
  attack: 2,    // Attacking target
  rest: 0,      // Resting (free, recovers energy)
}
```

#### Agent Initial Stats
```typescript
AGENT_INITIAL_HP = {
  opus: 25,     // Tank: High HP, slow (speed 2)
  sonnet: 20,   // Balanced: Medium HP, medium speed (speed 3)
  haiku: 15,    // Glass cannon: Low HP, fast (speed 4)
}

agents: [
  { agentId: 'opus', modelId: 'openai/gpt-4o-mini', speed: 2, ... },
  { agentId: 'sonnet', modelId: 'openai/gpt-4o-mini', speed: 3, ... },
  { agentId: 'haiku', modelId: 'openai/gpt-4o-mini', speed: 4, ... },
]
```

#### Backend Behavior
```typescript
BACKEND_CONFIG = {
  summaryModel: 'openai/gpt-4o-mini',  // LLM for round summaries
  turnDelayMs: 1500,                    // Delay between turns (ms)
  gameLoopDelayMs: 2000,                // Delay before game starts (ms)
}
```

### Frontend Configuration

**File:** `frontend/src/config.ts`

All UI constants, colors, and display settings.

#### Agent Visuals
```typescript
AGENT_COLORS = {
  opus: '#8b5cf6',    // Purple
  sonnet: '#3b82f6',  // Blue
  haiku: '#22c55e',   // Green
}

AGENT_MODELS = {
  opus: 'GPT-4o Mini',
  sonnet: 'GPT-4o Mini',
  haiku: 'GPT-4o Mini',
}
```

#### Layout
```typescript
UI_CONFIG = {
  maxWidth: 900,            // Container max width
  cellSize: 80,             // Grid cell size
  agentPanelMinWidth: 160,  // Agent panel minimum width
  eventLogHeight: 240,      // Log viewer height
  gridGap: 24,              // Spacing between elements
}
```

#### Theme Colors
```typescript
THEME = {
  background: {
    primary: '#0f172a',    // Main background
    secondary: '#1e293b',  // Cards/panels
    tertiary: '#334155',   // Borders
  },
  text: {
    primary: '#f1f5f9',    // Headings
    secondary: '#e2e8f0',  // Body text
    muted: '#94a3b8',      // Secondary text
    disabled: '#64748b',   // Disabled text
  },
  status: {
    success: '#22c55e',    // Green (success, restart button)
    warning: '#eab308',    // Yellow (low HP)
    error: '#ef4444',      // Red (eliminated)
    info: '#3b82f6',       // Blue (info)
    acting: '#fbbf24',     // Gold (current turn)
  },
  hp: {
    high: '#22c55e',       // >50% HP
    medium: '#eab308',     // 25-50% HP
    low: '#ef4444',        // <25% HP
  },
}
```

#### Animations
```typescript
ANIMATION = {
  transitionDuration: '0.5s',
  hoverDuration: '0.2s',
  scrollBehavior: 'smooth',
}
```

## How to Modify Configuration

### Changing Game Rules

**Example: Make attacks deal more damage**

Edit `packages/engine/src/game-config.ts`:
```typescript
export const DEFAULT_GAME_CONFIG: GameConfig = {
  // ...
  baseAttackDamage: 8,  // Changed from 5 to 8
  // ...
};
```

**Example: Increase backstab bonus**

Edit `packages/engine/src/game-config.ts`:
```typescript
export const HIT_ZONE_MODIFIERS = {
  front: 0.5,
  side: 1.0,
  back: 2.0,  // Changed from 1.5 to 2.0 (200% damage)
};
```

After changes:
1. Run `pnpm run build:edge` to rebuild backend
2. Deploy: `npx @insforge/cli functions deploy run-game`

### Changing UI Settings

**Example: Make grid larger**

Edit `frontend/src/config.ts`:
```typescript
export const UI_CONFIG = {
  // ...
  cellSize: 100,  // Changed from 80 to 100
  // ...
};
```

Changes take effect immediately (hot reload).

### Changing Agent Colors

Edit `frontend/src/config.ts`:
```typescript
export const AGENT_COLORS = {
  opus: '#ff0000',    // Red
  sonnet: '#00ff00',  // Green
  haiku: '#0000ff',   // Blue
};
```

### Changing Backend Timing

Edit `packages/engine/src/game-config.ts`:
```typescript
export const BACKEND_CONFIG = {
  summaryModel: 'openai/gpt-4o',      // Use better model
  turnDelayMs: 500,                    // Faster turns
  gameLoopDelayMs: 1000,               // Shorter startup delay
};
```

Then rebuild and redeploy backend.

## Configuration Best Practices

### ✅ DO:
- Modify values in `game-config.ts` or `frontend/src/config.ts`
- Keep related constants grouped together
- Add comments explaining what each value controls
- Test changes before deploying to production

### ❌ DON'T:
- Hardcode magic numbers in component files
- Duplicate configuration values
- Change values directly in `index.src.ts` or components

## Future Enhancements

### Planned Configuration Options:
- Action costs per action type (for multi-action system)
- AI model selection per agent
- Map layouts (different starting positions)
- Custom game modes (free-for-all, team battle, etc.)
- Difficulty presets (easy, normal, hard)

### Runtime Configuration:
Currently all configuration is compile-time. Future versions could support:
- Loading config from database
- Per-game configuration overrides
- User-selectable game modes
- Custom map editor

## Summary

**All magic numbers are now centralized in two files:**
1. `packages/engine/src/game-config.ts` - Game mechanics and backend
2. `frontend/src/config.ts` - UI and display settings

**To change game behavior:** Edit `game-config.ts`, rebuild, and redeploy backend.

**To change appearance:** Edit `frontend/src/config.ts` (hot reload applies immediately).
