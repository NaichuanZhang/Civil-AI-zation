import type {
  AgentId,
  AgentAction,
  AgentState,
  Direction,
  SharedGameView,
  PersonalAgentView,
} from './types.js';

const AGENT_PERSONALITIES: Record<AgentId, string> = {
  opus: 'You are Opus, a strategic and patient warrior. You think several moves ahead, value positioning, and prefer to attack from advantageous angles.',
  sonnet: 'You are Sonnet, a balanced and adaptive fighter. You assess the situation pragmatically, adapting your strategy to the current board state.',
  haiku: 'You are Haiku, an aggressive and impulsive combatant. You favor direct action, closing distance quickly and attacking whenever possible.',
};

const DIRECTION_NAMES: Record<string, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
};

export function buildSystemPrompt(agentId: AgentId): string {
  return `You are playing Civil-AI-zation, a turn-based arena battle game on a 3x3 grid.

OBJECTIVE:
Survive. Be the last agent standing. Eliminate opponents by reducing their HP to 0 through attacks, or outlast them to have the highest HP when the game ends at round 30.

RULES:
- You have 1 EP per turn (2 if you rested last turn). Each action costs 1 EP.
- move(direction): Move 1 cell N/S/E/W. Sets your facing to that direction.
- attack(target): Attack the agent directly in front of you (the cell you are facing). Damage depends on orientation:
  - Front (target faces you): 2 damage
  - Side (perpendicular): 5 damage
  - Back (target faces away): 7 damage
  You must be facing the target to attack. Use move to reposition and change facing first.
- turn(direction): Change your facing direction without moving. Costs 1 EP.
- rest(): Skip turn, gain +1 EP next turn.
- You are eliminated if HP reaches 0.
- Game ends when 1 agent remains or after round 30 (highest HP wins).

COORDINATE SYSTEM:
- (0,0) is top-left. X increases right, Y increases down.
- North = -Y, South = +Y, West = -X, East = +X.

YOUR IDENTITY:
${AGENT_PERSONALITIES[agentId]}

Choose ONE action. Think about positioning, opponent orientation, and survival.`;
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
      return `- ${a.agentId}: position (${a.position.x},${a.position.y}), HP ${a.hp}, facing ${DIRECTION_NAMES[a.orientation]}${youTag}`;
    })
    .join('\n');

  const eliminatedLines =
    sharedView.eliminatedAgents.length > 0
      ? sharedView.eliminatedAgents
          .map((a) => `- ${a.agentId}: eliminated in round ${a.eliminatedAtRound}`)
          .join('\n')
      : 'None';

  const adjacentInfo = buildAdjacentInfo(personalView, aliveAgents, sharedView.mapWidth, sharedView.mapHeight);

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
              enum: ['N', 'S', 'E', 'W'],
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
        if (dir === 'N' || dir === 'S' || dir === 'E' || dir === 'W') {
          return { type: 'move', direction: dir };
        }
        return { type: 'rest' };
      }
      case 'attack': {
        const target = args['target'];
        if (target === 'opus' || target === 'sonnet' || target === 'haiku') {
          return { type: 'attack', target };
        }
        return { type: 'rest' };
      }
      case 'turn': {
        const turnDir = args['direction'];
        if (turnDir === 'N' || turnDir === 'S' || turnDir === 'E' || turnDir === 'W') {
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
    N: '↑',
    S: '↓',
    E: '→',
    W: '←',
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

function buildAdjacentInfo(
  personal: PersonalAgentView,
  aliveAgents: readonly AgentState[],
  width: number,
  height: number,
): string {
  const dirs = ['N', 'S', 'E', 'W'] as const;
  const deltas: Record<string, { dx: number; dy: number }> = {
    N: { dx: 0, dy: -1 },
    S: { dx: 0, dy: 1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
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
    N: { dx: 0, dy: -1 },
    S: { dx: 0, dy: 1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
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
