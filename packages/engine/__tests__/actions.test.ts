import { describe, it, expect } from 'vitest';
import {
  validateMove,
  validateAttack,
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
  orientation: 'N',
  status: 'alive',
  eliminatedAtRound: null,
  memory: [],
  turnOrder: 0,
  ...overrides,
});

const config: GameConfig = DEFAULT_GAME_CONFIG;

describe('validateMove', () => {
  const agents: AgentState[] = [
    makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
    makeAgent({ agentId: 'sonnet', position: { x: 2, y: 1 } }),
    makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
  ];

  it('accepts valid move to empty cell', () => {
    const result = validateMove(agents[0]!, 'E', agents, config);
    expect(result.valid).toBe(true);
  });

  it('rejects move off grid', () => {
    const edgeAgent = makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } });
    const result = validateMove(edgeAgent, 'N', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('out of bounds');
  });

  it('rejects move to occupied cell', () => {
    const result = validateMove(agents[0]!, 'N', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('rejects move when no EP', () => {
    const noEpAgent = makeAgent({ agentId: 'opus', position: { x: 2, y: 2 }, ep: 0 });
    const result = validateMove(noEpAgent, 'E', [noEpAgent, agents[1]!, agents[2]!], config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EP');
  });

  it('rejects move when eliminated', () => {
    const deadAgent = makeAgent({
      agentId: 'opus',
      position: { x: 2, y: 2 },
      status: 'eliminated',
    });
    const result = validateMove(deadAgent, 'E', agents, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('eliminated');
  });
});

describe('validateAttack', () => {
  const agents: AgentState[] = [
    makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
    makeAgent({ agentId: 'sonnet', position: { x: 2, y: 1 } }),
    makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
  ];

  it('accepts attack on adjacent alive target', () => {
    const result = validateAttack(agents[0]!, 'sonnet', agents);
    expect(result.valid).toBe(true);
  });

  it('rejects attack on non-adjacent target', () => {
    const result = validateAttack(agents[0]!, 'haiku', agents);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not adjacent');
  });

  it('rejects attack on eliminated target', () => {
    const deadSonnet = makeAgent({
      agentId: 'sonnet',
      position: { x: 2, y: 1 },
      status: 'eliminated',
    });
    const result = validateAttack(agents[0]!, 'sonnet', [
      agents[0]!,
      deadSonnet,
      agents[2]!,
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not alive');
  });

  it('rejects attack on self', () => {
    const result = validateAttack(agents[0]!, 'opus', agents);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('self');
  });

  it('rejects attack when no EP', () => {
    const noEpAgent = makeAgent({ agentId: 'opus', position: { x: 2, y: 2 }, ep: 0 });
    const result = validateAttack(noEpAgent, 'sonnet', [noEpAgent, agents[1]!, agents[2]!]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EP');
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
        makeAgent({ agentId: 'opus', position: { x: 2, y: 2 }, orientation: 'N' }),
        makeAgent({ agentId: 'sonnet', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 4, y: 4 } }),
      ];
      const { agents: newAgents, result } = executeAction(
        'opus',
        { type: 'move', direction: 'E' },
        agents,
        config,
      );
      const opus = newAgents.find((a) => a.agentId === 'opus')!;
      expect(opus.position).toEqual({ x: 3, y: 2 });
      expect(opus.orientation).toBe('E');
      expect(opus.ep).toBe(0);
      expect(result.type).toBe('move');
      if (result.type === 'move') {
        expect(result.from).toEqual({ x: 2, y: 2 });
        expect(result.to).toEqual({ x: 3, y: 2 });
      }
    });
  });

  describe('attack', () => {
    it('deals damage and deducts EP', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 2, y: 2 }, orientation: 'N' }),
        makeAgent({ agentId: 'sonnet', position: { x: 2, y: 1 }, orientation: 'E' }),
        makeAgent({ agentId: 'haiku', position: { x: 4, y: 4 } }),
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
        makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 2, y: 1 }, hp: 5, orientation: 'E' }),
        makeAgent({ agentId: 'haiku', position: { x: 4, y: 4 } }),
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
        makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 2, y: 1 }, hp: 2, orientation: 'E' }),
        makeAgent({ agentId: 'haiku', position: { x: 4, y: 4 } }),
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
  });

  describe('rest', () => {
    it('returns rest result with EP bonus', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'haiku', position: { x: 4, y: 4 } }),
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
        makeAgent({ agentId: 'sonnet', position: { x: 4, y: 4 } }),
        makeAgent({ agentId: 'haiku', position: { x: 2, y: 2 } }),
      ];
      const { result } = executeAction(
        'opus',
        { type: 'move', direction: 'N' },
        agents,
        config,
      );
      expect(result.type).toBe('invalid');
      if (result.type === 'invalid') {
        expect(result.fallbackAction.type).toBe('rest');
      }
    });

    it('falls back to rest when attack target is not adjacent', () => {
      const agents: AgentState[] = [
        makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
        makeAgent({ agentId: 'sonnet', position: { x: 4, y: 4 } }),
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
});
