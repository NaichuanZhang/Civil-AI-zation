import type {
  GameConfig,
  GameState,
  AgentState,
  AgentId,
  SharedGameView,
  PersonalAgentView,
} from './types.js';

export function createInitialState(config: GameConfig): GameState {
  const turnOrders = shuffleTiebreakers(config.agents.length);

  const agents: readonly AgentState[] = config.agents.map((ac, i) => ({
    agentId: ac.agentId,
    modelId: ac.modelId,
    speed: ac.speed,
    hp: ac.hp,
    ep: config.energyPoints,
    position: ac.position,
    orientation: ac.orientation,
    status: 'alive' as const,
    eliminatedAtRound: null,
    memory: [],
    turnOrder: turnOrders[i]!,
  }));

  return {
    round: 0,
    status: 'running',
    config,
    agents,
    turnRecords: [],
    roundSummaries: [],
    result: null,
    winnerAgentId: null,
    chests: [],
  };
}

export function updateAgent(
  agents: readonly AgentState[],
  agentId: AgentId,
  updates: Partial<Omit<AgentState, 'agentId'>>,
): readonly AgentState[] {
  return agents.map((a) =>
    a.agentId === agentId ? { ...a, ...updates } : a,
  );
}

export function eliminateAgent(
  agents: readonly AgentState[],
  agentId: AgentId,
  round: number,
): readonly AgentState[] {
  return updateAgent(agents, agentId, {
    status: 'eliminated',
    eliminatedAtRound: round,
  });
}

export function buildSharedView(state: GameState): SharedGameView {
  const alive = state.agents.filter((a) => a.status === 'alive');
  const eliminated = state.agents.filter((a) => a.status === 'eliminated');

  const lastSummary =
    state.roundSummaries.length > 0
      ? state.roundSummaries[state.roundSummaries.length - 1]!.summary
      : null;

  const unopenedChests = state.chests
    .filter((c) => !c.opened)
    .map((c) => ({ position: c.position }));

  return {
    round: state.round,
    mapWidth: state.config.mapWidth,
    mapHeight: state.config.mapHeight,
    agents: alive.map((a) => ({
      agentId: a.agentId,
      position: a.position,
      hp: a.hp,
      orientation: a.orientation,
    })),
    eliminatedAgents: eliminated.map((a) => ({
      agentId: a.agentId,
      eliminatedAtRound: a.eliminatedAtRound!,
    })),
    previousRoundSummary: lastSummary,
    chests: unopenedChests,
  };
}

export function buildPersonalView(
  state: GameState,
  agentId: AgentId,
): PersonalAgentView {
  const agent = state.agents.find((a) => a.agentId === agentId)!;
  return {
    agentId: agent.agentId,
    hp: agent.hp,
    ep: agent.ep,
    position: agent.position,
    orientation: agent.orientation,
    memory: agent.memory,
  };
}

function shuffleTiebreakers(count: number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
