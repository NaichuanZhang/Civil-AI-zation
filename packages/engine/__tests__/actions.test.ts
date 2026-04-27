import { describe, it, expect } from 'vitest';
import {
  validateMove,
  validateAttack,
  validateTurn,
  validateRest,
  executeAction,
} from '../src/actions.js';
import type { AgentState, GameConfig } from '../src/types.js';
import { DEFAULT_GAME_CONFIG } from '../src/config.js';

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentState, 'agentId' | 'position'>
): AgentState => ({
  modelId: 'test',
  speed: 3,
  hp: 20,
  ep: 1,
  orientation: 'up',
  status: 'alive',
  eliminatedAtRound: null,
  memory: [],
  turnOrder: 0,
  ...overrides,
});

const config: GameConfig = DEFAULT_GAME_CONFIG;

describe('validateMove', () => {
  const agents: AgentState[] = [
    makeAgent({ agentId: 'opus', position: { x: 1, y: 1 } }),
    makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
    makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
  ];

  it('accepts valid move to empty cell', () => {
    const result = validateMove(agents[0]!, 'right', agents, config);
    expect(result.valid).toBe(true);
  });

  it('rejects move off grid', () => {
    const edgeAgent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } });
    const result = validateMove(edgeAgent, 'up', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('out of bounds');
  });

  it('rejects move to occupied cell', () => {
    const result = validateMove(agents[0]!, 'up', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('rejects move when no EP', () => {
    const noEpAgent = makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, ep: 0 });
    const result = validateMove(noEpAgent, 'right', [noEpAgent, agents[1]!, agents[2]!], config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EP');
  });

  it('rejects move when eliminated', () => {
    const deadAgent = makeAgent({
      agentId: 'opus',
      position: { x: 1, y: 1 },
      status: 'eliminated',
    });
    const result = validateMove(deadAgent, 'right', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('eliminated');
  });
});

describe('validateAttack', () => {
  it('accepts attack on target in facing direction', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
    ];
    const result = validateAttack(agents[0]!, 'sonnet', agents, config);
    expect(result.valid).toBe(true);
  });

  it('rejects attack on adjacent target not in facing direction', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'right' }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
    ];
    const result = validateAttack(agents[0]!, 'sonnet', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in your facing direction');
  });

  it('rejects attack on non-adjacent target', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 0, y: 0 }, orientation: 'down' }),
      makeAgent({ agentId: 'sonnet', position: { x: 2, y: 2 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 2 } }),
    ];
    const result = validateAttack(agents[0]!, 'sonnet', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in your facing direction');
  });

  it('rejects attack on eliminated target', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 }, status: 'eliminated' }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
    ];
    const result = validateAttack(agents[0]!, 'sonnet', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not alive');
  });

  it('rejects attack on self', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
    ];
    const result = validateAttack(agents[0]!, 'opus', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('self');
  });

  it('rejects attack when no EP', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up', ep: 0 }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
    ];
    const result = validateAttack(agents[0]!, 'sonnet', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EP');
  });
});

describe('validateTurn', () => {
  it('accepts turn for alive agent with EP', () => {
    const agent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } });
    const result = validateTurn(agent, config);
    expect(result.valid).toBe(true);
  });

  it('rejects turn when no EP', () => {
    const agent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 }, ep: 0 });
    const result = validateTurn(agent, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EP');
  });

  it('rejects turn for eliminated agent', () => {
    const agent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 }, status: 'eliminated' });
    const result = validateTurn(agent, config);
    expect(result.valid).toBe(false);
  });
});

describe('validateRest', () => {
  it('accepts rest for alive agent', () => {
    const agent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } });
    const result = validateRest(agent);
    expect(result.valid).toBe(true);
  });

  it('rejects rest for eliminated agent', () => {
    const agent = makeAgent({
      agentId: 'opus',
      position: { x: 0, y: 0 },
      status: 'eliminated',
    });
    const result = validateRest(agent);
    expect(result.valid).toBe(false);
  });
});

