import type {
  AgentId,
  AgentAction,
  AgentState,
  Direction,
  SharedGameView,
  PersonalAgentView,
} from './types.js';
import { AGENT_PERSONALITIES } from './game-config.js';

const DIRECTION_NAMES: Record<string, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
};

export function buildSystemPrompt(agentId: AgentId): string {
  return `You are playing Civil-AI-zation, a turn-based arena battle game on a 3x3 grid.

OBJECTIVE:
SURVIVE and ELIMINATE opponents. Win by being the last agent standing, or having the highest HP at round 30.

=== COORDINATE SYSTEM ===
The grid uses standard 2D array coordinates:
- (0,0) is TOP-LEFT corner
- X increases LEFT to RIGHT: 0 → 1 → 2
- Y increases TOP to BOTTOM: 0 → 1 → 2

CRITICAL: To find relative position between two points:
- Compare X values: smaller X = more LEFT, larger X = more RIGHT
- Compare Y values: smaller Y = more UP/TOP, larger Y = more DOWN/BOTTOM

Example: You are at (2,1), opponent at (0,1)
- Same Y (both at 1) = same horizontal row
- Your X=2, opponent X=0 → opponent is 2 cells to your LEFT
- To reach: move left to (1,1), then move left again to (0,1)

=== ACTIONS (each costs 1 EP) ===
1. move(direction): Move 1 cell in the specified direction AND automatically face that direction
   - up: YOUR position (X, Y-1), face up. If at (0,1) → move to (0,0)
   - down: YOUR position (X, Y+1), face down. If at (0,1) → move to (0,2)
   - left: YOUR position (X-1, Y), face left. If at (1,1) → move to (0,1)
   - right: YOUR position (X+1, Y), face right. If at (0,1) → move to (1,1)
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
   - Gain +1 EP next turn (so you'll have 2 EP total next turn)
   - Cost: 0 EP
   - Use when low on energy or in defensive position

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
- Start each turn with 1 EP (or 2 EP if you rested last turn)
- You MUST have enough EP to perform an action
- Moving is efficient: 1 EP to move AND turn (2-in-1 action!)
- Turning separately costs 1 EP, so prefer moving when possible

=== STRATEGY TIPS ===
1. POSITIONING: Get behind opponents for 7 damage backstabs (2.5x normal damage!)
2. EFFICIENCY: Use move() instead of turn() when possible (free facing change)
3. DEFENSE: If in danger of being attacked:
   - Move away to safety (costs 1 EP)
   - Turn to face attacker (reduces damage from 7→2 if they hit your back)
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

export function buildUserMessage(
  sharedView: SharedGameView,
  personalView: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  validMoveDirections: readonly Direction[],
): string {
  const grid = buildGridVisual(aliveAgents, sharedView.mapWidth, sharedView.mapHeight);

  const agentLines = sharedView.agents
    .map((a) => {
      const youTag = a.agentId === personalView.agentId ? ' [YOU]' : '';

      // Calculate relative position for opponents
      let relativePos = '';
      if (a.agentId !== personalView.agentId) {
        const dx = a.position.x - personalView.position.x;
        const dy = a.position.y - personalView.position.y;
        const horizontal = dx < 0 ? `${Math.abs(dx)} LEFT` : dx > 0 ? `${dx} RIGHT` : 'SAME column';
        const vertical = dy < 0 ? `${Math.abs(dy)} UP` : dy > 0 ? `${dy} DOWN` : 'SAME row';
        relativePos = ` | Relative to you: ${horizontal}, ${vertical}`;
      }

      return `- ${a.agentId}: position (${a.position.x},${a.position.y}), HP ${a.hp}, facing ${DIRECTION_NAMES[a.orientation]}${youTag}${relativePos}`;
    })
    .join('\n');

  const eliminatedLines =
    sharedView.eliminatedAgents.length > 0
      ? sharedView.eliminatedAgents
          .map((a) => `- ${a.agentId}: eliminated in round ${a.eliminatedAtRound}`)
          .join('\n')
      : 'None';

  const adjacentInfo = buildAdjacentInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight);
  const surroundingInfo = buildSurroundingInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight);

  const memoryLines =
    personalView.memory.length > 0
      ? personalView.memory.join('\n')
      : 'No memories yet.';

  const summaryText =
    sharedView.previousRoundSummary ?? 'First round - no previous summary.';

  return `=== ROUND ${sharedView.round} ===

BOARD STATE (${sharedView.mapWidth}x${sharedView.mapHeight} grid):
${grid}

ALIVE AGENTS:
${agentLines}

ELIMINATED AGENTS:
${eliminatedLines}

YOUR STATUS:
- HP: ${personalView.hp}, EP: ${personalView.ep}, Position: (${personalView.position.x},${personalView.position.y}), Facing: ${DIRECTION_NAMES[personalView.orientation]}
- SURROUNDING: ${surroundingInfo}
- Adjacent cells: ${adjacentInfo}
- Valid moves: ${validMoveDirections.length > 0 ? validMoveDirections.map((d) => `${d} (${DIRECTION_NAMES[d]})`).join(', ') : 'None — you are boxed in'}
- ${buildAttackTargetInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight)}

YOUR MEMORY:
${memoryLines}

PREVIOUS ROUND SUMMARY:
${summaryText}

