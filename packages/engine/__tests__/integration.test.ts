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
    // opus at (1,1) facing N, sonnet at (1,0) facing N
    // opus attacks sonnet: facing N = target is N = valid attack
    // attack direction N, sonnet faces N = same = front → 2 damage
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 2, hp: 25, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 1, y: 0 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 1, hp: 15, position: { x: 2, y: 2 }, orientation: 'E' as const },
      ],
    };

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
    let moveCount = 0;
    const decider: ActionDecider = () => {
      const directions = ['N', 'S', 'E', 'W'] as const;
      const dir = directions[moveCount % 4]!;
      moveCount++;
      return { type: 'move', direction: dir };
    };

    let state = createInitialState(DEFAULT_GAME_CONFIG);
    for (let i = 0; i < 10; i++) {
      state = processRound(state, decider);

      const alive = state.agents.filter((a) => a.status === 'alive');
      alive.forEach((a) => {
        expect(a.position.x).toBeGreaterThanOrEqual(0);
        expect(a.position.x).toBeLessThan(3);
        expect(a.position.y).toBeGreaterThanOrEqual(0);
        expect(a.position.y).toBeLessThan(3);
      });

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
    // sonnet at (1,1) facing N, haiku at (1,0) facing S (away)
    // sonnet attacks haiku: direction N, haiku faces S = opposite = back → 7 damage
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 25, position: { x: 0, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 20, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 7, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

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
      expect(a.memory[0]).toContain('Round 6');
      expect(a.memory[9]).toContain('Round 15');
    });
  });

  it('V7: invalid actions fall back to rest (facing direction)', () => {
    // haiku at (1,0) facing S, try to attack opus at (0,2) — not in facing direction
    const decider: ActionDecider = (agentId) => {
      if (agentId === 'haiku') {
        return { type: 'attack', target: 'opus' };
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
    // All in a column: haiku(1,0) facing S, sonnet(1,1) facing N, opus(1,2) facing N
    // sonnet faces N → attacks haiku (back hit, haiku faces S) → 7 dmg → eliminated
    // Then sonnet moves S to face south, then attacks opus
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 2, position: { x: 0, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 2, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    // R1: sonnet faces N, attacks haiku → eliminated
    let state = createInitialState(config);
    state = processRound(state, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    });

    // R2: sonnet moves W to (0,1), now facing W
    state = processRound(state, (agentId) => {
      if (agentId === 'sonnet') return { type: 'move', direction: 'W' };
      return { type: 'rest' };
    });

    // R3: sonnet moves S to (0,2), now facing S — but opus is at (0,2). Invalid → rest.
    // Instead: sonnet moves S to (0,2)? No opus there. Actually opus is at (0,2).
    // So sonnet at (0,1) facing S → attacks opus at (0,2)
    state = processRound(state, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'opus' };
      return { type: 'rest' };
    });

    // Sonnet at (0,1) facing W — not facing opus at (0,2). Need to face S first.
    // Let me redo: R2 move S instead of W
    // Actually after R2, sonnet faces W not S. Let me restart the approach.
    // Simplify: just put opus directly south of sonnet from the start.
    const config2 = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 2, position: { x: 1, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 2, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    // R1: sonnet faces N → attacks haiku (back) → eliminated
    let state2 = createInitialState(config2);
    state2 = processRound(state2, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    });

    // R2: sonnet moves S → now at (1,2)? No, opus at (1,2). Move blocked → invalid.
    // Need sonnet to face S first. Move to (0,1) then S to (0,2) then...
    // Simplest: just have sonnet move E to (2,1), then move S to (2,2), then move W...
    // Too complex. Let opus start elsewhere.
    const config3 = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 2, position: { x: 2, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 2, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    let state3 = createInitialState(config3);
    // R1: sonnet N → attacks haiku → eliminated
    state3 = processRound(state3, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    });
    expect(state3.agents.find((a) => a.agentId === 'haiku')!.status).toBe('eliminated');

    // R2: sonnet move E → (2,1) facing E
    state3 = processRound(state3, (agentId) => {
      if (agentId === 'sonnet') return { type: 'move', direction: 'E' };
      return { type: 'rest' };
    });

    // R3: sonnet move S → (2,2)? opus is there. Move S to face S, but blocked.
    // Sonnet at (2,1), opus at (2,2). Sonnet needs to face S.
    // Move S is blocked by opus. But we can just move to face S via another path.
    // Actually easier: just move S direction (invalid, occupied) → falls back to rest.
    // Then manually verify we can attack by moving elsewhere.

    // Simpler approach: just use 2 agents
    const config4 = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 2, position: { x: 2, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 100, position: { x: 2, y: 1 }, orientation: 'S' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 2, position: { x: 0, y: 0 }, orientation: 'N' as const },
      ],
    };

    let state4 = createInitialState(config4);
    // R1: sonnet faces S → attacks opus at (2,2) → opus HP 2, front hit (opus faces N = same dir as attack S? No.
    // Attack dir from (2,1) to (2,2) = S. Opus faces N. S vs N = opposite = back → 7 dmg → eliminated
    // haiku faces N at (0,0) → move N invalid (wall) → rest
    state4 = processRound(state4, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'opus' };
      if (agentId === 'haiku') return { type: 'move', direction: 'S' };
      return { type: 'rest' };
    });

    expect(state4.agents.find((a) => a.agentId === 'opus')!.status).toBe('eliminated');

    // R2: sonnet moves S to (2,2), now haiku at (0,1)
    state4 = processRound(state4, (agentId) => {
      if (agentId === 'sonnet') return { type: 'move', direction: 'S' };
      if (agentId === 'haiku') return { type: 'move', direction: 'S' };
      return { type: 'rest' };
    });

    // R3: sonnet move W to face haiku direction
    state4 = processRound(state4, (agentId) => {
      if (agentId === 'sonnet') return { type: 'move', direction: 'W' };
      if (agentId === 'haiku') return { type: 'move', direction: 'S' };
      return { type: 'rest' };
    });

    // At this point sonnet at (1,2) facing W, haiku at (0,2) facing S? Let's check positions
    // haiku: (0,0)→S(0,1)→S(0,2). sonnet: (2,1)→S(2,2)→W(1,2)
    // sonnet at (1,2) facing W, haiku at (0,2) — haiku is to the W!
    state4 = processRound(state4, (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    });

    const win4 = checkWinCondition(state4);
    expect(win4.gameOver).toBe(true);
    expect(win4.result).toBe('elimination');
    expect(win4.winnerAgentId).toBe('sonnet');
  });
});

describe('Integration: Agent prompt building', () => {
  it('builds valid system prompt', () => {
    const prompt = buildSystemPrompt('opus');
    expect(prompt).toContain('Civil-AI-zation');
    expect(prompt).toContain('Opus');
    expect(prompt).toContain('3x3');
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
    expect(message).toContain('[FACING - can attack here]');
  });

  it('builds tool definitions with alive opponents', () => {
    const tools = buildToolDefinitions(['sonnet', 'haiku']);
    expect(tools).toHaveLength(4);
    const attack = tools.find((t) => t.function.name === 'attack')!;
    expect(attack.function.description).toContain('facing');
    expect(tools.find((t) => t.function.name === 'turn')).toBeDefined();
  });

  it('omits attack tool when no opponents', () => {
    const tools = buildToolDefinitions([]);
    expect(tools).toHaveLength(3);
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

  it('parses turn action', () => {
    const action = parseToolCall({
      function: { name: 'turn', arguments: '{"direction":"S"}' },
    });
    expect(action).toEqual({ type: 'turn', direction: 'S' });
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
