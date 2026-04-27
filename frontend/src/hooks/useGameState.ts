import { useState, useEffect, useCallback, useRef } from 'react';
import { insforge } from '../insforge';
import { useLog } from '../contexts/LogContext';
import { AGENT_NAMES } from '../config';
import type { GameUIState, EventLogEntry } from '../types';

const agentName = (id: string) => AGENT_NAMES[id] ?? id;

const INITIAL_STATE: GameUIState = {
  gameId: null,
  status: 'idle',
  round: 0,
  agents: [],
  chests: [],
  eventLog: [],
  result: null,
  currentTurnAgent: null,
  attackedAgents: [],
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
              text: `${agentName(agentId)} is thinking...`,
            } as EventLogEntry,
          ],
        }));
      });

      insforge.realtime.on('turn_completed', (payload: Record<string, unknown>) => {
        const agentId = (payload as { agentId: string }).agentId;
        const actions = (payload.actions ?? [payload.action]) as EventLogEntry['action'][];
        const results = (payload.results ?? [payload.result]) as EventLogEntry['result'][];
        const lastAction = [...actions].reverse().find(a => a?.type !== 'invalid') ?? actions[actions.length - 1];
        const reasoning = payload.reasoning as string | null;
        const incoming = payload.agents as GameUIState['agents'];
        const agents = incoming.map((a) =>
          a.agentId === agentId ? { ...a, lastAction } : a,
        );

        console.log('[turn_completed] agentId:', agentId, 'actions:', actions.length);

        setState((s) => {
          const prevAgentState = s.agents.find(a => a.agentId === agentId);
          const finalAgentState = agents.find(a => a.agentId === agentId);
          const hp = finalAgentState?.hp ?? 0;
          const ep = finalAgentState?.ep ?? 0;

          // Build log for agent tab
          const logParts: string[] = [];
          if (prevAgentState) {
            logParts.push(`[R${s.round}] STATE: Pos (${prevAgentState.position.x},${prevAgentState.position.y}) | Face: ${prevAgentState.orientation} | HP: ${prevAgentState.hp} | EP: ${prevAgentState.ep}`);
          }
          if (reasoning) {
            logParts.push(`REASONING: ${reasoning}`);
          }
          for (let i = 0; i < actions.length; i++) {
            const act = actions[i];
            const res = results[i];
            const actStr = `ACTION ${i + 1}: ${act?.type || 'unknown'}${act?.direction ? ' ' + act.direction : ''}${act?.target ? ' → ' + act.target : ''}`;
            logParts.push(actStr);
            if (res) {
              let resStr = `RESULT ${i + 1}: ${res.type}`;
              if (res.type === 'move' && res.to) resStr += ` → (${res.to.x},${res.to.y})`;
              if (res.damage) resStr += ` (${res.damage} damage)`;
              if (res.targetEliminated) resStr += ' [ELIMINATED]';
              logParts.push(resStr);
            }
          }
          logParts.push(`FINAL: HP: ${hp} | EP: ${ep}`);

          addLogRef.current(
            agentId as 'opus' | 'sonnet' | 'haiku',
            'action',
            logParts.join('\n'),
            { round: s.round, prevState: prevAgentState, action: lastAction, result: results[results.length - 1], reasoning, finalState: { position: finalAgentState?.position, orientation: finalAgentState?.orientation, hp, ep } }
          );

          // Remove chests collected in any move result
          let chests = s.chests;
          const newEntries: EventLogEntry[] = [];

          for (let i = 0; i < actions.length; i++) {
            const act = actions[i];
            const res = results[i];

            // Build readable text for system log
            let actionText = `${agentName(agentId)}`;
            if (act?.type === 'move') actionText += ` moved ${act.direction}`;
            else if (act?.type === 'attack') actionText += ` attacked ${agentName(act.target ?? '')}`;
            else if (act?.type === 'turn') actionText += ` turned ${act.direction}`;
            else if (act?.type === 'rest') actionText += ` rested`;
            else if (act?.type === 'invalid') actionText += ` invalid action`;
            if (res?.type === 'attack' && res.damage) {
              actionText += ` (${res.damage} dmg${res.targetEliminated ? ' - ELIMINATED!' : ''})`;
            }

            newEntries.push({
              type: 'turn',
              round: s.round,
              agentId,
              action: act,
              result: res,
              reasoning: i === 0 ? (reasoning || undefined) : undefined,
              text: `[R${s.round}] ${actionText}`,
            });

            const chestData = (res as Record<string, unknown>)?.chestCollected as
              | { item: { type: string; hpChange: number }; hpBefore: number; hpAfter: number }
              | undefined;
            if (res?.type === 'move' && res?.to && chestData) {
              chests = chests.filter(
                (c) => !(c.position.x === res.to!.x && c.position.y === res.to!.y),
              );
              const effect = chestData.item.hpChange > 0 ? 'hp_boost' : 'hp_drain';
              const sign = chestData.item.hpChange > 0 ? '+' : '';
              const emoji = chestData.item.hpChange > 0 ? '💚' : '💔';
              newEntries.push({
                type: 'summary',
                round: s.round,
                text: `[R${s.round}] ${emoji} ${agentName(agentId)} opened a chest: ${effect} (${sign}${chestData.item.hpChange} HP) → HP ${chestData.hpBefore} → ${chestData.hpAfter}`,
              });
            }
          }

          const attackedTargets = results
            .filter((r) => r?.type === 'attack' && r.damage)
            .map((r) => r!.target!)
            .filter(Boolean);

          if (attackedTargets.length > 0) {
            setTimeout(() => {
              setState((prev) => ({
                ...prev,
                attackedAgents: prev.attackedAgents.filter((id) => !attackedTargets.includes(id)),
              }));
            }, 800);
          }

          return {
            ...s,
            agents,
            chests,
            currentTurnAgent: null,
            attackedAgents: [...new Set([...s.attackedAgents, ...attackedTargets])],
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
