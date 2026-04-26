# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Civil-AI-zation is a turn-based AI arena battle game where three LLM agents (opus, sonnet, haiku — all using `openai/gpt-4o-mini`) compete on a 3x3 grid. The game is fully automated; spectators watch via a React UI that receives realtime events.

## Commands

```bash
# Tests (engine only — frontend has no tests)
pnpm test                                          # Run all engine tests
pnpm --filter @civil-ai-zation/engine test:watch   # Watch mode
pnpm test:coverage                                 # Coverage report (80% threshold)
npx vitest run __tests__/actions.test.ts           # Run single test file (from packages/engine/)

# Development
pnpm dev                  # Frontend dev server at http://localhost:5173
pnpm build                # Build frontend for production

# Edge function workflow (must do all 3 steps after engine or edge function changes)
pnpm build:edge           # 1. Bundle engine + edge function source → index.ts
npx @insforge/cli functions deploy run-game   # 2. Deploy run-game
npx @insforge/cli functions deploy spectate   # 3. Deploy spectate

# Database
npx @insforge/cli db import migrations/NNN_name.sql  # Apply a single migration
npx @insforge/cli db tables                           # List tables
npx @insforge/cli db query "SELECT ..."               # Run raw SQL

# InsForge inspection
npx @insforge/cli metadata --json    # Available AI models, tables, functions
npx @insforge/cli functions list     # Deployed function status
npx @insforge/cli secrets get ANON_KEY
```

**Important**: InsForge CLI commands must run from the project root (where `.insforge/project.json` exists).

## Architecture

### Monorepo Layout

- `packages/engine/` — Pure game logic library (`@civil-ai-zation/engine`), zero I/O, fully testable
- `frontend/` — React + Vite spectator UI, subscribes to InsForge realtime events
- `insforge/functions/` — Deno edge functions deployed on InsForge
- `migrations/` — SQL files applied via `npx @insforge/cli db import`

### Engine (`packages/engine/src/`)

All functions are pure: state in → new state out. Never mutate. Module dependency order:

```
types.ts → config.ts
         → grid.ts → orientation.ts → combat.ts
         → state.ts
         → memory.ts
         → actions.ts (uses grid, combat, state)
         → turn.ts
         → round.ts (uses turn, actions, state, memory)
         → win-condition.ts
         → agent-prompt.ts (uses state, types)
         → summary.ts
         → index.ts (barrel export)
```

Key patterns:
- **`processRound(state, decider)`** is the central function. It takes an `ActionDecider` callback — in tests this is a scripted function, in production it calls the LLM.
- **`executeAction()`** validates then executes. Invalid actions automatically fall back to rest.
- **`updateAgent()`** returns a new array with one agent replaced (immutable update pattern used everywhere).
- Agents can only attack the cell they're **facing** — `validateAttack` checks `getAdjacentPosition(agent.position, agent.orientation)`.

### Edge Functions

**`run-game/index.src.ts`** is the source file. It imports from `./engine.ts` (a local esbuild bundle of the engine). The build step (`pnpm build:edge`) produces `index.ts` which is the deployable artifact. **Never edit `index.ts` directly** — it's generated.

The function creates the game in DB, returns the gameId immediately, then runs the game loop in the background via a fire-and-forget promise. A 2-second delay before the first event gives the frontend time to subscribe.

LLM calls are logged with latency: `[R3][haiku] LLM call: 1234ms (openai/gpt-4o-mini)`.

**`spectate/index.ts`** is a simple read-only function (no engine dependency, no build step needed).

### Frontend

`useGameState` hook is the core — it invokes the `run-game` function, gets a gameId, subscribes to `game:{gameId}` realtime channel, and updates React state on each of 7 event types (game_started, round_started, round_summary, turn_started, turn_completed, agent_eliminated, game_ended).

### Database

4 tables: `games`, `agent_states`, `turns`, `round_summaries`. Plus `realtime.channels` with pattern `game:%`. Migrations are numbered `001_` through `006_`. The `turns.action_type` CHECK allows: move, attack, rest, turn, invalid.

## Game Rules

- **Grid**: 3×3, configurable in `DEFAULT_GAME_CONFIG`
- **Agents**: opus (speed 2, HP 25), sonnet (speed 3, HP 20), haiku (speed 4, HP 15)
- **Actions**: move(dir) [1 EP], attack(target) [1 EP, must face target], turn(dir) [1 EP], rest() [0 EP, +1 EP next turn]
- **Damage**: `floor(5 × modifier)` — front 0.5× (2), side 1.0× (5), back 1.5× (7)
- **Facing**: "Same direction = Front" means if attack direction equals target facing, it's a front hit
- **Win**: last standing = elimination, round 30 = highest HP, HP tied = draw

## InsForge

- **App Key**: ayyn5caf | **Region**: us-east
- **URL**: `https://ayyn5caf.us-east.insforge.app`
- Frontend env: `VITE_INSFORGE_URL`, `VITE_INSFORGE_ANON_KEY` in `frontend/.env`
- Edge functions get `INSFORGE_BASE_URL` and `ANON_KEY` from `Deno.env.get()`
- AI models available: check `npx @insforge/cli metadata --json` → `aiIntegration.models`
