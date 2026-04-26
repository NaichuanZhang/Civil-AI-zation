import { describe, it, expect } from 'vitest';
import {
  getHitZone,
  getDamageModifier,
  getOppositeDirection,
} from '../src/orientation.js';
import type { Direction, HitZone } from '../src/types.js';

describe('getOppositeDirection', () => {
  it('N <-> S', () => {
    expect(getOppositeDirection('N')).toBe('S');
    expect(getOppositeDirection('S')).toBe('N');
  });

  it('E <-> W', () => {
    expect(getOppositeDirection('E')).toBe('W');
    expect(getOppositeDirection('W')).toBe('E');
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
    { attackDir: 'N', targetFacing: 'N', expected: 'front' },
    // Attack from South (attackDir=N), target facing S → opposite → Back
    { attackDir: 'N', targetFacing: 'S', expected: 'back' },
    { attackDir: 'N', targetFacing: 'E', expected: 'side' },
    { attackDir: 'N', targetFacing: 'W', expected: 'side' },

    { attackDir: 'S', targetFacing: 'S', expected: 'front' },
    { attackDir: 'S', targetFacing: 'N', expected: 'back' },
    { attackDir: 'S', targetFacing: 'E', expected: 'side' },
    { attackDir: 'S', targetFacing: 'W', expected: 'side' },

    { attackDir: 'E', targetFacing: 'E', expected: 'front' },
    { attackDir: 'E', targetFacing: 'W', expected: 'back' },
    { attackDir: 'E', targetFacing: 'N', expected: 'side' },
    { attackDir: 'E', targetFacing: 'S', expected: 'side' },

    { attackDir: 'W', targetFacing: 'W', expected: 'front' },
    { attackDir: 'W', targetFacing: 'E', expected: 'back' },
    { attackDir: 'W', targetFacing: 'N', expected: 'side' },
    { attackDir: 'W', targetFacing: 'S', expected: 'side' },
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
