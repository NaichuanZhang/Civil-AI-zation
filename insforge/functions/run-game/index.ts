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
    startPosition: { x: 0, y: 2 },
    startOrientation: "up"
  },
  sonnet: {
    modelId: "openai/gpt-4o-mini",
    speed: 3,
    hp: 20,
    startPosition: { x: 2, y: 2 },
    startOrientation: "left"
  },
  haiku: {
    modelId: "openai/gpt-4o-mini",
    speed: 4,
    hp: 15,
    startPosition: { x: 1, y: 0 },
    startOrientation: "down"
  }
};
var AGENT_INITIAL_HP = Object.fromEntries(
  Object.entries(AGENT_CONFIG_MAP).map(([id, config]) => [id, config.hp])
);
var DEFAULT_GAME_CONFIG = {
  mapWidth: 3,
  mapHeight: 3,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  agents: Object.entries(AGENT_CONFIG_MAP).map(([agentId, config]) => ({
    agentId,
    modelId: config.modelId,
    speed: config.speed,
    hp: config.hp,
    position: config.startPosition,
    orientation: config.startOrientation
  }))
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
    winnerAgentId: null
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
    previousRoundSummary: lastSummary
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
    case "move":
      return `Round ${round}: I moved ${DIRECTION_NAMES[result.newOrientation]} to (${result.to.x},${result.to.y}), facing ${DIRECTION_NAMES[result.newOrientation]}.`;
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

// packages/engine/src/actions.ts
function validateMove(agent, direction, allAgents, config) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < 1) {
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
function validateAttack(agent, targetId, allAgents) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < 1) {
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
function validateTurn(agent) {
  if (agent.status === "eliminated") {
    return { valid: false, reason: "Agent is eliminated" };
  }
  if (agent.ep < 1) {
    return { valid: false, reason: "Not enough EP" };
  }
  return { valid: true };
}
function executeAction(agentId, action, agents, config) {
  const agent = agents.find((a) => a.agentId === agentId);
  switch (action.type) {
    case "move": {
      const validation = validateMove(agent, action.direction, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, validation.reason, config);
      }
      const dest = getAdjacentPosition(agent.position, action.direction);
      const newAgents = updateAgent(agents, agentId, {
        position: dest,
        orientation: action.direction,
        ep: agent.ep - 1
      });
      return {
        agents: newAgents,
        result: {
          type: "move",
          from: agent.position,
          to: dest,
          newOrientation: action.direction
        }
      };
    }
    case "attack": {
      const validation = validateAttack(agent, action.target, agents);
      if (!validation.valid) {
        return makeInvalidResult(agents, validation.reason, config);
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
      let newAgents = updateAgent(agents, agentId, { ep: agent.ep - 1 });
      newAgents = updateAgent(newAgents, action.target, {
        hp: newHp,
        ...eliminated ? { status: "eliminated", eliminatedAtRound: 0 } : {}
      });
      return {
        agents: newAgents,
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
      const validation = validateTurn(agent);
      if (!validation.valid) {
        return makeInvalidResult(agents, validation.reason, config);
      }
      const prev = agent.orientation;
      const newAgents = updateAgent(agents, agentId, {
        orientation: action.direction,
        ep: agent.ep - 1
      });
      return {
        agents: newAgents,
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
        result: {
          type: "rest",
          epBonusNextTurn: config.restEpBonus
        }
      };
    }
  }
}
function makeInvalidResult(agents, reason, config) {
  return {
    agents,
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
  const ep = restedLastTurn ? config.energyPoints + config.restEpBonus : config.energyPoints;
  return { ...agent, ep };
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
1. move(direction): Move 1 cell AND automatically face that direction
   - up: decreases Y by 1, face up. Example: (1,2) \u2192 (1,1)
   - down: increases Y by 1, face down. Example: (1,0) \u2192 (1,1)
   - left: decreases X by 1, face left. Example: (2,1) \u2192 (1,1)
   - right: increases X by 1, face right. Example: (0,1) \u2192 (1,1)
   - Cost: 1 EP (moving also turns you for FREE!)

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
   - Gain +1 EP next turn (so you'll have 2 EP total next turn)
   - Cost: 0 EP
   - Use when low on energy or in defensive position

=== SURROUNDING INFO (CRITICAL FOR SPATIAL UNDERSTANDING) ===
In YOUR STATUS, you will see:
SURROUNDING: { up: "X", down: "Y", left: "Z", right: "W" }

This tells you EXACTLY what is in each adjacent cell:
- "Empty" = empty cell you can move to
- "Wall" = edge of map (cannot move there)
- Agent name (e.g., "opus") = that agent is in that direction

Example 1: You are at (1,0), surrounding is { up: "Wall", down: "haiku", left: "Empty", right: "Empty" }
- "haiku" is DOWN from you = haiku is at position (1,1)
- To attack haiku: You must face down, then attack(haiku)

Example 2: You are at (2,1), surrounding is { up: "Empty", down: "Empty", left: "Empty", right: "Wall" }
- All adjacent cells are empty or walls
- No one to attack until you move closer

USE THIS FIELD to understand who is where relative to you! Do NOT try to calculate from coordinates!

=== ENERGY MANAGEMENT ===
- Start each turn with 1 EP (or 2 EP if you rested last turn)
- You MUST have enough EP to perform an action
- Moving is efficient: 1 EP to move AND turn (2-in-1 action!)
- Turning separately costs 1 EP, so prefer moving when possible

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

Choose ONE action. Consider: Can I backstab (7 dmg)? Am I vulnerable (facing wrong way)? Do I need energy (rest)?`;
}
function buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections) {
  const grid = buildGridVisual(aliveAgents, sharedView.mapWidth, sharedView.mapHeight);
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
  return `=== ROUND ${sharedView.round} ===

BOARD STATE (${sharedView.mapWidth}x${sharedView.mapHeight} grid):
${grid}

ALIVE AGENTS:
${agentLines}

ELIMINATED AGENTS:
${eliminatedLines}

YOUR STATUS:
- HP: ${personalView.hp}, EP: ${personalView.ep}, Position: (${personalView.position.x},${personalView.position.y}), Facing: ${DIRECTION_NAMES2[personalView.orientation]}
- SURROUNDING: ${surroundingInfo}
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
  const tools = [];
  if (validMoveDirections.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: "move",
        description: "Move 1 cell in a cardinal direction. Costs 1 EP. Sets your facing to that direction. Cannot move outside map bounds or onto a cell occupied by another agent. Only the listed directions are valid this turn.",
        parameters: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: [...validMoveDirections],
              description: "Direction to move"
            }
          },
          required: ["direction"]
        }
      }
    });
  }
  if (aliveOpponents.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: "attack",
        description: "Attack an adjacent agent in your facing direction. Costs 1 EP. The target must be directly in the cell you are facing \u2014 you cannot attack diagonally, at range, or behind you. Use turn(direction) to change facing first if needed. Damage depends on how you hit relative to the target's facing: front=2, side=5, back=7.",
        parameters: {
          type: "object",
          properties: {
            target: {
              type: "string",
              enum: [...aliveOpponents],
              description: "ID of the agent to attack"
            }
          },
          required: ["target"]
        }
      }
    });
  }
  tools.push(
    {
      type: "function",
      function: {
        name: "turn",
        description: "Change your facing direction without moving. Costs 1 EP. Does not change your position. Use this to face a target before attacking, or to reorient defensively.",
        parameters: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: ["up", "down", "left", "right"],
              description: "Direction to face"
            }
          },
          required: ["direction"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "rest",
        description: "Skip your action this turn. Costs 0 EP. You will gain +1 bonus EP next turn (giving you 2 EP total).",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  );
  return tools;
}
function parseToolCall(toolCall) {
  try {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    switch (name) {
      case "move": {
        const dir = args["direction"];
        if (dir === "up" || dir === "down" || dir === "left" || dir === "right") {
          return { type: "move", direction: dir };
        }
        return { type: "rest" };
      }
      case "attack": {
        const target = args["target"];
        if (target && typeof target === "string" && target in AGENT_PERSONALITIES) {
          return { type: "attack", target };
        }
        return { type: "rest" };
      }
      case "turn": {
        const turnDir = args["direction"];
        if (turnDir === "up" || turnDir === "down" || turnDir === "left" || turnDir === "right") {
          return { type: "turn", direction: turnDir };
        }
        return { type: "rest" };
      }
      case "rest":
        return { type: "rest" };
      default:
        return { type: "rest" };
    }
  } catch {
    return { type: "rest" };
  }
}
function buildGridVisual(agents, width, height) {
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
        row += ". ";
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
    if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = params.tool_choice ?? "auto";
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
  return await client.ai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    ...params.tools?.length ? { tools: params.tools, tool_choice: params.tool_choice } : {},
    temperature: params.temperature,
    maxTokens: params.maxTokens
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
    await client.realtime.publish(`game:${gameId}`, "round_started", {
      roundNumber: round,
      turnOrder: getTurnOrder(state.agents).map((a) => a.agentId)
    });
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
      let action;
      let rawResponse = null;
      let reasoning = "";
      try {
        const systemPrompt = buildSystemPrompt(turnAgent.agentId);
        const userMessage = buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections);
        const tools = buildToolDefinitions(aliveOpponents, validMoveDirections);
        const t0 = Date.now();
        const completion = await callLlm(client, {
          model: turnAgent.modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          tools,
          tool_choice: "required",
          temperature: 0.7,
          maxTokens: 500
        });
        console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId})`);
        rawResponse = completion;
        const message = completion.choices?.[0]?.message;
        reasoning = message?.content || message?.reasoning_content || "";
        const toolCall = message?.tool_calls?.[0];
        if (toolCall) {
          action = parseToolCall(toolCall);
        } else {
          action = { type: "rest" };
        }
      } catch (err) {
        console.error(`LLM call failed for ${turnAgent.agentId}:`, err);
        action = { type: "rest" };
      }
      const { agents: updatedAgents, result } = executeAction(
        turnAgent.agentId,
        action,
        state.agents,
        config
      );
      state = { ...state, agents: updatedAgents };
      if (result.type === "attack" && result.targetEliminated) {
        state = {
          ...state,
          agents: updateAgent(state.agents, result.target, { eliminatedAtRound: round })
        };
      }
      const memoryEntry = buildMemoryEntry(round, turnAgent.agentId, result, state.agents);
      const agentAfterAction = state.agents.find((a) => a.agentId === turnAgent.agentId);
      const newMemory = appendMemory(agentAfterAction.memory, memoryEntry, config.memoryCap);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { memory: newMemory }) };
      const resolvedAction = result.type === "invalid" ? { type: "invalid", reason: result.reason } : action;
      const turnRecord = {
        roundNumber: round,
        agentId: turnAgent.agentId,
        action: resolvedAction,
        result
      };
      roundTurnRecords.push(turnRecord);
      await client.database.from("turns").insert([{
        game_id: gameId,
        round_number: round,
        agent_id: turnAgent.agentId,
        action_type: resolvedAction.type,
        action_params: resolvedAction.type === "move" ? { direction: resolvedAction.direction } : resolvedAction.type === "attack" ? { target: resolvedAction.target } : resolvedAction.type === "turn" ? { direction: resolvedAction.direction } : {},
        result,
        llm_reasoning: reasoning || null,
        raw_llm_response: rawResponse
      }]);
      await syncAgentStates(client, gameId, state.agents);
      await client.realtime.publish(`game:${gameId}`, "turn_completed", {
        agentId: turnAgent.agentId,
        action: resolvedAction,
        result,
        reasoning: reasoning || null,
        agents: state.agents.map(toPublicAgent)
      });
      if (result.type === "attack" && result.targetEliminated) {
        await client.realtime.publish(`game:${gameId}`, "agent_eliminated", {
          agentId: result.target,
          eliminatedBy: turnAgent.agentId
        });
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
