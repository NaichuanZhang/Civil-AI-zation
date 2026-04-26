import { describe, it, expect } from 'vitest';
import { processRound } from '../src/round.js';
import type { ActionDecider } from '../src/round.js';
import { createInitialState, updateAgent } from '../src/state.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';
import type { GameState } from '../src/types.js';

describe('processRound', () => {
  const deciderAllRest: ActionDecider = () => ({ type: 'rest' });

  it('increments round number', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const newState = processRound(state, deciderAllRest);
    expect(newState.round).toBe(1);
  });

  it('records turn for each alive agent', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const newState = processRound(state, deciderAllRest);
    const roundTurns = newState.turnRecords.filter((t) => t.roundNumber === 1);
    expect(roundTurns).toHaveLength(3);
  });

  it('turn order follows speed: haiku(4) > sonnet(3) > opus(2)', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const newState = processRound(state, deciderAllRest);
    const roundTurns = newState.turnRecords.filter((t) => t.roundNumber === 1);
    expect(roundTurns[0]!.agentId).toBe('haiku');
    expect(roundTurns[1]!.agentId).toBe('sonnet');
    expect(roundTurns[2]!.agentId).toBe('opus');
  });

  it('earlier agent move affects later agent state', () => {
    // haiku moves S from (1,0) to (1,1)
    // sonnet at (2,1) tries to move W to (1,1) — blocked by haiku
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 25, position: { x: 0, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 20, position: { x: 2, y: 1 }, orientation: 'W' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 15, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    const decider: ActionDecider = (agentId) => {
      if (agentId === 'haiku') return { type: 'move', direction: 'S' };
      if (agentId === 'sonnet') return { type: 'move', direction: 'W' };
      return { type: 'rest' };
    };

    const state = createInitialState(config);
    const newState = processRound(state, decider);
    const sonnetTurn = newState.turnRecords.find(
      (t) => t.roundNumber === 1 && t.agentId === 'sonnet',
    )!;
    expect(sonnetTurn.result.type).toBe('invalid');
  });

  it('updates memory after each action', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const newState = processRound(state, deciderAllRest);
    newState.agents.forEach((a) => {
      expect(a.memory).toHaveLength(1);
    });
  });

  it('target agent gets memory entry when attacked', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      agents: [
        { agentId: 'opus' as const, modelId: 'test', speed: 1, hp: 25, position: { x: 0, y: 2 }, orientation: 'N' as const },
        { agentId: 'sonnet' as const, modelId: 'test', speed: 3, hp: 20, position: { x: 1, y: 1 }, orientation: 'N' as const },
        { agentId: 'haiku' as const, modelId: 'test', speed: 4, hp: 15, position: { x: 1, y: 0 }, orientation: 'S' as const },
      ],
    };

    const decider: ActionDecider = (agentId) => {
      if (agentId === 'sonnet') return { type: 'attack', target: 'haiku' };
      return { type: 'rest' };
    };

    const state = createInitialState(config);
    const newState = processRound(state, decider);

    const haiku = newState.agents.find((a) => a.agentId === 'haiku')!;
    expect(haiku.memory.some((m) => m.includes('sonnet attacked me'))).toBe(true);

    const sonnet = newState.agents.find((a) => a.agentId === 'sonnet')!;
    expect(sonnet.memory.some((m) => m.includes('I attacked haiku'))).toBe(true);
  });

  it('skips eliminated agents', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const agents = updateAgent(state.agents, 'haiku', {
      status: 'eliminated',
      eliminatedAtRound: 0,
    });
    const modifiedState: GameState = { ...state, agents };

    const newState = processRound(modifiedState, deciderAllRest);
    const roundTurns = newState.turnRecords.filter((t) => t.roundNumber === 1);
    expect(roundTurns).toHaveLength(2);
    expect(roundTurns.map((t) => t.agentId)).not.toContain('haiku');
  });
});
