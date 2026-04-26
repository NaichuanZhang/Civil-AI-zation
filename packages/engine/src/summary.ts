import type { TurnRecord, AgentState } from './types.js';

const DIRECTION_NAMES: Record<string, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
};

export function buildSummaryPrompt(
  roundNumber: number,
  turnRecords: readonly TurnRecord[],
  agents: readonly AgentState[],
): { system: string; user: string } {
  const system =
    'You are a concise battle commentator for Civil-AI-zation. Summarize the round\'s events in 2-3 sentences. Be dramatic but factual. Include damage numbers and eliminations.';

  const events = turnRecords.map((t) => {
    switch (t.result.type) {
      case 'move':
        return `${t.agentId} moved ${DIRECTION_NAMES[t.result.newOrientation]} to (${t.result.to.x},${t.result.to.y}).`;
      case 'attack': {
        const elim = t.result.targetEliminated ? ` ${t.result.target} was eliminated!` : '';
        return `${t.agentId} attacked ${t.result.target} from the ${t.result.hitZone} for ${t.result.damage} damage (${t.result.targetHpBefore}→${t.result.targetHpAfter} HP).${elim}`;
      }
      case 'turn':
        return `${t.agentId} turned to face ${DIRECTION_NAMES[t.result.newOrientation]}.`;
      case 'rest':
        return `${t.agentId} rested.`;
      case 'invalid':
        return `${t.agentId} attempted an invalid action and rested instead.`;
    }
  });

  const agentStatus = agents
    .map((a) => `${a.agentId}: ${a.status === 'alive' ? `HP ${a.hp}` : 'eliminated'}`)
    .join(', ');

  const user = `Round ${roundNumber} events:\n${events.join('\n')}\n\nCurrent status: ${agentStatus}`;

  return { system, user };
}
