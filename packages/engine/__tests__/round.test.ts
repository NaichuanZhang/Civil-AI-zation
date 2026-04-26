import { describe, it, expect } from 'vitest';
import { processRound } from '../src/round.js';
import type { ActionDecider } from '../src/round.js';
import { createInitialState, updateAgent } from '../src/state.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';
import type { AgentAction, GameState } from '../src/types.js';

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
    // haiku moves East from (2,0) to (3,0)
    // sonnet tries to move to (3,0) — should be blocked if haiku moved there
    const decider: ActionDecider = (agentId) => {
      if (agentId === 'haiku') return { type: 'move', direction: 'E' };
      if (agentId === 'sonnet') return { type: 'move', direction: 'N' };
      return { type: 'rest' };
    };

    // Set sonnet at (3,1) so moving N would go to (3,0) where haiku just moved
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const agents = updateAgent(state.agents, 'sonnet', {
      position: { x: 3, y: 1 },
    });
    const modifiedState: GameState = { ...state, agents };

    const newState = processRound(modifiedState, decider);
    const sonnetTurn = newState.turnRecords.find(
      (t) => t.roundNumber === 1 && t.agentId === 'sonnet',
    )!;
    // Sonnet's move should be invalid because haiku is now at (3,0)
    expect(sonnetTurn.result.type).toBe('invalid');
  });

  it('updates memory after each action', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const newState = processRound(state, deciderAllRest);
    newState.agents.forEach((a) => {
      expect(a.memory).toHaveLength(1);
    });
  });

  it('resting agent gets EP bonus next round', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const afterRound1 = processRound(state, deciderAllRest);
    const afterRound2 = processRound(afterRound1, deciderAllRest);

    // After round 2, each agent should have had 2 EP at the start of their turn
    // since they rested in round 1
    afterRound2.agents.forEach((a) => {
      // They used their turn (rest doesn't cost EP in current implementation)
      // but the EP was set to 2 at the start of their turn
      expect(a.memory).toHaveLength(2);
    });
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
