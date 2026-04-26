import { describe, it, expect } from 'vitest';
import { createClient } from '@insforge/sdk';
import {
  DEFAULT_GAME_CONFIG,
  AGENT_CONFIG_MAP,
  createInitialState,
  buildSharedView,
  buildPersonalView,
  buildSystemPrompt,
  buildUserMessage,
  buildToolDefinitions,
  parseToolCall,
  getValidMoveDirections,
  executeAction,
  getTurnOrder,
  resetEpForTurn,
  updateAgent,
} from '../src/index.js';
import type {
  AgentId,
  AgentAction,
  GameState,
  ToolDefinition,
} from '../src/index.js';

const INSFORGE_URL = 'https://ayyn5caf.us-east.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTg4MjJ9.q8yL8pEOD_4dC83dquE8kCj9HkPyeiwr3LdfJAmiXMQ';
const ZAI_API_KEY = 'd5c6154ddecb4959a684fa644385e63f.i9sBy63iuOH1Pt4d';

interface LlmResponse {
  readonly id?: string;
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | null;
      readonly reasoning_content?: string | null;
      readonly tool_calls?: ReadonlyArray<{
        readonly id?: string;
        readonly type?: string;
        readonly function: { readonly name: string; readonly arguments: string };
      }>;
    };
    readonly finish_reason?: string;
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
}

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

async function callInsforgeAi(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: readonly ToolDefinition[];
  toolChoice?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmResponse> {
  return await insforge.ai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    ...(params.tools?.length ? { tools: params.tools, toolChoice: params.toolChoice } : {}),
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  }) as LlmResponse;
}

