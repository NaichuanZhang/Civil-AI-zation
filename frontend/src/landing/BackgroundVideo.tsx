import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

import backgroundVideo from '@assets/civAI_video_output.mp4';

export function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [showEnableSound, setShowEnableSound] = useState(false);

  useLayoutEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;

    const attemptUnmutedAutoplay = async () => {
      el.muted = false;
      setMuted(false);
      try {
        await el.play();
        if (!cancelled) {
          setShowEnableSound(false);
        }
      } catch {
        el.muted = true;
        if (!cancelled) {
          setMuted(true);
          setShowEnableSound(true);
        }
        try {
          await el.play();
        } catch {
          /* ignore */
        }
      }
    };

    void attemptUnmutedAutoplay();

    return () => {
      cancelled = true;
    };
  }, []);

  const enableSound = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setMuted(false);
    setShowEnableSound(false);
    void el.play();
  }, []);

  return (
    <>
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted={muted}
          playsInline
          className="w-full h-full object-cover"
          src={backgroundVideo}
        />
      </div>
      {showEnableSound && (
        <button
          type="button"
          onClick={enableSound}
          className="liquid-glass fixed bottom-6 right-6 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-[hsl(var(--foreground))] transition-transform hover:scale-105"
          aria-label="Enable video sound"
          title="Enable sound"
        >
          <Volume2 size={22} strokeWidth={2} />
        </button>
      )}
    </>
  );
}
