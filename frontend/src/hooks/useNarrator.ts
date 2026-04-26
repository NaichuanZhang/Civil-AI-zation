import { useState, useEffect, useRef, useCallback } from 'react';
import { usePersistedState } from './usePersistedState';
import { createNarrationQueue } from '../narrator/narrationQueue';
import type { NarrationQueue } from '../narrator/narrationQueue';
import type { NarratorState, NarrationItem } from '../narrator/types';
import type { GameUIState } from '../types';
import {
  generateNarrationForEvent,
  generateNarrationForGameStart,
  generateNarrationForGameEnd,
} from '../narrator/textGenerator';
import {
  fetchTTSAudio,
  convertMp3ToPcm16,
  playMp3Audio,
  resumeAudioContext,
} from '../narrator/ttsService';
import {
  initializeAvatar,
  sendAudioToAvatar,
  destroyAvatar,
  isAvatarConfigured,
  prepareAvatarAudio,
} from '../narrator/avatarService';

const NARRATOR_ENABLED = import.meta.env.VITE_NARRATOR_ENABLED === 'true';
const SUBTITLE_DISMISS_MS = 3500;

interface AvatarController {
  send(data: ArrayBuffer, end: boolean): string;
  close(): void;
  onConnectionState: ((state: string) => void) | null;
  onConversationState: ((state: string) => void) | null;
  onError: ((error: { code: string; message: string }) => void) | null;
  initializeAudioContext(): Promise<void>;
  start(): Promise<void>;
}

export function useNarrator(gameState: GameUIState) {
  const [isMuted, setIsMuted] = usePersistedState('civil-ai-zation:narratorMuted', false);
  const [volume, setVolume] = usePersistedState('civil-ai-zation:narratorVolume', 0.8);
  const [isMinimized, setIsMinimized] = usePersistedState('civil-ai-zation:narratorMinimized', false);

  const [status, setStatus] = useState<NarratorState['status']>(
    NARRATOR_ENABLED ? 'idle' : 'disabled',
  );
  const [subtitleText, setSubtitleText] = useState('');
  const [currentItem, setCurrentItem] = useState<NarrationItem | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [avatarReady, setAvatarReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  const queueRef = useRef<NarrationQueue>(createNarrationQueue());
  const isProcessingRef = useRef(false);
  const prevEventLogLengthRef = useRef(0);
  const prevStatusRef = useRef(gameState.status);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!NARRATOR_ENABLED || !isAvatarConfigured()) return;
    if (!avatarContainerRef.current) return;
    if (controllerRef.current) return;

    let cancelled = false;
    initializeAvatar(avatarContainerRef.current)
      .then((controller) => {
        if (cancelled) {
          controller.close();
          return;
        }
        controllerRef.current = controller as AvatarController;
        setAvatarReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setAvatarReady(false);
          setError(`Avatar init failed: ${(err as Error).message}`);
        }
      });

    return () => {
      cancelled = true;
      destroyAvatar();
      controllerRef.current = null;
      setAvatarReady(false);
    };
  }, [isMinimized]);

  useEffect(() => {
    if (!NARRATOR_ENABLED) return;

    if (gameState.status === 'running' && prevStatusRef.current !== 'running') {
      const item = generateNarrationForGameStart();
      queueRef.current.enqueue(item);
      setQueueLength(queueRef.current.getLength());
    }

    if (gameState.status === 'completed' && prevStatusRef.current !== 'completed' && gameState.result) {
      const item = generateNarrationForGameEnd(gameState.result);
      queueRef.current.enqueue(item);
      setQueueLength(queueRef.current.getLength());
    }

    prevStatusRef.current = gameState.status;
  }, [gameState.status, gameState.result]);

  useEffect(() => {
    if (!NARRATOR_ENABLED) return;

    const newEntries = gameState.eventLog.slice(prevEventLogLengthRef.current);
    prevEventLogLengthRef.current = gameState.eventLog.length;

    for (const entry of newEntries) {
      const item = generateNarrationForEvent(entry, gameState);
      if (item) {
        queueRef.current.enqueue(item);
      }
    }
    setQueueLength(queueRef.current.getLength());
  }, [gameState.eventLog.length, gameState]);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (status === 'disabled') return;

    const item = queueRef.current.dequeue();
    if (!item) return;

    isProcessingRef.current = true;
    setCurrentItem(item);
    setSubtitleText(item.text);
    setQueueLength(queueRef.current.getLength());

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      if (item.useTTS && !isMuted) {
        setStatus('loading');
        const mp3Buffer = await fetchTTSAudio(item.text);

        if (!abort.signal.aborted) {
          setStatus('speaking');

          if (controllerRef.current) {
            await prepareAvatarAudio();
            const pcm16 = await convertMp3ToPcm16(mp3Buffer);
            if (!abort.signal.aborted) {
              const avatarPromise = sendAudioToAvatar(
                controllerRef.current as Parameters<typeof sendAudioToAvatar>[0],
                pcm16,
              );
              const audioPromise = playMp3Audio(mp3Buffer.slice(0), volume);
              await Promise.all([avatarPromise, audioPromise]);
            }
          } else {
            await playMp3Audio(mp3Buffer.slice(0), volume);
          }
        }
      } else {
        setStatus('speaking');
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, SUBTITLE_DISMISS_MS);
          if (abort.signal.aborted) {
            clearTimeout(timer);
            resolve();
          }
          abort.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        setError((err as Error).message);
      }
    } finally {
      if (!abort.signal.aborted) {
        setStatus('idle');
        setSubtitleText('');
        setCurrentItem(null);
      }
      isProcessingRef.current = false;
      abortRef.current = null;
    }
  }, [status, isMuted, volume]);

  useEffect(() => {
    if (!NARRATOR_ENABLED) return;
    if (status !== 'idle') return;
    if (queueLength === 0) return;

    processQueue();
  }, [queueLength, status, processQueue]);

  const skipCurrent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isProcessingRef.current = false;
    setStatus('idle');
    setSubtitleText('');
    setCurrentItem(null);
  }, []);

  const handleSetMuted = useCallback(
    (muted: boolean) => {
      setIsMuted(muted);
      if (!muted) {
        resumeAudioContext();
      }
    },
    [setIsMuted],
  );

  const handleSetVolume = useCallback(
    (v: number) => setVolume(Math.max(0, Math.min(1, v))),
    [setVolume],
  );

  const narratorState: NarratorState = {
    status,
    currentItem,
    queueLength,
    subtitleText,
    isMuted,
    volume,
    avatarReady,
    isMinimized,
    error,
  };

  return {
    enabled: NARRATOR_ENABLED,
    narratorState,
    avatarContainerRef,
    setMuted: handleSetMuted,
    setVolume: handleSetVolume,
    setIsMinimized,
    skipCurrent,
  };
}
