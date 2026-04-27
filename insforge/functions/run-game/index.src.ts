import { createClient } from 'npm:@insforge/sdk';
import {
  DEFAULT_GAME_CONFIG,
  BACKEND_CONFIG,
  AGENT_CONFIG_MAP,
  createInitialState,
  buildSharedView,
  buildPersonalView,
  buildSystemPrompt,
  buildUserMessage,
  buildToolDefinitions,
  buildJsonModeInstructions,
  parseToolCall,
  parseJsonContent,
  executeAction,
  getTurnOrder,
  resetEpForTurn,
  checkWinCondition,
  updateAgent,
  appendMemory,
  buildMemoryEntry,
  buildSummaryPrompt,
  getValidMoveDirections,
  spawnChest,
} from './engine/index.js';
import type {
  AgentState,
  AgentId,
  AgentAction,
  ActionResult,
  GameState,
  GameConfig,
  TurnRecord,
  ToolDefinition,
} from './engine/index.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LlmResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ function: { name: string; arguments: string } }>;
    };
  }>;
}

async function callLlm(
  client: ReturnType<typeof createClient>,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    tools?: readonly ToolDefinition[];
    toolChoice?: string | Record<string, unknown>;
    responseFormat?: Record<string, unknown>;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LlmResponse> {
  if (params.model.startsWith('zai/')) {
    const actualModel = params.model.slice(4);
    const apiKey = Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('ZAI_API_KEY not configured');

    const body: Record<string, unknown> = {
      model: actualModel,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 500,
    };
    if (params.responseFormat) {
      body.response_format = params.responseFormat;
    } else if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = params.toolChoice ?? 'auto';
    }

    const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Z.AI API error (${res.status}): ${text}`);
    }
    return await res.json() as LlmResponse;
  }

  const supportsThinking = params.model.startsWith('anthropic/');
  return await client.ai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    ...(params.tools?.length ? { tools: params.tools, toolChoice: params.toolChoice } : {}),
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    ...(supportsThinking ? { thinking: true } : {}),
  }) as LlmResponse;
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

function parseActionsFromContent(content: string): AgentAction[] {
  const actions: AgentAction[] = [];
  const pattern = /\b(move|attack|turn|rest):(up|down|left|right|opus|sonnet|haiku)\b/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const param = match[2].toLowerCase();
    if (type === 'move' && ['up', 'down', 'left', 'right'].includes(param)) {
      actions.push({ type: 'move', direction: param as 'up' | 'down' | 'left' | 'right' });
    } else if (type === 'attack' && ['opus', 'sonnet', 'haiku'].includes(param)) {
      actions.push({ type: 'attack', target: param as AgentId });
    } else if (type === 'turn' && ['up', 'down', 'left', 'right'].includes(param)) {
      actions.push({ type: 'turn', direction: param as 'up' | 'down' | 'left' | 'right' });
    } else if (type === 'rest') {
      actions.push({ type: 'rest' });
    }
  }
  if (actions.length > 0) {
    console.log(`[parseActionsFromContent] Extracted ${actions.length} actions from content text`);
  }
  return actions.length > 0 ? actions : [{ type: 'rest' }];
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
  await delay(BACKEND_CONFIG.gameLoopDelayMs);

  await client.realtime.publish(`game:${gameId}`, 'game_started', {
    gameId,
    config,
    agents: state.agents.map(toPublicAgent),
  });

  for (let round = 1; round <= config.maxRounds; round++) {
    state = { ...state, round };

    console.log(`[R${round}] Round started`);

    await client.realtime.publish(`game:${gameId}`, 'round_started', {
      roundNumber: round,
      turnOrder: getTurnOrder(state.agents).map((a) => a.agentId),
    });

    // Spawn chest on configured rounds
    if (config.chests.enabled && config.chests.spawnRounds.includes(round)) {
      const newChest = spawnChest(state.agents, state.chests, config);
      if (newChest) {
        state = { ...state, chests: [...state.chests, newChest] };
        console.log(`[R${round}] Chest spawned at (${newChest.position.x},${newChest.position.y})`);
        await client.realtime.publish(`game:${gameId}`, 'chest_spawned', {
          roundNumber: round,
          position: newChest.position,
        });
      }
    }

    if (round > 1) {
      const prevTurns = state.turnRecords.filter((t) => t.roundNumber === round - 1);
      try {
        const { system, user } = buildSummaryPrompt(round - 1, prevTurns, state.agents);
        const tSummary = Date.now();
        const completion = await callLlm(client, {
          model: BACKEND_CONFIG.summaryModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.8,
          maxTokens: 200,
        });
        console.log(`[R${round}][summary] LLM call: ${Date.now() - tSummary}ms (${BACKEND_CONFIG.summaryModel})`);
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

      let parsedActions: AgentAction[] = [{ type: 'rest' }];
      let rawResponse: unknown = null;
      let reasoning = '';

      const isZaiModel = turnAgent.modelId.startsWith('zai/');

      try {
        const systemPrompt = buildSystemPrompt(turnAgent.agentId);
        const userMessage = buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections);

        const t0 = Date.now();
        const agentMaxTokens = AGENT_CONFIG_MAP[turnAgent.agentId]?.maxTokens ?? 500;

        if (isZaiModel) {
          const jsonInstructions = buildJsonModeInstructions(aliveOpponents, validMoveDirections);
          const completion = await callLlm(client, {
            model: turnAgent.modelId,
            messages: [
              { role: 'system', content: systemPrompt + '\n\n' + jsonInstructions },
              { role: 'user', content: userMessage },
            ],
            responseFormat: { type: 'json_object' },
            temperature: 0.7,
            maxTokens: agentMaxTokens,
          });
          console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId}, json_mode, ${agentMaxTokens} tokens)`);

          rawResponse = completion;
          const message = completion.choices?.[0]?.message;
          const content = message?.content || '';
          const parsed = parseJsonContent(content);
          parsedActions = parsed.actions;
          reasoning = message?.reasoning_content || parsed.reasoning;
        } else {
          const tools = buildToolDefinitions(aliveOpponents, validMoveDirections);
          const completion = await callLlm(client, {
            model: turnAgent.modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            tools,
            toolChoice: { type: 'function', function: { name: 'choose_actions' } },
            temperature: 0.7,
            maxTokens: agentMaxTokens,
          });
          console.log(`[R${round}][${turnAgent.agentId}] LLM call: ${Date.now() - t0}ms (${turnAgent.modelId}, ${agentMaxTokens} tokens)`);

          rawResponse = completion;
          const message = completion.choices?.[0]?.message;
          const thinkingReasoning = message?.reasoning_content || '';

          const toolCalls = message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            let toolReasoning = '';
            try {
              const toolArgs = JSON.parse(toolCalls[0].function.arguments);
              toolReasoning = toolArgs.reasoning || '';
            } catch { /* ignore */ }
            reasoning = thinkingReasoning || toolReasoning || message?.content || '';

            const merged: AgentAction[] = [];
            for (const tc of toolCalls) {
              merged.push(...parseToolCall(tc));
            }
            parsedActions = merged.length > 0 ? merged : [{ type: 'rest' }];
          } else {
            reasoning = thinkingReasoning || message?.content || '';
            parsedActions = parseActionsFromContent(message?.content || '');
          }
        }
      } catch (err) {
        console.error(`LLM call failed for ${turnAgent.agentId}:`, err);
      }

      // Sort actions in execution order: move → turn → attack; rest standalone
      const ACTION_ORDER: Record<string, number> = { move: 0, turn: 1, attack: 2, rest: 3 };
      const orderedActions = [...parsedActions].sort(
        (a, b) => (ACTION_ORDER[a.type] ?? 99) - (ACTION_ORDER[b.type] ?? 99),
      );

      console.log(`[R${round}][${turnAgent.agentId}] Actions: ${orderedActions.map(a => a.type).join(' → ')}`);

      // Execute all actions in sequence
      const allResults: ActionResult[] = [];
      const allResolvedActions: Array<AgentAction | { type: 'invalid'; reason?: string }> = [];

      for (const action of orderedActions) {
        if (action.type === 'rest') {
          const { agents: ra, chests: rc, result: rr } = executeAction(
            turnAgent.agentId, action, state.agents, config, state.chests,
          );
          state = { ...state, agents: ra, chests: rc };
          allResults.push(rr);
          allResolvedActions.push(action);
          break;
        }

        const { agents: ua, chests: uc, result: ur } = executeAction(
          turnAgent.agentId, action, state.agents, config, state.chests,
        );
        state = { ...state, agents: ua, chests: uc };
        allResults.push(ur);

        if (ur.type === 'invalid') {
          allResolvedActions.push({ type: 'invalid' as const, reason: ur.reason });
          break;
        }

        allResolvedActions.push(action);

        if (ur.type === 'attack' && ur.targetEliminated) {
          state = {
            ...state,
            agents: updateAgent(state.agents, ur.target, { eliminatedAtRound: round }),
          };
        }
      }

      // Use last successful result for memory and broadcast
      const lastResult = allResults[allResults.length - 1]!;
      const lastAction = allResolvedActions[allResolvedActions.length - 1]!;

      const memoryEntry = buildMemoryEntry(round, turnAgent.agentId, lastResult, state.agents);
      const agentAfterAction = state.agents.find((a) => a.agentId === turnAgent.agentId)!;
      const newMemory = appendMemory(agentAfterAction.memory, memoryEntry, config.memoryCap);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { memory: newMemory }) };

      const turnRecord: TurnRecord = {
        roundNumber: round,
        agentId: turnAgent.agentId,
        action: lastAction as TurnRecord['action'],
        result: lastResult,
      };
      roundTurnRecords.push(turnRecord);

      // Store each sub-action as a separate DB row
      for (let i = 0; i < allResolvedActions.length; i++) {
        const act = allResolvedActions[i]!;
        const res = allResults[i]!;
        await client.database.from('turns').insert([{
          game_id: gameId,
          round_number: round,
          agent_id: turnAgent.agentId,
          action_type: act.type,
          action_params: act.type === 'move'
            ? { direction: (act as AgentAction & { direction: string }).direction }
            : act.type === 'attack'
              ? { target: (act as AgentAction & { target: string }).target }
              : act.type === 'turn'
                ? { direction: (act as AgentAction & { direction: string }).direction }
                : {},
          result: res as unknown,
          llm_reasoning: i === 0 ? (reasoning || null) : null,
          raw_llm_response: i === 0 ? rawResponse : null,
        }]);
      }

      await syncAgentStates(client, gameId, state.agents);

      await client.realtime.publish(`game:${gameId}`, 'turn_completed', {
        agentId: turnAgent.agentId,
        actions: allResolvedActions,
        results: allResults,
        action: lastAction,
        result: lastResult,
        reasoning: reasoning || null,
        agents: state.agents.map(toPublicAgent),
      });

      for (const res of allResults) {
        if (res.type === 'attack' && res.targetEliminated) {
          await client.realtime.publish(`game:${gameId}`, 'agent_eliminated', {
            agentId: res.target,
            eliminatedBy: turnAgent.agentId,
          });
        }
      }

      await delay(BACKEND_CONFIG.turnDelayMs);
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
