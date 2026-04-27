// insforge/functions/run-game/index.src.ts
import { createClient } from "npm:@insforge/sdk";

// packages/engine/src/game-config.ts
var HIT_ZONE_MODIFIERS = {
  front: 0.5,
  // Attacking from front: 50% damage (target is facing you)
  side: 1,
  // Attacking from side: 100% damage (flanking)
  back: 1.5
  // Attacking from back: 150% damage (backstab bonus)
};
var ACTION_COSTS = {
  move: 1,
  turn: 1,
  attack: 1,
  rest: 0
};
var BACKEND_CONFIG = {
  summaryModel: "openai/gpt-4o-mini",
  // Model for round summaries
  turnDelayMs: 1500,
  // Delay between turns (for UI readability)
  gameLoopDelayMs: 2e3
  // Initial delay before game loop starts
};
var AGENT_PERSONALITIES = {
  opus: "You are Opus, a strategic and patient warrior. You think several moves ahead, value positioning, and prefer to attack from advantageous angles.",
  sonnet: "You are Sonnet, a balanced and adaptive fighter. You assess the situation pragmatically, adapting your strategy to the current board state.",
  haiku: "You are Haiku, an aggressive and impulsive combatant. You favor direct action, closing distance quickly and attacking whenever possible."
};
var AGENT_CONFIG_MAP = {
  opus: {
    modelId: "zai/glm-5-turbo",
    speed: 2,
    hp: 25,
    startPosition: { x: 0, y: 4 },
    startOrientation: "up",
    maxTokens: 1024
  },
  sonnet: {
    modelId: "openai/gpt-4o-mini",
    speed: 3,
    hp: 20,
    startPosition: { x: 4, y: 4 },
    startOrientation: "left",
    maxTokens: 1024
  },
  haiku: {
    modelId: "openai/gpt-4o-mini",
    speed: 4,
    hp: 15,
    startPosition: { x: 2, y: 0 },
    startOrientation: "down",
    maxTokens: 1024
  }
};
var AGENT_INITIAL_HP = Object.fromEntries(
  Object.entries(AGENT_CONFIG_MAP).map(([id, config]) => [id, config.hp])
);
var CHEST_CONFIG = {
  enabled: true,
  // Enable/disable chest feature
  spawnRounds: [2, 7, 12, 17, 22, 27],
  // First chest at round 2, then every 5 rounds
  hpBoostAmount: 5,
  // HP gained from hp_boost item
  hpDrainAmount: -5,
  // HP lost from hp_drain item
  maxOnBoard: 2
  // Max unopened chests on the board at once
};
var DEFAULT_GAME_CONFIG = {
  mapWidth: 5,
  mapHeight: 5,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  maxEp: 3,
  agents: Object.entries(AGENT_CONFIG_MAP).map(([agentId, config]) => ({
    agentId,
    modelId: config.modelId,
    speed: config.speed,
    hp: config.hp,
    position: config.startPosition,
    orientation: config.startOrientation
  })),
  chests: CHEST_CONFIG,
  actionCosts: ACTION_COSTS
};

// packages/engine/src/grid.ts
var DIRECTION_DELTAS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 }
};
function isInBounds(pos, width, height) {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}
function getAdjacentPosition(pos, dir) {
  const delta = DIRECTION_DELTAS[dir];
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}
function getDirectionBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === -1) return "up";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  return null;
}
function isPositionOccupied(pos, agents) {
  return agents.some(
    (a) => a.status === "alive" && a.position.x === pos.x && a.position.y === pos.y
  );
}
var ALL_DIRECTIONS = ["up", "down", "left", "right"];
function getValidMoveDirections(pos, width, height, agents) {
  return ALL_DIRECTIONS.filter((dir) => {
    const dest = getAdjacentPosition(pos, dir);
    return isInBounds(dest, width, height) && !isPositionOccupied(dest, agents);
  });
}

// packages/engine/src/orientation.ts
var OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};
function getOppositeDirection(dir) {
  return OPPOSITES[dir];
}
function getHitZone(attackDirection, targetFacing) {
  if (attackDirection === targetFacing) return "front";
  if (attackDirection === getOppositeDirection(targetFacing)) return "back";
  return "side";
}
function getDamageModifier(hitZone) {
  return HIT_ZONE_MODIFIERS[hitZone];
}

// packages/engine/src/combat.ts
function calculateDamage(attackerPos, targetPos, targetFacing, baseDamage) {
  const attackDirection = getDirectionBetween(attackerPos, targetPos);
  if (attackDirection === null) {
    throw new Error(
      `Cannot calculate damage: positions are not adjacent (${attackerPos.x},${attackerPos.y}) -> (${targetPos.x},${targetPos.y})`
    );
  }
  const hitZone = getHitZone(attackDirection, targetFacing);
  const modifier = getDamageModifier(hitZone);
  const damage = Math.floor(baseDamage * modifier);
  return { damage, hitZone, modifier };
}

