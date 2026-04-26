# Game Actions Reference

This document describes all available actions in Civil-AI-zation, their effects, energy costs, and validation rules.

## Action Types Overview

| Action | EP Cost | Description | Can Fail? |
|--------|---------|-------------|-----------|
| **move** | 1 | Move to an adjacent cell and face that direction | Yes |
| **attack** | 2 | Attack an adjacent agent in your facing direction | Yes |
| **turn** | 0 | Rotate to face a different direction (no movement) | No* |
| **rest** | 0 | Skip turn to gain +1 EP next turn | No |

\* Turn can fail only if agent is eliminated or has insufficient EP (0 EP).

---

## 1. Move Action

**Type**: `move`  
**EP Cost**: `1`  
**Effect**: Move to an adjacent cell and automatically face that direction

### JSON Format
```json
{
  "type": "move",
  "direction": "up" | "down" | "left" | "right"
}
```

### Validation Rules

✅ **Valid if:**
- Agent has **≥1 EP**
- Destination cell is **in bounds** (within 3×3 grid)
- Destination cell is **not occupied** by another agent
- Agent status is **alive**

❌ **Invalid if:**
- Agent has 0 EP → fallback to **rest**
- Destination out of bounds → fallback to **rest**
- Destination occupied → fallback to **rest**
- Agent is eliminated → fallback to **rest**

### Effects

**On success:**
- Agent position updates to destination
- Agent orientation updates to movement direction
- Agent EP decreases by 1

**On failure:**
- Action replaced with **rest** (0 EP cost, +1 EP next turn)
- State unchanged

### Examples

**Valid move:**
```
Agent at (0,0) facing up, 2 EP
Action: move up
Result: Position (0,1), Facing up, EP = 1
```

**Invalid move (out of bounds):**
```
Agent at (0,2) facing up, 2 EP
Action: move up (would go to y=3, out of bounds)
Result: Rest (fallback), EP unchanged, +1 EP bonus next turn
```

**Invalid move (occupied):**
```
Agent at (0,0), Target agent at (0,1)
Action: move up (destination occupied)
Result: Rest (fallback), EP unchanged, +1 EP bonus next turn
```

---

## 2. Attack Action

**Type**: `attack`  
**EP Cost**: `2`  
**Effect**: Deal damage to an adjacent agent in your facing direction

### JSON Format
```json
{
  "type": "attack",
  "target": "opus" | "sonnet" | "haiku"
}
```

### Validation Rules

✅ **Valid if:**
- Agent has **≥2 EP**
- Target is **not self**
- Target **exists** and is **alive**
- Target is in the **cell agent is facing** (adjacent in facing direction)

❌ **Invalid if:**
- Agent has <2 EP → fallback to **rest**
- Target is self → fallback to **rest**
- Target not found → fallback to **rest**
- Target is eliminated → fallback to **rest**
- Target not in facing direction → fallback to **rest**

### Damage Calculation

**Base damage**: `5` (configurable via `config.baseAttackDamage`)

**Damage modifiers by hit zone:**

| Hit Zone | Modifier | Final Damage | Description |
|----------|----------|--------------|-------------|
| **Front** | 0.5× | `floor(5 × 0.5) = 2` | Target is facing attacker |
| **Side** | 1.0× | `floor(5 × 1.0) = 5` | Flanking attack |
| **Back** | 1.5× | `floor(5 × 1.5) = 7` | Backstab bonus |

**Hit zone determination:**
- **Front**: Attack direction matches target's facing direction
- **Back**: Attack direction is opposite to target's facing direction  
- **Side**: Attack direction is perpendicular to target's facing direction

### Effects

**On success:**
- Attacker EP decreases by 2
- Target HP decreases by calculated damage
- If target HP ≤ 0:
  - Target status changes to `eliminated`
  - Target `eliminatedAtRound` set to current round

**On failure:**
- Action replaced with **rest** (0 EP cost, +1 EP next turn)
- No damage dealt

### Examples

**Front attack (minimal damage):**
```
Attacker at (0,0) facing right, 3 EP
Target at (1,0) facing left (towards attacker)
Result: Front hit, 2 damage, Attacker EP = 1
```

