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
- Example: Start with 1 EP → rest → next turn 3 EP (1 current + 1 base + 1 bonus, capped at 3)

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

Choose your actions for this turn. You can perform MULTIPLE actions in sequence until you run out of EP or choose to rest. Plan your sequence carefully based on available EP. Consider: Can I move then attack? Should I reposition first? Am I vulnerable?`;
}

export function buildUserMessage(
  sharedView: SharedGameView,
  personalView: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  validMoveDirections: readonly Direction[],
): string {
  const grid = buildGridVisual(aliveAgents, sharedView.chests, sharedView.mapWidth, sharedView.mapHeight);

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

  const chestsText =
    sharedView.chests.length > 0
      ? sharedView.chests
          .map((c) => `- Chest at (${c.position.x},${c.position.y}) - Contents unknown`)
          .join('\n')
      : 'None currently on the map.';

  return `=== ROUND ${sharedView.round} ===

━━━ 🔍 YOUR IMMEDIATE SURROUNDINGS (ONLY USE THIS FOR SPATIAL DECISIONS) ━━━
${surroundingInfo}

⚠️ CRITICAL RULES FOR USING SURROUNDING:
1. ONLY agents shown in SURROUNDING are adjacent (1 cell away) - you can attack them
2. Agents NOT in SURROUNDING are 2+ cells away - you CANNOT attack them yet
3. DO NOT calculate directions from coordinates - ONLY use SURROUNDING field
4. If SURROUNDING shows "Empty" for all 4 directions, NO agents are adjacent to you

Example: If SURROUNDING = { up: "Empty", down: "Empty", left: "opus", right: "Empty" }
→ ONLY opus is adjacent (to your left)
→ All other agents are far away (2+ cells)
→ To attack opus: turn(left) then attack(opus)

BOARD STATE (${sharedView.mapWidth}x${sharedView.mapHeight} grid):
${grid}

ALIVE AGENTS (WARNING: These positions are for context only! Use SURROUNDING above for adjacency):
${agentLines}

ELIMINATED AGENTS:
${eliminatedLines}

TREASURE CHESTS:
${chestsText}

YOUR STATUS:
- HP: ${personalView.hp}, EP: ${personalView.ep}, Position: (${personalView.position.x},${personalView.position.y}), Facing: ${DIRECTION_NAMES[personalView.orientation]}

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
  return [{
    type: 'function',
    function: {
      name: 'choose_actions',
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
        type: 'object',
        properties: {
          reasoning: {
            type: 'string',
            description: 'Your strategic thinking and reasoning about the current situation before choosing actions. Analyze threats, opportunities, and explain your plan.',
          },
          actions: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                ...validMoveDirections.map(d => `move:${d}`),
                ...(aliveOpponents.length > 0 ? aliveOpponents.map(t => `attack:${t}`) : []),
                'turn:up',
                'turn:down',
                'turn:left',
                'turn:right',
                'rest',
              ],
            },
            description: 'Sequence of actions to perform. Format: "action:param" or "rest". Example: ["move:left", "attack:opus"]',
          },
        },
        required: ['reasoning', 'actions'],
      },
    },
  }];
}

export function parseToolCall(toolCall: {
  function: { name: string; arguments: string };
}): AgentAction[] {
  try {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

    if (name === 'choose_actions') {
      const actions = args['actions'];
      if (!Array.isArray(actions)) {
        return [{ type: 'rest' }];
      }

      const parsedActions: AgentAction[] = [];

      for (const actionStr of actions) {
        if (typeof actionStr !== 'string') continue;

        if (actionStr === 'rest') {
          parsedActions.push({ type: 'rest' });
          break; // Rest ends the sequence
        }

        const [actionType, param] = actionStr.split(':');

        if (actionType === 'move') {
          if (param === 'up' || param === 'down' || param === 'left' || param === 'right') {
            parsedActions.push({ type: 'move', direction: param });
          }
        } else if (actionType === 'attack') {
          if (param && param in AGENT_PERSONALITIES) {
            parsedActions.push({ type: 'attack', target: param as AgentId });
          }
        } else if (actionType === 'turn') {
          if (param === 'up' || param === 'down' || param === 'left' || param === 'right') {
            parsedActions.push({ type: 'turn', direction: param });
          }
        }
      }

      return parsedActions.length > 0 ? parsedActions : [{ type: 'rest' }];
    }

    // Fallback to old single-action format for backwards compatibility
    switch (name) {
      case 'move': {
        const dir = args['direction'];
        if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') {
          return [{ type: 'move', direction: dir }];
        }
        return [{ type: 'rest' }];
      }
      case 'attack': {
        const target = args['target'];
        if (target && typeof target === 'string' && target in AGENT_PERSONALITIES) {
          return [{ type: 'attack', target: target as AgentId }];
        }
        return [{ type: 'rest' }];
      }
      case 'turn': {
        const turnDir = args['direction'];
        if (turnDir === 'up' || turnDir === 'down' || turnDir === 'left' || turnDir === 'right') {
          return [{ type: 'turn', direction: turnDir }];
        }
        return [{ type: 'rest' }];
      }
      case 'rest':
        return [{ type: 'rest' }];
      default:
        return [{ type: 'rest' }];
    }
  } catch {
    return [{ type: 'rest' }];
  }
}

function buildGridVisual(
  agents: readonly AgentState[],
  chests: readonly { position: { x: number; y: number } }[],
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
        const chest = chests.find((c) => c.position.x === x && c.position.y === y);
        if (chest) {
          row += 'C ';
        } else {
          row += '. ';
        }
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