Choose your action.`;
}

export interface ToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export function buildToolDefinitions(
  aliveOpponents: readonly AgentId[],
  validMoveDirections: readonly Direction[],
): readonly ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (validMoveDirections.length > 0) {
    tools.push({
      type: 'function',
      function: {
        name: 'move',
        description:
          'Move 1 cell in a cardinal direction. Costs 1 EP. Sets your facing to that direction. Cannot move outside map bounds or onto a cell occupied by another agent. Only the listed directions are valid this turn.',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: [...validMoveDirections],
              description: 'Direction to move',
            },
          },
          required: ['direction'],
        },
      },
    });
  }

  if (aliveOpponents.length > 0) {
    tools.push({
      type: 'function',
      function: {
        name: 'attack',
        description:
          'Attack an adjacent agent in your facing direction. Costs 1 EP. The target must be directly in the cell you are facing — you cannot attack diagonally, at range, or behind you. Use turn(direction) to change facing first if needed. Damage depends on how you hit relative to the target\'s facing: front=2, side=5, back=7.',
        parameters: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: [...aliveOpponents],
              description: 'ID of the agent to attack',
            },
          },
          required: ['target'],
        },
      },
    });
  }

  tools.push(
    {
      type: 'function',
      function: {
        name: 'turn',
        description:
          'Change your facing direction without moving. Costs 1 EP. Does not change your position. Use this to face a target before attacking, or to reorient defensively.',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['up', 'down', 'left', 'right'],
              description: 'Direction to face',
            },
          },
          required: ['direction'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'rest',
        description: 'Skip your action this turn. Costs 0 EP. You will gain +1 bonus EP next turn (giving you 2 EP total).',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
  );

  return tools;
}

export function parseToolCall(toolCall: {
  function: { name: string; arguments: string };
}): AgentAction {
  try {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

    switch (name) {
      case 'move': {
        const dir = args['direction'];
        if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') {
          return { type: 'move', direction: dir };
        }
        return { type: 'rest' };
      }
      case 'attack': {
        const target = args['target'];
        // Validate target is a valid AgentId
        if (target && typeof target === 'string' && target in AGENT_PERSONALITIES) {
          return { type: 'attack', target: target as AgentId };
        }
        return { type: 'rest' };
      }
      case 'turn': {
        const turnDir = args['direction'];
        if (turnDir === 'up' || turnDir === 'down' || turnDir === 'left' || turnDir === 'right') {
          return { type: 'turn', direction: turnDir };
        }
        return { type: 'rest' };
      }
      case 'rest':
        return { type: 'rest' };
      default:
        return { type: 'rest' };
    }
  } catch {
    return { type: 'rest' };
  }
}

function buildGridVisual(
  agents: readonly AgentState[],
  width: number,
  height: number,
): string {
  const dirArrow: Record<string, string> = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };

  const lines: string[] = [];
  lines.push('  ' + Array.from({ length: width }, (_, i) => i).join(' '));
  for (let y = 0; y < height; y++) {
    let row = `${y} `;
    for (let x = 0; x < width; x++) {
      const agent = agents.find(
        (a) => a.status === 'alive' && a.position.x === x && a.position.y === y,
      );
      if (agent) {
        row += agent.agentId[0]!.toUpperCase() + dirArrow[agent.orientation];
      } else {
        row += '. ';
      }
    }
    lines.push(row.trimEnd());
  }
  return lines.join('\n');
}

function buildSurroundingInfo(
  personal: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  width: number,
  height: number,
): string {
  const dirs = ['up', 'down', 'left', 'right'] as const;
  const deltas: Record<string, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 },
  };

  const surrounding: Record<string, string> = {};

  for (const d of dirs) {
    const delta = deltas[d]!;
    const nx = personal.position.x + delta.dx;
    const ny = personal.position.y + delta.dy;

    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      surrounding[d] = 'Wall';
    } else {
      const occupant = aliveAgents.find(
        (a) => a.status === 'alive' && a.agentId !== personal.agentId && a.position.x === nx && a.position.y === ny,
      );
      surrounding[d] = occupant ? occupant.agentId : 'Empty';
    }
  }

  return `{ up: "${surrounding.up}", down: "${surrounding.down}", left: "${surrounding.left}", right: "${surrounding.right}" }`;
}

function buildAdjacentInfo(
  personal: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  width: number,
  height: number,
): string {
  const dirs = ['up', 'down', 'left', 'right'] as const;
  const deltas: Record<string, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 },
  };

  return dirs
    .map((d) => {
      const delta = deltas[d]!;
      const nx = personal.position.x + delta.dx;
      const ny = personal.position.y + delta.dy;
      const facingTag = d === personal.orientation ? ' [FACING - can attack here]' : '';
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return `${d}=wall${facingTag}`;
      }
      const occupant = aliveAgents.find(
        (a) => a.status === 'alive' && a.position.x === nx && a.position.y === ny,
      );
      if (occupant) {
        return `${d}=(${nx},${ny}) ${occupant.agentId}${facingTag}`;
      }
      return `${d}=(${nx},${ny}) empty${facingTag}`;
    })
    .join(', ');
}

function buildAttackTargetInfo(
  personal: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  width: number,
  height: number,
): string {
  const deltas: Record<string, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 },
  };
  const delta = deltas[personal.orientation]!;
  const fx = personal.position.x + delta.dx;
  const fy = personal.position.y + delta.dy;

  if (fx < 0 || fx >= width || fy < 0 || fy >= height) {
    return `ATTACK TARGET: You are facing a wall (${DIRECTION_NAMES[personal.orientation]}). You cannot attack. Use turn(direction) to face a different direction, or move.`;
  }

  const target = aliveAgents.find(
    (a) => a.status === 'alive' && a.agentId !== personal.agentId && a.position.x === fx && a.position.y === fy,
  );

  if (target) {
    return `ATTACK TARGET: You can attack ${target.agentId} at (${fx},${fy}) — they are directly in front of you.`;
  }

  return `ATTACK TARGET: Cell (${fx},${fy}) in front of you is empty. No one to attack. Use turn(direction) to change facing, or move closer.`;
}