// packages/engine/src/state.ts
function createInitialState(config) {
  const turnOrders = shuffleTiebreakers(config.agents.length);
  const agents = config.agents.map((ac, i) => ({
    agentId: ac.agentId,
    modelId: ac.modelId,
    speed: ac.speed,
    hp: ac.hp,
    ep: config.energyPoints,
    position: ac.position,
    orientation: ac.orientation,
    status: "alive",
    eliminatedAtRound: null,
    memory: [],
    turnOrder: turnOrders[i]
  }));
  return {
    round: 0,
    status: "running",
    config,
    agents,
    turnRecords: [],
    roundSummaries: [],
    result: null,
    winnerAgentId: null,
    chests: []
  };
}
function updateAgent(agents, agentId, updates) {
  return agents.map(
    (a) => a.agentId === agentId ? { ...a, ...updates } : a
  );
}
function buildSharedView(state) {
  const alive = state.agents.filter((a) => a.status === "alive");
  const eliminated = state.agents.filter((a) => a.status === "eliminated");
  const lastSummary = state.roundSummaries.length > 0 ? state.roundSummaries[state.roundSummaries.length - 1].summary : null;
  const unopenedChests = state.chests.filter((c) => !c.opened).map((c) => ({ position: c.position }));
  return {
    round: state.round,
    mapWidth: state.config.mapWidth,
    mapHeight: state.config.mapHeight,
    agents: alive.map((a) => ({
      agentId: a.agentId,
      position: a.position,
      hp: a.hp,
      orientation: a.orientation
    })),
    eliminatedAgents: eliminated.map((a) => ({
      agentId: a.agentId,
      eliminatedAtRound: a.eliminatedAtRound
    })),
    previousRoundSummary: lastSummary,
    chests: unopenedChests
  };
}
function buildPersonalView(state, agentId) {
  const agent = state.agents.find((a) => a.agentId === agentId);
  return {
    agentId: agent.agentId,
    hp: agent.hp,
    ep: agent.ep,
    position: agent.position,
    orientation: agent.orientation,
    memory: agent.memory
  };
}
function shuffleTiebreakers(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// packages/engine/src/memory.ts
function appendMemory(currentMemory, entry, cap) {
  const updated = [...currentMemory, entry];
  if (updated.length <= cap) return updated;
  return updated.slice(updated.length - cap);
}
var DIRECTION_NAMES = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right"
};
function buildMemoryEntry(round, _agentId, result, _agents) {
  switch (result.type) {
    case "move": {
      let entry = `Round ${round}: I moved ${DIRECTION_NAMES[result.newOrientation]} to (${result.to.x},${result.to.y}), facing ${DIRECTION_NAMES[result.newOrientation]}.`;
      if (result.chestCollected) {
        const itemDesc = result.chestCollected.item.type === "hp_boost" ? "HP boost" : "HP drain";
        entry += ` Opened chest! Got ${itemDesc}: HP ${result.chestCollected.hpBefore}\u2192${result.chestCollected.hpAfter}.`;
      }
      return entry;
    }
    case "attack": {
      let entry = `Round ${round}: I attacked ${result.target} from the ${result.hitZone} for ${result.damage} damage. ${result.target} HP: ${result.targetHpBefore}\u2192${result.targetHpAfter}.`;
      if (result.targetEliminated) {
        entry += ` ${result.target} eliminated!`;
      }
      return entry;
    }
    case "turn":
      return `Round ${round}: I turned from ${DIRECTION_NAMES[result.previousOrientation]} to face ${DIRECTION_NAMES[result.newOrientation]}.`;
    case "rest":
      return `Round ${round}: I rested. +${result.epBonusNextTurn} EP next turn.`;
    case "invalid":
      return `Round ${round}: Invalid action (${result.reason}). Rested instead. +${result.fallbackAction.epBonusNextTurn} EP next turn.`;
  }
}

// packages/engine/src/chest.ts
function spawnChest(agents, existingChests, config) {
  if (!config.chests.enabled) {
    return null;
  }
  const unopenedCount = existingChests.filter((c) => !c.opened).length;
  if (unopenedCount >= config.chests.maxOnBoard) {
    return null;
  }
  const emptyPositions = [];
  for (let y = 0; y < config.mapHeight; y++) {
    for (let x = 0; x < config.mapWidth; x++) {
      const pos = { x, y };
      const occupied = agents.some(
        (a) => a.status === "alive" && a.position.x === x && a.position.y === y
      );
      const hasChest = existingChests.some(
        (c) => !c.opened && c.position.x === x && c.position.y === y
      );
      if (!occupied && !hasChest) {
        emptyPositions.push(pos);
      }
    }
  }
  if (emptyPositions.length === 0) {
    return null;
  }
  const position = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  const item = Math.random() < 0.5 ? { type: "hp_boost", hpChange: config.chests.hpBoostAmount } : { type: "hp_drain", hpChange: config.chests.hpDrainAmount };
  return {
    position,
    item,
    opened: false
  };
}
function findChestAtPosition(chests, position) {
  return chests.find(
    (c) => !c.opened && c.position.x === position.x && c.position.y === position.y
  );
}
function openChest(chests, position) {
  return chests.map(
    (c) => c.position.x === position.x && c.position.y === position.y ? { ...c, opened: true } : c
  );
}

// packages/engine/src/actions.ts
function validateMove(agent, direction, allAgents, config) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < config.actionCosts.move) {
    return { valid: false, reason: "Not enough EP" };
  }
  const dest = getAdjacentPosition(agent.position, direction);
  if (!isInBounds(dest, config.mapWidth, config.mapHeight)) {
    return { valid: false, reason: "Destination is out of bounds" };
  }
  if (isPositionOccupied(dest, allAgents)) {
    return { valid: false, reason: "Destination is occupied" };
  }
  return { valid: true };
}
function validateAttack(agent, targetId, allAgents, config) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < config.actionCosts.attack) {
    return { valid: false, reason: "Not enough EP" };
  }
  if (targetId === agent.agentId) {
    return { valid: false, reason: "Cannot attack self" };
  }
  const target = allAgents.find((a) => a.agentId === targetId);
  if (!target) {
    return { valid: false, reason: `Target ${targetId} not found` };
  }
  if (target.status !== "alive") {
    return { valid: false, reason: `Target ${targetId} is not alive` };
  }
  const facingPos = getAdjacentPosition(agent.position, agent.orientation);
  if (target.position.x !== facingPos.x || target.position.y !== facingPos.y) {
    return { valid: false, reason: `Target ${targetId} is not in your facing direction` };
  }
  return { valid: true };
}
function validateTurn(agent, config) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < config.actionCosts.turn) {
    return { valid: false, reason: "Not enough EP" };
  }
  return { valid: true };
}
function executeAction(agentId, action, agents, config, chests) {
  const agent = agents.find((a) => a.agentId === agentId);
  switch (action.type) {
    case "move": {
      const validation = validateMove(agent, action.direction, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason, config);
      }
      const dest = getAdjacentPosition(agent.position, action.direction);
      let newAgents = updateAgent(agents, agentId, {
        position: dest,
        orientation: action.direction,
        ep: agent.ep - config.actionCosts.move
      });
      const chest = findChestAtPosition(chests, dest);
      let newChests = chests;
      let chestCollected = void 0;
      if (chest) {
        newChests = openChest(chests, dest);
        const hpBefore = newAgents.find((a) => a.agentId === agentId).hp;
        const newHp = Math.max(1, hpBefore + chest.item.hpChange);
        newAgents = updateAgent(newAgents, agentId, { hp: newHp });
        chestCollected = {
          item: chest.item,
          hpBefore,
          hpAfter: newHp
        };
      }
      return {
        agents: newAgents,
        chests: newChests,
        result: {
          type: "move",
          from: agent.position,
          to: dest,
          newOrientation: action.direction,
          chestCollected
        }
      };
    }
    case "attack": {
      const validation = validateAttack(agent, action.target, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason, config);
      }
      const target = agents.find((a) => a.agentId === action.target);
      const { damage, hitZone } = calculateDamage(
        agent.position,
        target.position,
        target.orientation,
        config.baseAttackDamage
      );
      const newHp = Math.max(0, target.hp - damage);
      const eliminated = newHp <= 0;
      let newAgents = updateAgent(agents, agentId, { ep: agent.ep - config.actionCosts.attack });
      newAgents = updateAgent(newAgents, action.target, {
        hp: newHp,
        ...eliminated ? { status: "eliminated", eliminatedAtRound: 0 } : {}
      });
      return {
        agents: newAgents,
        chests,
        result: {
          type: "attack",
          target: action.target,
          hitZone,
          damage,
          targetHpBefore: target.hp,
          targetHpAfter: newHp,
          targetEliminated: eliminated
        }
      };
    }
    case "turn": {
      const validation = validateTurn(agent, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason, config);
      }
      const prev = agent.orientation;
      const newAgents = updateAgent(agents, agentId, {
        orientation: action.direction,
        ep: agent.ep - config.actionCosts.turn
      });
      return {
        agents: newAgents,
        chests,
        result: {
          type: "turn",
          previousOrientation: prev,
          newOrientation: action.direction
        }
      };
    }
    case "rest": {
      return {
        agents,
        chests,
        result: {
          type: "rest",
          epBonusNextTurn: config.restEpBonus
        }
      };
    }
  }
}
function makeInvalidResult(agents, chests, reason, config) {
  return {
    agents,
    chests,
    result: {
      type: "invalid",
      reason,
      fallbackAction: { type: "rest", epBonusNextTurn: config.restEpBonus }
    }
  };
}

