# Civil-AI-zation: Technical Plan

## Context

Turn-based multi-agent arena battle game where 3 Claude LLM agents (Opus, Sonnet, Haiku) compete on a 5x5 grid. V0 is fully automated — no user interaction, spectators watch via a web UI. The game design is complete in `non-tech.md`; this plan covers implementation using InsForge (already provisioned) for backend infrastructure.

**Key decisions made:**
- Orientation: implement exactly as spec (same direction = Front = 0.5x)
- Orchestrator: single edge function runs the full game
- Frontend: minimal, will be redesigned later — plain HTML canvas or simple React

---

## Architecture Overview

```
Frontend (Spectator UI)          InsForge Backend
┌─────────────────────┐    ┌──────────────────────────────┐
│  React + Vite       │    │  Edge Function: run-game     │
│  useGameState hook ◄├────┤    ↕ Database (PostgreSQL)   │
│  (realtime sub)     │    │    ↕ AI Gateway (OpenRouter)  │
│                     │    │    ↕ Realtime Broadcast       │
│  [Start Game] ──────├────┤                               │
└─────────────────────┘    └──────────────────────────────┘
```

**Data flow:** Edge function orchestrates → writes DB → publishes realtime → frontend subscribes

---

## Project Structure

```
Civil-AI-zation/
├── packages/engine/              # Pure game logic (zero I/O, fully testable)
│   ├── src/
│   │   ├── types.ts              # All interfaces & type aliases
│   │   ├── config.ts             # Default game configuration
│   │   ├── grid.ts               # Bounds, adjacency, direction between positions
│   │   ├── orientation.ts        # Hit zone + damage modifier calculation
│   │   ├── combat.ts             # Damage = floor(base * modifier)
│   │   ├── actions.ts            # Validate & execute move/attack/rest
│   │   ├── turn.ts               # Turn ordering, EP management
│   │   ├── round.ts              # Full round processing (all agents in order)
│   │   ├── memory.ts             # FIFO memory (cap 10 rounds)
│   │   ├── state.ts              # Immutable state creation & transitions
│   │   ├── win-condition.ts      # Last standing / HP / draw checks
│   │   ├── agent-prompt.ts       # System prompt, user message, tool defs for LLM
│   │   ├── summary.ts            # Round summary prompt builder
│   │   └── index.ts              # Barrel export
│   └── __tests__/                # Vitest tests for each module
│       ├── grid.test.ts
│       ├── orientation.test.ts
│       ├── combat.test.ts
│       ├── actions.test.ts
│       ├── turn.test.ts
│       ├── round.test.ts
│       ├── memory.test.ts
│       ├── state.test.ts
│       ├── win-condition.test.ts
│       └── integration.test.ts   # Full 30-round game sim with scripted actions
├── insforge/functions/
│   ├── run-game/index.ts         # Orchestrator: creates game, runs loop, publishes events
│   └── spectate/index.ts         # Returns current state for late-joining spectators
├── frontend/                     # Minimal spectator UI (React + Vite)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── insforge.ts           # InsForge client singleton
│   │   ├── hooks/useGameState.ts # Realtime subscription hook
│   │   └── components/
│   │       ├── Grid.tsx           # 5x5 board with agent tokens
│   │       ├── AgentPanel.tsx     # HP bar, EP, orientation, status
│   │       ├── EventLog.tsx       # Scrolling event feed
│   │       └── GameControls.tsx   # Start game button + win banner
│   └── index.html
├── migrations/                   # SQL migration files
├── package.json                  # Root workspace
├── non-tech.md                   # Game design (exists)
└── .gitignore                    # (exists)
```

---

## Database Schema

### `games`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| status | TEXT | `pending` / `running` / `completed` |
| current_round | INTEGER | default 0 |
| max_rounds | INTEGER | default 30 |
| config | JSONB | full GameConfig |
| winner_agent_id | TEXT | null if draw or running |
| result | TEXT | `elimination` / `highest_hp` / `draw` / null |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