async function callZaiApi(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: readonly ToolDefinition[];
  tool_choice?: string;
  temperature?: number;
  max_tokens?: number;
}): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 500,
  };
  if (params.tools?.length) {
    body.tools = params.tools;
    body.tool_choice = params.tool_choice ?? 'auto';
  }

  const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z.AI API error (${res.status}): ${text}`);
  }
  return await res.json() as LlmResponse;
}

async function callLlmForAgent(
  agentId: AgentId,
  systemPrompt: string,
  userMessage: string,
  tools: readonly ToolDefinition[],
): Promise<LlmResponse> {
  const modelId = AGENT_CONFIG_MAP[agentId].modelId;
  const maxTokens = AGENT_CONFIG_MAP[agentId].maxTokens;

  if (modelId.startsWith('z-ai/')) {
    const actualModel = modelId.slice(5);
    return callZaiApi({
      model: actualModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      tools,
      tool_choice: 'required',
      temperature: 0.7,
      max_tokens: maxTokens,
    });
  }

  return callInsforgeAi({
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    tools,
    toolChoice: 'required',
    temperature: 0.7,
    maxTokens: maxTokens,
  });
}

function buildTurnInputs(state: GameState, agentId: AgentId) {
  const sharedView = buildSharedView(state);
  const personalView = buildPersonalView(state, agentId);
  const aliveAgents = state.agents.filter((a) => a.status === 'alive');
  const aliveOpponents = aliveAgents
    .filter((a) => a.agentId !== agentId)
    .map((a) => a.agentId);
  const currentAgent = state.agents.find((a) => a.agentId === agentId)!;
  const validMoveDirections = getValidMoveDirections(
    currentAgent.position,
    state.config.mapWidth,
    state.config.mapHeight,
    aliveAgents,
  );

  const systemPrompt = buildSystemPrompt(agentId);
  const userMessage = buildUserMessage(sharedView, personalView, aliveAgents, validMoveDirections);
  const tools = buildToolDefinitions(aliveOpponents, validMoveDirections);

  return { systemPrompt, userMessage, tools, aliveOpponents, validMoveDirections };
}

const VALID_ACTION_TYPES = ['move', 'attack', 'turn', 'rest'] as const;
const VALID_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
const VALID_AGENT_IDS = ['opus', 'sonnet', 'haiku'] as const;

describe('LLM Integration: One round with real model calls', () => {
  it('calls each agent model and receives parseable tool call responses', async () => {
    const config = DEFAULT_GAME_CONFIG;
    let state = createInitialState(config);
    state = { ...state, round: 1 };

    const turnOrder = getTurnOrder(state.agents);
    const results: Array<{
      agentId: AgentId;
      rawResponse: LlmResponse;
      parsedActions: AgentAction[];
      finishReason: string | undefined;
    }> = [];

    for (const turnAgent of turnOrder) {
      const currentAgent = state.agents.find((a) => a.agentId === turnAgent.agentId)!;
      if (currentAgent.status !== 'alive') continue;

      const withEp = resetEpForTurn(currentAgent, config, false);
      state = { ...state, agents: updateAgent(state.agents, turnAgent.agentId, { ep: withEp.ep }) };

      const { systemPrompt, userMessage, tools } = buildTurnInputs(state, turnAgent.agentId);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`AGENT: ${turnAgent.agentId} (${turnAgent.modelId})`);
      console.log(`${'='.repeat(60)}`);

      const t0 = Date.now();
      const completion = await callLlmForAgent(turnAgent.agentId, systemPrompt, userMessage, tools);
      const elapsed = Date.now() - t0;

      console.log(`LLM call: ${elapsed}ms`);
      console.log(`Response ID: ${completion.id}`);
      console.log(`Usage: ${JSON.stringify(completion.usage)}`);

      // ==========================================
      // ASSERT: Response structure is complete
      // ==========================================
      expect(completion.choices, `${turnAgent.agentId}: choices missing`).toBeDefined();
      expect(completion.choices!.length, `${turnAgent.agentId}: choices empty`).toBeGreaterThan(0);

      const choice = completion.choices![0]!;
      const message = choice.message;
      expect(message, `${turnAgent.agentId}: message missing`).toBeDefined();

      const finishReason = choice.finish_reason;
      console.log(`Finish reason: ${finishReason}`);

      // ==========================================
      // ASSERT: Not truncated (finish_reason should be 'stop' or 'tool_calls')
      // ==========================================
      if (finishReason) {
        expect(
          finishReason,
          `${turnAgent.agentId}: finish_reason='${finishReason}' indicates truncation`,
        ).not.toBe('length');
      }

      // ==========================================
      // ASSERT: Tool calls present
      // ==========================================
      const toolCalls = message!.tool_calls;
      console.log(`Tool calls count: ${toolCalls?.length ?? 0}`);

      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0]!;
        console.log(`Tool call function: ${toolCall.function.name}`);
        console.log(`Tool call arguments (raw): ${toolCall.function.arguments}`);

        // ==========================================
        // ASSERT: Tool call arguments are valid JSON
        // ==========================================
        let parsedArgs: unknown;
        expect(() => {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        }, `${turnAgent.agentId}: tool_call arguments is not valid JSON: "${toolCall.function.arguments}"`).not.toThrow();

        console.log(`Tool call arguments (parsed): ${JSON.stringify(parsedArgs, null, 2)}`);

        // ==========================================
        // ASSERT: parseToolCall produces valid actions
        // ==========================================
        const parsedActions = parseToolCall({
          function: { name: toolCall.function.name, arguments: toolCall.function.arguments },
        });
        console.log(`Parsed actions: ${JSON.stringify(parsedActions)}`);

        expect(
          parsedActions.length,
          `${turnAgent.agentId}: parseToolCall returned empty array`,
        ).toBeGreaterThan(0);

        for (const action of parsedActions) {
          expect(
            VALID_ACTION_TYPES,
            `${turnAgent.agentId}: invalid action type '${action.type}'`,
          ).toContain(action.type);

          if (action.type === 'move' || action.type === 'turn') {
            expect(
              VALID_DIRECTIONS,
              `${turnAgent.agentId}: invalid direction '${action.direction}' in ${action.type}`,
            ).toContain(action.direction);
          }

          if (action.type === 'attack') {
            expect(
              VALID_AGENT_IDS,
              `${turnAgent.agentId}: invalid attack target '${action.target}'`,
            ).toContain(action.target);
            expect(
              action.target,
              `${turnAgent.agentId}: agent is attacking itself`,
            ).not.toBe(turnAgent.agentId);
          }
        }

        // ==========================================
        // ASSERT: First action is not silently defaulting to rest
        //         due to bad parsing (unless the model actually chose rest)
        // ==========================================
        if (toolCall.function.name === 'choose_actions') {
          const args = parsedArgs as { actions?: unknown[] };
          if (Array.isArray(args.actions) && args.actions.length > 0) {
            const firstRawAction = String(args.actions[0]);
            if (firstRawAction !== 'rest') {
              expect(
                parsedActions[0]!.type,
                `${turnAgent.agentId}: model chose '${firstRawAction}' but parseToolCall returned rest — likely a parsing bug`,
              ).not.toBe('rest');
            }
          }
        }

        results.push({
          agentId: turnAgent.agentId,
          rawResponse: completion,
          parsedActions,
          finishReason,
        });

        // Execute the first action to advance game state for next agent
        const action = parsedActions[0] ?? { type: 'rest' as const };
        const { agents: updatedAgents, chests: updatedChests } = executeAction(
          turnAgent.agentId,
          action,
          state.agents,
          config,
          state.chests,
        );
        state = { ...state, agents: updatedAgents, chests: updatedChests };
      } else {
        // No tool calls — this is a problem since we set tool_choice=required
        console.log(`Content: ${message!.content}`);
        console.log(`Reasoning: ${message!.reasoning_content}`);

        results.push({
          agentId: turnAgent.agentId,
          rawResponse: completion,
          parsedActions: [{ type: 'rest' }],
          finishReason,
        });

        console.warn(
          `WARNING: ${turnAgent.agentId} returned no tool_calls despite tool_choice=required. `
          + `Content was: "${message!.content?.slice(0, 200)}"`,
        );
      }
    }

    // ==========================================
    // SUMMARY: All agents responded
    // ==========================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    for (const r of results) {
      const actionSummary = r.parsedActions.map((a) => {
        if (a.type === 'move') return `move:${a.direction}`;
        if (a.type === 'attack') return `attack:${a.target}`;
        if (a.type === 'turn') return `turn:${a.direction}`;
        return 'rest';
      }).join(' → ');
      console.log(
        `${r.agentId}: finish=${r.finishReason}, actions=[${actionSummary}], `
        + `tokens=${r.rawResponse.usage?.total_tokens ?? '?'}`,
      );
    }

    expect(results.length, 'Not all alive agents produced results').toBe(3);
  }, 60_000);

  it('choose_actions tool definition enum matches valid game actions', () => {
    const state = createInitialState(DEFAULT_GAME_CONFIG);
    const stateR1 = { ...state, round: 1 };

    for (const agent of state.agents) {
      const { tools, aliveOpponents, validMoveDirections } = buildTurnInputs(stateR1, agent.agentId);

      expect(tools.length, `${agent.agentId}: should have exactly 1 tool (choose_actions)`).toBe(1);

      const tool = tools[0]!;
      expect(tool.function.name).toBe('choose_actions');

      const params = tool.function.parameters as {
        properties: { actions: { items: { enum: string[] } } };
      };
      const enumValues = params.properties.actions.items.enum;

      for (const dir of validMoveDirections) {
        expect(enumValues, `${agent.agentId}: move:${dir} missing from enum`).toContain(`move:${dir}`);
      }
      for (const opp of aliveOpponents) {
        expect(enumValues, `${agent.agentId}: attack:${opp} missing from enum`).toContain(`attack:${opp}`);
      }
      expect(enumValues).toContain('rest');
      for (const dir of VALID_DIRECTIONS) {
        expect(enumValues, `${agent.agentId}: turn:${dir} missing from enum`).toContain(`turn:${dir}`);
      }
    }
  });

  it('parseToolCall handles truncated JSON gracefully', () => {
    const truncated = '{"actions":["move:l';
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: truncated },
    });
    expect(result).toEqual([{ type: 'rest' }]);
  });

  it('parseToolCall handles empty actions array', () => {
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: '{"actions":[]}' },
    });
    expect(result).toEqual([{ type: 'rest' }]);
  });

  it('parseToolCall handles non-array actions field', () => {
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: '{"actions":"move:left"}' },
    });
    expect(result).toEqual([{ type: 'rest' }]);
  });

  it('parseToolCall handles unknown action strings in array', () => {
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: '{"actions":["fly:up","move:left"]}' },
    });
    expect(result).toEqual([{ type: 'move', direction: 'left' }]);
  });

  it('parseToolCall handles multi-action sequence', () => {
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: '{"actions":["move:left","attack:opus"]}' },
    });
    expect(result).toEqual([
      { type: 'move', direction: 'left' },
      { type: 'attack', target: 'opus' },
    ]);
  });

  it('parseToolCall stops sequence at rest', () => {
    const result = parseToolCall({
      function: { name: 'choose_actions', arguments: '{"actions":["move:left","rest","attack:opus"]}' },
    });
    expect(result).toEqual([
      { type: 'move', direction: 'left' },
      { type: 'rest' },
    ]);
  });
});