// packages/engine/src/turn.ts
function getTurnOrder(agents) {
  return agents.filter((a) => a.status === "alive").toSorted((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.turnOrder - b.turnOrder;
  });
}
function resetEpForTurn(agent, config, restedLastTurn) {
  const bonusEp = restedLastTurn ? config.restEpBonus : 0;
  const newEp = Math.min(agent.ep + config.energyPoints + bonusEp, config.maxEp);
  return { ...agent, ep: newEp };
}

// packages/engine/src/win-condition.ts
function checkWinCondition(state) {
  const alive = state.agents.filter((a) => a.status === "alive");
  if (alive.length === 1) {
    return {
      gameOver: true,
      result: "elimination",
      winnerAgentId: alive[0].agentId
    };
  }
  if (alive.length === 0) {
    return {
      gameOver: true,
      result: "draw",
      winnerAgentId: null
    };
  }
  if (state.round >= state.config.maxRounds) {
    const maxHp = Math.max(...alive.map((a) => a.hp));
    const withMaxHp = alive.filter((a) => a.hp === maxHp);
    if (withMaxHp.length === 1) {
      return {
        gameOver: true,
        result: "highest_hp",
        winnerAgentId: withMaxHp[0].agentId
      };
    }
    return {
      gameOver: true,
      result: "draw",
      winnerAgentId: null
    };
  }
  return {
    gameOver: false,
    result: null,
    winnerAgentId: null
  };
}

