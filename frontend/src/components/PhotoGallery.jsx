import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '../auth.jsx';

function timeAgo(date) {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60)         return `${sec}s trước`;
  if (sec < 3600)       return `${Math.floor(sec/60)} phút trước`;
  if (sec < 86400)      return `${Math.floor(sec/3600)} giờ trước`;
  if (sec < 86400 * 7)  return `${Math.floor(sec/86400)} ngày trước`;
  return new Date(date).toLocaleDateString('vi-VN');
}

export default function PhotoGallery({ ho, socket }) {
  const { user, token, authFetch } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const fileRef = useRef();

  // Load
  useEffect(() => {
    if (!ho) return;
    setLoading(true);
    fetch(`${API}/api/photos?hoKey=${ho.key}`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos || []))
      .finally(() => setLoading(false));
  }, [ho]);

  // Realtime
  useEffect(() => {
    if (!socket || !ho) return;
    const onNew = (p) => {
      if (p.ho_key === ho.key) setPhotos((prev) => [p, ...prev]);
    };
    const onDel = ({ id, hoKey }) => {
      if (hoKey === ho.key) setPhotos((prev) => prev.filter((p) => p.id !== id));
    };
    socket.on('photo:new', onNew);
    socket.on('photo:delete', onDel);
    return () => { socket.off('photo:new', onNew); socket.off('photo:delete', onDel); };
  }, [socket, ho]);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('hoKey', ho.key);
      if (caption) fd.append('caption', caption);
      const r = await fetch(`${API}/api/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload thất bại');
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo) {
    if (!confirm('Xoá ảnh này?')) return;
    const r = await authFetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'Lỗi');
    }
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        📸 Ảnh thực tế từ thành viên ({photos.length})
      </h3>

      {!user ? (
        <div style={{
          background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10,
          padding: 14, fontSize: 12, color: '#6b7280', marginBottom: 12, textAlign: 'center',
        }}>
          <Link to="/login" style={{ color: '#0f2d52', fontWeight: 600 }}>Đăng nhập</Link> để đăng ảnh và bình luận
        </div>
      ) : (
        <form onSubmit={handleUpload} style={{
          background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <input ref={fileRef} type="file" accept="image/*" required style={{ fontSize: 12 }} />
          <input
            type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="Mô tả (không bắt buộc)..."
            maxLength={500}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
          />
          <button type="submit" disabled={uploading} style={{
            padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: '#0f2d52', color: '#fff', border: 'none', cursor: 'pointer',
            opacity: uploading ? 0.6 : 1, alignSelf: 'flex-start',
          }}>
            {uploading ? 'Đang tải...' : '📤 Đăng ảnh'}
          </button>
        </form>
      )}

      {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 12 }}>Đang tải...</div>}

      {!loading && photos.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 30, fontSize: 12, background: '#f8fafc', borderRadius: 8 }}>
          Chưa có ảnh nào — hãy là người đầu tiên!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} socket={socket} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

function PhotoCard({ photo, socket, onDelete }) {
  const { user, token, authFetch } = useAuth();
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  function loadComments() {
    fetch(`${API}/api/photos/${photo.id}/comments`)
      .then((r) => r.json())
      .then((d) => { setComments(d.comments || []); setLoaded(true); });
  }

  // Realtime comments cho ảnh đang mở
  useEffect(() => {
    if (!socket || !open) return;
    const onNew = (c) => { if (c.photo_id === photo.id) setComments((prev) => [...prev, c]); };
    const onDel = ({ id, photo_id }) => { if (photo_id === photo.id) setComments((prev) => prev.filter((c) => c.id !== id)); };
    socket.on('comment:new', onNew);
    socket.on('comment:delete', onDel);
    return () => { socket.off('comment:new', onNew); socket.off('comment:delete', onDel); };
  }, [socket, open, photo.id]);

  async function postComment(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/api/photos/${photo.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error);
      }
      setText('');
    } catch (e) {
      alert(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(c) {
    if (!confirm('Xoá bình luận này?')) return;
    const r = await authFetch(`/api/comments/${c.id}`, { method: 'DELETE' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'Lỗi');
    }
  }

  function toggle() {
    if (!open && !loaded) loadComments();
    setOpen(!open);
  }

  const isOwner = user?.id === photo.user_id;
  const canDelete = isOwner || user?.role === 'admin';

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>👤 {photo.username}</span>
        <span style={{ color: '#9ca3af' }}>· {timeAgo(photo.created_at)}</span>
        {canDelete && (
          <button onClick={() => onDelete(photo)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>Xoá</button>
        )}
      </div>
      <img src={`${API}/uploads/${photo.filename}`} alt={photo.caption || ''}
        style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block', background: '#f3f4f6' }} />
      {photo.caption && (
        <div style={{ padding: '8px 12px', fontSize: 13, color: '#374151' }}>
          {photo.caption}
        </div>
      )}
      <button onClick={toggle} style={{
        width: '100%', padding: '8px 12px', background: '#f8fafc',
        border: 'none', borderTop: '1px solid #e5e7eb',
        fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 600, textAlign: 'left',
      }}>
        💬 {open ? 'Ẩn' : 'Xem'} bình luận ({photo.comments_count || comments.length})
      </button>

      {open && (
        <div style={{ padding: '8px 12px', background: '#fafbfc' }}>
          {!loaded && <div style={{ color: '#9ca3af', fontSize: 12 }}>Đang tải...</div>}
          {loaded && comments.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 12, padding: '6px 0' }}>Chưa có bình luận nào</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {comments.map((c) => {
              const myComment = user?.id === c.user_id;
              const canDel = myComment || user?.role === 'admin';
              return (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: '#374151' }}>{c.username}</span>
                    <span style={{ color: '#9ca3af' }}>· {timeAgo(c.created_at)}</span>
                    {canDel && (
                      <button onClick={() => deleteComment(c)} style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      }}>Xoá</button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#1f2937', marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                </div>
              );
            })}
          </div>
          {user ? (
            <form onSubmit={postComment} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text" value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Viết bình luận..." maxLength={1000}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
              />
              <button type="submit" disabled={posting || !text.trim()} style={{
                padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: '#0f2d52', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: (posting || !text.trim()) ? 0.5 : 1,
              }}>Gửi</button>
            </form>
          ) : (
            <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 6 }}>
              <Link to="/login" style={{ color: '#0f2d52', fontWeight: 600 }}>Đăng nhập</Link> để bình luận
            </div>
          )}
        </div>
      )}
    </div>
  );
}
