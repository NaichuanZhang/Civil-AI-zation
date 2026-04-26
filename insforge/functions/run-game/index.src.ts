import { createClient } from 'npm:@insforge/sdk';
import {
  DEFAULT_GAME_CONFIG,
  createInitialState,
  buildSharedView,
  buildPersonalView,
  buildSystemPrompt,
  buildUserMessage,
  buildToolDefinitions,
  parseToolCall,
  executeAction,
  getTurnOrder,
  resetEpForTurn,
  checkWinCondition,
  updateAgent,
  appendMemory,
  buildMemoryEntry,
  buildSummaryPrompt,
  getValidMoveDirections,
} from './engine/index.js';
import type {
  AgentState,
  AgentId,
  AgentAction,
  ActionResult,
  GameState,
  GameConfig,
  TurnRecord,
} from './engine/index.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUMMARY_MODEL = 'openai/gpt-4o-mini';
const TURN_DELAY_MS = 1500;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  });

  const config = DEFAULT_GAME_CONFIG;

  try {
    const state = createInitialState(config);

    const { data: gameData, error: gameError } = await client.database
      .from('games')
      .insert([{
        status: 'running',
        current_round: 0,
        max_rounds: config.maxRounds,
        config: config as unknown,
      }])
      .select()
      .single();

    if (gameError || !gameData) {
      return jsonResponse({ error: 'Failed to create game', details: gameError }, 500);
    }

    const gameId: string = gameData.id;

    const agentInserts = state.agents.map((a) => ({
      game_id: gameId,
      agent_id: a.agentId,
      model_id: a.modelId,
      hp: a.hp,
      ep: a.ep,
      position_x: a.position.x,
      position_y: a.position.y,
      orientation: a.orientation,
      status: a.status,
      speed: a.speed,
      eliminated_at_round: a.eliminatedAtRound,
      memory: a.memory,
      turn_order: a.turnOrder,
    }));

    await client.database.from('agent_states').insert(agentInserts);

    // Run game loop in background — return gameId immediately so frontend can subscribe
    runGameLoop(client, gameId, state, config).catch((err) => {
      console.error('Game loop failed:', err);
      client.database
        .from('games')
        .update({ status: 'completed', result: 'draw', completed_at: new Date().toISOString() })
        .eq('id', gameId)
        .then(() => {});
    });

    return jsonResponse({ gameId, status: 'running', agents: state.agents.map(toPublicAgent) });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
}

