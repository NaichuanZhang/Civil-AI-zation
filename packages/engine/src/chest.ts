import type {
  TreasureChest,
  ChestItem,
  Position,
  AgentState,
  GameConfig,
} from './types.js';

export function spawnChest(
  agents: readonly AgentState[],
  existingChests: readonly TreasureChest[],
  config: GameConfig,
): TreasureChest | null {
  if (!config.chests.enabled) {
    return null;
  }

  const unopenedCount = existingChests.filter((c) => !c.opened).length;
  if (unopenedCount >= config.chests.maxOnBoard) {
    return null;
  }

  // Find all empty positions (not occupied by agents or existing chests)
  const emptyPositions: Position[] = [];
  for (let y = 0; y < config.mapHeight; y++) {
    for (let x = 0; x < config.mapWidth; x++) {
      const pos = { x, y };
      const occupied = agents.some(
        (a) => a.status === 'alive' && a.position.x === x && a.position.y === y,
      );
      const hasChest = existingChests.some(
        (c) => !c.opened && c.position.x === x && c.position.y === y,
      );
      if (!occupied && !hasChest) {
        emptyPositions.push(pos);
      }
    }
  }

  if (emptyPositions.length === 0) {
    return null; // No empty space for chest
  }

  // Random position
  const position = emptyPositions[Math.floor(Math.random() * emptyPositions.length)]!;

  // Random item (50/50 boost or drain)
  const item: ChestItem = Math.random() < 0.5
    ? { type: 'hp_boost', hpChange: config.chests.hpBoostAmount }
    : { type: 'hp_drain', hpChange: config.chests.hpDrainAmount };

  return {
    position,
    item,
    opened: false,
  };
}

export function findChestAtPosition(
  chests: readonly TreasureChest[],
  position: Position,
): TreasureChest | undefined {
  return chests.find(
    (c) => !c.opened && c.position.x === position.x && c.position.y === position.y,
  );
}

export function openChest(
  chests: readonly TreasureChest[],
  position: Position,
): readonly TreasureChest[] {
  return chests.map((c) =>
    c.position.x === position.x && c.position.y === position.y
      ? { ...c, opened: true }
      : c,
  );
}
