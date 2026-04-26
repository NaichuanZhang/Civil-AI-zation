import { describe, it, expect } from 'vitest';
import { appendMemory, buildMemoryEntry, buildTargetMemoryEntry } from '../src/memory.js';
import type { ActionResult, AttackResult, AgentState } from '../src/types.js';

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentState, 'agentId'>
): AgentState => ({
  modelId: 'test',
  speed: 3,
  hp: 20,
  ep: 1,
  position: { x: 2, y: 2 },
  orientation: 'up',
  status: 'alive',
  eliminatedAtRound: null,
  memory: [],
  turnOrder: 0,
  ...overrides,
});

describe('appendMemory', () => {
  it('adds entry to empty memory', () => {
    const result = appendMemory([], 'Round 1: I moved North.', 10);
    expect(result).toEqual(['Round 1: I moved North.']);
  });

  it('appends to existing memory', () => {
    const result = appendMemory(['entry1'], 'entry2', 10);
    expect(result).toEqual(['entry1', 'entry2']);
  });

  it('trims oldest entry when at cap', () => {
    const mem = Array.from({ length: 10 }, (_, i) => `entry${i}`);
    const result = appendMemory(mem, 'entry10', 10);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe('entry1');
    expect(result[9]).toBe('entry10');
  });

  it('trims multiple entries when well over cap', () => {
    const mem = Array.from({ length: 12 }, (_, i) => `entry${i}`);
    const result = appendMemory(mem, 'entry12', 10);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe('entry3');
    expect(result[9]).toBe('entry12');
  });

  it('does not mutate original array', () => {
    const original = ['entry1'];
    appendMemory(original, 'entry2', 10);
    expect(original).toEqual(['entry1']);
  });
});

describe('buildMemoryEntry', () => {
  const agents: AgentState[] = [
    makeAgent({ agentId: 'opus', position: { x: 2, y: 1 } }),
    makeAgent({ agentId: 'sonnet', hp: 15, position: { x: 3, y: 2 } }),
    makeAgent({ agentId: 'haiku', position: { x: 0, y: 0 } }),
  ];

  it('builds move entry', () => {
    const result: ActionResult = {
      type: 'move',
      from: { x: 2, y: 2 },
      to: { x: 2, y: 1 },
      newOrientation: 'up',
    };
    const entry = buildMemoryEntry(1, 'opus', result, agents);
    expect(entry).toBe('Round 1: I moved Up to (2,1), facing Up.');
  });

  it('builds attack entry', () => {
    const result: ActionResult = {
      type: 'attack',
      target: 'sonnet',
      hitZone: 'side',
      damage: 5,
      targetHpBefore: 20,
      targetHpAfter: 15,
      targetEliminated: false,
    };
    const entry = buildMemoryEntry(2, 'opus', result, agents);
    expect(entry).toBe(
      'Round 2: I attacked sonnet from the side for 5 damage. sonnet HP: 20→15.',
    );
  });

  it('builds attack entry with elimination', () => {
    const result: ActionResult = {
      type: 'attack',
      target: 'sonnet',
      hitZone: 'back',
      damage: 7,
      targetHpBefore: 7,
      targetHpAfter: 0,
      targetEliminated: true,
    };
    const entry = buildMemoryEntry(3, 'opus', result, agents);
    expect(entry).toBe(
      'Round 3: I attacked sonnet from the back for 7 damage. sonnet HP: 7→0. sonnet eliminated!',
    );
  });

  it('builds rest entry', () => {
    const result: ActionResult = {
      type: 'rest',
      epBonusNextTurn: 1,
    };
    const entry = buildMemoryEntry(4, 'opus', result, agents);
    expect(entry).toBe('Round 4: I rested. +1 EP next turn.');
  });

  it('builds invalid entry', () => {
    const result: ActionResult = {
      type: 'invalid',
      reason: 'Target not adjacent',
      fallbackAction: { type: 'rest', epBonusNextTurn: 1 },
    };
    const entry = buildMemoryEntry(5, 'opus', result, agents);
    expect(entry).toBe(
      'Round 5: Invalid action (Target not adjacent). Rested instead. +1 EP next turn.',
    );
  });
});

describe('buildTargetMemoryEntry', () => {
  it('builds entry from victim perspective', () => {
    const result: AttackResult = {
      type: 'attack',
      target: 'sonnet',
      hitZone: 'back',
      damage: 7,
      targetHpBefore: 20,
      targetHpAfter: 13,
      targetEliminated: false,
    };
    const entry = buildTargetMemoryEntry(3, 'haiku', result);
    expect(entry).toBe(
      'Round 3: haiku attacked me from the back for 7 damage. My HP: 20→13.',
    );
  });

  it('includes elimination notice', () => {
    const result: AttackResult = {
      type: 'attack',
      target: 'sonnet',
      hitZone: 'side',
      damage: 5,
      targetHpBefore: 5,
      targetHpAfter: 0,
      targetEliminated: true,
    };
    const entry = buildTargetMemoryEntry(7, 'opus', result);
    expect(entry).toBe(
      'Round 7: opus attacked me from the side for 5 damage. My HP: 5→0. I was eliminated!',
    );
  });
});
