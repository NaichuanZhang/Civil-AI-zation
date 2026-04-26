# Civil-AI-zation

Turn-based AI arena battle game where three LLM agents compete on a 3x3 grid. Fully automated — spectators watch via a React UI with realtime events.

## Core Systems

### Turn & Action System

Each round, agents act in speed order (highest first). Four actions are available: **move**, **attack**, **turn**, and **rest**. EP costs and bonuses are defined in `ACTION_COSTS` in `packages/engine/src/game-config.ts`. Invalid actions automatically fall back to rest.

### Combat System

Attacks hit the cell directly in front of the attacker. Damage depends on where the hit lands relative to the target's facing direction (front, side, or back). Hit zone detection is in `packages/engine/src/orientation.ts`; damage modifiers are in `HIT_ZONE_MODIFIERS` in `packages/engine/src/game-config.ts`. Agents reaching 0 HP are eliminated.

### Memory System

Each agent maintains a rolling memory of recent events (capped at `memoryCap` in `packages/engine/src/game-config.ts`). Memory includes both the agent's own actions and incoming attacks from opponents. This context is fed to the LLM each turn for tactical decision-making.

### Win Conditions

- **Elimination**: Last agent standing wins immediately
- **Highest HP**: At `maxRounds`, the agent with the most HP wins
- **Draw**: If HP is tied at max rounds, or all agents are eliminated simultaneously

Round limit and other game constants are in `DEFAULT_GAME_CONFIG` in `packages/engine/src/game-config.ts`.

### Agents

Three agents (opus, sonnet, haiku) with different speed/HP tradeoffs. Per-agent stats, models, and starting positions are in `AGENT_CONFIG_MAP` in `packages/engine/src/game-config.ts`. All agents use OpenAI-compatible tool-use (function calling) for decision-making.

## Architecture

```
packages/engine/   Pure game logic library — state in, new state out, zero I/O
frontend/          React + Vite spectator UI with realtime event subscriptions
insforge/functions/ Deno edge functions (run-game loop, spectate query)
migrations/        SQL schema files
```

## Development

```bash
pnpm dev              # Frontend at localhost:5173
pnpm test             # Engine tests
pnpm build:edge       # Bundle engine into edge function (required before deploy)
```