// packages/engine/src/agent-prompt.ts
var DIRECTION_NAMES2 = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right"
};
function buildSystemPrompt(agentId) {
  return `You are playing Civil-AI-zation, a turn-based arena battle game on a 3x3 grid.

OBJECTIVE:
SURVIVE and ELIMINATE opponents. Win by being the last agent standing, or having the highest HP at round 30.

=== COORDINATE SYSTEM ===
The grid uses standard 2D array coordinates:
- (0,0) is TOP-LEFT corner
- X increases LEFT to RIGHT: 0 \u2192 1 \u2192 2
- Y increases TOP to BOTTOM: 0 \u2192 1 \u2192 2

CRITICAL: To find relative position between two points:
- Compare X values: smaller X = more LEFT, larger X = more RIGHT
- Compare Y values: smaller Y = more UP/TOP, larger Y = more DOWN/BOTTOM

Example: You are at (2,1), opponent at (0,1)
- Same Y (both at 1) = same horizontal row
- Your X=2, opponent X=0 \u2192 opponent is 2 cells to your LEFT
- To reach: move left to (1,1), then move left again to (0,1)

=== ACTIONS (each costs 1 EP) ===
1. move(direction): Move 1 cell in the specified direction AND automatically face that direction
   - up: YOUR position (X, Y-1), face up. If at (0,1) \u2192 move to (0,0)
   - down: YOUR position (X, Y+1), face down. If at (0,1) \u2192 move to (0,2)
   - left: YOUR position (X-1, Y), face left. If at (1,1) \u2192 move to (0,1)
   - right: YOUR position (X+1, Y), face right. If at (0,1) \u2192 move to (1,1)
   - Cost: 1 EP (moving also turns you for FREE!)
   - IMPORTANT: You move YOUR position, not to another agent's position!
   - To reach an agent, check SURROUNDING to see which direction they are, then move that direction

2. turn(direction): Change facing WITHOUT moving
   - Use when you want to face a different direction but stay in place
   - Cost: 1 EP

3. attack(target): Attack the cell you are facing
   - MUST be facing the target (they must be in the cell directly in front of you)
   - Damage depends on target's facing relative to your attack:
     * Front hit (target faces you): 2 damage (they see you coming)
     * Side hit (perpendicular): 5 damage (flanking)
     * Back hit (target faces away): 7 damage (BACKSTAB - massive damage!)
   - Cost: 1 EP

4. rest(): Skip turn, recover energy
   - Gain +2 EP next turn (base +1 EP plus +1 rest bonus)
   - Cost: 0 EP
   - Energy accumulates up to 3 EP maximum
   - Use when you need to build up energy for multi-action turns

=== TREASURE CHESTS (NEW!) ===
Treasure chests (marked as 'C' on the board) appear randomly on the map at certain rounds.

WHAT YOU KNOW:
- Chest locations are visible to all agents (you'll see them in CHESTS section)
- Chests are automatically opened when you move onto their cell
- The game does NOT reveal what's inside until opened

WHAT'S INSIDE:
- Each chest contains ONE item that affects your HP
- Items have varying effects - some may help you, others may harm you
- Exact effects can change between games (not fixed)
- Taking the risk might give you an advantage, or it might backfire

STRATEGY:
- Chests can be a gamble - weigh risk vs reward
- Observe opponent behavior - do they seek chests or avoid them?
- Use chests as bait or tactical positioning opportunities
- Remember: you must MOVE onto the chest cell to open it (cannot open from adjacent cell)

=== SURROUNDING INFO (CRITICAL FOR SPATIAL UNDERSTANDING) ===
In YOUR STATUS, you will see SURROUNDING with 4 directions:
SURROUNDING: { up: "...", down: "...", left: "...", right: "..." }

Each direction shows what is in that adjacent cell:
- "Empty" = empty cell you can move to
- "Wall" = edge of map (cannot move there)
- Agent name ("opus", "sonnet", "haiku") = that agent is in that direction

Example 1: You are at (1,0)
SURROUNDING: { up: "Wall", down: "haiku", left: "Empty", right: "Empty" }
- up shows "Wall" = you're at the top edge, cannot move up
- down shows "haiku" = haiku is at (1,1), cell is occupied, CANNOT move down
- left shows "Empty" = cell (0,0) is empty, CAN move left
- right shows "Empty" = cell (2,0) is empty, CAN move right
- To attack haiku: turn(down) then attack(haiku) next turn

Example 2: You are at (0,1)
SURROUNDING: { up: "Empty", down: "Empty", left: "Wall", right: "haiku" }
- up shows "Empty" = can move to (0,0)
- down shows "Empty" = can move to (0,2)
- left shows "Wall" = at left edge, cannot move left
- right shows "haiku" = haiku at (1,1), occupied, CANNOT move right
- To attack haiku: turn(right) then attack(haiku)

Example 3: You are at (1,1) [center]
SURROUNDING: { up: "opus", down: "Empty", left: "sonnet", right: "Empty" }
- up shows "opus" = opus at (1,0), occupied
- down shows "Empty" = can move to (1,2)
- left shows "sonnet" = sonnet at (0,1), occupied
- right shows "Empty" = can move to (2,1)
- You can attack opus (turn up) or sonnet (turn left)
- Or move to empty cells: down to (1,2) or right to (2,1)

CRITICAL:
- SURROUNDING tells you EXACTLY what's adjacent in each direction
- If it shows an agent name = that cell is OCCUPIED, cannot move there
- If it shows "Empty" = you CAN move there
- Use this to decide: attack (if facing occupied cell) or move (to empty cell)

=== ENERGY MANAGEMENT ===
- Energy ACCUMULATES each turn (does NOT reset)
- Gain +1 EP at start of each turn
- Gain +1 bonus EP if you rested last turn (total +2 EP)
- Maximum EP cap: 3 (cannot exceed this)
- Actions cost: move=1, turn=1, attack=1, rest=0
- Rest when at max EP is wasted (already at cap)
- Moving is efficient: 1 EP to move AND turn (2-in-1 action!)
- Example: Start with 1 EP \u2192 rest \u2192 next turn 3 EP (1 current + 1 base + 1 bonus, capped at 3)

=== STRATEGY TIPS ===
1. POSITIONING: Get behind opponents for 7 damage backstabs (2.5x normal damage!)
2. EFFICIENCY: Use move() instead of turn() when possible (free facing change)
3. DEFENSE: If in danger of being attacked:
   - Move away to safety (costs 1 EP)
   - Turn to face attacker (reduces damage from 7\u21922 if they hit your back)
   - Consider resting if safe (recover EP for stronger next turn)
4. ENERGY: Watch your EP! Rest when needed to build up for multi-action turns
5. DAMAGE AWARENESS:
   - Getting hit in the BACK = 7 damage (very dangerous!)
   - Getting hit in the SIDE = 5 damage (moderate)
   - Getting hit in the FRONT = 2 damage (you saw it coming)
   - Always try to face threats to minimize damage taken

YOUR IDENTITY:
${AGENT_PERSONALITIES[agentId]}

RESPONSE FORMAT: You MUST call the choose_actions tool with NO text before it. Do NOT write any analysis, reasoning, or content in your message. Go directly to the tool call. Put brief reasoning (under 50 words) in the tool's "reasoning" field.`;
}
function buildJsonModeInstructions(aliveOpponents, validMoveDirections) {
  const validActions = [
    ...validMoveDirections.map((d) => `move:${d}`),
    ...aliveOpponents.length > 0 ? aliveOpponents.map((t) => `attack:${t}`) : [],
    "turn:up",
    "turn:down",
    "turn:left",
    "turn:right",
    "rest"
  ];
  return `CRITICAL: Decide your actions FIRST, then explain briefly. Do NOT over-analyze.

Respond with ONLY a JSON object. No other text.

{"actions": [...], "reasoning": "1 sentence"}

Valid actions: ${JSON.stringify(validActions)}

Examples:
{"actions": ["move:left"], "reasoning": "Flanking opponent"}
{"actions": ["move:up", "attack:sonnet"], "reasoning": "Side hit opportunity"}
{"actions": ["rest"], "reasoning": "Need EP"}

Rules: no repeated action types, attack must be last, rest stops sequence.
Reasoning must be under 20 words. Focus on WHAT you do, not WHY in detail.`;
}
function buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections) {
  const grid = buildGridVisual(aliveAgents, sharedView.chests, sharedView.mapWidth, sharedView.mapHeight);
  const agentLines = sharedView.agents.map((a) => {
    const youTag = a.agentId === personalView.agentId ? " [YOU]" : "";
    let relativePos = "";
    if (a.agentId !== personalView.agentId) {
      const dx = a.position.x - personalView.position.x;
      const dy = a.position.y - personalView.position.y;
      const horizontal = dx < 0 ? `${Math.abs(dx)} LEFT` : dx > 0 ? `${dx} RIGHT` : "SAME column";
      const vertical = dy < 0 ? `${Math.abs(dy)} UP` : dy > 0 ? `${dy} DOWN` : "SAME row";
      relativePos = ` | Relative to you: ${horizontal}, ${vertical}`;
    }
    return `- ${a.agentId}: position (${a.position.x},${a.position.y}), HP ${a.hp}, facing ${DIRECTION_NAMES2[a.orientation]}${youTag}${relativePos}`;
  }).join("\n");
  const eliminatedLines = sharedView.eliminatedAgents.length > 0 ? sharedView.eliminatedAgents.map((a) => `- ${a.agentId}: eliminated in round ${a.eliminatedAtRound}`).join("\n") : "None";
  const adjacentInfo = buildAdjacentInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight);
  const surroundingInfo = buildSurroundingInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight);
  const memoryLines = personalView.memory.length > 0 ? personalView.memory.join("\n") : "No memories yet.";
  const summaryText = sharedView.previousRoundSummary ?? "First round - no previous summary.";
  const chestsText = sharedView.chests.length > 0 ? sharedView.chests.map((c) => `- Chest at (${c.position.x},${c.position.y}) - Contents unknown`).join("\n") : "None currently on the map.";
  return `=== ROUND ${sharedView.round} ===

\u2501\u2501\u2501 \u{1F50D} YOUR IMMEDIATE SURROUNDINGS (ONLY USE THIS FOR SPATIAL DECISIONS) \u2501\u2501\u2501
${surroundingInfo}

\u26A0\uFE0F CRITICAL RULES FOR USING SURROUNDING:
1. ONLY agents shown in SURROUNDING are adjacent (1 cell away) - you can attack them
2. Agents NOT in SURROUNDING are 2+ cells away - you CANNOT attack them yet
3. DO NOT calculate directions from coordinates - ONLY use SURROUNDING field
4. If SURROUNDING shows "Empty" for all 4 directions, NO agents are adjacent to you

Example: If SURROUNDING = { up: "Empty", down: "Empty", left: "opus", right: "Empty" }
\u2192 ONLY opus is adjacent (to your left)
\u2192 All other agents are far away (2+ cells)
\u2192 To attack opus: turn(left) then attack(opus)

BOARD STATE (${sharedView.mapWidth}x${sharedView.mapHeight} grid):
${grid}

ALIVE AGENTS (WARNING: These positions are for context only! Use SURROUNDING above for adjacency):
${agentLines}

ELIMINATED AGENTS:
${eliminatedLines}

TREASURE CHESTS:
${chestsText}

YOUR STATUS:
- HP: ${personalView.hp}, EP: ${personalView.ep}, Position: (${personalView.position.x},${personalView.position.y}), Facing: ${DIRECTION_NAMES2[personalView.orientation]}

- Adjacent cells: ${adjacentInfo}
- Valid moves: ${validMoveDirections.length > 0 ? validMoveDirections.map((d) => `${d} (${DIRECTION_NAMES2[d]})`).join(", ") : "None \u2014 you are boxed in"}
- ${buildAttackTargetInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight)}

YOUR MEMORY:
${memoryLines}

PREVIOUS ROUND SUMMARY:
${summaryText}

Choose your action.`;
}
function buildToolDefinitions(aliveOpponents, validMoveDirections) {
  return [{
    type: "function",
    function: {
      name: "choose_actions",
      description: `Choose one or more actions to perform this turn in sequence. Actions execute in the order provided. Each action costs EP (move=1, turn=1, attack=1, rest=0). You can keep acting until EP runs out or you choose to rest. Moving automatically changes your facing for FREE (no need to turn separately unless you want different facing after move).

Examples:
- With 1 EP: ["move:left"] or ["turn:up"] or ["rest"]
- With 2 EP: ["move:left", "attack:opus"] or ["turn:up", "attack:haiku"]
- With 3 EP: ["move:up", "move:left", "attack:sonnet"]

Rules:
- Cannot repeat same action type (no double move, double turn, etc.)
- Attack must be last action (after move/turn positioning)
- Rest stops sequence immediately (cannot act after rest)
- Invalid actions are skipped and you rest instead`,
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "string",
              enum: [
                ...validMoveDirections.map((d) => `move:${d}`),
                ...aliveOpponents.length > 0 ? aliveOpponents.map((t) => `attack:${t}`) : [],
                "turn:up",
                "turn:down",
                "turn:left",
                "turn:right",
                "rest"
              ]
            },
            description: 'Sequence of actions to perform. Format: "action:param" or "rest". Example: ["move:left", "attack:opus"]'
          },
          reasoning: {
            type: "string",
            description: "Brief strategic reasoning (max 50 words)."
          }
        },
        required: ["actions"]
      }
    }
  }];
}
function parseToolCall(toolCall) {
  try {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    if (name === "choose_actions") {
      const actions = args["actions"];
      if (!Array.isArray(actions)) {
        return [{ type: "rest" }];
      }
      const parsedActions = [];
      for (const actionStr of actions) {
        if (typeof actionStr !== "string") continue;
        if (actionStr === "rest") {
          parsedActions.push({ type: "rest" });
          break;
        }
        const [actionType, param] = actionStr.split(":");
        if (actionType === "move") {
          if (param === "up" || param === "down" || param === "left" || param === "right") {
            parsedActions.push({ type: "move", direction: param });
          }
        } else if (actionType === "attack") {
          if (param && param in AGENT_PERSONALITIES) {
            parsedActions.push({ type: "attack", target: param });
          }
        } else if (actionType === "turn") {
          if (param === "up" || param === "down" || param === "left" || param === "right") {
            parsedActions.push({ type: "turn", direction: param });
          }
        }
      }
      return parsedActions.length > 0 ? parsedActions : [{ type: "rest" }];
    }
    switch (name) {
      case "move": {
        const dir = args["direction"];
        if (dir === "up" || dir === "down" || dir === "left" || dir === "right") {
          return [{ type: "move", direction: dir }];
        }
        return [{ type: "rest" }];
      }
      case "attack": {
        const target = args["target"];
        if (target && typeof target === "string" && target in AGENT_PERSONALITIES) {
          return [{ type: "attack", target }];
        }
        return [{ type: "rest" }];
      }
      case "turn": {
        const turnDir = args["direction"];
        if (turnDir === "up" || turnDir === "down" || turnDir === "left" || turnDir === "right") {
          return [{ type: "turn", direction: turnDir }];
        }
        return [{ type: "rest" }];
      }
      case "rest":
        return [{ type: "rest" }];
      default:
        return [{ type: "rest" }];
    }
  } catch {
    return [{ type: "rest" }];
  }
}
function parseJsonContent(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { actions: [{ type: "rest" }], reasoning: "" };
    const parsed = JSON.parse(jsonMatch[0]);
    const reasoning = typeof parsed["reasoning"] === "string" ? parsed["reasoning"] : "";
    const actions = parsed["actions"];
    if (!Array.isArray(actions)) return { actions: [{ type: "rest" }], reasoning };
    const parsedActions = [];
    for (const actionStr of actions) {
      if (typeof actionStr !== "string") continue;
      if (actionStr === "rest") {
        parsedActions.push({ type: "rest" });
        break;
      }
      const [actionType, param] = actionStr.split(":");
      if (actionType === "move") {
        if (param === "up" || param === "down" || param === "left" || param === "right") {
          parsedActions.push({ type: "move", direction: param });
        }
      } else if (actionType === "attack") {
        if (param && param in AGENT_PERSONALITIES) {
          parsedActions.push({ type: "attack", target: param });
        }
      } else if (actionType === "turn") {
        if (param === "up" || param === "down" || param === "left" || param === "right") {
          parsedActions.push({ type: "turn", direction: param });
        }
      }
    }
    return { actions: parsedActions.length > 0 ? parsedActions : [{ type: "rest" }], reasoning };
  } catch {
    return { actions: [{ type: "rest" }], reasoning: "" };
  }
}
function buildGridVisual(agents, chests, width, height) {
  const dirArrow = {
    up: "\u2191",
    down: "\u2193",
    left: "\u2190",
    right: "\u2192"
  };
  const lines = [];
  lines.push("  " + Array.from({ length: width }, (_, i) => i).join(" "));
  for (let y = 0; y < height; y++) {
    let row = `${y} `;
    for (let x = 0; x < width; x++) {
      const agent = agents.find(
        (a) => a.status === "alive" && a.position.x === x && a.position.y === y
      );
      if (agent) {
        row += agent.agentId[0].toUpperCase() + dirArrow[agent.orientation];
      } else {
        const chest = chests.find((c) => c.position.x === x && c.position.y === y);
        if (chest) {
          row += "C ";
        } else {
          row += ". ";
        }
      }
    }
    lines.push(row.trimEnd());
  }
  return lines.join("\n");
}
function buildSurroundingInfo(personal, aliveAgents, width, height) {
  const dirs = ["up", "down", "left", "right"];
  const deltas = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 }
  };
  const surrounding = {};
  for (const d of dirs) {
    const delta = deltas[d];
    const nx = personal.position.x + delta.dx;
    const ny = personal.position.y + delta.dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      surrounding[d] = "Wall";
    } else {
      const occupant = aliveAgents.find(
        (a) => a.status === "alive" && a.agentId !== personal.agentId && a.position.x === nx && a.position.y === ny
      );
      surrounding[d] = occupant ? occupant.agentId : "Empty";
    }
  }
  return `{ up: "${surrounding.up}", down: "${surrounding.down}", left: "${surrounding.left}", right: "${surrounding.right}" }`;
}
function buildAdjacentInfo(personal, aliveAgents, width, height) {
  const dirs = ["up", "down", "left", "right"];
  const deltas = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 }
  };
  return dirs.map((d) => {
    const delta = deltas[d];
    const nx = personal.position.x + delta.dx;
    const ny = personal.position.y + delta.dy;
    const facingTag = d === personal.orientation ? " [FACING - can attack here]" : "";
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      return `${d}=wall${facingTag}`;
    }
    const occupant = aliveAgents.find(
      (a) => a.status === "alive" && a.position.x === nx && a.position.y === ny
    );
    if (occupant) {
      return `${d}=(${nx},${ny}) ${occupant.agentId}${facingTag}`;
    }
    return `${d}=(${nx},${ny}) empty${facingTag}`;
  }).join(", ");
}
function buildAttackTargetInfo(personal, aliveAgents, width, height) {
  const deltas = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 }
  };
  const delta = deltas[personal.orientation];
  const fx = personal.position.x + delta.dx;
  const fy = personal.position.y + delta.dy;
  if (fx < 0 || fx >= width || fy < 0 || fy >= height) {
    return `ATTACK TARGET: You are facing a wall (${DIRECTION_NAMES2[personal.orientation]}). You cannot attack. Use turn(direction) to face a different direction, or move.`;
  }
  const target = aliveAgents.find(
    (a) => a.status === "alive" && a.agentId !== personal.agentId && a.position.x === fx && a.position.y === fy
  );
  if (target) {
    return `ATTACK TARGET: You can attack ${target.agentId} at (${fx},${fy}) \u2014 they are directly in front of you.`;
  }
  return `ATTACK TARGET: Cell (${fx},${fy}) in front of you is empty. No one to attack. Use turn(direction) to change facing, or move closer.`;
}

