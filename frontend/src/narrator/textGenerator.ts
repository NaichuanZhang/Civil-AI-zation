import type { EventLogEntry, GameUIState } from '../types';
import type { NarrationItem } from './types';

let counter = 0;
function nextId(): string {
  return `narration-${++counter}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DIRECTION_NAMES: Record<string, string> = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
  N: 'north',
  S: 'south',
  E: 'east',
  W: 'west',
};

function dirName(dir: string | undefined): string {
  if (!dir) return '';
  return DIRECTION_NAMES[dir] ?? dir;
}

export function generateNarrationForGameStart(): NarrationItem {
  return {
    id: nextId(),
    text: 'The battle begins! Three AI warriors enter the arena.',
    priority: 'high',
    useTTS: true,
    source: 'game_start',
    timestamp: Date.now(),
  };
}

export function generateNarrationForEvent(
  entry: EventLogEntry,
  _gameState: GameUIState,
): NarrationItem | null {
  switch (entry.type) {
    case 'summary':
      return entry.text
        ? {
            id: nextId(),
            text: entry.text,
            priority: 'normal',
            useTTS: true,
            source: 'round_summary',
            timestamp: Date.now(),
          }
        : null;

    case 'elimination':
      if (!entry.agentId) return null;
      return {
        id: nextId(),
        text: `${capitalize(entry.agentId)} has been eliminated by ${capitalize(entry.eliminatedBy ?? 'unknown')}!`,
        priority: 'high',
        useTTS: true,
        source: 'elimination',
        timestamp: Date.now(),
      };

    case 'turn':
      return generateTurnNarration(entry);

    default:
      return null;
  }
}

function generateTurnNarration(entry: EventLogEntry): NarrationItem | null {
  if (!entry.agentId || !entry.action) return null;

  const name = capitalize(entry.agentId);
  const action = entry.action;
  const result = entry.result;
  let text: string;

  switch (action.type) {
    case 'move':
      text = `${name} moves ${dirName(action.direction)}`;
      break;
    case 'attack': {
      const target = capitalize(action.target ?? 'unknown');
      const dmg = result?.damage;
      text = dmg
        ? `${name} attacks ${target} for ${dmg} damage`
        : `${name} attacks ${target}`;
      if (result?.targetEliminated) {
        text += ' — knockout!';
      }
      break;
    }
    case 'turn':
      text = `${name} turns ${dirName(action.direction)}`;
      break;
    case 'rest':
      text = `${name} rests`;
      break;
    default:
      text = `${name} hesitates`;
      break;
  }

  return {
    id: nextId(),
    text,
    priority: 'low',
    useTTS: false,
    source: 'turn',
    timestamp: Date.now(),
  };
}

export function generateNarrationForGameEnd(
  result: { winner: string | null; type: string },
): NarrationItem {
  const text = result.winner
    ? `${capitalize(result.winner)} claims victory! The battle is over.`
    : 'The battle ends in a draw! No clear winner emerges.';

  return {
    id: nextId(),
    text,
    priority: 'high',
    useTTS: true,
    source: 'game_end',
    timestamp: Date.now(),
  };
}
