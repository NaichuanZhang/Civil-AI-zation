import { describe, it, expect } from 'vitest';
import {
  getHitZone,
  getDamageModifier,
  getOppositeDirection,
} from '../src/orientation.js';
import type { Direction, HitZone } from '../src/types.js';

describe('getOppositeDirection', () => {
  it('N <-> S', () => {
    expect(getOppositeDirection('up')).toBe('down');
    expect(getOppositeDirection('down')).toBe('up');
  });

  it('E <-> W', () => {
    expect(getOppositeDirection('right')).toBe('left');
    expect(getOppositeDirection('left')).toBe('right');
  });
});

describe('getHitZone', () => {
  // "Same direction = Front" — attack direction matches target facing
  // "Opposite = Back" — attack direction is opposite to target facing
  // "Else = Side"

  const cases: Array<{
    attackDir: Direction;
    targetFacing: Direction;
    expected: HitZone;
  }> = [
    // Attack from South (attackDir=N), target facing N → same → Front
    { attackDir: 'up', targetFacing: 'up', expected: 'front' },
    // Attack from South (attackDir=N), target facing S → opposite → Back
    { attackDir: 'up', targetFacing: 'down', expected: 'back' },
    { attackDir: 'up', targetFacing: 'right', expected: 'side' },
    { attackDir: 'up', targetFacing: 'left', expected: 'side' },

    { attackDir: 'down', targetFacing: 'down', expected: 'front' },
    { attackDir: 'down', targetFacing: 'up', expected: 'back' },
    { attackDir: 'down', targetFacing: 'right', expected: 'side' },
    { attackDir: 'down', targetFacing: 'left', expected: 'side' },

    { attackDir: 'right', targetFacing: 'right', expected: 'front' },
    { attackDir: 'right', targetFacing: 'left', expected: 'back' },
    { attackDir: 'right', targetFacing: 'up', expected: 'side' },
    { attackDir: 'right', targetFacing: 'down', expected: 'side' },

    { attackDir: 'left', targetFacing: 'left', expected: 'front' },
    { attackDir: 'left', targetFacing: 'right', expected: 'back' },
    { attackDir: 'left', targetFacing: 'up', expected: 'side' },
    { attackDir: 'left', targetFacing: 'down', expected: 'side' },
  ];

  cases.forEach(({ attackDir, targetFacing, expected }) => {
    it(`attackDir=${attackDir}, targetFacing=${targetFacing} → ${expected}`, () => {
      expect(getHitZone(attackDir, targetFacing)).toBe(expected);
    });
  });
});

describe('getDamageModifier', () => {
  it('front = 0.5', () => {
    expect(getDamageModifier('front')).toBe(0.5);
  });

  it('side = 1.0', () => {
    expect(getDamageModifier('side')).toBe(1.0);
  });

  it('back = 1.5', () => {
    expect(getDamageModifier('back')).toBe(1.5);
  });
});
