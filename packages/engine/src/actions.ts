import type {
  AgentState,
  AgentId,
  AgentAction,
  ActionResult,
  Direction,
  GameConfig,
  TreasureChest,
} from './types.js';
import { isInBounds, getAdjacentPosition, isPositionOccupied } from './grid.js';
import { calculateDamage } from './combat.js';
import { updateAgent } from './state.js';
import { findChestAtPosition, openChest } from './chest.js';

export interface ActionValidation {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateMove(
  agent: AgentState,
  direction: Direction,
  allAgents: readonly AgentState[],
  config: GameConfig,
): ActionValidation {
  if (agent.status === 'eliminated') {
    return { valid: false, reason: 'Agent is eliminated' };
  }
  if (agent.ep < config.actionCosts.move) {
    return { valid: false, reason: 'Not enough EP' };
  }
  const dest = getAdjacentPosition(agent.position, direction);
  if (!isInBounds(dest, config.mapWidth, config.mapHeight)) {
    return { valid: false, reason: 'Destination is out of bounds' };
  }
  if (isPositionOccupied(dest, allAgents)) {
    return { valid: false, reason: 'Destination is occupied' };
  }
  return { valid: true };
}

export function validateAttack(
  agent: AgentState,
  targetId: AgentId,
  allAgents: readonly AgentState[],
  config: GameConfig,
): ActionValidation {
  if (agent.status === 'eliminated') {
    return { valid: false, reason: 'Agent is eliminated' };
  }
  if (agent.ep < config.actionCosts.attack) {
    return { valid: false, reason: 'Not enough EP' };
  }
  if (targetId === agent.agentId) {
    return { valid: false, reason: 'Cannot attack self' };
  }
  const target = allAgents.find((a) => a.agentId === targetId);
  if (!target) {
    return { valid: false, reason: `Target ${targetId} not found` };
  }
  if (target.status !== 'alive') {
    return { valid: false, reason: `Target ${targetId} is not alive` };
  }
  const facingPos = getAdjacentPosition(agent.position, agent.orientation);
  if (target.position.x !== facingPos.x || target.position.y !== facingPos.y) {
    return { valid: false, reason: `Target ${targetId} is not in your facing direction` };
  }
  return { valid: true };
}

export function validateTurn(agent: AgentState, config: GameConfig): ActionValidation {
  if (agent.status === 'eliminated') {
    return { valid: false, reason: 'Agent is eliminated' };
  }
  if (agent.ep < config.actionCosts.turn) {
    return { valid: false, reason: 'Not enough EP' };
  }
  return { valid: true };
}

export function validateRest(agent: AgentState): ActionValidation {
  if (agent.status === 'eliminated') {
    return { valid: false, reason: 'Agent is eliminated' };
  }
  return { valid: true };
}

export function executeAction(
  agentId: AgentId,
  action: AgentAction,
  agents: readonly AgentState[],
  config: GameConfig,
  chests: readonly TreasureChest[],
): {
  agents: readonly AgentState[];
  chests: readonly TreasureChest[];
  result: ActionResult;
} {
  const agent = agents.find((a) => a.agentId === agentId)!;

  switch (action.type) {
    case 'move': {
      const validation = validateMove(agent, action.direction, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason!, config);
      }
      const dest = getAdjacentPosition(agent.position, action.direction);
      let newAgents = updateAgent(agents, agentId, {
        position: dest,
        orientation: action.direction,
        ep: agent.ep - config.actionCosts.move,
      });

      // Check for chest at destination
      const chest = findChestAtPosition(chests, dest);
      let newChests = chests;
      let chestCollected: ActionResult['chestCollected'] = undefined;

      if (chest) {
        newChests = openChest(chests, dest);
        const hpBefore = newAgents.find((a) => a.agentId === agentId)!.hp;
        const newHp = Math.max(1, hpBefore + chest.item.hpChange); // HP cannot go below 1 from chest
        newAgents = updateAgent(newAgents, agentId, { hp: newHp });
        chestCollected = {
          item: chest.item,
          hpBefore,
          hpAfter: newHp,
        };
      }

      return {
        agents: newAgents,
        chests: newChests,
        result: {
          type: 'move',
          from: agent.position,
          to: dest,
          newOrientation: action.direction,
          chestCollected,
        },
      };
    }

    case 'attack': {
      const validation = validateAttack(agent, action.target, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason!, config);
      }
      const target = agents.find((a) => a.agentId === action.target)!;
      const { damage, hitZone } = calculateDamage(
        agent.position,
        target.position,
        target.orientation,
        config.baseAttackDamage,
      );
      const newHp = Math.max(0, target.hp - damage);
      const eliminated = newHp <= 0;

      let newAgents = updateAgent(agents, agentId, { ep: agent.ep - config.actionCosts.attack });
      newAgents = updateAgent(newAgents, action.target, {
        hp: newHp,
        ...(eliminated
          ? { status: 'eliminated' as const, eliminatedAtRound: 0 }
          : {}),
      });

      return {
        agents: newAgents,
        chests,
        result: {
          type: 'attack',
          target: action.target,
          hitZone,
          damage,
          targetHpBefore: target.hp,
          targetHpAfter: newHp,
          targetEliminated: eliminated,
        },
      };
    }

    case 'turn': {
      const validation = validateTurn(agent, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, chests, validation.reason!, config);
      }
      const prev = agent.orientation;
      const newAgents = updateAgent(agents, agentId, {
        orientation: action.direction,
        ep: agent.ep - config.actionCosts.turn,
      });
      return {
        agents: newAgents,
        chests,
        result: {
          type: 'turn',
          previousOrientation: prev,
          newOrientation: action.direction,
        },
      };
    }

    case 'rest': {
      return {
        agents,
        chests,
        result: {
          type: 'rest',
          epBonusNextTurn: config.restEpBonus,
        },
      };
    }
  }
}

function makeInvalidResult(
  agents: readonly AgentState[],
  chests: readonly TreasureChest[],
  reason: string,
  config: GameConfig,
): {
  agents: readonly AgentState[];
  chests: readonly TreasureChest[];
  result: ActionResult;
} {
  return {
    agents,
    chests,
    result: {
      type: 'invalid',
      reason,
      fallbackAction: { type: 'rest', epBonusNextTurn: config.restEpBonus },
    },
  };
}
