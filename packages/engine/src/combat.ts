import type { Position, Direction, HitZone } from './types.js';
import { getDirectionBetween } from './grid.js';
import { getHitZone, getDamageModifier } from './orientation.js';

export interface DamageResult {
  readonly damage: number;
  readonly hitZone: HitZone;
  readonly modifier: number;
}

export function calculateDamage(
  attackerPos: Position,
  targetPos: Position,
  targetFacing: Direction,
  baseDamage: number,
): DamageResult {
  const attackDirection = getDirectionBetween(attackerPos, targetPos);
  if (attackDirection === null) {
    throw new Error(
      `Cannot calculate damage: positions are not adjacent (${attackerPos.x},${attackerPos.y}) -> (${targetPos.x},${targetPos.y})`,
    );
  }

  const hitZone = getHitZone(attackDirection, targetFacing);
  const modifier = getDamageModifier(hitZone);
  const damage = Math.floor(baseDamage * modifier);

  return { damage, hitZone, modifier };
}
