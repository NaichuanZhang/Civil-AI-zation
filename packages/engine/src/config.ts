import type { GameConfig } from './types.js';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 3,
  mapHeight: 3,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  agents: [
    {
      agentId: 'opus',
      modelId: 'openai/gpt-4o-mini',
      speed: 2,
      hp: 25,
      position: { x: 0, y: 2 },
      orientation: 'N',
    },
    {
      agentId: 'sonnet',
      modelId: 'openai/gpt-4o-mini',
      speed: 3,
      hp: 20,
      position: { x: 2, y: 2 },
      orientation: 'W',
    },
    {
      agentId: 'haiku',
      modelId: 'openai/gpt-4o-mini',
      speed: 4,
      hp: 15,
      position: { x: 1, y: 0 },
      orientation: 'S',
    },
  ],
};