### `agent_states`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| game_id | UUID FK → games | |
| agent_id | TEXT | `opus` / `sonnet` / `haiku` |
| model_id | TEXT | e.g. `anthropic/claude-opus-4` |
| hp | INTEGER | |
| ep | INTEGER | |
| position_x | INTEGER | |
| position_y | INTEGER | |
| orientation | TEXT | N/S/E/W |
| status | TEXT | `alive` / `eliminated` |
| speed | INTEGER | |
| eliminated_at_round | INTEGER | nullable |
| memory | JSONB | string array, FIFO capped at 10 |
| turn_order | INTEGER | randomized tiebreaker |

### `turns`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| game_id | UUID FK → games | |
| round_number | INTEGER | |
| agent_id | TEXT | |
| action_type | TEXT | move/attack/rest/invalid |
| action_params | JSONB | `{"direction":"N"}` or `{"target":"sonnet"}` |
| result | JSONB | outcome details |
| llm_reasoning | TEXT | agent's thinking (hidden) |
| raw_llm_response | JSONB | for debugging |

### `round_summaries`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| game_id | UUID FK → games | |
| round_number | INTEGER | unique with game_id |
| summary | TEXT | narrative |
| state_snapshot | JSONB | shared state at round end |

---

## Engine Design (Pure Logic, No I/O)

All functions are pure: state in → new state out. Never mutate.

### Key modules:

**`grid.ts`** — `isInBounds()`, `getAdjacentPosition()`, `isAdjacent()`, `getDirectionBetween()`, `isPositionOccupied()`

**`orientation.ts`** — `getHitZone(attackDir, targetFacing)`: same direction = Front (0.5x), opposite = Back (1.5x), else Side (1.0x). `getDamageModifier(hitZone)`.

**`combat.ts`** — `calculateDamage(attacker, target, baseDamage)` → `{ damage, hitZone }`

**`actions.ts`** — `validateAction()` checks constraints (bounds, adjacency, EP, alive). `executeAction()` returns new GameState + ActionResult. Invalid actions fall back to rest.

**`turn.ts`** — `getTurnOrder()` sorts alive agents by speed DESC then turnOrder ASC.

**`round.ts`** — `processRound()` iterates agents in turn order, applies each action sequentially (earlier agents affect later state).

**`state.ts`** — `createInitialState()`, `updateAgent()`, `eliminateAgent()` — all return new objects.

**`win-condition.ts`** — 1 alive = elimination win. 0 alive = draw. Round ≥ max = highest HP or draw.

**`agent-prompt.ts`** — Builds system prompt (personality + rules), user message (grid state + personal view + memory), and OpenAI-compatible tool definitions for move/attack/rest.

---

## Agent LLM Integration

### Tool definitions (OpenAI-compatible, via InsForge AI Gateway)
```
move(direction: "N"|"S"|"E"|"W")
attack(target: "opus"|"sonnet"|"haiku")
rest()
```

### Per-agent call flow:
1. Build system prompt with agent personality + game rules
2. Build user message with shared game view + personal state + memory
3. Call `insforge.ai.chat.completions.create({ model, messages, tools, tool_choice: 'required' })`
4. Parse `tool_calls[0]` → map to AgentAction
5. If parse fails → default to rest

### Agent models & personalities:
- **opus** (`anthropic/claude-opus-4`): Strategic, positional, patient
- **sonnet** (`anthropic/claude-sonnet-4`): Balanced, adaptive, pragmatic
- **haiku** (`anthropic/claude-haiku-3.5`): Aggressive, impulsive, fast

---

## Realtime Events

Single channel per game: `game:{gameId}`

| Event | Payload | When |
|-------|---------|------|
| `game_started` | config, initial agent states | Game created |
| `round_started` | roundNumber, turnOrder | New round begins |
| `round_summary` | roundNumber, summary text | Previous round narrative |
| `turn_started` | agentId | Before LLM call |
| `turn_completed` | agentId, action, result, all agent states | After action resolved |
| `agent_eliminated` | agentId, eliminatedBy | HP ≤ 0 |
| `game_ended` | winner, result, final states | Game over |

