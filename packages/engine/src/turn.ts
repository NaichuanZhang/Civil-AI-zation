import type { AgentState, GameConfig } from './types.js';

export function getTurnOrder(
  agents: readonly AgentState[],
): readonly AgentState[] {
  return agents
    .filter((a) => a.status === 'alive')
    .toSorted((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      return a.turnOrder - b.turnOrder;
    });
}

export function resetEpForTurn(
  agent: AgentState,
  config: GameConfig,
  restedLastTurn: boolean,
): AgentState {
  const ep = restedLastTurn
    ? config.energyPoints + config.restEpBonus
    : config.energyPoints;
  return { ...agent, ep };
}
