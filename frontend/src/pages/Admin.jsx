import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Admin() {
  const { user, authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const r = await authFetch('/api/admin/users');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUsers(d.users || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (user?.role === 'admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>🚫 Không có quyền truy cập</h2>
        <p style={{ color: '#6b7280' }}>Trang này chỉ dành cho admin.</p>
      </div>
    );
  }

  async function setRole(u, role) {
    if (!confirm(`Đổi quyền của "${u.username}" thành ${role.toUpperCase()}?`)) return;
    const r = await authFetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!r.ok) { const d = await r.json(); return alert(d.error); }
    load();
  }

  async function toggleActive(u) {
    const action = u.is_active ? 'KHOÁ' : 'MỞ KHOÁ';
    if (!confirm(`${action} tài khoản "${u.username}"?`)) return;
    const r = await authFetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    if (!r.ok) { const d = await r.json(); return alert(d.error); }
    load();
  }

  async function deleteUser(u) {
    if (!confirm(`Xoá vĩnh viễn tài khoản "${u.username}"? Tất cả ảnh & bình luận sẽ bị xoá!`)) return;
    const r = await authFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json(); return alert(d.error); }
    load();
  }

  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🛡️ Quản lý người dùng</h1>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{users.length} tài khoản</span>
        <button onClick={load} style={{
          marginLeft: 'auto', padding: '6px 12px', borderRadius: 6,
          background: '#0f2d52', color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 600,
        }}>Tải lại</button>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 12 }}>{err}</div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <Th>ID</Th>
                <Th>Username</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Trạng thái</Th>
                <Th>Ảnh</Th>
                <Th>Bình luận</Th>
                <Th>Đăng ký</Th>
                <Th>Hành động</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>Đang tải...</td></tr>}
              {!loading && users.map((u, i) => {
                const isMe = u.id === user.id;
                return (
                  <tr key={u.id} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                    <Td>{u.id}</Td>
                    <Td><b>{u.username}</b>{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280' }}>(bạn)</span>}</Td>
                    <Td style={{ color: '#6b7280' }}>{u.email}</Td>
                    <Td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                        background: u.role === 'admin' ? '#fef3c7' : '#dbeafe',
                        color:      u.role === 'admin' ? '#92400e' : '#1e40af',
                      }}>{u.role.toUpperCase()}</span>
                    </Td>
                    <Td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                        background: u.is_active ? '#dcfce7' : '#fee2e2',
                        color:      u.is_active ? '#166534' : '#991b1b',
                      }}>{u.is_active ? 'Hoạt động' : 'Đã khoá'}</span>
                    </Td>
                    <Td>{u.photos_count}</Td>
                    <Td>{u.comments_count}</Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</Td>
                    <Td>
                      {!isMe && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.role === 'user' ? (
                            <BtnAct onClick={() => setRole(u, 'admin')} color="#92400e" bg="#fef3c7">Lên Admin</BtnAct>
                          ) : (
                            <BtnAct onClick={() => setRole(u, 'user')} color="#374151" bg="#f3f4f6">Hạ User</BtnAct>
                          )}
                          <BtnAct onClick={() => toggleActive(u)}
                            color={u.is_active ? '#991b1b' : '#166534'}
                            bg={u.is_active ? '#fee2e2' : '#dcfce7'}>
                            {u.is_active ? 'Khoá' : 'Mở khoá'}
                          </BtnAct>
                          <BtnAct onClick={() => deleteUser(u)} color="#fff" bg="#dc2626">Xoá</BtnAct>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        💡 <b>Mẹo:</b> Admin có thể xoá ảnh và bình luận của bất kỳ ai trong panel chi tiết hồ.
        Người dùng đầu tiên đăng ký được tự động làm admin.
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', ...style }}>{children}</td>;
}
function BtnAct({ children, onClick, color, bg }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: bg, color, border: 'none', cursor: 'pointer',
    }}>{children}</button>
  );
}
