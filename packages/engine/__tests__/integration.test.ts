import { describe, it, expect } from 'vitest';
import { createInitialState, buildSharedView, buildPersonalView } from '../src/state.js';
import { processRound } from '../src/round.js';
import type { ActionDecider } from '../src/round.js';
import { checkWinCondition } from '../src/win-condition.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';
import { buildSystemPrompt, buildUserMessage, buildToolDefinitions, parseToolCall } from '../src/agent-prompt.js';
import { buildSummaryPrompt } from '../src/summary.js';
import type { GameState } from '../src/types.js';

describe('Integration: Full game simulation', () => {
  it('V1: runs a full 30-round game to completion', () => {
    const decider: ActionDecider = () => ({ type: 'rest' });
    let state = createInitialState(DEFAULT_GAME_CONFIG);

    for (let i = 0; i < 30; i++) {
      state = processRound(state, decider);
      const win = checkWinCondition(state);
      if (win.gameOver) break;
    }

    expect(state.round).toBe(30);
    const win = checkWinCondition(state);
    expect(win.gameOver).toBe(true);
  });

  it('V2: turn order respects speed (haiku > sonnet > opus)', () => {
    const turnLog: string[] = [];
    const decider: ActionDecider = (agentId) => {
      turnLog.push(agentId);
      return { type: 'rest' };
    };

    let state = createInitialState(DEFAULT_GAME_CONFIG);
    state = processRound(state, decider);

    expect(turnLog).toEqual(['haiku', 'sonnet', 'opus']);
  });

  it('V3: orientation damage values are front=2, side=5, back=7', () => {
    // Set up agents adjacent for attack testing
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 2, hp: 25, position: { x: 2, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 2, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 1, hp: 15, position: { x: 4, y: 4 }, orientation: 'E' as const },
      ],
    };

    // opus attacks sonnet from below: direction = N, sonnet faces N = front → 2 damage
    const decider: ActionDecider = (agentId) => {
      if (agentId === 'opus') return { type: 'attack', target: 'sonnet' };
      return { type: 'rest' };
    };

    let state = createInitialState(config);
    state = processRound(state, decider);

    const attackTurn = state.turnRecords.find(
      (t) => t.agentId === 'opus' && t.result.type === 'attack',
    );
    expect(attackTurn).toBeDefined();
    if (attackTurn?.result.type === 'attack') {
      expect(attackTurn.result.hitZone).toBe('front');
      expect(attackTurn.result.damage).toBe(2);
    }
  });

  it('V4: no agent moves off-grid or overlaps', () => {
    // Agents move around randomly, validating positions each round
    let moveCount = 0;
    const decider: ActionDecider = (agentId, _shared, personal) => {
      const directions = ['N', 'S', 'E', 'W'] as const;
      const dir = directions[moveCount % 4]!;
      moveCount++;
      return { type: 'move', direction: dir };
    };

    let state = createInitialState(DEFAULT_GAME_CONFIG);
    for (let i = 0; i < 10; i++) {
      state = processRound(state, decider);

      // Check all alive agents are in bounds
      const alive = state.agents.filter((a) => a.status === 'alive');
      alive.forEach((a) => {
        expect(a.position.x).toBeGreaterThanOrEqual(0);
        expect(a.position.x).toBeLessThan(5);
        expect(a.position.y).toBeGreaterThanOrEqual(0);
        expect(a.position.y).toBeLessThan(5);
      });

      // Check no two alive agents overlap
      for (let j = 0; j < alive.length; j++) {
        for (let k = j + 1; k < alive.length; k++) {
          expect(
            alive[j]!.position.x !== alive[k]!.position.x ||
            alive[j]!.position.y !== alive[k]!.position.y,
          ).toBe(true);
        }
      }
    }
  });

  it('V5: elimination at HP 0', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 25, position: { x: 0, y: 0 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 20, position: { x: 1, y: 1 }, orientation: 'S' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 7, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    // haiku faces S (away from sonnet who is at 1,1 = South of haiku)
    // sonnet attacks haiku: direction from (1,1) to (1,0) = N, haiku faces S = opposite = back = 7 damage
    // haiku has 7 HP → eliminated
    const decider: ActionDecider = (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    };

    let state = createInitialState(config);
    state = processRound(state, decider);

    const haiku = state.agents.find((a) => a.agentId === 'haiku')!;
    expect(haiku.hp).toBe(0);
    expect(haiku.status).toBe('eliminated');
  });

  it('V6: memory accumulates correctly with FIFO cap at 10', () => {
    const decider: ActionDecider = () => ({ type: 'rest' });
    let state = createInitialState(DEFAULT_GAME_CONFIG);

    for (let i = 0; i < 15; i++) {
      state = processRound(state, decider);
    }

    state.agents.forEach((a) => {
      expect(a.memory).toHaveLength(10);
      // Oldest memory should be from round 6 (rounds 1-5 trimmed)
      expect(a.memory[0]).toContain('Round 6');
      expect(a.memory[9]).toContain('Round 15');
    });
  });

  it('V7: invalid tool calls fall back to rest', () => {
    const decider: ActionDecider = (agentId) => {
      if (agentId === 'haiku') {
        // haiku is at (2,0), try to move North = off grid
        return { type: 'move', direction: 'N' };
      }
      return { type: 'rest' };
    };

    let state = createInitialState(DEFAULT_GAME_CONFIG);
    state = processRound(state, decider);

    const haikuTurn = state.turnRecords.find(
      (t) => t.agentId === 'haiku' && t.roundNumber === 1,
    )!;
    expect(haikuTurn.result.type).toBe('invalid');
    if (haikuTurn.result.type === 'invalid') {
      expect(haikuTurn.result.fallbackAction.type).toBe('rest');
    }
  });

  it('V8: game ends at elimination (last standing)', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 2, position: { x: 1, y: 2 }, orientation: 'S' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 1, y: 1 }, orientation: 'S' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 2, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    // sonnet attacks both: haiku is at (1,0) adjacent N, opus at (1,2) adjacent S
    // haiku (speed 4) goes first → rest. sonnet (speed 3) attacks haiku → back hit → 7 dmg → eliminated
    // Then next round, sonnet attacks opus → back hit → eliminated
    const decider: ActionDecider = (agentId, _shared, personal) => {
      if (agentId === 'sonnet') {
        // Attack whoever is adjacent and alive
        return { type: 'attack', target: 'haiku' };
      }
      return { type: 'rest' };
    };

    let state = createInitialState(config);
    // Round 1: sonnet eliminates haiku (back hit, 7 > 2 HP)
    state = processRound(state, decider);

    // Now switch sonnet to attack opus
    const decider2: ActionDecider = (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'opus' };
      return { type: 'rest' };
    };
    state = processRound(state, decider2);

    const win = checkWinCondition(state);
    expect(win.gameOver).toBe(true);
    expect(win.result).toBe('elimination');
    expect(win.winnerAgentId).toBe('sonnet');
    expect(state.round).toBe(2);
  });
});

