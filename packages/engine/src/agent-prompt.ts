import type {
  AgentId,
  AgentAction,
  AgentState,
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
  return `You are playing Civil-AI-zation, a turn-based arena battle game on a 5x5 grid.

RULES:
- You have 1 EP per turn (2 if you rested last turn). Each action costs 1 EP.
- move(direction): Move 1 cell N/S/E/W. Sets your facing to that direction.
- attack(target): Attack an adjacent agent. Damage depends on orientation:
  - Front (target faces you): 2 damage
  - Side (perpendicular): 5 damage
  - Back (target faces away): 7 damage
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
): readonly ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'move',
        description:
          'Move 1 cell in a cardinal direction. Sets your facing to that direction.',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['N', 'S', 'E', 'W'],
              description: 'Direction to move',
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
        description: 'Rest this turn. Gain +1 EP next turn.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
  ];

  if (aliveOpponents.length > 0) {
    tools.splice(1, 0, {
      type: 'function',
      function: {
        name: 'attack',
        description:
          'Attack an adjacent agent. Damage depends on your approach vs their facing.',
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
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return `${d}=wall`;
      }
      const occupant = aliveAgents.find(
        (a) => a.status === 'alive' && a.position.x === nx && a.position.y === ny,
      );
      if (occupant) {
        return `${d}=(${nx},${ny}) ${occupant.agentId}`;
      }
      return `${d}=(${nx},${ny}) empty`;
    })
    .join(', ');
}
