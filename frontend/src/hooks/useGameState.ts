import { useState, useEffect, useCallback, useRef } from 'react';
import { insforge } from '../insforge';
import { useLog } from '../contexts/LogContext';
import type { GameUIState, EventLogEntry } from '../types';

const INITIAL_STATE: GameUIState = {
  gameId: null,
  status: 'idle',
  round: 0,
  agents: [],
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
          round: 0,
        }));
      });

      insforge.realtime.on('round_started', (payload: Record<string, unknown>) => {
        setState((s) => ({
          ...s,
          round: payload.roundNumber as number,
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

      insforge.realtime.on('turn_started', (payload: Record<string, unknown>) => {
        const agentId = payload.agentId as string;

        // Always log to agent-specific tab (addLog checks if agent is enabled)
        console.log('[turn_started] agentId:', agentId);
        addLogRef.current(
          agentId as 'opus' | 'sonnet' | 'haiku',
          'system',
          `Turn started - ${agentId} is thinking...`,
          { round: state.round, agentId }
        );

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

        // Log reasoning/rationale first
        if (reasoning) {
          console.log('[turn_completed] Adding reasoning log');
          addLogRef.current(
            agentId as 'opus' | 'sonnet' | 'haiku',
            'prompt',
            `Reasoning: ${reasoning}`,
            { reasoning, action }
          );
        }

        // Then log the action
        console.log('[turn_completed] Adding action log');
        addLogRef.current(
          agentId as 'opus' | 'sonnet' | 'haiku',
          'action',
          `Action: ${action?.type || 'unknown'}${action?.direction ? ' ' + action.direction : ''}${action?.target ? ' → ' + action.target : ''}`,
          { action, result }
        );

        // Finally log the result
        if (result) {
          console.log('[turn_completed] Adding result log');
          addLogRef.current(
            agentId as 'opus' | 'sonnet' | 'haiku',
            'result',
            `Result: ${result.type}${result.damage ? ` (${result.damage} damage)` : ''}${result.targetEliminated ? ' [ELIMINATED]' : ''}`,
            result
          );
        }

        setState((s) => ({
          ...s,
          agents,
          currentTurnAgent: null,
          eventLog: [
            ...s.eventLog,
            {
              type: 'turn',
              round: s.round,
              agentId,
              action,
              result,
              reasoning: reasoning || undefined,
            } satisfies EventLogEntry,
          ],
        }));
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
