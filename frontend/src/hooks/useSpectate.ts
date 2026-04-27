import { useState, useEffect, useRef, useCallback } from 'react';
import { insforge } from '../insforge';
import { AGENT_NAMES } from '../config';
import type { GameUIState, EventLogEntry, AgentUIState } from '../types';

const agentName = (id: string) => AGENT_NAMES[id] ?? id;

function getFunctionsUrl(): string {
  const baseUrl = import.meta.env.VITE_INSFORGE_URL as string;
  const match = baseUrl.match(/https?:\/\/([^.]+)\./);
  const appKey = match ? match[1] : '';
  return `https://${appKey}.functions.insforge.app`;
}

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

const REPLAY_DELAYS: Record<number, number> = {
  1: 1500,
  2: 750,
  4: 375,
};

interface SpectateResponse {
  game: {
    id: string;
    status: string;
    current_round: number;
    max_rounds: number;
    config: unknown;
    winner_agent_id: string | null;
    result: string | null;
  } | null;
  agents: Array<{
    agent_id: string;
    game_id: string;
    hp: number;
    ep: number;
    position_x: number;
    position_y: number;
    orientation: string;
    status: string;
    speed: number;
    eliminated_at_round: number | null;
  }>;
  summaries: Array<{
    round_number: number;
    summary: string;
  }>;
  turns: Array<{
    round_number: number;
    agent_id: string;
    action_type: string;
    action_params: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    llm_reasoning: string | null;
  }>;
  message?: string;
}

interface HistoryEvent {
  kind: 'round_start' | 'turn' | 'summary' | 'elimination';
  round: number;
  entry: EventLogEntry;
  agents?: AgentUIState[];
}

function buildAgentsFromResponse(agents: SpectateResponse['agents']): AgentUIState[] {
  return agents.map((a) => ({
    agentId: a.agent_id,
    position: { x: a.position_x, y: a.position_y },
    hp: a.hp,
    ep: a.ep,
    orientation: a.orientation,
    status: a.status,
    speed: a.speed,
    eliminatedAtRound: a.eliminated_at_round,
  }));
}

function buildHistoryEvents(
  turns: SpectateResponse['turns'],
  summaries: SpectateResponse['summaries'],
): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const summaryMap = new Map(summaries.map((s) => [s.round_number, s.summary]));
  const roundsSet = new Set<number>();

  for (const turn of turns) {
    if (!roundsSet.has(turn.round_number)) {
      roundsSet.add(turn.round_number);
      events.push({
        kind: 'round_start',
        round: turn.round_number,
        entry: {
          type: 'summary',
          round: turn.round_number,
          text: `--- Round ${turn.round_number} ---`,
        },
      });
    }

    const action = turn.action_params
      ? { type: turn.action_type, ...turn.action_params }
      : { type: turn.action_type };

    const result = turn.result as EventLogEntry['result'] | null;

    let actionText = agentName(turn.agent_id);
    if (turn.action_type === 'move') actionText += ` moved ${(turn.action_params as Record<string, string>)?.direction ?? ''}`;
    else if (turn.action_type === 'attack') actionText += ` attacked ${agentName((turn.action_params as Record<string, string>)?.target ?? '')}`;
    else if (turn.action_type === 'turn') actionText += ` turned ${(turn.action_params as Record<string, string>)?.direction ?? ''}`;
    else if (turn.action_type === 'rest') actionText += ` rested`;
    else if (turn.action_type === 'invalid') actionText += ` invalid action`;

    if (result?.type === 'attack' && result.damage) {
      actionText += ` (${result.damage} dmg${result.targetEliminated ? ' - ELIMINATED!' : ''})`;
    }

    events.push({
      kind: 'turn',
      round: turn.round_number,
      entry: {
        type: 'turn',
        round: turn.round_number,
        agentId: turn.agent_id,
        action: action as EventLogEntry['action'],
        result: result ?? undefined,
        reasoning: turn.llm_reasoning ?? undefined,
        text: `[R${turn.round_number}] ${actionText}`,
      },
    });

    if (result?.targetEliminated && result.target) {
      events.push({
        kind: 'elimination',
        round: turn.round_number,
        entry: {
          type: 'elimination',
          round: turn.round_number,
          agentId: result.target,
          eliminatedBy: turn.agent_id,
        },
      });
    }
  }

  for (const [roundNum, summary] of summaryMap) {
    let lastTurnIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev && ev.round === roundNum && ev.kind === 'turn') {
        lastTurnIdx = i;
        break;
      }
    }
    const insertIdx = lastTurnIdx >= 0 ? lastTurnIdx + 1 : events.length;

    events.splice(insertIdx, 0, {
      kind: 'summary',
      round: roundNum,
      entry: {
        type: 'summary',
        round: roundNum,
        text: summary,
      },
    });
  }

  return events;
}

