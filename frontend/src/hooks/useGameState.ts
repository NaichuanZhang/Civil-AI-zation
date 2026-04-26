import { useState, useEffect, useCallback, useRef } from 'react';
import { insforge } from '../insforge';
import { useLog } from '../contexts/LogContext';
import type { GameUIState, EventLogEntry } from '../types';

const INITIAL_STATE: GameUIState = {
  gameId: null,
  status: 'idle',
  round: 0,
  agents: [],
  chests: [],
  eventLog: [],
  result: null,
  currentTurnAgent: null,
};

export function useGameState() {
  const [state, setState] = useState<GameUIState>(INITIAL_STATE);
  const { addLog } = useLog();
  const addLogRef = useRef(addLog);

  // Keep ref up to date
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  const startGame = useCallback(async () => {
    console.log('[useGameState] Starting game...');
    setState((s) => ({ ...s, status: 'loading', eventLog: [], result: null }));

    console.log('[useGameState] Invoking run-game function...');
    const { data, error } = await insforge.functions.invoke('run-game', {
      body: {},
    });

    if (error) {
      console.error('[useGameState] Error starting game:', error);
      setState((s) => ({ ...s, status: 'idle' }));
      return;
    }

    if (!data) {
      console.error('[useGameState] No data returned from run-game');
      setState((s) => ({ ...s, status: 'idle' }));
      return;
    }

    console.log('[useGameState] Game started successfully:', data);
    setState((s) => ({ ...s, gameId: data.gameId, status: 'running' }));
  }, []);

  useEffect(() => {
    if (!state.gameId) return;
    const channel = `game:${state.gameId}`;

    const setup = async () => {
      await insforge.realtime.connect();
      await insforge.realtime.subscribe(channel);

      insforge.realtime.on('game_started', (payload: Record<string, unknown>) => {
        setState((s) => ({
          ...s,
          status: 'running',
          agents: payload.agents as GameUIState['agents'],
          chests: [],
          round: 0,
        }));
      });

      insforge.realtime.on('round_started', (payload: Record<string, unknown>) => {
        const roundNumber = payload.roundNumber as number;
        setState((s) => ({
          ...s,
          round: roundNumber,
          eventLog: [
            ...s.eventLog,
            {
              type: 'summary',
              round: roundNumber,
              text: `--- Round ${roundNumber} ---`,
            } satisfies EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('round_summary', (payload: Record<string, unknown>) => {
        setState((s) => ({
          ...s,
          eventLog: [
            ...s.eventLog,
            {
              type: 'summary',
              round: payload.roundNumber as number,
              text: payload.summary as string,
            } satisfies EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('chest_spawned', (payload: Record<string, unknown>) => {
        const position = payload.position as { x: number; y: number };
        const roundNumber = payload.roundNumber as number;

        setState((s) => ({
          ...s,
          chests: [...s.chests, { position }],
          eventLog: [
            ...s.eventLog,
            {
              type: 'summary',
              round: roundNumber,
              text: `[R${roundNumber}] Treasure chest appeared at (${position.x},${position.y})!`,
            } satisfies EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('turn_started', (payload: Record<string, unknown>) => {
        const agentId = payload.agentId as string;

        // Just update state, don't log yet - will log when turn completes
        console.log('[turn_started] agentId:', agentId);

        setState((s) => ({
          ...s,
          currentTurnAgent: agentId,
          eventLog: [
            ...s.eventLog,
            {
              type: 'turn',
              round: s.round,
              agentId,
              text: `${agentId} is thinking...`,
            } as EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('turn_completed', (payload: Record<string, unknown>) => {
        const agentId = (payload as { agentId: string }).agentId;
        const action = payload.action as EventLogEntry['action'];
        const result = payload.result as EventLogEntry['result'];
        const reasoning = payload.reasoning as string | null;
        const incoming = payload.agents as GameUIState['agents'];
        const agents = incoming.map((a) =>
          a.agentId === agentId ? { ...a, lastAction: action } : a,
        );

        // Always log to agent-specific tab (addLog checks if agent is enabled)
        console.log('[turn_completed] agentId:', agentId, 'reasoning:', reasoning ? 'present' : 'none');

        // Use setState callback to get current round number and agent state
        setState((s) => {
          // Get states before and after action
          const prevAgentState = s.agents.find(a => a.agentId === agentId);
          const finalAgentState = agents.find(a => a.agentId === agentId);
          const pos = finalAgentState?.position;
          const orientation = finalAgentState?.orientation;
          const hp = finalAgentState?.hp ?? 0;
          const ep = finalAgentState?.ep ?? 0;

          // Build comprehensive single log entry
          const logParts: string[] = [];

          // Start with state before action
          if (prevAgentState) {
            logParts.push(`[R${s.round}] STATE: Pos (${prevAgentState.position.x},${prevAgentState.position.y}) | Face: ${prevAgentState.orientation} | HP: ${prevAgentState.hp} | EP: ${prevAgentState.ep}`);
          }

          // Add reasoning
          if (reasoning) {
            logParts.push(`REASONING: ${reasoning}`);
          }

          // Add action
          const actionStr = `ACTION: ${action?.type || 'unknown'}${action?.direction ? ' ' + action.direction : ''}${action?.target ? ' → ' + action.target : ''}`;
          logParts.push(actionStr);

          // Add result with final state
          if (result) {
            let resultStr = `RESULT: ${result.type}`;
            if (result.type === 'move' && result.to) {
              resultStr += ` → Pos (${result.to.x},${result.to.y}) | Face: ${orientation}`;
            }
            if (result.damage) {
              resultStr += ` (${result.damage} damage)`;
            }
            if (result.targetEliminated) {
              resultStr += ' [ELIMINATED]';
            }
            resultStr += ` | HP: ${hp} | EP: ${ep}`;
            logParts.push(resultStr);
          }

          // Log as single consolidated entry
          console.log('[turn_completed] Adding consolidated log');
          addLogRef.current(
            agentId as 'opus' | 'sonnet' | 'haiku',
            'action',
            logParts.join('\n'),
            {
              round: s.round,
              prevState: prevAgentState,
              action,
              result,
              reasoning,
              finalState: { position: pos, orientation, hp, ep }
            }
          );

          // Remove chest if agent collected one
          let chests = s.chests;
          const chestData = (result as Record<string, unknown>)?.chestCollected as
            | { item: { type: string; hpChange: number }; hpBefore: number; hpAfter: number }
            | undefined;
          if (result?.type === 'move' && result?.to && chestData) {
            chests = chests.filter(
              (c) => !(c.position.x === result.to!.x && c.position.y === result.to!.y),
            );
          }

          // Build event log entries
          const newEntries: EventLogEntry[] = [
            {
              type: 'turn',
              round: s.round,
              agentId,
              action,
              result,
              reasoning: reasoning || undefined,
            },
          ];

          if (chestData) {
            const effect = chestData.item.hpChange > 0 ? 'hp_boost' : 'hp_drain';
            const sign = chestData.item.hpChange > 0 ? '+' : '';
            const emoji = chestData.item.hpChange > 0 ? '💚' : '💔';
            newEntries.push({
              type: 'summary',
              round: s.round,
              text: `[R${s.round}] ${emoji} ${agentId} opened a chest: ${effect} (${sign}${chestData.item.hpChange} HP) → HP ${chestData.hpBefore} → ${chestData.hpAfter}`,
            });
          }

          return {
            ...s,
            agents,
            chests,
            currentTurnAgent: null,
            eventLog: [...s.eventLog, ...newEntries],
          };
        });
      });

      insforge.realtime.on('agent_eliminated', (payload: Record<string, unknown>) => {
        setState((s) => ({
          ...s,
          eventLog: [
            ...s.eventLog,
            {
              type: 'elimination',
              round: s.round,
              agentId: payload.agentId as string,
              eliminatedBy: payload.eliminatedBy as string,
            } satisfies EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('game_ended', (payload: Record<string, unknown>) => {
        setState((s) => ({
          ...s,
          status: 'completed',
          result: {
            winner: payload.winner as string | null,
            type: payload.result as string,
          },
          agents: payload.finalStates as GameUIState['agents'],
        }));
      });
    };

    setup();

    return () => {
      insforge.realtime.unsubscribe(channel);
      insforge.realtime.disconnect();
    };
  }, [state.gameId]);

  return { state, startGame };
}
