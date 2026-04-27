import type { NarrationItem, NarrationPriority } from './types';

const PRIORITY_ORDER: Record<NarrationPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

const MAX_TTS_ITEMS = 3;
const STALE_THRESHOLD_MS = 30_000;

export function createNarrationQueue() {
  let items: readonly NarrationItem[] = [];

  function enqueue(item: NarrationItem): readonly NarrationItem[] {
    const now = Date.now();
    const fresh = items.filter((i) => now - i.timestamp < STALE_THRESHOLD_MS);

    const ttsCount = fresh.filter((i) => i.useTTS).length;
    if (item.useTTS && item.priority === 'low' && ttsCount >= MAX_TTS_ITEMS) {
      items = fresh;
      return items;
    }

    const withNew = [...fresh, item];
    withNew.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    items = withNew;
    return items;
  }

  function dequeue(): NarrationItem | null {
    if (items.length === 0) return null;
    const head = items[0];
    items = items.slice(1);
    return head ?? null;
  }

  function peek(): NarrationItem | null {
    return items.length > 0 ? (items[0] ?? null) : null;
  }

  function clear(): void {
    items = [];
  }

  function getLength(): number {
    return items.length;
  }

  function getItems(): readonly NarrationItem[] {
    return items;
  }

  return { enqueue, dequeue, peek, clear, getLength, getItems };
}

export type NarrationQueue = ReturnType<typeof createNarrationQueue>;
