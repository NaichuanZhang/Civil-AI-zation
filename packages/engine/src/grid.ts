import type { Position, Direction, AgentState } from './types.js';

const DIRECTION_DELTAS: Record<Direction, Position> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

export function isInBounds(
  pos: Position,
  width: number,
  height: number,
): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

export function getAdjacentPosition(pos: Position, dir: Direction): Position {
  const delta = DIRECTION_DELTAS[dir];
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

export function isAdjacent(a: Position, b: Position): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

export function getDirectionBetween(
  from: Position,
  to: Position,
): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === -1) return 'N';
  if (dx === 0 && dy === 1) return 'S';
  if (dx === 1 && dy === 0) return 'E';
  if (dx === -1 && dy === 0) return 'W';
  return null;
}

export function isPositionOccupied(
  pos: Position,
  agents: readonly AgentState[],
): boolean {
  return agents.some(
    (a) => a.status === 'alive' && a.position.x === pos.x && a.position.y === pos.y,
  );
}
