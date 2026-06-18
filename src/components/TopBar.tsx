interface Props {
  gridSize: number;
  zoom: number;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onGridSizeChange: (s: number) => void;
  onZoomChange: (z: number) => void;
  onToggleGrid: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onSave: () => void;
  onOpenGallery: () => void;
  onNew: () => void;
}

export default function TopBar({
  gridSize, zoom, showGrid, canUndo, canRedo,
  onGridSizeChange, onZoomChange, onToggleGrid,
  onUndo, onRedo, onExport, onSave, onOpenGallery, onNew,
}: Props) {
  return (
    <div className="topbar">
      <span className="logo">🎨 像素画编辑器</span>
      <span className="sep" />

      <div className="group">
        <label>画布</label>
        <select
          value={gridSize}
          onChange={e => onGridSizeChange(+e.target.value)}
        >
          <option value={16}>16×16</option>
          <option value={32}>32×32</option>
          <option value={64}>64×64</option>
        </select>
      </div>

      <span className="sep" />

      <div className="group">
        <label>缩放</label>
        <button onClick={() => onZoomChange(Math.max(1, zoom - 1))}>−</button>
        <span style={{ minWidth: 32, textAlign: 'center', fontSize: 12 }}>{zoom}x</span>
        <button onClick={() => onZoomChange(Math.min(32, zoom + 1))}>+</button>
      </div>

      <button className={showGrid ? 'active' : ''} onClick={onToggleGrid}>
        网格
      </button>

      <span className="sep" />

      <button disabled={!canUndo} onClick={onUndo}>↩ 撤销</button>
      <button disabled={!canRedo} onClick={onRedo}>↪ 重做</button>

      <span className="spacer" />

      <button onClick={onNew}>新建</button>
      <button onClick={onSave}>保存</button>
      <button onClick={onOpenGallery}>作品</button>
      <button onClick={onExport}>导出 PNG</button>
    </div>
  );
}
