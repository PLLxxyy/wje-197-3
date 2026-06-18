import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tool, Artwork } from './types';
import { makeCanvas, canvasToUrl, drawUrlOnCanvas, compositeLayers, exportPng, downloadBlob } from './canvasUtils';
import { MAX_HISTORY } from './constants';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import ColorPalette from './components/ColorPalette';
import Canvas from './components/Canvas';
import LayerPanel from './components/LayerPanel';
import ArtworkGallery from './components/ArtworkGallery';

interface Layer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

interface HistoryEntry {
  snapshots: Record<string, { dataUrl: string; offsetX: number; offsetY: number }>;
}

const STORAGE_KEY = 'pixel-art-artworks';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function App() {
  // ---- State ----
  const [canvasW, setCanvasW]         = useState(32);
  const [canvasH, setCanvasH]         = useState(32);
  const [zoom, setZoom]               = useState(12);
  const [showGrid, setShowGrid]       = useState(true);
  const [tool, setTool]               = useState<Tool>('brush');
  const [color, setColor]             = useState('#1e1e2e');
  const [brushSize, setBrushSize]     = useState(1);
  const [layers, setLayers]           = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack]     = useState<HistoryEntry[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [artworks, setArtworks]       = useState<Artwork[]>([]);
  const [currentArtId, setCurrentArtId] = useState<string | null>(null);

  // Refs
  const layerRefs    = useRef<Map<string, { canvas: HTMLCanvasElement; visible: boolean; opacity: number; offsetX: number; offsetY: number }>>(new Map());
  const pendingSnap  = useRef<Record<string, { dataUrl: string; offsetX: number; offsetY: number }> | null>(null);
  const inited       = useRef(false);

  // ---- Helper: capture all layers ----
  const captureAll = useCallback((): HistoryEntry => {
    const snaps: Record<string, { dataUrl: string; offsetX: number; offsetY: number }> = {};
    layers.forEach(l => {
      snaps[l.id] = { dataUrl: canvasToUrl(l.canvas), offsetX: l.offsetX, offsetY: l.offsetY };
    });
    return { snapshots: snaps };
  }, [layers]);

  // ---- Init canvas ----
  const initCanvas = useCallback((w: number, h: number) => {
    const bgCanvas = makeCanvas(w, h, true);
    const id = uid();
    const layer: Layer = { id, name: '图层 1', canvas: bgCanvas, visible: true, opacity: 1, offsetX: 0, offsetY: 0 };
    layerRefs.current.clear();
    layerRefs.current.set(id, layer);
    setLayers([layer]);
    setActiveLayerId(id);
    setHistory([ { snapshots: { [id]: { dataUrl: canvasToUrl(bgCanvas), offsetX: 0, offsetY: 0 } } } ]);
    setRedoStack([]);
  }, []);

  // ---- Mount ----
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    try { setArtworks(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch {}
    initCanvas(canvasW, canvasH);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Re-init when canvas size changes ----
  const prevW = useRef(canvasW);
  const prevH = useRef(canvasH);
  useEffect(() => {
    if (!inited.current) return;
    if (canvasW !== prevW.current || canvasH !== prevH.current) {
      prevW.current = canvasW;
      prevH.current = canvasH;
      initCanvas(canvasW, canvasH);
    }
  }, [canvasW, canvasH, initCanvas]);

  // ---- Tool / grid size handlers ----
  const handleGridSizeChange = useCallback((s: number) => {
    setCanvasW(s);
    setCanvasH(s);
  }, []);

  const handleZoomChange = useCallback((z: number) => setZoom(z), []);
  const handleToggleGrid = useCallback(() => setShowGrid(g => !g), []);

  // ---- History ----
  const handleLayerSnapshot = useCallback(() => {
    const active = layerRefs.current.get(activeLayerId);
    if (!active) return;
    pendingSnap.current = {
      [activeLayerId]: { dataUrl: canvasToUrl(active.canvas), offsetX: active.offsetX, offsetY: active.offsetY },
    };
  }, [activeLayerId]);

  const handleAfterStroke = useCallback(() => {
    if (!pendingSnap.current) return;
    const active = layerRefs.current.get(activeLayerId);
    if (!active) { pendingSnap.current = null; return; }
    const before = pendingSnap.current;
    const after = { [activeLayerId]: { dataUrl: canvasToUrl(active.canvas), offsetX: active.offsetX, offsetY: active.offsetY } };

    setHistory(prev => {
      const next = [...prev, { snapshots: { ...before, ...after } }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setRedoStack([]);
    pendingSnap.current = null;
  }, [activeLayerId]);

  const restoreEntry = useCallback(async (entry: HistoryEntry) => {
    for (const [id, snap] of Object.entries(entry.snapshots)) {
      const layer = layerRefs.current.get(id);
      if (!layer) continue;
      await drawUrlOnCanvas(layer.canvas, snap.dataUrl);
      layer.offsetX = snap.offsetX;
      layer.offsetY = snap.offsetY;
      setLayers(prev => prev.map(l => l.id === id ? { ...l, offsetX: snap.offsetX, offsetY: snap.offsetY } : l));
    }
    (window as any).__pixelRender?.();
  }, []);

  const handleUndo = useCallback(async () => {
    if (history.length < 2) return;
    const current = history[history.length - 1];
    const prev = history[history.length - 2];
    setRedoStack(r => [...r, current]);
    setHistory(h => h.slice(0, -1));
    await restoreEntry(prev);
  }, [history, restoreEntry]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setHistory(h => [...h, entry]);
    await restoreEntry(entry);
  }, [redoStack, restoreEntry]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      if (e.key === 'b' || e.key === 'B') setTool('brush');
      if (e.key === 'e' || e.key === 'E') setTool('eraser');
      if (e.key === 'f' || e.key === 'F') setTool('fill');
      if (e.key === 'i' || e.key === 'I') setTool('eyedropper');
      if (e.key === 'm' || e.key === 'M') setTool('move');
      if (e.key === '[') setBrushSize(s => Math.max(1, s - 1));
      if (e.key === ']') setBrushSize(s => Math.min(16, s + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ---- Layer operations ----
  const updateLayerRef = useCallback((id: string, updates: Partial<{ visible: boolean; opacity: number; offsetX: number; offsetY: number }>) => {
    const ref = layerRefs.current.get(id);
    if (ref) Object.assign(ref, updates);
  }, []);

  const handleAddLayer = useCallback(() => {
    const c = makeCanvas(canvasW, canvasH);
    const id = uid();
    const num = layers.length + 1;
    const layer: Layer = { id, name: `图层 ${num}`, canvas: c, visible: true, opacity: 1, offsetX: 0, offsetY: 0 };
    layerRefs.current.set(id, layer);
    setLayers(prev => [...prev, layer]);
    setActiveLayerId(id);
    (window as any).__pixelRender?.();
  }, [canvasW, canvasH, layers.length]);

  const handleDeleteLayer = useCallback((id: string) => {
    if (layers.length <= 1) return;
    layerRefs.current.delete(id);
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      const remaining = layers.filter(l => l.id !== id);
      setActiveLayerId(remaining[remaining.length - 1].id);
    }
    setTimeout(() => (window as any).__pixelRender?.(), 0);
  }, [layers, activeLayerId]);

  const handleDuplicateLayer = useCallback((id: string) => {
    const src = layerRefs.current.get(id);
    if (!src) return;
    const c = makeCanvas(canvasW, canvasH);
    c.getContext('2d')!.drawImage(src.canvas, 0, 0);
    const newId = uid();
    const layer: Layer = { id: newId, name: `${layers.find(l => l.id === id)?.name || '图层'} 副本`, canvas: c, visible: true, opacity: src.opacity, offsetX: src.offsetX, offsetY: src.offsetY };
    layerRefs.current.set(newId, layer);
    const idx = layers.findIndex(l => l.id === id);
    setLayers(prev => { const n = [...prev]; n.splice(idx + 1, 0, layer); return n; });
    setActiveLayerId(newId);
    setTimeout(() => (window as any).__pixelRender?.(), 0);
  }, [canvasW, canvasH, layers]);

  const handleToggleVis = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    updateLayerRef(id, { visible: !layerRefs.current.get(id)?.visible });
    setTimeout(() => (window as any).__pixelRender?.(), 0);
  }, [updateLayerRef]);

  const handleOpacityChange = useCallback((id: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
    updateLayerRef(id, { opacity });
    (window as any).__pixelRender?.();
  }, [updateLayerRef]);

  const moveLayer = useCallback((id: string, dir: -1 | 1) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const n = [...prev];
      [n[idx], n[target]] = [n[target], n[idx]];
      // Sync map order by rebuilding
      layerRefs.current.clear();
      n.forEach(l => layerRefs.current.set(l.id, l));
      return n;
    });
    setTimeout(() => (window as any).__pixelRender?.(), 0);
  }, []);

  // ---- Export ----
  const handleExport = useCallback(async () => {
    const refLayers: { canvas: HTMLCanvasElement; visible: boolean; opacity: number; offsetX: number; offsetY: number }[] = [];
    layers.forEach(l => refLayers.push({ canvas: l.canvas, visible: l.visible, opacity: l.opacity, offsetX: l.offsetX, offsetY: l.offsetY }));
    const blob = await exportPng(refLayers, canvasW, canvasH);
    downloadBlob(blob, `pixel-art-${Date.now()}.png`);
  }, [layers, canvasW, canvasH]);

  // ---- Artworks ----
  const persistArtworks = useCallback((arts: Artwork[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arts));
  }, []);

  const handleSave = useCallback(() => {
    let name: string;
    if (currentArtId) {
      name = artworks.find(a => a.id === currentArtId)?.name || `作品 ${Date.now()}`;
    } else {
      const input = prompt('请输入作品名称：', `像素画 ${artworks.length + 1}`);
      if (input === null) return;
      name = input || `像素画 ${artworks.length + 1}`;
    }

    // Make thumbnail
    const thumbCanvas = makeCanvas(canvasW, canvasH);
    const refLayers = layers.map(l => ({ canvas: l.canvas, visible: l.visible, opacity: l.opacity, offsetX: l.offsetX, offsetY: l.offsetY }));
    compositeLayers(thumbCanvas, refLayers, canvasW, canvasH);

    const layerData = layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      dataUrl: canvasToUrl(l.canvas),
      offsetX: l.offsetX,
      offsetY: l.offsetY,
    }));

    const art: Artwork = {
      id: currentArtId || uid(),
      name,
      width: canvasW,
      height: canvasH,
      layers: layerData,
      thumb: canvasToUrl(thumbCanvas),
      updatedAt: Date.now(),
    };

    setArtworks(prev => {
      const idx = prev.findIndex(a => a.id === art.id);
      const next = idx >= 0 ? prev.map((a, i) => i === idx ? art : a) : [...prev, art];
      persistArtworks(next);
      return next;
    });
    setCurrentArtId(art.id);
  }, [currentArtId, artworks, canvasW, canvasH, layers, persistArtworks]);

  const handleOpenArtwork = useCallback(async (id: string) => {
    const art = artworks.find(a => a.id === id);
    if (!art) return;

    layerRefs.current.clear();
    const newLayers: Layer[] = [];
    for (const ld of art.layers) {
      const c = makeCanvas(art.width, art.height);
      await drawUrlOnCanvas(c, ld.dataUrl);
      const layer: Layer = { id: ld.id, name: ld.name, canvas: c, visible: ld.visible, opacity: ld.opacity, offsetX: ld.offsetX, offsetY: ld.offsetY };
      layerRefs.current.set(ld.id, layer);
      newLayers.push(layer);
    }

    setLayers(newLayers);
    setActiveLayerId(newLayers[newLayers.length - 1]?.id || '');
    setCanvasW(art.width);
    setCanvasH(art.height);
    setCurrentArtId(art.id);
    // Build initial history from the newly loaded refs (not stale `layers` state)
    const initSnaps: Record<string, { dataUrl: string; offsetX: number; offsetY: number }> = {};
    newLayers.forEach(l => {
      initSnaps[l.id] = { dataUrl: canvasToUrl(l.canvas), offsetX: l.offsetX, offsetY: l.offsetY };
    });
    setHistory([{ snapshots: initSnaps }]);
    setRedoStack([]);
    setGalleryOpen(false);

    prevW.current = art.width;
    prevH.current = art.height;

    setTimeout(() => (window as any).__pixelRender?.(), 50);
  }, [artworks]);

  const handleDeleteArtwork = useCallback((id: string) => {
    setArtworks(prev => {
      const next = prev.filter(a => a.id !== id);
      persistArtworks(next);
      return next;
    });
    if (currentArtId === id) setCurrentArtId(null);
  }, [currentArtId, persistArtworks]);

  const handleNew = useCallback(() => {
    if (!window.confirm('创建新画布将丢弃当前未保存的更改，是否继续？')) return;
    setCurrentArtId(null);
    initCanvas(canvasW, canvasH);
  }, [canvasW, canvasH, initCanvas]);

  const handleColorPick = useCallback((c: string) => {
    setColor(c);
    setTool('brush');
  }, []);

  return (
    <div className="app">
      <TopBar
        gridSize={canvasW}
        zoom={zoom}
        showGrid={showGrid}
        canUndo={history.length >= 2}
        canRedo={redoStack.length > 0}
        onGridSizeChange={handleGridSizeChange}
        onZoomChange={handleZoomChange}
        onToggleGrid={handleToggleGrid}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
        onSave={handleSave}
        onOpenGallery={() => { setArtworks(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); setGalleryOpen(true); }}
        onNew={handleNew}
      />
      <div className="main">
        <ColorPalette color={color} onColorChange={setColor} />
        <Canvas
          canvasW={canvasW}
          canvasH={canvasH}
          zoom={zoom}
          showGrid={showGrid}
          tool={tool}
          color={color}
          brushSize={brushSize}
          layerRefs={layerRefs}
          activeLayerId={activeLayerId}
          onColorPick={handleColorPick}
          onAfterStroke={handleAfterStroke}
          onLayerSnapshot={handleLayerSnapshot}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Toolbar
            tool={tool}
            brushSize={brushSize}
            onToolChange={setTool}
            onBrushSizeChange={setBrushSize}
          />
          <LayerPanel
            layers={layers}
            activeId={activeLayerId}
            onSelect={setActiveLayerId}
            onAdd={handleAddLayer}
            onDelete={handleDeleteLayer}
            onDuplicate={handleDuplicateLayer}
            onToggleVis={handleToggleVis}
            onOpacityChange={handleOpacityChange}
            onMoveUp={(id) => moveLayer(id, 1)}
            onMoveDown={(id) => moveLayer(id, -1)}
          />
        </div>
      </div>
      {galleryOpen && (
        <ArtworkGallery
          artworks={artworks}
          onOpen={handleOpenArtwork}
          onDelete={handleDeleteArtwork}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}
