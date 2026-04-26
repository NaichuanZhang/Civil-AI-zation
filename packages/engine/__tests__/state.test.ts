import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  updateAgent,
  eliminateAgent,
  buildSharedView,
  buildPersonalView,
} from '../src/state.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';

describe('createInitialState', () => {
  const state = createInitialState(DEFAULT_GAME_CONFIG);

  it('creates 3 agents', () => {
    expect(state.agents).toHaveLength(3);
  });

  it('sets round to 0', () => {
    expect(state.round).toBe(0);
  });

  it('sets status to running', () => {
    expect(state.status).toBe('running');
  });

  it('sets all agents to alive with correct HP', () => {
    const opus = state.agents.find((a) => a.agentId === 'opus')!;
    const sonnet = state.agents.find((a) => a.agentId === 'sonnet')!;
    const haiku = state.agents.find((a) => a.agentId === 'haiku')!;

    expect(opus.status).toBe('alive');
    expect(opus.hp).toBe(25);
    expect(sonnet.hp).toBe(20);
    expect(haiku.hp).toBe(15);
  });

  it('sets EP from config', () => {
    state.agents.forEach((a) => {
      expect(a.ep).toBe(DEFAULT_GAME_CONFIG.energyPoints);
    });
  });

  it('sets correct positions and orientations', () => {
    const opus = state.agents.find((a) => a.agentId === 'opus')!;
    expect(opus.position).toEqual({ x: 0, y: 0 });
    expect(opus.orientation).toBe('N');
  });

  it('assigns unique turnOrder values', () => {
    const orders = state.agents.map((a) => a.turnOrder);
    expect(new Set(orders).size).toBe(3);
  });

  it('initializes empty turn records and summaries', () => {
    expect(state.turnRecords).toHaveLength(0);
    expect(state.roundSummaries).toHaveLength(0);
  });

  it('initializes result and winner as null', () => {
    expect(state.result).toBeNull();
    expect(state.winnerAgentId).toBeNull();
  });
});

describe('updateAgent', () => {
  const state = createInitialState(DEFAULT_GAME_CONFIG);

  it('returns new array with updated agent', () => {
    const updated = updateAgent(state.agents, 'opus', { hp: 10 });
    const opus = updated.find((a) => a.agentId === 'opus')!;
    expect(opus.hp).toBe(10);
  });

  it('does not mutate original array', () => {
    const original = state.agents;
    updateAgent(state.agents, 'opus', { hp: 10 });
    expect(original.find((a) => a.agentId === 'opus')!.hp).toBe(25);
  });

  it('leaves other agents unchanged', () => {
    const updated = updateAgent(state.agents, 'opus', { hp: 10 });
    const sonnet = updated.find((a) => a.agentId === 'sonnet')!;
    expect(sonnet.hp).toBe(20);
  });
});

describe('eliminateAgent', () => {
  const state = createInitialState(DEFAULT_GAME_CONFIG);

  it('sets status to eliminated', () => {
    const updated = eliminateAgent(state.agents, 'haiku', 5);
    const haiku = updated.find((a) => a.agentId === 'haiku')!;
    expect(haiku.status).toBe('eliminated');
    expect(haiku.eliminatedAtRound).toBe(5);
  });
});

describe('buildSharedView', () => {
  it('includes alive agents with public info only', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const view = buildSharedView(state);

    expect(view.round).toBe(0);
    expect(view.mapWidth).toBe(5);
    expect(view.mapHeight).toBe(5);
    expect(view.agents).toHaveLength(3);
    view.agents.forEach((a) => {
      expect(a).toHaveProperty('agentId');
      expect(a).toHaveProperty('position');
      expect(a).toHaveProperty('hp');
      expect(a).toHaveProperty('orientation');
      expect(a).not.toHaveProperty('ep');
      expect(a).not.toHaveProperty('memory');
    });
  });

  it('separates eliminated agents', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const agents = eliminateAgent(state.agents, 'haiku', 3);
    const updatedState = { ...state, agents };
    const view = buildSharedView(updatedState);

    expect(view.agents).toHaveLength(2);
    expect(view.eliminatedAgents).toHaveLength(1);
    expect(view.eliminatedAgents[0]!.agentId).toBe('haiku');
    expect(view.eliminatedAgents[0]!.eliminatedAtRound).toBe(3);
  });

  it('includes null previousRoundSummary for round 0', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const view = buildSharedView(state);
    expect(view.previousRoundSummary).toBeNull();
  });
});

describe('buildPersonalView', () => {
  it('includes EP and memory for the specified agent', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const view = buildPersonalView(state, 'opus');

    expect(view.agentId).toBe('opus');
    expect(view.hp).toBe(25);
    expect(view.ep).toBe(1);
    expect(view.memory).toEqual([]);
    expect(view.position).toEqual({ x: 0, y: 0 });
    expect(view.orientation).toBe('N');
  });
});
