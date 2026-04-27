import { useRef, useEffect, useState, useCallback } from 'react';
import type { AgentUIState, ChestUIState } from '../types';
import { AGENT_NAMES, AGENT_COLORS } from '../config';
import mapUrl from '@assets/map.png';

import glmBack from '@assets/figure/glm/glm-backview_256.png';
import glmFront from '@assets/figure/glm/glm-frontview_256.png';
import glmLeft from '@assets/figure/glm/glm-leftview_256.png';
import glmRight from '@assets/figure/glm/glm-rightview_256.png';
import gptBack from '@assets/figure/gpt/gpt-backview_256.png';
import gptFront from '@assets/figure/gpt/gpt-frontview_256.png';
import gptLeft from '@assets/figure/gpt/gpt-leftview_256.png';
import gptRight from '@assets/figure/gpt/gpt-rightview_256.png';
import claudeBack from '@assets/figure/claude/claude-backview_256.png';
import claudeFront from '@assets/figure/claude/claude-frontview_256.png';
import claudeLeft from '@assets/figure/claude/claude-leftview_256.png';
import claudeRight from '@assets/figure/claude/claude-rightview_256.png';

const AGENT_FIGURES: Record<string, Record<string, string>> = {
  opus: { up: glmBack, down: glmFront, left: glmLeft, right: glmRight },
  sonnet: { up: gptBack, down: gptFront, left: gptLeft, right: gptRight },
  haiku: { up: claudeBack, down: claudeFront, left: claudeLeft, right: claudeRight },
};

/**
 * Board corner positions as (width%, height%) of the container.
 * Adjust these to align the grid with the background chessboard.
 */
const DEFAULT_CORNERS = {
  tl: { w: 38.4, h: 30.6 },
  tr: { w: 63.9, h: 30.6 },
  bl: { w: 35.3, h: 69.3 },
  br: { w: 66.5, h: 69.3 },
};

const DEFAULT_FIGURE = {
  scale: 200,
  offsetY: -55,
};

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';
type Corners = Record<CornerKey, { w: number; h: number }>;

function computeMatrix3d(
  srcW: number,
  srcH: number,
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  bl: { x: number; y: number },
  br: { x: number; y: number },
): string {
  const sx = srcW;
  const sy = srcH;

  const x0 = tl.x, y0 = tl.y;
  const x1 = tr.x, y1 = tr.y;
  const x2 = bl.x, y2 = bl.y;
  const x3 = br.x, y3 = br.y;

  const dx1 = x1 - x3;
  const dx2 = x2 - x3;
  const dx3 = x0 - x1 + x3 - x2;
  const dy1 = y1 - y3;
  const dy2 = y2 - y3;
  const dy3 = y0 - y1 + y3 - y2;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-10) return 'none';

  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;

  const a = x1 - x0 + g * x1;
  const b = x2 - x0 + h * x2;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y2 - y0 + h * y2;
  const f = y0;

  const m11 = a / sx;
  const m12 = d / sx;
  const m14 = g / sx;
  const m21 = b / sy;
  const m22 = e / sy;
  const m24 = h / sy;
  const m41 = c;
  const m42 = f;
  const m44 = 1;

  return `matrix3d(${m11},${m12},0,${m14}, ${m21},${m22},0,${m24}, 0,0,1,0, ${m41},${m42},0,${m44})`;
}

interface GridProps {
  agents: AgentUIState[];
  chests: ChestUIState[];
  currentTurnAgent: string | null;
  attackedAgents: string[];
  gridSize?: number;
  debugMode?: boolean;
}

