import type { Direction, HitZone } from './types.js';

const OPPOSITES: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

const MODIFIERS: Record<HitZone, number> = {
  front: 0.5,
  side: 1.0,
  back: 1.5,
};

export function getOppositeDirection(dir: Direction): Direction {
  return OPPOSITES[dir];
}

export function getHitZone(
  attackDirection: Direction,
  targetFacing: Direction,
): HitZone {
  if (attackDirection === targetFacing) return 'front';
  if (attackDirection === getOppositeDirection(targetFacing)) return 'back';
  return 'side';
}

export function getDamageModifier(hitZone: HitZone): number {
  return MODIFIERS[hitZone];
}
