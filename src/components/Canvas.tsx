import React, { useRef, useEffect, useCallback } from 'react';
import { Tool } from '../types';
import { bresenhamLine, floodFill } from '../canvasUtils';

interface LayerRef {
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  canvasW: number;
  canvasH: number;
  zoom: number;
  showGrid: boolean;
  tool: Tool;
  color: string;
  brushSize: number;
  layerRefs: React.MutableRefObject<Map<string, LayerRef>>;
  activeLayerId: string;
  onColorPick: (color: string) => void;
  onAfterStroke: () => void;   // call after stroke ends to snapshot history
  onLayerSnapshot: () => void; // snapshot BEFORE a stroke begins
}

export default function Canvas({
  canvasW, canvasH, zoom, showGrid, tool, color, brushSize,
  layerRefs, activeLayerId, onColorPick, onAfterStroke, onLayerSnapshot,
}: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const compRef    = useRef<HTMLCanvasElement | null>(null);

  // Drawing state
  const drawing = useRef(false);
  const lastPx  = useRef<[number, number] | null>(null);
  const moveStart = useRef<[number, number] | null>(null);
  const moveLayerStart = useRef<[number, number]>([0, 0]);

  // Ensure compositing canvas
  if (!compRef.current) {
    compRef.current = document.createElement('canvas');
  }

  // ---- Render loop ----
  const render = useCallback(() => {
    const comp = compRef.current!;
    comp.width  = canvasW;
    comp.height = canvasH;
    const ctx = comp.getContext('2d')!;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const layers = layerRefs.current;
    // Iterate in draw order (bottom = first inserted = lowest index in array
    // but our Map preserves insertion order; we render all)
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer.canvas, layer.offsetX, layer.offsetY);
    });
    ctx.globalAlpha = 1;

    // Draw to display
    const disp = displayRef.current;
    if (!disp) return;
    disp.width  = canvasW * zoom;
    disp.height = canvasH * zoom;
    const dctx = disp.getContext('2d')!;
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(comp, 0, 0, canvasW * zoom, canvasH * zoom);

    // Grid
    if (showGrid && zoom >= 4) {
      dctx.strokeStyle = 'rgba(255,255,255,0.15)';
      dctx.lineWidth = 0.5;
      for (let x = 0; x <= canvasW; x++) {
        dctx.beginPath();
        dctx.moveTo(x * zoom + 0.5, 0);
        dctx.lineTo(x * zoom + 0.5, canvasH * zoom);
        dctx.stroke();
      }
      for (let y = 0; y <= canvasH; y++) {
        dctx.beginPath();
        dctx.moveTo(0, y * zoom + 0.5);
        dctx.lineTo(canvasW * zoom, y * zoom + 0.5);
        dctx.stroke();
      }
    }
  }, [canvasW, canvasH, zoom, showGrid, layerRefs]);

  // Render on every relevant change
  useEffect(() => {
    render();
  }, [render]);

  // Expose render for external calls
  useEffect(() => {
    (window as any).__pixelRender = render;
    return () => { delete (window as any).__pixelRender; };
  }, [render]);

  // ---- Pixel coords from mouse ----
  const pixelAt = useCallback((e: React.MouseEvent): [number, number] => {
    const rect = displayRef.current!.getBoundingClientRect();
    const px = Math.floor((e.clientX - rect.left) / zoom);
    const py = Math.floor((e.clientY - rect.top)  / zoom);
    return [
      Math.max(0, Math.min(canvasW - 1, px)),
      Math.max(0, Math.min(canvasH - 1, py)),
    ];
  }, [zoom, canvasW, canvasH]);

  // ---- Get active layer ----
  const getActiveLayer = useCallback((): LayerRef | undefined => {
    return layerRefs.current.get(activeLayerId);
  }, [layerRefs, activeLayerId]);

  // ---- Draw brush/eraser stamp ----
  const drawStamp = useCallback((ctx: CanvasRenderingContext2D, px: number, py: number, erase: boolean) => {
    const half = Math.floor(brushSize / 2);
    const x0 = px - half;
    const y0 = py - half;
    if (erase) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(x0, y0, brushSize, brushSize);
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0, brushSize, brushSize);
    }
  }, [brushSize, color]);

  // ---- Mouse handlers ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const [px, py] = pixelAt(e);
    const layer = getActiveLayer();
    if (!layer) return;

    if (tool === 'eyedropper') {
      // Pick from composited canvas
      const comp = compRef.current!;
      const ctx = comp.getContext('2d')!;
      const d = ctx.getImageData(px, py, 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      onColorPick(hex);
      return;
    }

    if (tool === 'move') {
      onLayerSnapshot();
      drawing.current = true;
      moveStart.current = [e.clientX, e.clientY];
      moveLayerStart.current = [layer.offsetX, layer.offsetY];
      return;
    }

    // Snapshot before stroke begins
    onLayerSnapshot();

    drawing.current = true;
    lastPx.current = [px, py];
    const ctx = layer.canvas.getContext('2d')!;

    if (tool === 'fill') {
      floodFill(layer.canvas, px, py, color);
      render();
      onAfterStroke();
      drawing.current = false;
      return;
    }

    // Brush or eraser - draw first point
    drawStamp(ctx, px, py, tool === 'eraser');
    render();
  }, [tool, pixelAt, getActiveLayer, onColorPick, onLayerSnapshot, drawStamp, color, render, onAfterStroke]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current) return;
    const [px, py] = pixelAt(e);
    const layer = getActiveLayer();
    if (!layer) return;

    if (tool === 'move' && moveStart.current) {
      const dx = Math.round((e.clientX - moveStart.current[0]) / zoom);
      const dy = Math.round((e.clientY - moveStart.current[1]) / zoom);
      layer.offsetX = moveLayerStart.current[0] + dx;
      layer.offsetY = moveLayerStart.current[1] + dy;
      render();
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      const ctx = layer.canvas.getContext('2d')!;
      if (lastPx.current) {
        const pts = bresenhamLine(lastPx.current[0], lastPx.current[1], px, py);
        for (const [bx, by] of pts) {
          drawStamp(ctx, bx, by, tool === 'eraser');
        }
      } else {
        drawStamp(ctx, px, py, tool === 'eraser');
      }
      lastPx.current = [px, py];
      render();
    }
  }, [tool, pixelAt, getActiveLayer, drawStamp, zoom, render]);

  const handleMouseUp = useCallback(() => {
    if (drawing.current) {
      if (tool === 'move' && moveStart.current) {
        onAfterStroke();
      }
      if ((tool === 'brush' || tool === 'eraser') && lastPx.current) {
        onAfterStroke();
      }
    }
    drawing.current = false;
    lastPx.current = null;
    moveStart.current = null;
  }, [tool, onAfterStroke]);

  const handleMouseLeave = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  return (
    <div className="canvas-area">
      <div className="canvas-wrapper">
        <canvas
          ref={displayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={e => e.preventDefault()}
        />
      </div>
      <div className="canvas-info">
        {canvasW}×{canvasH} &nbsp;|&nbsp; {zoom}x
      </div>
    </div>
  );
}
