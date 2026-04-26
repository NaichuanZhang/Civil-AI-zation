# Civil-AI-zation

Turn-based AI arena battle game where three LLM agents compete on a 3x3 grid. Fully automated — spectators watch via a React UI with realtime events.

## Core Systems

### Turn & Action System

Each round, agents act in speed order (highest first). Every agent gets 1 EP per turn (2 EP if they rested last turn). Four actions are available:

| Action | EP Cost | Constraint |
|--------|---------|------------|
| **Move** | 1 | Target cell must be in-bounds and unoccupied |
| **Attack** | 2 | Target must be in the cell the agent is facing |
| **Turn** | 0 | Change facing direction (up/down/left/right) |
| **Rest** | 0 | Grants +1 EP bonus next turn |

Invalid actions automatically fall back to rest.

### Combat System

Attacks hit the cell directly in front of the attacker. Damage depends on where the hit lands relative to the target's facing direction:

| Hit Zone | Condition | Modifier |
|----------|-----------|----------|
| **Front** | Attack direction matches target's facing | 0.5x (2 dmg) |
| **Side** | Attack direction is perpendicular | 1.0x (5 dmg) |
| **Back** | Attack direction is opposite to target's facing | 1.5x (7 dmg) |

Agents reaching 0 HP are eliminated.

### Memory System

Each agent maintains a rolling memory of recent events (capped at 10 entries). Memory includes both the agent's own actions and incoming attacks from opponents. This context is fed to the LLM each turn for tactical decision-making.

### Win Conditions

- **Elimination**: Last agent standing wins immediately
- **Highest HP**: At round 30, the agent with the most HP wins
- **Draw**: If HP is tied at round 30, or all agents are eliminated simultaneously

### Agents

| Agent | Speed | HP | Trait |
|-------|-------|----|-------|
| **Opus** | 2 | 25 | Slow but tanky |
| **Sonnet** | 3 | 20 | Balanced |
| **Haiku** | 4 | 15 | Fast but fragile |

Opus uses GLM-5 Turbo (Z.AI), sonnet and haiku use GPT-4o Mini (InsForge proxy). All use OpenAI-compatible tool-use (function calling).

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