describe('Integration: Agent prompt building', () => {
  it('builds valid system prompt', () => {
    const prompt = buildSystemPrompt('opus');
    expect(prompt).toContain('Civil-AI-zation');
    expect(prompt).toContain('Opus');
    expect(prompt).toContain('5x5');
  });

  it('builds valid user message', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const sharedView = buildSharedView(state);
    const personalView = buildPersonalView(state, 'opus');
    const aliveAgents = state.agents.filter((a) => a.status === 'alive');

    const message = buildUserMessage(sharedView, personalView, aliveAgents);
    expect(message).toContain('ROUND');
    expect(message).toContain('YOUR STATUS');
    expect(message).toContain('opus');
  });

  it('builds tool definitions with alive opponents', () => {
    const tools = buildToolDefinitions(['sonnet', 'haiku']);
    expect(tools).toHaveLength(3); // move, attack, rest
    const attack = tools.find((t) => t.function.name === 'attack')!;
    expect(attack.function.parameters).toBeDefined();
  });

  it('omits attack tool when no opponents', () => {
    const tools = buildToolDefinitions([]);
    expect(tools).toHaveLength(2); // move, rest only
    expect(tools.find((t) => t.function.name === 'attack')).toBeUndefined();
  });
});

describe('Integration: parseToolCall', () => {
  it('parses move action', () => {
    const action = parseToolCall({
      function: { name: 'move', arguments: '{"direction":"N"}' },
    });
    expect(action).toEqual({ type: 'move', direction: 'N' });
  });

  it('parses attack action', () => {
    const action = parseToolCall({
      function: { name: 'attack', arguments: '{"target":"sonnet"}' },
    });
    expect(action).toEqual({ type: 'attack', target: 'sonnet' });
  });

  it('parses rest action', () => {
    const action = parseToolCall({
      function: { name: 'rest', arguments: '{}' },
    });
    expect(action).toEqual({ type: 'rest' });
  });

  it('returns rest for unknown function name', () => {
    const action = parseToolCall({
      function: { name: 'unknown', arguments: '{}' },
    });
    expect(action).toEqual({ type: 'rest' });
  });

  it('returns rest for invalid JSON', () => {
    const action = parseToolCall({
      function: { name: 'move', arguments: 'not json' },
    });
    expect(action).toEqual({ type: 'rest' });
  });

  it('returns rest for invalid direction', () => {
    const action = parseToolCall({
      function: { name: 'move', arguments: '{"direction":"UP"}' },
    });
    expect(action).toEqual({ type: 'rest' });
  });
});

describe('Integration: Summary prompt building', () => {
  it('builds summary prompt from turn records', () => {
    const decider: ActionDecider = () => ({ type: 'rest' });
    let state = createInitialState(DEFAULT_GAME_CONFIG);
    state = processRound(state, decider);

    const roundTurns = state.turnRecords.filter((t) => t.roundNumber === 1);
    const { system, user } = buildSummaryPrompt(1, roundTurns, state.agents);

    expect(system).toContain('commentator');
    expect(user).toContain('Round 1');
    expect(user).toContain('rested');
  });
});
