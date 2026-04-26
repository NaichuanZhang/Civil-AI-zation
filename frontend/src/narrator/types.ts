export type NarrationPriority = 'high' | 'normal' | 'low';

export type NarrationSource =
  | 'game_start'
  | 'round_summary'
  | 'elimination'
  | 'game_end'
  | 'turn';

export interface NarrationItem {
  readonly id: string;
  readonly text: string;
  readonly priority: NarrationPriority;
  readonly useTTS: boolean;
  readonly source: NarrationSource;
  readonly timestamp: number;
}

export type NarratorStatus = 'idle' | 'loading' | 'speaking' | 'error' | 'disabled';

export interface NarratorState {
  readonly status: NarratorStatus;
  readonly currentItem: NarrationItem | null;
  readonly queueLength: number;
  readonly subtitleText: string;
  readonly isMuted: boolean;
  readonly volume: number;
  readonly avatarReady: boolean;
  readonly isMinimized: boolean;
  readonly error: string | null;
}
