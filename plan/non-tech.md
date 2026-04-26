# Civil-AI-zation: Game Design Document

## Context
Turn-based multi-agent arena battle game. AI agents (different LLM models) compete on a grid map via tool calls. V0 is fully automated — no user interaction, agents decide everything.

---

## 1. Map
5x5 empty grid. All cells passable. Agents cannot overlap.

**Future:** Resource spots, obstacles (mountain, river), traps.

---

## 2. Core Attributes (4)

| Attribute | Description | Default |
|-----------|-------------|---------|
| **Speed** | Turn order (higher goes first) | 3 |
| **Health (HP)** | 0 = eliminated | 20 |
| **Actions** | What the agent can do (see below) | move, attack, rest |
| **Energy Points (EP)** | Actions per turn | 1 |

### Pre-Game Config
All attributes are **config-based** and modifiable before game start. Each agent can have different values. Config is loaded from a file (or set by the user/agent pre-game).

```
Example config:
agents:
  opus:
    model: claude-opus
    speed: 2
    hp: 25
    actions: [move, attack, rest]
    position: [0, 0]
    orientation: N
  sonnet:
    model: claude-sonnet
    speed: 3
    hp: 20
    actions: [move, attack, rest]
    position: [4, 4]
    orientation: S
  haiku:
    model: claude-haiku
    speed: 4
    hp: 15
    actions: [move, attack, rest]
    position: [2, 0]
    orientation: E

game:
  energy_points: 1      # global, same for all agents

map:
  width: 5
  height: 5

rules:
  max_rounds: 30
  base_attack_damage: 5
  heal_amount: 3        # future
  rest_ep_bonus: 1
  memory_cap: 10
```

**EP is fixed and identical across all agents** — it's a global game rule, not per-agent. Other attributes (speed, HP) can vary per agent. This ensures fair action economy; differentiation comes from speed, HP, and the LLM model.

### Agent State (tracked at runtime, not configurable)
Position (x,y), Orientation (N/S/E/W), Memory[], Status (alive/eliminated), Current EP

---

## 3. Actions

| Action | Effect | Constraints |
|--------|--------|-------------|
| **move(direction)** | Move 1 cell (N/S/E/W). Sets orientation to movement direction | No off-grid. No occupied cells |
| **attack(target_id)** | Deal 5 damage (orientation-modified) to adjacent agent | Target must be in N/S/E/W neighbor cell |
| **rest()** | +1 EP next turn | — |

**Future:** gather, range_attack, debuff, defend, scout, heal

---

## 4. Combat: Orientation

```
final_damage = floor(5 * orientation_modifier)
```

| Hit Zone | When | Modifier | Damage |
|----------|------|----------|--------|
| Front | Target faces attacker | x0.5 | 2 |
| Side | Perpendicular | x1.0 | 5 |
| Back | Target faces away | x1.5 | 7 |

**Logic:** A attacks B → determine direction A→B → compare to B's facing. Same direction = Front, opposite = Back, else Side.

---

## 5. Turn & Round Structure

### Turn Order
Alive agents act by Speed (high→low). Ties: random shuffle at game start.

### Turn Flow
1. Agent receives: game state + own state + memory
2. LLM called with tool definitions → returns up to EP tool calls
3. Actions validated & executed immediately
4. State updated, events appended to agent memory
5. HP <= 0 → eliminated

### Round Flow
1. Increment round
2. Generate previous round's global summary
3. Execute each alive agent's turn (by speed)
4. Check win condition

### Win Condition
- Last standing → wins
- Round 30 → highest HP wins
- HP tied → draw

---

## 6. Game State

### Shared (all agents see)
- Round number, map size (5x5)
- All alive agents: id, position, HP, orientation
- Eliminated agents: id, round eliminated
- Previous round summary

### Hidden
- Other agents' EP, memory, reasoning

---

## 7. Memory
Personal event log per agent. Last 10 rounds (FIFO trim).

```
Round 1: I moved North to (2,3), facing North.
Round 2: I attacked sonnet from side for 5 damage. sonnet HP: 20→15.
Round 3: haiku attacked me from behind for 7 damage. My HP: 20→13.
```

---

## 8. Agents

| ID | Model | Expected Behavior |
|----|-------|-------------------|
| `opus` | Claude Opus | Strategic, positional |
| `sonnet` | Claude Sonnet | Balanced, efficient |
| `haiku` | Claude Haiku | Reactive, impulsive |

### Tools (exposed to LLM)
```
move(direction: "N"|"S"|"E"|"W")
attack(target: agent_id)
rest()
```

---

## 9. V0 Scope

**In:** 3 agents, 5x5 empty grid, 3 actions (move/attack/rest), orientation combat, memory (10 rounds), global summaries, 30 round limit, fully automated (no user interaction)

**Out:** Resources, obstacles, debuffs, range/AOE, defense, heal, voice commentator, user-controlled agent, cross-provider models, tile effects

---

## Verification
1. Full 30-round game runs to completion
2. Turn order respects speed
3. Orientation damage: front=2, side=5, back=7
4. No off-grid or overlapping moves
5. Elimination at HP 0
6. Memory accumulates correctly
7. Invalid tool calls rejected gracefully
8. Game ends at last-standing or round 30