**Side attack (full damage):**
```
Attacker at (0,0) facing right, 3 EP
Target at (1,0) facing up (perpendicular)
Result: Side hit, 5 damage, Attacker EP = 1
```

**Back attack (maximum damage):**
```
Attacker at (0,0) facing right, 3 EP
Target at (1,0) facing right (away from attacker)
Result: Back hit, 7 damage, Attacker EP = 1
```

**Invalid attack (target not in facing direction):**
```
Attacker at (0,0) facing up, 3 EP
Target at (1,0) (to the right)
Action: attack target
Result: Rest (fallback), EP unchanged, +1 EP bonus next turn
Reason: "Target not in your facing direction"
```

**Elimination:**
```
Target HP = 5
Back attack damage = 7
Result: Target HP = 0, Status = eliminated
```

---

## 3. Turn Action

**Type**: `turn`  
**EP Cost**: `0` (free rotation)  
**Effect**: Rotate to face a different direction without moving

### JSON Format
```json
{
  "type": "turn",
  "direction": "up" | "down" | "left" | "right"
}
```

### Validation Rules

✅ **Valid if:**
- Agent has **≥0 EP** (always true for alive agents)
- Agent status is **alive**

❌ **Invalid if:**
- Agent is eliminated → fallback to **rest**

**Note**: Turn costs 0 EP but still requires validation. An agent with 0 EP can turn but cannot move or attack.

### Effects

**On success:**
- Agent orientation updates to new direction
- Agent EP unchanged (0 cost)
- Agent position unchanged

**On failure:**
- Action replaced with **rest** (0 EP cost, +1 EP next turn)
- State unchanged

### Examples

**Valid turn:**
```
Agent at (0,0) facing up, 0 EP
Action: turn right
Result: Position unchanged (0,0), Facing right, EP = 0
```

**Turn to prepare attack:**
```
Round 1:
  Agent at (0,0) facing up, 1 EP
  Target at (1,0)
  Action: turn right
  Result: Facing right, EP = 1

Round 2:
  Agent facing right, 2 EP (regenerated)
  Action: attack target
  Result: Valid attack (target in facing direction)
```

---

## 4. Rest Action

**Type**: `rest`  
**EP Cost**: `0`  
**Effect**: Skip turn to gain energy bonus next turn

### JSON Format
```json
{
  "type": "rest"
}
```

### Validation Rules

✅ **Always valid** (even for eliminated agents, though eliminated agents never take turns)

### Effects

**Immediate:**
- No change to agent state (HP, EP, position, orientation unchanged)

**Next turn:**
- Agent gains **+1 EP bonus** when energy regenerates
- Normal EP regeneration: `min(agent.ep + 1 + restBonus, agent.speed)`
- Example: Agent with speed=3, EP=1 rests → next turn EP = min(1 + 1 + 1, 3) = 3

### Examples

**Strategic rest:**
```
Agent speed = 3, EP = 0
Action: rest
Result: EP unchanged (0), Next turn EP = min(0 + 1 + 1, 3) = 2
```

**Rest at full energy:**
```
Agent speed = 3, EP = 3
Action: rest
Result: EP unchanged (3), Next turn EP = min(3 + 1 + 1, 3) = 3 (capped)
```

**Fallback rest (invalid action):**
```
Agent EP = 1, attempts to attack (needs 2 EP)
Result: Rest (fallback), EP = 1, Next turn EP = min(1 + 1 + 1, 3) = 3
```

---

## Invalid Actions & Fallback Behavior

When an action fails validation, it is automatically replaced with **rest**.

### Invalid Action Result
```json
{
  "type": "invalid",
  "reason": "Descriptive error message",
  "fallbackAction": {
    "type": "rest",
    "epBonusNextTurn": 1
  }
}
```

### Common Invalid Reasons

| Reason | Cause | Example |
|--------|-------|---------|
| `"Not enough EP"` | EP < action cost | Attack with 1 EP (needs 2) |
| `"Destination is out of bounds"` | Move beyond grid | Move up from (0,2) |
| `"Destination is occupied"` | Move to occupied cell | Move to cell with agent |
| `"Target not in your facing direction"` | Attack target not facing | Attack right while facing up |
| `"Target not found"` | Invalid target ID | Attack "invalid_id" |
| `"Target is not alive"` | Attack eliminated agent | Attack after elimination |
| `"Cannot attack self"` | Target is self | Attack own agent ID |
| `"Agent is eliminated"` | Dead agent attempts action | Eliminated agent shouldn't act |

