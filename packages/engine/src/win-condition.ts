import type { GameState, WinConditionResult } from './types.js';

export function checkWinCondition(state: GameState): WinConditionResult {
  const alive = state.agents.filter((a) => a.status === 'alive');

  if (alive.length === 1) {
    return {
      gameOver: true,
      result: 'elimination',
      winnerAgentId: alive[0]!.agentId,
    };
  }

  if (alive.length === 0) {
    return {
      gameOver: true,
      result: 'draw',
      winnerAgentId: null,
    };
  }

  if (state.round >= state.config.maxRounds) {
    const maxHp = Math.max(...alive.map((a) => a.hp));
    const withMaxHp = alive.filter((a) => a.hp === maxHp);

    if (withMaxHp.length === 1) {
      return {
        gameOver: true,
        result: 'highest_hp',
        winnerAgentId: withMaxHp[0]!.agentId,
      };
    }

    return {
      gameOver: true,
      result: 'draw',
      winnerAgentId: null,
    };
  }

  return {
    gameOver: false,
    result: null,
    winnerAgentId: null,
  };
}
