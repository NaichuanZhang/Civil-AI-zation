import type { AgentId, AgentAction, AgentState, GameConfig, ActionResult } from './types.js';
import { executeAction } from './actions.js';
import { updateAgent } from './state.js';

export interface MultiActionResult {
  agents: readonly AgentState[];
  results: readonly ActionResult[];
  epSpent: number;
}

/**
 * Execute multiple actions in sequence for an agent
 * Enforces order: move → turn → attack
 * Stops on invalid action or insufficient EP
 */
export function executeMultipleActions(
  agentId: AgentId,
  actions: readonly AgentAction[],
  agents: readonly AgentState[],
  config: GameConfig,
): MultiActionResult {
  let currentAgents = agents;
  const results: ActionResult[] = [];
  let epSpent = 0;

  const agent = currentAgents.find(a => a.agentId === agentId);
  if (!agent) {
    return { agents: currentAgents, results: [], epSpent: 0 };
  }

  // Validate and reorder actions: move → turn → attack
  const orderedActions = reorderActions(actions);

  for (const action of orderedActions) {
    const currentAgent = currentAgents.find(a => a.agentId === agentId)!;

    // Check if agent has enough EP
    const actionCost = getActionCost(action);
    if (currentAgent.ep < actionCost) {
      // Insufficient EP, stop here
      break;
    }

    // Execute the action
    const { agents: newAgents, result } = executeAction(
      agentId,
      action,
      currentAgents,
      config,
    );

    // If action was invalid, stop sequence
    if (result.type === 'invalid') {
      results.push(result);
      break;
    }

    // Deduct EP
    currentAgents = updateAgent(newAgents, agentId, { ep: currentAgent.ep - actionCost });
    results.push(result);
    epSpent += actionCost;

    // If rest, stop sequence
    if (action.type === 'rest') {
      break;
    }
  }

  return {
    agents: currentAgents,
    results,
    epSpent,
  };
}

/**
 * Reorder actions to enforce: move → turn → attack
 * Also validates no duplicates of same type
 */
function reorderActions(actions: readonly AgentAction[]): readonly AgentAction[] {
  const moves = actions.filter(a => a.type === 'move');
  const turns = actions.filter(a => a.type === 'turn');
  const attacks = actions.filter(a => a.type === 'attack');
  const rests = actions.filter(a => a.type === 'rest');

  // Only allow one of each type
  const orderedActions: AgentAction[] = [];

  if (moves.length > 0) orderedActions.push(moves[0]!);
  if (turns.length > 0) orderedActions.push(turns[0]!);
  if (attacks.length > 0) orderedActions.push(attacks[0]!);
  if (rests.length > 0) orderedActions.push(rests[0]!);

  return orderedActions;
}

function getActionCost(action: AgentAction): number {
  switch (action.type) {
    case 'move':
    case 'turn':
    case 'attack':
      return 1;
    case 'rest':
      return 0;
  }
}
