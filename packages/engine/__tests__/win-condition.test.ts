import { describe, it, expect } from 'vitest';
import { checkWinCondition } from '../src/win-condition.js';
import { createInitialState, updateAgent, eliminateAgent } from '../src/state.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';
import type { GameState } from '../src/types.js';

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialState(DEFAULT_GAME_CONFIG),
  ...overrides,
});

describe('checkWinCondition', () => {
  it('returns not over when all 3 agents alive and round < max', () => {
    const state = makeState({ round: 5 });
    const result = checkWinCondition(state);
    expect(result.gameOver).toBe(false);
    expect(result.result).toBeNull();
    expect(result.winnerAgentId).toBeNull();
  });

  it('returns elimination win when 1 agent alive', () => {
    const state = makeState({ round: 10 });
    let agents = eliminateAgent(state.agents, 'sonnet', 8);
    agents = eliminateAgent(agents, 'haiku', 10);
    const result = checkWinCondition({ ...state, agents });
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('elimination');
    expect(result.winnerAgentId).toBe('opus');
  });

  it('returns draw when 0 agents alive (mutual kill)', () => {
    const state = makeState({ round: 10 });
    let agents = eliminateAgent(state.agents, 'opus', 10);
    agents = eliminateAgent(agents, 'sonnet', 10);
    agents = eliminateAgent(agents, 'haiku', 10);
    const result = checkWinCondition({ ...state, agents });
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('draw');
    expect(result.winnerAgentId).toBeNull();
  });

  it('returns highest_hp win at max rounds', () => {
    const state = makeState({ round: 30 });
    // opus: 25, sonnet: 20, haiku: 15 (default HPs)
    const result = checkWinCondition(state);
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('highest_hp');
    expect(result.winnerAgentId).toBe('opus');
  });

  it('returns draw at max rounds when HP tied', () => {
    const state = makeState({ round: 30 });
    let agents = updateAgent(state.agents, 'opus', { hp: 10 });
    agents = updateAgent(agents, 'sonnet', { hp: 10 });
    agents = updateAgent(agents, 'haiku', { hp: 10 });
    const result = checkWinCondition({ ...state, agents });
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('draw');
    expect(result.winnerAgentId).toBeNull();
  });

  it('returns highest_hp with 2 alive agents at max rounds', () => {
    const state = makeState({ round: 30 });
    let agents = eliminateAgent(state.agents, 'haiku', 15);
    // opus: 25, sonnet: 20
    const result = checkWinCondition({ ...state, agents });
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('highest_hp');
    expect(result.winnerAgentId).toBe('opus');
  });

  it('returns draw with 2 alive agents with same HP at max rounds', () => {
    const state = makeState({ round: 30 });
    let agents = eliminateAgent(state.agents, 'haiku', 15);
    agents = updateAgent(agents, 'opus', { hp: 10 });
    agents = updateAgent(agents, 'sonnet', { hp: 10 });
    const result = checkWinCondition({ ...state, agents });
    expect(result.gameOver).toBe(true);
    expect(result.result).toBe('draw');
    expect(result.winnerAgentId).toBeNull();
  });
});
