import { Artwork } from '../types';

interface Props {
  artworks: Artwork[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ArtworkGallery({ artworks, onOpen, onDelete, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>我的作品</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {artworks.length === 0 ? (
            <div className="empty-msg">还没有保存的作品</div>
          ) : (
            <div className="artwork-grid">
              {artworks
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(a => (
                  <div key={a.id} className="artwork-card">
                    <img className="thumb" src={a.thumb} alt={a.name} />
                    <div className="name">{a.name}</div>
                    <div className="meta">
                      {a.width}×{a.height} · {new Date(a.updatedAt).toLocaleString('zh-CN')}
                    </div>
                    <div className="actions">
                      <button className="btn-open" onClick={() => onOpen(a.id)}>打开</button>
                      <button className="btn-del" onClick={() => onDelete(a.id)}>删除</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
