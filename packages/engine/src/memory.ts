import type { ActionResult, AttackResult, AgentId, AgentState } from './types.js';

export function appendMemory(
  currentMemory: readonly string[],
  entry: string,
  cap: number,
): readonly string[] {
  const updated = [...currentMemory, entry];
  if (updated.length <= cap) return updated;
  return updated.slice(updated.length - cap);
}

const DIRECTION_NAMES: Record<string, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
};

export function buildMemoryEntry(
  round: number,
  _agentId: AgentId,
  result: ActionResult,
  _agents: readonly AgentState[],
): string {
  switch (result.type) {
    case 'move':
      return `Round ${round}: I moved ${DIRECTION_NAMES[result.newOrientation]} to (${result.to.x},${result.to.y}), facing ${DIRECTION_NAMES[result.newOrientation]}.`;

    case 'attack': {
      let entry = `Round ${round}: I attacked ${result.target} from the ${result.hitZone} for ${result.damage} damage. ${result.target} HP: ${result.targetHpBefore}→${result.targetHpAfter}.`;
      if (result.targetEliminated) {
        entry += ` ${result.target} eliminated!`;
      }
      return entry;
    }

    case 'turn':
      return `Round ${round}: I turned from ${DIRECTION_NAMES[result.previousOrientation]} to face ${DIRECTION_NAMES[result.newOrientation]}.`;

    case 'rest':
      return `Round ${round}: I rested. +${result.epBonusNextTurn} EP next turn.`;

    case 'invalid':
      return `Round ${round}: Invalid action (${result.reason}). Rested instead. +${result.fallbackAction.epBonusNextTurn} EP next turn.`;
  }
}

export function buildTargetMemoryEntry(
  round: number,
  attackerId: AgentId,
  result: AttackResult,
): string {
  let entry = `Round ${round}: ${attackerId} attacked me from the ${result.hitZone} for ${result.damage} damage. My HP: ${result.targetHpBefore}→${result.targetHpAfter}.`;
  if (result.targetEliminated) {
    entry += ' I was eliminated!';
  }
  return entry;
}
