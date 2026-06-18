import { canvasToUrl } from '../canvasUtils';

interface LayerPanelItem {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
}

interface Props {
  layers: LayerPanelItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleVis: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

export default function LayerPanel({
  layers, activeId, onSelect, onAdd, onDelete, onDuplicate,
  onToggleVis, onOpacityChange, onMoveUp, onMoveDown,
}: Props) {
  return (
    <div className="layers-section">
      <div className="layers-header">
        <h3>图层</h3>
        <div className="layers-actions">
          <button onClick={onAdd} title="新建图层">+</button>
        </div>
      </div>
      <div className="layers-list">
        {layers.map((layer, i) => (
          <div
            key={layer.id}
            className={`layer-item${layer.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(layer.id)}
          >
            <img
              className="layer-thumb"
              src={canvasToUrl(layer.canvas)}
              alt={layer.name}
              draggable={false}
            />
            <div className="layer-info">
              <div className="layer-name">{layer.name}</div>
              <div className="layer-meta">
                <span className="layer-opacity">
                  {Math.round(layer.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onOpacityChange(layer.id, +e.target.value / 100)}
                  style={{ width: 50, accentColor: '#cba6f7' }}
                />
              </div>
            </div>
            <div className="layer-controls">
              <button
                className={layer.visible ? '' : 'vis-off'}
                title={layer.visible ? '隐藏' : '显示'}
                onClick={e => { e.stopPropagation(); onToggleVis(layer.id); }}
              >
                {layer.visible ? '👁' : '—'}
              </button>
              <button
                title="上移"
                onClick={e => { e.stopPropagation(); onMoveUp(layer.id); }}
                disabled={i === layers.length - 1}
              >
                ↑
              </button>
              <button
                title="下移"
                onClick={e => { e.stopPropagation(); onMoveDown(layer.id); }}
                disabled={i === 0}
              >
                ↓
              </button>
              <button
                title="复制"
                onClick={e => { e.stopPropagation(); onDuplicate(layer.id); }}
              >
                ⊕
              </button>
              <button
                title="删除"
                onClick={e => { e.stopPropagation(); onDelete(layer.id); }}
                disabled={layers.length <= 1}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
