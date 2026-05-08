import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar({ connected }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{
      background: '#0f2d52', color: '#fff', padding: '0 20px',
      display: 'flex', alignItems: 'center', gap: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,.2)', zIndex: 500, flexShrink: 0,
      height: 56,
    }}>
      <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
        💧 Thuỷ điện Quảng Nam
      </Link>

      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
        <NavItem to="/"          label="Trang chủ" />
        <NavItem to="/thong-ke"  label="Thống kê" />
        <NavItem to="/lich-su"   label="Lịch sử" />
        {user?.role === 'admin' && <NavItem to="/admin" label="🛡️ Admin" />}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 11px', borderRadius: 999,
          background: connected ? '#dcfce7' : '#fee2e2',
          color: connected ? '#166534' : '#991b1b',
          fontSize: 11, fontWeight: 700,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            animation: connected ? 'blink 1.5s infinite' : 'none',
          }} />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>
              {user.role === 'admin' ? '🛡️' : '👤'} <b style={{ color: '#fff' }}>{user.username}</b>
              {user.role === 'admin' && <span style={{ marginLeft: 4, padding: '1px 6px', background: '#fbbf24', color: '#1f2937', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>ADMIN</span>}
            </span>
            <button onClick={() => { logout(); navigate('/'); }} style={btnGhost}>Đăng xuất</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <Link to="/login"    style={btnGhost}>Đăng nhập</Link>
            <Link to="/register" style={btnPrimary}>Đăng ký</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink to={to} end={to === '/'}
      style={({ isActive }) => ({
        color: isActive ? '#fff' : '#cbd5e1',
        textDecoration: 'none',
        fontSize: 13, fontWeight: 600,
        padding: '8px 14px', borderRadius: 8,
        background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
        transition: 'background .15s',
      })}
    >
      {label}
    </NavLink>
  );
}

const btnGhost = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: '1px solid rgba(255,255,255,.3)', background: 'transparent',
  color: '#fff', cursor: 'pointer', textDecoration: 'none',
};
const btnPrimary = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: 'none', background: '#fbbf24', color: '#1f2937',
  cursor: 'pointer', textDecoration: 'none',
};