describe('executeAction', () => {
  describe('move', () => {
    it('updates position and orientation, deducts EP', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { agents: newAgents, result } = executeAction(
        'opus',
        { type: 'move', direction: 'right' },
        agents,
        config,
        [],
      );
      const opus = newAgents.find((a) => a.agentId === 'opus')!;
      expect(opus.position).toEqual({ x: 2, y: 1 });
      expect(opus.orientation).toBe('right');
      expect(opus.ep).toBe(0);
      expect(result.type).toBe('move');
      if (result.type === 'move') {
        expect(result.from).toEqual({ x: 1, y: 1 });
        expect(result.to).toEqual({ x: 2, y: 1 });
      }
    });
  });

  describe('attack', () => {
    it('deals damage and deducts EP when facing target', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 }, orientation: 'right' }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { agents: newAgents, result } = executeAction(
        'opus',
        { type: 'attack', target: 'sonnet' },
        agents,
        config,
      );
      expect(result.type).toBe('attack');
      if (result.type === 'attack') {
        expect(result.hitZone).toBe('side');
        expect(result.damage).toBe(5);
        expect(result.targetHpBefore).toBe(20);
        expect(result.targetHpAfter).toBe(15);
        expect(result.targetEliminated).toBe(false);
      }
      const sonnet = newAgents.find((a) => a.agentId === 'sonnet')!;
      expect(sonnet.hp).toBe(15);
      const opus = newAgents.find((a) => a.agentId === 'opus')!;
      expect(opus.ep).toBe(0);
    });

    it('eliminates target when HP reaches 0', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 }, hp: 5, orientation: 'right' }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { agents: newAgents, result } = executeAction(
        'opus',
        { type: 'attack', target: 'sonnet' },
        agents,
        config,
      );
      if (result.type === 'attack') {
        expect(result.targetEliminated).toBe(true);
        expect(result.targetHpAfter).toBe(0);
      }
      const sonnet = newAgents.find((a) => a.agentId === 'sonnet')!;
      expect(sonnet.status).toBe('eliminated');
      expect(sonnet.hp).toBe(0);
    });

    it('does not let HP go negative', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 }, hp: 2, orientation: 'right' }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { agents: newAgents } = executeAction(
        'opus',
        { type: 'attack', target: 'sonnet' },
        agents,
        config,
      );
      const sonnet = newAgents.find((a) => a.agentId === 'sonnet')!;
      expect(sonnet.hp).toBe(0);
    });

    it('rejects attack when not facing target (invalid fallback)', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'right' }),
        makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { result } = executeAction(
        'opus',
        { type: 'attack', target: 'sonnet' },
        agents,
        config,
      );
      expect(result.type).toBe('invalid');
    });
  });

  describe('turn', () => {
    it('changes orientation and deducts EP', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { agents: newAgents, result } = executeAction(
        'opus',
        { type: 'turn', direction: 'down' },
        agents,
        config,
      );
      const opus = newAgents.find((a) => a.agentId === 'opus')!;
      expect(opus.orientation).toBe('down');
      expect(opus.position).toEqual({ x: 1, y: 1 });
      expect(opus.ep).toBe(0);
      expect(result.type).toBe('turn');
      if (result.type === 'turn') {
        expect(result.previousOrientation).toBe('up');
        expect(result.newOrientation).toBe('down');
      }
    });
  });

  describe('rest', () => {
    it('returns rest result with EP bonus', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 1, y: 1 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { result } = executeAction(
        'opus',
        { type: 'rest' },
        agents,
        config,
      );
      expect(result.type).toBe('rest');
      if (result.type === 'rest') {
        expect(result.epBonusNextTurn).toBe(1);
      }
    });
  });

  describe('invalid action fallback', () => {
    it('falls back to rest when move is invalid', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 2, y: 2 } }),
        makeAgent({ agentId: 'haiku', position: { x: 1, y: 1 } }),
      ];
      const { result } = executeAction(
        'opus',
        { type: 'move', direction: 'up' },
        agents,
        config,
      );
      expect(result.type).toBe('invalid');
      if (result.type === 'invalid') {
        expect(result.fallbackAction.type).toBe('rest');
      }
    });

    it('falls back to rest when attack target is not in facing direction', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 0, y: 0 }, orientation: 'up' }),
        makeAgent({ agentId: 'sonnet', position: { x: 2, y: 2 } }),
        makeAgent({ agentId: 'haiku', position: { x: 1, y: 1 } }),
      ];
      const { result } = executeAction(
        'opus',
        { type: 'attack', target: 'sonnet' },
        agents,
        config,
      );
      expect(result.type).toBe('invalid');
    });
  });
});
