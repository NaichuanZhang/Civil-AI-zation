import { createContext, useContext } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useNarrator } from '../hooks/useNarrator';
import type { GameUIState } from '../types';
import type { NarratorState } from '../narrator/types';

interface NarratorContextValue {
  enabled: boolean;
  narratorState: NarratorState;
  avatarContainerRef: RefObject<HTMLDivElement | null>;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMinimized: (minimized: boolean) => void;
  skipCurrent: () => void;
}

const NarratorContext = createContext<NarratorContextValue | null>(null);

export function NarratorProvider({
  gameState,
  children,
}: {
  gameState: GameUIState;
  children: ReactNode;
}) {
  const narrator = useNarrator(gameState);

  return (
    <NarratorContext.Provider value={narrator}>
      {children}
    </NarratorContext.Provider>
  );
}

export function useNarratorContext(): NarratorContextValue {
  const ctx = useContext(NarratorContext);
  if (!ctx) {
    throw new Error('useNarratorContext must be used within a NarratorProvider');
  }
  return ctx;
}
