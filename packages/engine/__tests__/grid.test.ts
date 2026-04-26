import { describe, it, expect } from 'vitest';
import {
  isInBounds,
  getAdjacentPosition,
  isAdjacent,
  getDirectionBetween,
  isPositionOccupied,
  getValidMoveDirections,
} from '../src/grid.js';
import type { AgentState } from '../src/types.js';

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentState, 'agentId' | 'position'>
): AgentState => ({
  modelId: 'test-model',
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

describe('isInBounds', () => {
  it('accepts all corners of 5x5 grid', () => {
    expect(isInBounds({ x: 0, y: 0 }, 5, 5)).toBe(true);
    expect(isInBounds({ x: 4, y: 0 }, 5, 5)).toBe(true);
    expect(isInBounds({ x: 0, y: 4 }, 5, 5)).toBe(true);
    expect(isInBounds({ x: 4, y: 4 }, 5, 5)).toBe(true);
  });

  it('accepts center of grid', () => {
    expect(isInBounds({ x: 2, y: 2 }, 5, 5)).toBe(true);
  });

  it('rejects negative coordinates', () => {
    expect(isInBounds({ x: -1, y: 0 }, 5, 5)).toBe(false);
    expect(isInBounds({ x: 0, y: -1 }, 5, 5)).toBe(false);
  });

  it('rejects coordinates at or beyond width/height', () => {
    expect(isInBounds({ x: 5, y: 0 }, 5, 5)).toBe(false);
    expect(isInBounds({ x: 0, y: 5 }, 5, 5)).toBe(false);
    expect(isInBounds({ x: 5, y: 5 }, 5, 5)).toBe(false);
  });
});

describe('getAdjacentPosition', () => {
  const center = { x: 2, y: 2 };

  it('moves North (y-1)', () => {
    expect(getAdjacentPosition(center, 'up')).toEqual({ x: 2, y: 1 });
  });

  it('moves South (y+1)', () => {
    expect(getAdjacentPosition(center, 'down')).toEqual({ x: 2, y: 3 });
  });

  it('moves East (x+1)', () => {
    expect(getAdjacentPosition(center, 'right')).toEqual({ x: 3, y: 2 });
  });

  it('moves West (x-1)', () => {
    expect(getAdjacentPosition(center, 'left')).toEqual({ x: 1, y: 2 });
  });
});

describe('isAdjacent', () => {
  it('returns true for horizontally adjacent cells', () => {
    expect(isAdjacent({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe(true);
    expect(isAdjacent({ x: 2, y: 2 }, { x: 1, y: 2 })).toBe(true);
  });

  it('returns true for vertically adjacent cells', () => {
    expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(true);
    expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 1 })).toBe(true);
  });

  it('returns false for diagonal cells', () => {
    expect(isAdjacent({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
  });

  it('returns false for same cell', () => {
    expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  it('returns false for cells with distance 2', () => {
    expect(isAdjacent({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
    expect(isAdjacent({ x: 0, y: 0 }, { x: 0, y: 2 })).toBe(false);
  });
});

describe('getDirectionBetween', () => {
  it('returns N when target is above', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 2, y: 1 })).toBe('up');
  });

  it('returns S when target is below', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe('down');
  });

  it('returns E when target is right', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe('right');
  });

  it('returns W when target is left', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 1, y: 2 })).toBe('left');
  });

  it('returns null for non-adjacent positions', () => {
    expect(getDirectionBetween({ x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
  });

  it('returns null for same position', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 2, y: 2 })).toBeNull();
  });

  it('returns null for diagonal positions', () => {
    expect(getDirectionBetween({ x: 2, y: 2 }, { x: 3, y: 3 })).toBeNull();
  });
});

describe('isPositionOccupied', () => {
  const agents: AgentState[] = [
    makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
    makeAgent({ agentId: 'sonnet', position: { x: 4, y: 4 } }),
    makeAgent({
      agentId: 'haiku',
      position: { x: 2, y: 2 },
      status: 'eliminated',
    }),
  ];

  it('returns true for position with alive agent', () => {
    expect(isPositionOccupied({ x: 0, y: 0 }, agents)).toBe(true);
    expect(isPositionOccupied({ x: 4, y: 4 }, agents)).toBe(true);
  });

  it('returns false for empty position', () => {
    expect(isPositionOccupied({ x: 1, y: 1 }, agents)).toBe(false);
  });

  it('returns false for position with eliminated agent', () => {
    expect(isPositionOccupied({ x: 2, y: 2 }, agents)).toBe(false);
  });
});

describe('getValidMoveDirections', () => {
  it('returns all four directions from center of empty 3x3 grid', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 } }),
    ];
    const result = getValidMoveDirections({ x: 1, y: 1 }, 3, 3, agents);
    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining(['up', 'down', 'right', 'left']));
  });

  it('excludes out-of-bounds directions at corner (0,0)', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
    ];
    const result = getValidMoveDirections({ x: 0, y: 0 }, 3, 3, agents);
    expect(result).toHaveLength(2);
    expect(result).toContain('down');
    expect(result).toContain('right');
    expect(result).not.toContain('up');
    expect(result).not.toContain('left');
  });

  it('excludes out-of-bounds directions at corner (2,2)', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 2, y: 2 } }),
    ];
    const result = getValidMoveDirections({ x: 2, y: 2 }, 3, 3, agents);
    expect(result).toHaveLength(2);
    expect(result).toContain('up');
    expect(result).toContain('left');
    expect(result).not.toContain('down');
    expect(result).not.toContain('right');
  });

  it('excludes directions with occupied cells', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 } }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 2, y: 1 } }),
    ];
    const result = getValidMoveDirections({ x: 1, y: 1 }, 3, 3, agents);
    expect(result).toHaveLength(2);
    expect(result).toContain('down');
    expect(result).toContain('left');
    expect(result).not.toContain('up');
    expect(result).not.toContain('right');
  });

  it('ignores eliminated agents when checking occupancy', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 1, y: 1 } }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 }, status: 'eliminated' }),
    ];
    const result = getValidMoveDirections({ x: 1, y: 1 }, 3, 3, agents);
    expect(result).toHaveLength(4);
    expect(result).toContain('up');
  });

  it('returns empty array on 1x1 grid', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
    ];
    const result = getValidMoveDirections({ x: 0, y: 0 }, 1, 1, agents);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when completely boxed in by walls and agents', () => {
    const agents: AgentState[] = [
      makeAgent({ agentId: 'opus', position: { x: 0, y: 0 } }),
      makeAgent({ agentId: 'sonnet', position: { x: 1, y: 0 } }),
      makeAgent({ agentId: 'haiku', position: { x: 0, y: 1 } }),
    ];
    const result = getValidMoveDirections({ x: 0, y: 0 }, 3, 3, agents);
    expect(result).toHaveLength(0);
  });
});
