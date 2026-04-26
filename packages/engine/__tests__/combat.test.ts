import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../src/combat.js';
import type { Direction } from '../src/types.js';

describe('calculateDamage', () => {
  // Attacker at (2,2), target at (2,1) → attackDirection = N
  // Base damage = 5

  it('front hit: target faces toward attacker → floor(5 * 0.5) = 2', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'N', // target faces N = same as attack direction → front
      5,
    );
    expect(result.hitZone).toBe('front');
    expect(result.modifier).toBe(0.5);
    expect(result.damage).toBe(2);
  });

  it('back hit: target faces away from attacker → floor(5 * 1.5) = 7', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'S', // target faces S = opposite of N attack → back
      5,
    );
    expect(result.hitZone).toBe('back');
    expect(result.modifier).toBe(1.5);
    expect(result.damage).toBe(7);
  });

  it('side hit: target faces perpendicular → floor(5 * 1.0) = 5', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'E', // target faces E = perpendicular to N attack → side
      5,
    );
    expect(result.hitZone).toBe('side');
    expect(result.modifier).toBe(1.0);
    expect(result.damage).toBe(5);
  });

  it('side hit with W facing', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'W',
      5,
    );
    expect(result.hitZone).toBe('side');
    expect(result.damage).toBe(5);
  });

  it('works with horizontal attack (East)', () => {
    // Attacker at (1,2), target at (2,2) → attackDirection = E
    const result = calculateDamage(
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      'E', // target faces E = same as attack direction → front
      5,
    );
    expect(result.hitZone).toBe('front');
    expect(result.damage).toBe(2);
  });

  it('floor rounds down correctly with odd base damage', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'N',
      7, // front: floor(7 * 0.5) = floor(3.5) = 3
    );
    expect(result.damage).toBe(3);
  });

  it('back hit with different base damage', () => {
    const result = calculateDamage(
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      'S',
      3, // back: floor(3 * 1.5) = floor(4.5) = 4
    );
    expect(result.damage).toBe(4);
  });

  it('throws for non-adjacent positions', () => {
    expect(() =>
      calculateDamage({ x: 0, y: 0 }, { x: 2, y: 2 }, 'N', 5),
    ).toThrow();
  });
});