### Fallback Behavior

**All invalid actions:**
1. Log the invalid action type and reason
2. Replace with `rest` action
3. Grant +1 EP bonus next turn
4. No state change (HP, position, orientation, EP unchanged)

**Benefits:**
- Game always progresses (no stuck states)
- Agents aren't punished for LLM mistakes (get EP bonus)
- Invalid attempts are logged for debugging

---

## Energy System

### Energy Regeneration

**Each turn start:**
```
newEP = min(currentEP + 1 + restBonus, agent.speed)
```

**Rest bonus:**
- Default: 0
- After rest: +1
- After invalid action: +1 (fallback rest)

### Agent Energy Caps

| Agent | Speed | Max EP | Regen per Turn |
|-------|-------|--------|----------------|
| Opus | 2 | 2 | 1 (or 2 if rested) |
| Sonnet | 3 | 3 | 1 (or 2 if rested) |
| Haiku | 4 | 4 | 1 (or 2 if rested) |

**Note**: Energy is capped at agent speed. Resting at full energy wastes the bonus.

### Energy Strategy Examples

**Aggressive (Haiku):**
```
Turn 1: EP=4, attack (cost 2) → EP=2
Turn 2: EP=3, attack (cost 2) → EP=1
Turn 3: EP=2, attack (cost 2) → EP=0
Turn 4: EP=1, rest → EP=1, next turn bonus
Turn 5: EP=3, attack (cost 2) → EP=1
```

**Conservative (Opus):**
```
Turn 1: EP=2, move (cost 1) → EP=1
Turn 2: EP=2, turn (cost 0) → EP=2
Turn 3: EP=2, attack (cost 2) → EP=0
Turn 4: EP=1, rest → EP=1, next turn bonus
Turn 5: EP=2, attack (cost 2) → EP=0
```

---

## Action Validation Summary

### Validation Order

For each action type, validation checks in this order:

1. **Agent status** (eliminated?)
2. **Energy requirement** (enough EP?)
3. **Action-specific rules** (varies by type)

### Quick Reference

| Check | Move | Attack | Turn | Rest |
|-------|------|--------|------|------|
| Agent alive? | ✅ | ✅ | ✅ | ✅ |
| Enough EP? | ≥1 | ≥2 | ≥0 | N/A |
| In bounds? | ✅ | N/A | N/A | N/A |
| Not occupied? | ✅ | N/A | N/A | N/A |
| Target exists? | N/A | ✅ | N/A | N/A |
| Target alive? | N/A | ✅ | N/A | N/A |
| Target in facing? | N/A | ✅ | N/A | N/A |
| Not self? | N/A | ✅ | N/A | N/A |

---

## Configuration Constants

All values are defined in `packages/engine/src/game-config.ts`.

### Action Costs
```typescript
export const ACTION_COSTS = {
  move: 1,
  turn: 0,
  attack: 2,
  rest: 0,
} as const;
```

### Hit Zone Modifiers
```typescript
export const HIT_ZONE_MODIFIERS = {
  front: 0.5,  // 50% damage
  side: 1.0,   // 100% damage
  back: 1.5,   // 150% damage
} as const;
```

### Game Config Defaults
```typescript
export const DEFAULT_GAME_CONFIG = {
  baseAttackDamage: 5,   // Base damage before modifiers
  restEpBonus: 1,        // EP bonus after rest
  energyPoints: 1,       // Starting EP per agent
  // ...
};
```

---

## See Also

- [CLAUDE.md](./CLAUDE.md) - Project overview and architecture
- [packages/engine/src/actions.ts](./packages/engine/src/actions.ts) - Action validation and execution
- [packages/engine/src/combat.ts](./packages/engine/src/combat.ts) - Damage calculation
- [packages/engine/src/game-config.ts](./packages/engine/src/game-config.ts) - Configuration constants