export function useSpectate(gameId?: string | null) {
  const [state, setState] = useState<GameUIState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);

  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayEventsRef = useRef<HistoryEvent[]>([]);
  const replayIndexRef = useRef(0);
  const replaySpeedRef = useRef(replaySpeed);
  const liveChannelRef = useRef<string | null>(null);

  useEffect(() => {
    replaySpeedRef.current = replaySpeed;
  }, [replaySpeed]);

  const scheduleNextReplayEvent = useCallback(() => {
    if (replayIndexRef.current >= replayEventsRef.current.length) {
      return;
    }

    const delay = REPLAY_DELAYS[replaySpeedRef.current] ?? 1500;
    replayTimerRef.current = setTimeout(() => {
      const event = replayEventsRef.current[replayIndexRef.current];
      if (!event) return;

      replayIndexRef.current += 1;

      setState((s) => ({
        ...s,
        round: event.round,
        eventLog: [...s.eventLog, event.entry],
      }));

      scheduleNextReplayEvent();
    }, delay);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAndSetup = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;
        const functionsBase = getFunctionsUrl();
        const url = gameId
          ? `${functionsBase}/spectate?gameId=${gameId}`
          : `${functionsBase}/spectate`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error(`Spectate request failed: ${res.status}`);
        }

        const data = (await res.json()) as SpectateResponse;

        if (cancelled) return;

        if (!data.game) {
          setState(INITIAL_STATE);
          setIsLoading(false);
          return;
        }

        const agents = buildAgentsFromResponse(data.agents);
        const historyEvents = buildHistoryEvents(data.turns, data.summaries);

        if (data.game.status === 'running') {
          setState({
            gameId: data.game.id,
            status: 'running',
            round: data.game.current_round,
            agents,
            chests: [],
            eventLog: historyEvents.map((e) => e.entry),
            result: null,
            currentTurnAgent: null,
            attackedAgents: [],
          });
          setIsReplay(false);
          setIsLoading(false);

          const channel = `game:${data.game.id}`;
          liveChannelRef.current = channel;
          await insforge.realtime.connect();
          await insforge.realtime.subscribe(channel);

          insforge.realtime.on('round_started', (payload: Record<string, unknown>) => {
            if (cancelled) return;
            const roundNumber = payload.roundNumber as number;
            setState((s) => ({
              ...s,
              round: roundNumber,
              eventLog: [
                ...s.eventLog,
                { type: 'summary', round: roundNumber, text: `--- Round ${roundNumber} ---` } satisfies EventLogEntry,
              ],
            }));
          });

          insforge.realtime.on('round_summary', (payload: Record<string, unknown>) => {
            if (cancelled) return;
            setState((s) => ({
              ...s,
              eventLog: [
                ...s.eventLog,
                { type: 'summary', round: payload.roundNumber as number, text: payload.summary as string } satisfies EventLogEntry,
              ],
            }));
          });

          insforge.realtime.on('turn_started', (payload: Record<string, unknown>) => {
            if (cancelled) return;
            const agentId = payload.agentId as string;
            setState((s) => ({
              ...s,
              currentTurnAgent: agentId,
              eventLog: [
                ...s.eventLog,
                { type: 'turn', round: s.round, agentId, text: `${agentName(agentId)} is thinking...` } as EventLogEntry,
              ],
            }));
          });

          insforge.realtime.on('turn_completed', (payload: Record<string, unknown>) => {
            if (cancelled) return;
            const agentId = (payload as { agentId: string }).agentId;
            const actions = (payload.actions ?? [payload.action]) as EventLogEntry['action'][];
            const results = (payload.results ?? [payload.result]) as EventLogEntry['result'][];
            const lastAction = [...actions].reverse().find((a) => a?.type !== 'invalid') ?? actions[actions.length - 1];
            const reasoning = payload.reasoning as string | null;
            const incoming = payload.agents as GameUIState['agents'];
            const updatedAgents = incoming.map((a) =>
              a.agentId === agentId ? { ...a, lastAction } : a,
            );

            setState((s) => {
              const newEntries: EventLogEntry[] = [];
              let chests = s.chests;

              for (let i = 0; i < actions.length; i++) {
                const act = actions[i];
                const res = results[i];

                let actionText = agentName(agentId);
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
                  const sign = chestData.item.hpChange > 0 ? '+' : '';
                  const emoji = chestData.item.hpChange > 0 ? '💚' : '💔';
                  newEntries.push({
                    type: 'summary',
                    round: s.round,
                    text: `[R${s.round}] ${emoji} ${agentName(agentId)} opened a chest: (${sign}${chestData.item.hpChange} HP) → HP ${chestData.hpBefore} → ${chestData.hpAfter}`,
                  });
                }
              }

              return {
                ...s,
                agents: updatedAgents,
                chests,
                currentTurnAgent: null,
                eventLog: [...s.eventLog, ...newEntries],
              };
            });
          });

          insforge.realtime.on('chest_spawned', (payload: Record<string, unknown>) => {
            if (cancelled) return;
            const position = payload.position as { x: number; y: number };
            const roundNumber = payload.roundNumber as number;
            setState((s) => ({
              ...s,
              chests: [...s.chests, { position }],
              eventLog: [
                ...s.eventLog,
                { type: 'summary', round: roundNumber, text: `[R${roundNumber}] Treasure chest appeared at (${position.x},${position.y})!` } satisfies EventLogEntry,
              ],
            }));
          });

          insforge.realtime.on('agent_eliminated', (payload: Record<string, unknown>) => {
            if (cancelled) return;
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
            if (cancelled) return;
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
        } else {
          setState({
            gameId: data.game.id,
            status: 'completed',
            round: data.game.current_round,
            agents,
            chests: [],
            eventLog: [],
            result: data.game.result
              ? { winner: data.game.winner_agent_id, type: data.game.result }
              : null,
            currentTurnAgent: null,
            attackedAgents: [],
          });
          setIsReplay(true);
          setIsLoading(false);

          replayEventsRef.current = historyEvents;
          replayIndexRef.current = 0;
          scheduleNextReplayEvent();
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setIsLoading(false);
        }
      }
    };

    fetchAndSetup();

    return () => {
      cancelled = true;
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
      }
      if (liveChannelRef.current) {
        insforge.realtime.unsubscribe(liveChannelRef.current);
        insforge.realtime.disconnect();
        liveChannelRef.current = null;
      }
    };
  }, [gameId, scheduleNextReplayEvent]);

  return { state, isLoading, error, isReplay, replaySpeed, setReplaySpeed };
}