// packages/engine/src/summary.ts
var DIRECTION_NAMES3 = {
  N: "North",
  S: "South",
  E: "East",
  W: "West"
};
function buildSummaryPrompt(roundNumber, turnRecords, agents) {
  const system = "You are a concise battle commentator for Civil-AI-zation. Summarize the round's events in 2-3 sentences. Be dramatic but factual. Include damage numbers and eliminations.";
  const events = turnRecords.map((t) => {
    switch (t.result.type) {
      case "move":
        return `${t.agentId} moved ${DIRECTION_NAMES3[t.result.newOrientation]} to (${t.result.to.x},${t.result.to.y}).`;
      case "attack": {
        const elim = t.result.targetEliminated ? ` ${t.result.target} was eliminated!` : "";
        return `${t.agentId} attacked ${t.result.target} from the ${t.result.hitZone} for ${t.result.damage} damage (${t.result.targetHpBefore}\u2192${t.result.targetHpAfter} HP).${elim}`;
      }
      case "turn":
        return `${t.agentId} turned to face ${DIRECTION_NAMES3[t.result.newOrientation]}.`;
      case "rest":
        return `${t.agentId} rested.`;
      case "invalid":
        return `${t.agentId} attempted an invalid action and rested instead.`;
    }
  });
  const agentStatus = agents.map((a) => `${a.agentId}: ${a.status === "alive" ? `HP ${a.hp}` : "eliminated"}`).join(", ");
  const user = `Round ${roundNumber} events:
${events.join("\n")}

Current status: ${agentStatus}`;
  return { system, user };
}

