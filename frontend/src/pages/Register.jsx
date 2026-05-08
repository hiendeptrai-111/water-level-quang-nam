import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [err, setErr]   = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) return setErr('Mật khẩu nhập lại không khớp');
    setErr(''); setBusy(true);
    try {
      await register(username, email, password);
      nav('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <form onSubmit={submit} style={card}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Đăng ký tài khoản</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280' }}>
          Tạo tài khoản miễn phí để xem dự đoán & truy cập đầy đủ
        </p>

        <Label>Tên đăng nhập</Label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30}
          pattern="[a-zA-Z0-9_]{3,30}" style={inp} autoFocus
          placeholder="3-30 ký tự, chỉ chữ/số/_" />

        <Label>Email</Label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inp} placeholder="ban@email.com" />

        <Label>Mật khẩu</Label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inp} placeholder="≥ 6 ký tự" />

        <Label>Nhập lại mật khẩu</Label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inp} />

        {err && <div style={errBox}>{err}</div>}

        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? .6 : 1 }}>
          {busy ? 'Đang xử lý...' : 'Đăng ký'}
        </button>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Đã có tài khoản? <Link to="/login" style={{ color: '#0f2d52', fontWeight: 600 }}>Đăng nhập</Link>
        </div>
      </form>
    </div>
  );
}

const wrap = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f1f5f9' };
const card = { width: 'min(440px, 100%)', background: '#fff', borderRadius: 14, padding: '28px 30px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' };
const inp = { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, fontFamily: 'inherit' };
const btn = { padding: '11px 14px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#fbbf24', color: '#1f2937', border: 'none', cursor: 'pointer', marginTop: 4 };
const errBox = { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 10 };
function Label({ children }) {
  return <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{children}</span>;
}
