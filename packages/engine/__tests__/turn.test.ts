import { describe, it, expect } from 'vitest';
import { getTurnOrder, resetEpForTurn } from '../src/turn.js';
import type { AgentState } from '../src/types.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentState, 'agentId'>
): AgentState => ({
  modelId: 'test',
  speed: 3,
  hp: 20,
  ep: 1,
  position: { x: 0, y: 0 },
  orientation: 'N',
  status: 'alive',
  eliminatedAtRound: null,
  memory: [],
  turnOrder: 0,
  ...overrides,
});

describe('getTurnOrder', () => {
  it('sorts by speed descending', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', speed: 2, turnOrder: 0 }),
      makeAgent({ agentId: 'sonnet', speed: 3, turnOrder: 1 }),
      makeAgent({ agentId: 'haiku', speed: 4, turnOrder: 2 }),
    ];
    const order = getTurnOrder(agents);
    expect(order.map((a) => a.agentId)).toEqual(['haiku', 'sonnet', 'opus']);
  });

  it('uses turnOrder as tiebreaker (ascending)', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', speed: 3, turnOrder: 2 }),
      makeAgent({ agentId: 'sonnet', speed: 3, turnOrder: 0 }),
      makeAgent({ agentId: 'haiku', speed: 3, turnOrder: 1 }),
    ];
    const order = getTurnOrder(agents);
    expect(order.map((a) => a.agentId)).toEqual(['sonnet', 'haiku', 'opus']);
  });

  it('excludes eliminated agents', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', speed: 2 }),
      makeAgent({ agentId: 'sonnet', speed: 3, status: 'eliminated' }),
      makeAgent({ agentId: 'haiku', speed: 4 }),
    ];
    const order = getTurnOrder(agents);
    expect(order).toHaveLength(2);
    expect(order.map((a) => a.agentId)).toEqual(['haiku', 'opus']);
  });
});

describe('resetEpForTurn', () => {
  const config = DEFAULT_GAME_CONFIG;

  it('resets EP to base value', () => {
    const agent = makeAgent({ agentId: 'opus', ep: 0 });
    const result = resetEpForTurn(agent, config, false);
    expect(result.ep).toBe(1);
  });

  it('adds rest bonus when agent rested last turn', () => {
    const agent = makeAgent({ agentId: 'opus', ep: 0 });
    const result = resetEpForTurn(agent, config, true);
    expect(result.ep).toBe(2);
  });

  it('returns new object, does not mutate original', () => {
    const agent = makeAgent({ agentId: 'opus', ep: 0 });
    const result = resetEpForTurn(agent, config, false);
    expect(result).not.toBe(agent);
    expect(agent.ep).toBe(0);
  });
});
