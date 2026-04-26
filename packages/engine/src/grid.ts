import type { Position, Direction, AgentState } from './types.js';

const DIRECTION_DELTAS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
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

  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
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

const ALL_DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export function getValidMoveDirections(
  pos: Position,
  width: number,
  height: number,
  agents: readonly AgentState[],
): readonly Direction[] {
  return ALL_DIRECTIONS.filter((dir) => {
    const dest = getAdjacentPosition(pos, dir);
    return isInBounds(dest, width, height) && !isPositionOccupied(dest, agents);
  });
}