export function Grid({ agents, chests, currentTurnAgent, attackedAgents, gridSize = 5, debugMode = false }: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1000, h: 600 });
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [figure, setFigure] = useState(DEFAULT_FIGURE);
  const dragging = useRef<CornerKey | null>(null);
  const draggingFigure = useRef<{ startY: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handlePointerDown = useCallback((key: CornerKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = key;
  }, []);

  const handleFigurePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingFigure.current = { startY: e.clientY, startOffsetY: figure.offsetY };
  }, [figure.offsetY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingFigure.current) {
      const dy = e.clientY - draggingFigure.current.startY;
      const containerH = containerRef.current?.clientHeight ?? 600;
      const pct = (dy / containerH) * 100;
      setFigure((prev) => ({ ...prev, offsetY: Math.round((draggingFigure.current!.startOffsetY + pct) * 10) / 10 }));
      return;
    }
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const h = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const key = dragging.current;
    setCorners((prev) => ({ ...prev, [key]: { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 } }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
    draggingFigure.current = null;
  }, []);

  const handleFigureWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setFigure((prev) => ({ ...prev, scale: Math.max(50, Math.round(prev.scale - e.deltaY / 5)) }));
  }, []);

  const { w: cw, h: ch } = dims;

  const gridW = (corners.br.w - corners.bl.w) / 100 * cw;
  const gridH = (corners.bl.h - corners.tl.h) / 100 * ch;

  const tl = { x: corners.tl.w / 100 * cw, y: corners.tl.h / 100 * ch };
  const tr = { x: corners.tr.w / 100 * cw, y: corners.tr.h / 100 * ch };
  const bl = { x: corners.bl.w / 100 * cw, y: corners.bl.h / 100 * ch };
  const br = { x: corners.br.w / 100 * cw, y: corners.br.h / 100 * ch };

  const matrix = computeMatrix3d(gridW, gridH, tl, tr, bl, br);

  const cells = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = agents.find(
        (a) => a.status === 'alive' && a.position.x === x && a.position.y === y,
      );
      const chest = chests.find((c) => c.position.x === x && c.position.y === y);
      const isActive = agent?.agentId === currentTurnAgent;
      const isAttacked = agent ? attackedAgents.includes(agent.agentId) : false;

      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            border: debugMode ? '1px solid rgba(51, 65, 85, 0.65)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: debugMode
              ? (chest && !agent ? 'rgba(42, 31, 10, 0.72)' : 'rgba(30, 41, 59, 0.45)')
              : 'transparent',
            position: 'relative',
            boxSizing: 'border-box',
            overflow: 'visible',
          }}
        >
          {agent ? (() => {
            const isFirstAgent = agents.findIndex((a) => a.status === 'alive') === agents.indexOf(agent);
            const canDrag = debugMode && isFirstAgent;
            const figureFilter = isAttacked
              ? 'drop-shadow(0 0 10px #ef4444) drop-shadow(0 0 20px #ef4444)'
              : isActive
                ? `drop-shadow(0 0 8px ${AGENT_COLORS[agent.agentId] ?? '#666'})`
                : 'none';
            return (
              <div
                onPointerDown={canDrag ? handleFigurePointerDown : undefined}
                onWheel={canDrag ? handleFigureWheel : undefined}
                style={{
                  position: 'absolute',
                  width: `${figure.scale}%`,
                  height: `${figure.scale}%`,
                  top: `${50 + figure.offsetY}%`,
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: y + 1,
                  filter: figureFilter,
                  animation: isAttacked ? 'shake-hit 0.6s ease-in-out' : 'none',
                  transition: 'filter 0.3s',
                  cursor: canDrag ? 'grab' : 'default',
                  pointerEvents: canDrag ? 'auto' : 'none',
                }}
              >
                <img
                  src={AGENT_FIGURES[agent.agentId]?.[agent.orientation]}
                  alt={`${agent.agentId} facing ${agent.orientation}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                />
                {canDrag && (
                  <span style={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: '#fbbf24',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    {figure.scale}% Y:{figure.offsetY}%
                  </span>
                )}
              </div>
            );
          })() : chest ? (
            <span style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>📦</span>
          ) : null}
          {debugMode && (
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 4,
                fontSize: 'clamp(7px, 1.8vw, 9px)',
                color: '#e2e8f0',
                textShadow: '0 0 4px rgba(0,0,0,0.85)',
              }}
            >
              {x},{y}
            </span>
          )}
        </div>,
      );
    }
  }

  const cornerEntries: Array<{ key: CornerKey; label: string }> = [
    { key: 'tl', label: 'TL' },
    { key: 'tr', label: 'TR' },
    { key: 'bl', label: 'BL' },
    { key: 'br', label: 'BR' },
  ];

  return (
    <div
      ref={containerRef}
      onPointerMove={debugMode ? handlePointerMove : undefined}
      onPointerUp={debugMode ? handlePointerUp : undefined}
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        touchAction: debugMode ? 'none' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: gridW,
          height: gridH,
          transformOrigin: '0 0',
          transform: matrix,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          gap: 1,
          border: debugMode ? '2px solid rgba(51, 65, 85, 0.85)' : 'none',
          boxSizing: 'border-box',
        }}
      >
        {cells}
      </div>

      {debugMode && cornerEntries.map(({ key, label }) => (
        <div
          key={key}
          onPointerDown={handlePointerDown(key)}
          style={{
            position: 'absolute',
            left: `${corners[key].w}%`,
            top: `${corners[key].h}%`,
            transform: 'translate(-50%, -50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: '#fbbf24',
            border: '2px solid #000',
            cursor: 'grab',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -18,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: '#fbbf24',
              background: 'rgba(0,0,0,0.8)',
              padding: '1px 4px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {label} ({corners[key].w}%,{corners[key].h}%)
          </span>
        </div>
      ))}
    </div>
  );
}
