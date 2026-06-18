import { DEFAULT_PALETTE } from '../constants';

interface Props {
  color: string;
  onColorChange: (c: string) => void;
}

export default function ColorPalette({ color, onColorChange }: Props) {
  return (
    <div className="panel-left">
      <div className="panel-section">
        <h3>颜色</h3>
        <div className="color-preview">
          <div>
            <div className="swatch active" style={{ background: color }} />
            <div className="label">当前</div>
          </div>
        </div>
        <input
          type="color"
          className="color-input"
          value={color}
          onChange={e => onColorChange(e.target.value)}
        />
        <input
          className="color-hex"
          value={color}
          maxLength={7}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') onColorChange(v);
          }}
          onBlur={e => {
            if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onColorChange('#000000');
          }}
          spellCheck={false}
        />
      </div>

      <div className="panel-section" style={{ flex: 1, overflow: 'auto' }}>
        <h3>调色板</h3>
        <div className="palette-grid">
          {DEFAULT_PALETTE.map(c => (
            <div
              key={c}
              className={`palette-color${c === color ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