// insforge/functions/run-game/index.src.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function callLlm(client, params) {
  if (params.model.startsWith("zai/")) {
    const actualModel = params.model.slice(4);
    const apiKey = Deno.env.get("ZAI_API_KEY");
    if (!apiKey) throw new Error("ZAI_API_KEY not configured");
    const body = {
      model: actualModel,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 500
    };
    if (params.responseFormat) {
      body.response_format = params.responseFormat;
    } else if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = params.toolChoice ?? "auto";
    }
    const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Z.AI API error (${res.status}): ${text}`);
    }
    return await res.json();
  }
  const supportsThinking = params.model.startsWith("anthropic/");
  return await client.ai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    ...params.tools?.length ? { tools: params.tools, toolChoice: params.toolChoice } : {},
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    ...supportsThinking ? { thinking: true } : {}
  });
}
async function index_src_default(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const client = createClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL"),
    anonKey: Deno.env.get("ANON_KEY")
  });
  const config = DEFAULT_GAME_CONFIG;
  try {
    const state = createInitialState(config);
    const { data: gameData, error: gameError } = await client.database.from("games").insert([{
      status: "running",
      current_round: 0,
      max_rounds: config.maxRounds,
      config
    }]).select().single();
    if (gameError || !gameData) {
      return jsonResponse({ error: "Failed to create game", details: gameError }, 500);
    }
    const gameId = gameData.id;
    const agentInserts = state.agents.map((a) => ({
      game_id: gameId,
      agent_id: a.agentId,
      model_id: a.modelId,
      hp: a.hp,
      ep: a.ep,
      position_x: a.position.x,
      position_y: a.position.y,
      orientation: a.orientation,
      status: a.status,
      speed: a.speed,
      eliminated_at_round: a.eliminatedAtRound,
      memory: a.memory,
      turn_order: a.turnOrder
    }));
    await client.database.from("agent_states").insert(agentInserts);
    runGameLoop(client, gameId, state, config).catch((err) => {
      console.error("Game loop failed:", err);
      client.database.from("games").update({ status: "completed", result: "draw", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", gameId).then(() => {
      });
    });
    return jsonResponse({ gameId, status: "running", agents: state.agents.map(toPublicAgent) });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
function parseActionsFromContent(content) {
  const actions = [];
  const pattern = /\b(move|attack|turn|rest):(up|down|left|right|opus|sonnet|haiku)\b/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const param = match[2].toLowerCase();
    if (type === "move" && ["up", "down", "left", "right"].includes(param)) {
      actions.push({ type: "move", direction: param });
    } else if (type === "attack" && ["opus", "sonnet", "haiku"].includes(param)) {
      actions.push({ type: "attack", target: param });
    } else if (type === "turn" && ["up", "down", "left", "right"].includes(param)) {
      actions.push({ type: "turn", direction: param });
    } else if (type === "rest") {
      actions.push({ type: "rest" });
    }
  }
  if (actions.length > 0) {
    console.log(`[parseActionsFromContent] Extracted ${actions.length} actions from content text`);
  }
  return actions.length > 0 ? actions : [{ type: "rest" }];
}
async function runGameLoop(client, gameId, initialState, config) {
  let state = initialState;
  await client.realtime.connect();
  await client.realtime.subscribe(`game:${gameId}`);
  await delay(BACKEND_CONFIG.gameLoopDelayMs);
  await client.realtime.publish(`game:${gameId}`, "game_started", {
    gameId,
    config,
    agents: state.agents.map(toPublicAgent)
  });
  for (let round = 1; round <= config.maxRounds; round++) {
    state = { ...state, round };
    console.log(`[R${round}] Round started`);
    await client.realtime.publish(`game:${gameId}`, "round_started", {
      roundNumber: round,
      turnOrder: getTurnOrder(state.agents).map((a) => a.agentId)
    });
    if (config.chests.enabled && config.chests.spawnRounds.includes(round)) {
      const newChest = spawnChest(state.agents, state.chests, config);
      if (newChest) {
        state = { ...state, chests: [...state.chests, newChest] };
        console.log(`[R${round}] Chest spawned at (${newChest.position.x},${newChest.position.y})`);
        await client.realtime.publish(`game:${gameId}`, "chest_spawned", {
          roundNumber: round,
          position: newChest.position
        });
      }
    }
    if (round > 1) {
      const prevTurns = state.turnRecords.filter((t) => t.roundNumber === round - 1);
      try {
        const { system, user } = buildSummaryPrompt(round - 1, prevTurns, state.agents);
        const tSummary = Date.now();
        const completion = await callLlm(client, {
          model: BACKEND_CONFIG.summaryModel,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ],
          temperature: 0.8,
          maxTokens: 200
        });
        console.log(`[R${round}][summary] LLM call: ${Date.now() - tSummary}ms (${BACKEND_CONFIG.summaryModel})`);
        const summaryText = completion.choices?.[0]?.message?.content ?? "No summary available.";
        await client.database.from("round_summaries").insert([{
          game_id: gameId,
          round_number: round - 1,
          summary: summaryText,
          state_snapshot: buildSharedView(state)
        }]);
        state = {
          ...state,
          roundSummaries: [...state.roundSummaries, {
            roundNumber: round - 1,
            summary: summaryText,
            stateSnapshot: buildSharedView(state)
          }]
        };
        await client.realtime.publish(`game:${gameId}`, "round_summary", {
          roundNumber: round - 1,
          summary: summaryText
        });
      } catch {
      }
    }
    const turnOrder = getTurnOrder(state.agents);
    const roundTurnRecords = [];
    for (const turnAgent of turnOrder) {
      const currentAgent = state.agents.find((a) => a.agentId === turnAgent.agentId);
      if (currentAgent.status !== "alive") continue;
      await client.realtime.publish(`game:${gameId}`, "turn_started", {
        agentId: turnAgent.agentId
      });
      const restedLastTurn = didRestLastTurn(state, turnAgent.agentId);
      const withEp = resetEpForTurn(currentAgent, config, restedLastTurn);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { ep: withEp.ep }) };
      const sharedView = buildSharedView(state);
      const personalView = buildPersonalView(state, turnAgent.agentId);
      const aliveAgents = state.agents.filter((a) => a.status === "alive");
      const aliveOpponents = aliveAgents.filter((a) => a.agentId !== turnAgent.agentId).map((a) => a.agentId);
      const currentAgentState = state.agents.find((a) => a.agentId === turnAgent.agentId);
      const validMoveDirections = getValidMoveDirections(
        currentAgentState.position,
        config.mapWidth,
        config.mapHeight,
        aliveAgents
      );
      let parsedActions = [{ type: "rest" }];
      let rawResponse = null;
      let reasoning = "";
      const isZaiModel = turnAgent.modelId.startsWith("zai/");
      try {
        const systemPrompt = buildSystemPrompt(turnAgent.agentId);
        const userMessage = buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections);
        const t0 = Date.now();
        const agentMaxTokens = AGENT_CONFIG_MAP[turnAgent.agentId]?.maxTokens ?? 500;
        if (isZaiModel) {
          const jsonInstructions = buildJsonModeInstructions(aliveOpponents, validMoveDirections);
          const completion = await callLlm(client, {
            model: turnAgent.modelId,
            messages: [
              { role: "system", content: systemPrompt + "\n\n" + jsonInstructions },
              { role: "user", content: userMessage }
            ],
            responseFormat: { type: "json_object" },
            temperature: 0.7,
            maxTokens: agentMaxTokens
          });
          console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId}, json_mode, ${agentMaxTokens} tokens)`);
          rawResponse = completion;
          const message = completion.choices?.[0]?.message;
          const content = message?.content || "";
          const parsed = parseJsonContent(content);
          parsedActions = parsed.actions;
          reasoning = message?.reasoning_content || parsed.reasoning;
        } else {
          const tools = buildToolDefinitions(aliveOpponents, validMoveDirections);
          const completion = await callLlm(client, {
            model: turnAgent.modelId,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
            tools,
            toolChoice: { type: "function", function: { name: "choose_actions" } },
            temperature: 0.7,
            maxTokens: agentMaxTokens
          });
          console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId}, ${agentMaxTokens} tokens)`);
          rawResponse = completion;
          const message = completion.choices?.[0]?.message;
          const thinkingReasoning = message?.reasoning_content || "";
          const toolCalls = message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            let toolReasoning = "";
            try {
              const toolArgs = JSON.parse(toolCalls[0].function.arguments);
              toolReasoning = toolArgs.reasoning || "";
            } catch {
            }
            reasoning = thinkingReasoning || toolReasoning || message?.content || "";
            const merged = [];
            for (const tc of toolCalls) {
              merged.push(...parseToolCall(tc));
            }
            parsedActions = merged.length > 0 ? merged : [{ type: "rest" }];
          } else {
            reasoning = thinkingReasoning || message?.content || "";
            parsedActions = parseActionsFromContent(message?.content || "");
          }
        }
      } catch (err) {
        console.error(`LLM call failed for ${turnAgent.agentId}:`, err);
      }
      const ACTION_ORDER = { move: 0, turn: 1, attack: 2, rest: 3 };
      const orderedActions = [...parsedActions].sort(
        (a, b) => (ACTION_ORDER[a.type] ?? 99) - (ACTION_ORDER[b.type] ?? 99)
      );
      console.log(`[R${round}][${turnAgent.agentId}] Actions: ${orderedActions.map((a) => a.type).join(" \u2192 ")}`);
      const allResults = [];
      const allResolvedActions = [];
      for (const action of orderedActions) {
        if (action.type === "rest") {
          const { agents: ra, chests: rc, result: rr } = executeAction(
            turnAgent.agentId,
            action,
            state.agents,
            config,
            state.chests
          );
          state = { ...state, agents: ra, chests: rc };
          allResults.push(rr);
          allResolvedActions.push(action);
          break;
        }
        const { agents: ua, chests: uc, result: ur } = executeAction(
          turnAgent.agentId,
          action,
          state.agents,
          config,
          state.chests
        );
        state = { ...state, agents: ua, chests: uc };
        allResults.push(ur);
        if (ur.type === "invalid") {
          allResolvedActions.push({ type: "invalid", reason: ur.reason });
          break;
        }
        allResolvedActions.push(action);
        if (ur.type === "attack" && ur.targetEliminated) {
          state = {
            ...state,
            agents: updateAgent(state.agents, ur.target, { eliminatedAtRound: round })
          };
        }
      }
      const lastResult = allResults[allResults.length - 1];
      const lastAction = allResolvedActions[allResolvedActions.length - 1];
      const memoryEntry = buildMemoryEntry(round, turnAgent.agentId, lastResult, state.agents);
      const agentAfterAction = state.agents.find((a) => a.agentId === turnAgent.agentId);
      const newMemory = appendMemory(agentAfterAction.memory, memoryEntry, config.memoryCap);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { memory: newMemory }) };
      const turnRecord = {
        roundNumber: round,
        agentId: turnAgent.agentId,
        action: lastAction,
        result: lastResult
      };
      roundTurnRecords.push(turnRecord);
      for (let i = 0; i < allResolvedActions.length; i++) {
        const act = allResolvedActions[i];
        const res = allResults[i];
        await client.database.from("turns").insert([{
          game_id: gameId,
          round_number: round,
          agent_id: turnAgent.agentId,
          action_type: act.type,
          action_params: act.type === "move" ? { direction: act.direction } : act.type === "attack" ? { target: act.target } : act.type === "turn" ? { direction: act.direction } : {},
          result: res,
          llm_reasoning: i === 0 ? reasoning || null : null,
          raw_llm_response: i === 0 ? rawResponse : null
        }]);
      }
      await syncAgentStates(client, gameId, state.agents);
      await client.realtime.publish(`game:${gameId}`, "turn_completed", {
        agentId: turnAgent.agentId,
        actions: allResolvedActions,
        results: allResults,
        action: lastAction,
        result: lastResult,
        reasoning: reasoning || null,
        agents: state.agents.map(toPublicAgent)
      });
      for (const res of allResults) {
        if (res.type === "attack" && res.targetEliminated) {
          await client.realtime.publish(`game:${gameId}`, "agent_eliminated", {
            agentId: res.target,
            eliminatedBy: turnAgent.agentId
          });
        }
      }
      await delay(BACKEND_CONFIG.turnDelayMs);
    }
    state = { ...state, turnRecords: [...state.turnRecords, ...roundTurnRecords] };
    const winResult = checkWinCondition(state);
    if (winResult.gameOver) {
      await finalizeGame(client, gameId, state, winResult);
      await client.realtime.publish(`game:${gameId}`, "game_ended", {
        winner: winResult.winnerAgentId,
        result: winResult.result,
        finalStates: state.agents.map(toPublicAgent)
      });
      client.realtime.disconnect();
      return;
    }
    await client.database.from("games").update({ current_round: round }).eq("id", gameId);
  }
  const finalResult = checkWinCondition(state);
  await finalizeGame(client, gameId, state, finalResult);
  await client.realtime.publish(`game:${gameId}`, "game_ended", {
    winner: finalResult.winnerAgentId,
    result: finalResult.result,
    finalStates: state.agents.map(toPublicAgent)
  });
  client.realtime.disconnect();
}
function toPublicAgent(a) {
  return {
    agentId: a.agentId,
    position: a.position,
    hp: a.hp,
    ep: a.ep,
    orientation: a.orientation,
    status: a.status,
    speed: a.speed,
    eliminatedAtRound: a.eliminatedAtRound
  };
}
function didRestLastTurn(state, agentId) {
  if (state.round <= 1) return false;
  const lastTurn = state.turnRecords.find(
    (t) => t.roundNumber === state.round - 1 && t.agentId === agentId
  );
  if (!lastTurn) return false;
  return lastTurn.result.type === "rest" || lastTurn.result.type === "invalid";
}
async function syncAgentStates(client, gameId, agents) {
  for (const a of agents) {
    await client.database.from("agent_states").update({
      hp: a.hp,
      ep: a.ep,
      position_x: a.position.x,
      position_y: a.position.y,
      orientation: a.orientation,
      status: a.status,
      eliminated_at_round: a.eliminatedAtRound,
      memory: a.memory
    }).eq("game_id", gameId).eq("agent_id", a.agentId);
  }
}
async function finalizeGame(client, gameId, state, winResult) {
  await client.database.from("games").update({
    status: "completed",
    current_round: state.round,
    winner_agent_id: winResult.winnerAgentId,
    result: winResult.result,
    completed_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", gameId);
}
export {
  index_src_default as default
};
