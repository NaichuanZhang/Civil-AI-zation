import { useState, useEffect } from 'react';
import type { ThoughtBubbleData } from '../types';
import { AGENT_COLORS, THOUGHT_BUBBLE_CONFIG } from '../config';
import { DEFAULT_CORNERS } from './Grid';
import dashboardBgUrl from '@assets/dashboard-bg.png';

function gridToScreen(
  gx: number,
  gy: number,
  gridSize: number,
): { xPct: number; yPct: number } {
  const u = (gx + 0.5) / gridSize;
  const v = (gy + 0.5) / gridSize;

  const topX = DEFAULT_CORNERS.tl.w + (DEFAULT_CORNERS.tr.w - DEFAULT_CORNERS.tl.w) * u;
  const topY = DEFAULT_CORNERS.tl.h + (DEFAULT_CORNERS.tr.h - DEFAULT_CORNERS.tl.h) * u;
  const botX = DEFAULT_CORNERS.bl.w + (DEFAULT_CORNERS.br.w - DEFAULT_CORNERS.bl.w) * u;
  const botY = DEFAULT_CORNERS.bl.h + (DEFAULT_CORNERS.br.h - DEFAULT_CORNERS.bl.h) * u;

  return {
    xPct: topX + (botX - topX) * v,
    yPct: topY + (botY - topY) * v,
  };
}

function ThoughtBubble({ bubble, gridSize }: { bubble: ThoughtBubbleData; gridSize: number }) {
  const { maxChars, typewriterCharsPerTick, typewriterTickMs, displayDurationMs, yOffsetPct, maxWidth, minWidth } = THOUGHT_BUBBLE_CONFIG;

  const truncatedText = bubble.reasoning.length > maxChars
    ? bubble.reasoning.slice(0, maxChars) + '...'
    : bubble.reasoning;

  const [displayedLength, setDisplayedLength] = useState(0);

  useEffect(() => {
    setDisplayedLength(0);
    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = prev + typewriterCharsPerTick;
        if (next >= truncatedText.length) {
          clearInterval(interval);
          return truncatedText.length;
        }
        return next;
      });
    }, typewriterTickMs);
    return () => clearInterval(interval);
  }, [truncatedText, typewriterCharsPerTick, typewriterTickMs]);

  const screenPos = gridToScreen(bubble.gridPosition.x, bubble.gridPosition.y, gridSize);
  const color = AGENT_COLORS[bubble.agentId] ?? '#a08060';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${screenPos.xPct}%`,
        top: `${screenPos.yPct - yOffsetPct}%`,
        maxWidth,
        minWidth,
        padding: '10px 14px',
        backgroundImage: `url(${dashboardBgUrl})`,
        backgroundSize: '100% 100%',
        borderRadius: 12,
        border: `2px solid ${color}`,
        fontSize: 12,
        lineHeight: 1.4,
        color: '#2c1810',
        fontFamily: "'Patrick Hand', cursive, system-ui, sans-serif",
        pointerEvents: 'none',
        zIndex: bubble.gridPosition.y + 1,
        boxShadow: `0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)`,
        animation: `thought-bubble-lifecycle ${displayDurationMs}ms ease-out forwards`,
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 'bold',
        color,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        Thinking...
      </div>
      <div style={{
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}>
        {truncatedText.slice(0, displayedLength)}
        {displayedLength < truncatedText.length && (
          <span style={{ opacity: 0.5 }}>|</span>
        )}
      </div>
      {/* Tail pointing down toward agent */}
      <div style={{
        position: 'absolute',
        bottom: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: `10px solid ${color}`,
      }} />
    </div>
  );
}

interface ThoughtBubblesProps {
  bubbles: ThoughtBubbleData[];
  gridSize: number;
}

export function ThoughtBubbles({ bubbles, gridSize }: ThoughtBubblesProps) {
  if (bubbles.length === 0) return null;

  return (
    <>
      {bubbles.map((bubble) => (
        <ThoughtBubble
          key={`${bubble.agentId}-${bubble.timestamp}`}
          bubble={bubble}
          gridSize={gridSize}
        />
      ))}
    </>
  );
}
