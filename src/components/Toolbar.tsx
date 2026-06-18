import { Tool } from '../types';

const TOOLS: { key: Tool; icon: string; label: string }[] = [
  { key: 'brush',      icon: '✏️',  label: '画笔' },
  { key: 'eraser',     icon: '⬜',  label: '橡皮' },
  { key: 'fill',       icon: '🎨',  label: '填充' },
  { key: 'eyedropper', icon: '👇',  label: '吸管' },
  { key: 'move',       icon: '✨',  label: '移动' },
];

interface Props {
  tool: Tool;
  brushSize: number;
  onToolChange: (t: Tool) => void;
  onBrushSizeChange: (s: number) => void;
}

export default function Toolbar({ tool, brushSize, onToolChange, onBrushSizeChange }: Props) {
  return (
    <div className="panel-right">
      <div className="panel-section">
        <h3>工具</h3>
        <div className="tools-grid">
          {TOOLS.map(t => (
            <button
              key={t.key}
              className={`tool-btn${tool === t.key ? ' active' : ''}`}
              onClick={() => onToolChange(t.key)}
              title={t.label}
            >
              <span className="icon">{t.icon}</span>
              <span className="label">{t.label}</span>
            </button>
          ))}
        </div>
        {(tool === 'brush' || tool === 'eraser') && (
          <div className="brush-size">
            <label>笔刷</label>
            <input
              type="range"
              min={1}
              max={16}
              value={brushSize}
              onChange={e => onBrushSizeChange(+e.target.value)}
            />
            <span className="val">{brushSize}</span>
          </div>
        )}
      </div>
    </div>
  );
}