---

## Edge Function: `run-game`

Single orchestrator that runs the full game:

```
1. Create game row (status: running) + 3 agent_state rows
2. Publish game_started
3. For round 1..30:
   a. Publish round_started
   b. If round > 1: generate summary via cheap LLM call, publish round_summary
   c. For each alive agent (by speed):
      - Publish turn_started
      - Build prompt → call AI Gateway → parse tool call
      - Validate & execute action via engine
      - Update agent_states in DB
      - Insert turns row
      - Publish turn_completed
      - If target eliminated: publish agent_eliminated
   d. Check win condition → if game over: publish game_ended, return
4. Round 30 reached: determine winner, publish game_ended
```

**Error handling:** LLM failure → rest. Invalid tool call → rest. DB failure → retry once, then abort. Realtime failure → log, continue (DB is source of truth).

**Pacing:** 1.5s delay between turns so spectators can follow.

---

## Frontend (Minimal)

Simple React + Vite app. Will be redesigned later — focus on function over form.

**`useGameState` hook:** Fetches initial state via `spectate` function, subscribes to `game:{id}` realtime channel, updates local state on each event.

**Components:**
- `Grid` — 5x5 CSS grid, colored circles for agents with direction arrows
- `AgentPanel` — HP bar, EP, orientation, status per agent
- `EventLog` — scrolling text feed of game events
- `GameControls` — "Start New Game" button, win/draw banner

---

## Implementation Phases

### Phase 1: Engine Core (TDD)
1. Set up `packages/engine` — TypeScript + Vitest
2. Implement types.ts → grid.ts → orientation.ts → combat.ts → actions.ts → state.ts → memory.ts → turn.ts → round.ts → win-condition.ts
3. Tests for each module (TDD: test first, then implement)
4. Integration test: full 30-round game with scripted actions
5. **Exit:** All 8 verification points from non-tech.md pass locally

### Phase 2: Database + Infrastructure
1. Write migration SQL files
2. Apply via InsForge CLI
3. Verify InsForge AI Gateway model access

### Phase 3: Agent Prompts
1. Implement agent-prompt.ts + summary.ts
2. Manual test: call AI Gateway with sample prompt + tools, verify response parses

### Phase 4: Edge Function Orchestrator
1. Write run-game/index.ts (bundles engine logic)
2. Write spectate/index.ts
3. Deploy, invoke, verify DB populates and realtime events fire

### Phase 5: Frontend
1. React + Vite setup
2. InsForge client + useGameState hook
3. Grid, AgentPanel, EventLog, GameControls
4. Test: start game, watch it play out

### Phase 6: End-to-End
1. Full game from deployed frontend
2. Verify all events render correctly
3. Test edge cases: simultaneous elimination, round 30 timeout, draw

---

## Verification (from non-tech.md)

1. Full 30-round game runs to completion
2. Turn order respects speed
3. Orientation damage: front=2, side=5, back=7
4. No off-grid or overlapping moves
5. Elimination at HP 0
6. Memory accumulates correctly (FIFO, cap 10)
7. Invalid tool calls rejected gracefully (fallback to rest)
8. Game ends at last-standing or round 30

---

## Key Files to Create/Modify

| File | Purpose |
|------|---------|
| `packages/engine/src/types.ts` | All game types — everything depends on this |
| `packages/engine/src/actions.ts` | Core gameplay: validate + execute actions |
| `packages/engine/src/agent-prompt.ts` | LLM prompt + tool defs — determines agent behavior quality |
| `insforge/functions/run-game/index.ts` | Orchestrator tying DB + AI Gateway + Realtime |
| `frontend/src/hooks/useGameState.ts` | Realtime subscription bridge to UI |
