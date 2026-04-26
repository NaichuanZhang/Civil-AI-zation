import type { Direction, HitZone } from './types.js';
import { HIT_ZONE_MODIFIERS } from './game-config.js';

const OPPOSITES: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
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
  return HIT_ZONE_MODIFIERS[hitZone];
}
