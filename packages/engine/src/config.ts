import type { GameConfig } from './types.js';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 5,
  mapHeight: 5,
  maxRounds: 30,
  baseAttackDamage: 5,
  restEpBonus: 1,
  memoryCap: 10,
  energyPoints: 1,
  agents: [
    {
      agentId: 'opus',
      modelId: 'anthropic/claude-sonnet-4.5',
      speed: 2,
      hp: 25,
      position: { x: 0, y: 0 },
      orientation: 'N',
    },
    {
      agentId: 'sonnet',
      modelId: 'deepseek/deepseek-v3.2',
      speed: 3,
      hp: 20,
      position: { x: 4, y: 4 },
      orientation: 'S',
    },
    {
      agentId: 'haiku',
      modelId: 'openai/gpt-4o-mini',
      speed: 4,
      hp: 15,
      position: { x: 2, y: 0 },
      orientation: 'E',
    },
  ],
};
