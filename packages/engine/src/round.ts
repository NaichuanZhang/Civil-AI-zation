import type {
  AgentId,
  AgentAction,
  GameState,
  GameConfig,
  SharedGameView,
  PersonalAgentView,
  TurnRecord,
} from './types.js';
import { getTurnOrder, resetEpForTurn } from './turn.js';
import { executeAction } from './actions.js';
import { buildSharedView, buildPersonalView, updateAgent } from './state.js';
import { appendMemory, buildMemoryEntry, buildTargetMemoryEntry } from './memory.js';
import { spawnChest } from './chest.js';

export type ActionDecider = (
  agentId: AgentId,
  sharedView: SharedGameView,
  personalView: PersonalAgentView,
  config: GameConfig,
) => AgentAction;

export function processRound(
  state: GameState,
  decider: ActionDecider,
): GameState {
  const round = state.round + 1;
  let agents = state.agents;
  const newTurnRecords: TurnRecord[] = [];

  const turnOrder = getTurnOrder(agents);

  for (const turnAgent of turnOrder) {
    if (turnAgent.status !== 'alive') continue;

    const currentAgent = agents.find((a) => a.agentId === turnAgent.agentId)!;
    if (currentAgent.status !== 'alive') continue;

    const restedLastTurn = didRestLastTurn(state, turnAgent.agentId);
    const withEp = resetEpForTurn(currentAgent, state.config, restedLastTurn);
    agents = updateAgent(agents, turnAgent.agentId, { ep: withEp.ep });

    const currentState: GameState = { ...state, round, agents };
    const sharedView = buildSharedView(currentState);
    const personalView = buildPersonalView(currentState, turnAgent.agentId);

    const action = decider(turnAgent.agentId, sharedView, personalView, state.config);

    const { agents: updatedAgents, result } = executeAction(
      turnAgent.agentId,
      action,
      agents,
      state.config,
    );
    agents = updatedAgents;

    const resolvedAction =
      result.type === 'invalid'
        ? { type: 'invalid' as const, reason: result.reason }
        : action;

    const memoryEntry = buildMemoryEntry(round, turnAgent.agentId, result, agents);
    const agentAfterAction = agents.find((a) => a.agentId === turnAgent.agentId)!;
    const newMemory = appendMemory(
      agentAfterAction.memory,
      memoryEntry,
      state.config.memoryCap,
    );
    agents = updateAgent(agents, turnAgent.agentId, { memory: newMemory });

    if (result.type === 'attack') {
      const targetAgent = agents.find((a) => a.agentId === result.target)!;
      const targetEntry = buildTargetMemoryEntry(round, turnAgent.agentId, result);
      const targetNewMemory = appendMemory(targetAgent.memory, targetEntry, state.config.memoryCap);
      agents = updateAgent(agents, result.target, { memory: targetNewMemory });
    }

    newTurnRecords.push({
      roundNumber: round,
      agentId: turnAgent.agentId,
      action: resolvedAction,
      result,
    });
  }

  return {
    ...state,
    round,
    agents,
    turnRecords: [...state.turnRecords, ...newTurnRecords],
  };
}

function didRestLastTurn(state: GameState, agentId: AgentId): boolean {
  if (state.round === 0) return false;
  const lastTurn = state.turnRecords.find(
    (t) => t.roundNumber === state.round && t.agentId === agentId,
  );
  if (!lastTurn) return false;
  return (
    lastTurn.result.type === 'rest' ||
    lastTurn.result.type === 'invalid'
  );
}
