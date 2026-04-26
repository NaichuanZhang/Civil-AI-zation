import type {
  AgentState,
  AgentId,
  AgentAction,
  ActionResult,
  Direction,
  GameConfig,
} from './types.js';
import { isInBounds, getAdjacentPosition, isPositionOccupied } from './grid.js';
import { calculateDamage } from './combat.js';
import { isAdjacent } from './grid.js';
import { updateAgent } from './state.js';

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
  if (agent.ep < 1) {
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
): ActionValidation {
  if (agent.status === 'eliminated') {
    return { valid: false, reason: 'Agent is eliminated' };
  }
  if (agent.ep < 1) {
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
  if (!isAdjacent(agent.position, target.position)) {
    return { valid: false, reason: `Target ${targetId} is not adjacent` };
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
): { agents: readonly AgentState[]; result: ActionResult } {
  const agent = agents.find((a) => a.agentId === agentId)!;

  switch (action.type) {
    case 'move': {
      const validation = validateMove(agent, action.direction, agents, config);
      if (!validation.valid) {
        return makeInvalidResult(agents, validation.reason!, config);
      }
      const dest = getAdjacentPosition(agent.position, action.direction);
      const newAgents = updateAgent(agents, agentId, {
        position: dest,
        orientation: action.direction,
        ep: agent.ep - 1,
      });
      return {
        agents: newAgents,
        result: {
          type: 'move',
          from: agent.position,
          to: dest,
          newOrientation: action.direction,
        },
      };
    }

    case 'attack': {
      const validation = validateAttack(agent, action.target, agents);
      if (!validation.valid) {
        return makeInvalidResult(agents, validation.reason!, config);
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

      let newAgents = updateAgent(agents, agentId, { ep: agent.ep - 1 });
      newAgents = updateAgent(newAgents, action.target, {
        hp: newHp,
        ...(eliminated
          ? { status: 'eliminated' as const, eliminatedAtRound: 0 }
          : {}),
      });

      return {
        agents: newAgents,
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

    case 'rest': {
      return {
        agents,
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
  reason: string,
  config: GameConfig,
): { agents: readonly AgentState[]; result: ActionResult } {
  return {
    agents,
    result: {
      type: 'invalid',
      reason,
      fallbackAction: { type: 'rest', epBonusNextTurn: config.restEpBonus },
    },
  };
}
