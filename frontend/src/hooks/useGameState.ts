import { useState, useEffect, useCallback } from 'react';
import { insforge } from '../insforge';
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

  const startGame = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', eventLog: [], result: null }));
    const { data, error } = await insforge.functions.invoke('run-game', {
      body: {},
    });
    if (error || !data) {
      setState((s) => ({ ...s, status: 'idle' }));
      return;
    }
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
        setState((s) => ({ ...s, currentTurnAgent: payload.agentId as string }));
      });

      insforge.realtime.on('turn_completed', (payload: Record<string, unknown>) => {
        const actingAgent = (payload as { agentId: string }).agentId;
        const action = payload.action as EventLogEntry['action'];
        const incoming = payload.agents as GameUIState['agents'];
        const agents = incoming.map((a) =>
          a.agentId === actingAgent ? { ...a, lastAction: action } : a,
        );
        setState((s) => ({
          ...s,
          agents,
          currentTurnAgent: null,
          eventLog: [
            ...s.eventLog,
            {
              type: 'turn',
              round: s.round,
              agentId: actingAgent,
              action,
              result: payload.result as EventLogEntry['result'],
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