async function runGameLoop(
  client: ReturnType<typeof createClient>,
  gameId: string,
  initialState: GameState,
  config: GameConfig,
): Promise<void> {
  let state = initialState;

  await client.realtime.connect();
  await client.realtime.subscribe(`game:${gameId}`);

  // Small delay to let frontend subscribe
  await delay(2000);

  await client.realtime.publish(`game:${gameId}`, 'game_started', {
    gameId,
    config,
    agents: state.agents.map(toPublicAgent),
  });

  for (let round = 1; round <= config.maxRounds; round++) {
    state = { ...state, round };

    await client.realtime.publish(`game:${gameId}`, 'round_started', {
      roundNumber: round,
      turnOrder: getTurnOrder(state.agents).map((a) => a.agentId),
    });

    if (round > 1) {
      const prevTurns = state.turnRecords.filter((t) => t.roundNumber === round - 1);
      try {
        const { system, user } = buildSummaryPrompt(round - 1, prevTurns, state.agents);
        const tSummary = Date.now();
        const completion = await client.ai.chat.completions.create({
          model: SUMMARY_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.8,
          maxTokens: 200,
        });
        console.log(`[R${round}][summary] LLM call: ${Date.now() - tSummary}ms (${SUMMARY_MODEL})`);
        const summaryText = completion.choices?.[0]?.message?.content ?? 'No summary available.';

        await client.database.from('round_summaries').insert([{
          game_id: gameId,
          round_number: round - 1,
          summary: summaryText,
          state_snapshot: buildSharedView(state),
        }]);

        state = {
          ...state,
          roundSummaries: [...state.roundSummaries, {
            roundNumber: round - 1,
            summary: summaryText,
            stateSnapshot: buildSharedView(state),
          }],
        };

        await client.realtime.publish(`game:${gameId}`, 'round_summary', {
          roundNumber: round - 1,
          summary: summaryText,
        });
      } catch {
        // Summary generation failed, continue without it
      }
    }

    const turnOrder = getTurnOrder(state.agents);
    const roundTurnRecords: TurnRecord[] = [];

    for (const turnAgent of turnOrder) {
      const currentAgent = state.agents.find((a) => a.agentId === turnAgent.agentId)!;
      if (currentAgent.status !== 'alive') continue;

      await client.realtime.publish(`game:${gameId}`, 'turn_started', {
        agentId: turnAgent.agentId,
      });

      const restedLastTurn = didRestLastTurn(state, turnAgent.agentId);
      const withEp = resetEpForTurn(currentAgent, config, restedLastTurn);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { ep: withEp.ep }) };

      const sharedView = buildSharedView(state);
      const personalView = buildPersonalView(state, turnAgent.agentId);
      const aliveAgents = state.agents.filter((a) => a.status === 'alive');
      const aliveOpponents = aliveAgents
        .filter((a) => a.agentId !== turnAgent.agentId)
        .map((a) => a.agentId);
      const currentAgentState = state.agents.find((a) => a.agentId === turnAgent.agentId)!;
      const validMoveDirections = getValidMoveDirections(
        currentAgentState.position,
        config.mapWidth,
        config.mapHeight,
        aliveAgents,
      );

      let action: AgentAction;
      let rawResponse: unknown = null;
      let reasoning = '';

      try {
        const systemPrompt = buildSystemPrompt(turnAgent.agentId);
        const userMessage = buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections);
        const tools = buildToolDefinitions(aliveOpponents, validMoveDirections);

        const t0 = Date.now();
        const completion = await client.ai.chat.completions.create({
          model: turnAgent.modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          tools,
          tool_choice: 'required',
          temperature: 0.7,
          maxTokens: 500,
        });
        console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId})`);

        rawResponse = completion;
        const message = completion.choices?.[0]?.message;
        reasoning = message?.content ?? '';

        const toolCall = message?.tool_calls?.[0];
        if (toolCall) {
          action = parseToolCall(toolCall);
        } else {
          action = { type: 'rest' };
        }
      } catch (err) {
        console.error(`LLM call failed for ${turnAgent.agentId}:`, err);
        action = { type: 'rest' };
      }

      const { agents: updatedAgents, result } = executeAction(
        turnAgent.agentId,
        action,
        state.agents,
        config,
      );
      state = { ...state, agents: updatedAgents };

      if (result.type === 'attack' && result.targetEliminated) {
        state = {
          ...state,
          agents: updateAgent(state.agents, result.target, { eliminatedAtRound: round }),
        };
      }

      const memoryEntry = buildMemoryEntry(round, turnAgent.agentId, result, state.agents);
      const agentAfterAction = state.agents.find((a) => a.agentId === turnAgent.agentId)!;
      const newMemory = appendMemory(agentAfterAction.memory, memoryEntry, config.memoryCap);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { memory: newMemory }) };

      const resolvedAction = result.type === 'invalid'
        ? { type: 'invalid' as const, reason: result.reason }
        : action;

      const turnRecord: TurnRecord = {
        roundNumber: round,
        agentId: turnAgent.agentId,
        action: resolvedAction,
        result,
      };
      roundTurnRecords.push(turnRecord);

      await client.database.from('turns').insert([{
        game_id: gameId,
        round_number: round,
        agent_id: turnAgent.agentId,
        action_type: resolvedAction.type,
        action_params: resolvedAction.type === 'move'
          ? { direction: resolvedAction.direction }
          : resolvedAction.type === 'attack'
            ? { target: resolvedAction.target }
            : resolvedAction.type === 'turn'
              ? { direction: resolvedAction.direction }
              : {},
        result: result as unknown,
        llm_reasoning: reasoning || null,
        raw_llm_response: rawResponse,
      }]);

      await syncAgentStates(client, gameId, state.agents);

      await client.realtime.publish(`game:${gameId}`, 'turn_completed', {
        agentId: turnAgent.agentId,
        action: resolvedAction,
        result,
        agents: state.agents.map(toPublicAgent),
      });

      if (result.type === 'attack' && result.targetEliminated) {
        await client.realtime.publish(`game:${gameId}`, 'agent_eliminated', {
          agentId: result.target,
          eliminatedBy: turnAgent.agentId,
        });
      }

      await delay(TURN_DELAY_MS);
    }

    state = { ...state, turnRecords: [...state.turnRecords, ...roundTurnRecords] };

    const winResult = checkWinCondition(state);
    if (winResult.gameOver) {
      await finalizeGame(client, gameId, state, winResult);
      await client.realtime.publish(`game:${gameId}`, 'game_ended', {
        winner: winResult.winnerAgentId,
        result: winResult.result,
        finalStates: state.agents.map(toPublicAgent),
      });
      client.realtime.disconnect();
      return;
    }

    await client.database.from('games').update({ current_round: round }).eq('id', gameId);
  }

  const finalResult = checkWinCondition(state);
  await finalizeGame(client, gameId, state, finalResult);
  await client.realtime.publish(`game:${gameId}`, 'game_ended', {
    winner: finalResult.winnerAgentId,
    result: finalResult.result,
    finalStates: state.agents.map(toPublicAgent),
  });
  client.realtime.disconnect();
}

function toPublicAgent(a: AgentState) {
  return {
    agentId: a.agentId,
    position: a.position,
    hp: a.hp,
    ep: a.ep,
    orientation: a.orientation,
    status: a.status,
    speed: a.speed,
    eliminatedAtRound: a.eliminatedAtRound,
  };
}

function didRestLastTurn(state: GameState, agentId: AgentId): boolean {
  if (state.round <= 1) return false;
  const lastTurn = state.turnRecords.find(
    (t) => t.roundNumber === state.round - 1 && t.agentId === agentId,
  );
  if (!lastTurn) return false;
  return lastTurn.result.type === 'rest' || lastTurn.result.type === 'invalid';
}

async function syncAgentStates(client: ReturnType<typeof createClient>, gameId: string, agents: readonly AgentState[]) {
  for (const a of agents) {
    await client.database
      .from('agent_states')
      .update({
        hp: a.hp,
        ep: a.ep,
        position_x: a.position.x,
        position_y: a.position.y,
        orientation: a.orientation,
        status: a.status,
        eliminated_at_round: a.eliminatedAtRound,
        memory: a.memory,
      })
      .eq('game_id', gameId)
      .eq('agent_id', a.agentId);
  }
}

async function finalizeGame(
  client: ReturnType<typeof createClient>,
  gameId: string,
  state: GameState,
  winResult: { result: string | null; winnerAgentId: string | null },
) {
  await client.database
    .from('games')
    .update({
      status: 'completed',
      current_round: state.round,
      winner_agent_id: winResult.winnerAgentId,
      result: winResult.result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', gameId);
}
