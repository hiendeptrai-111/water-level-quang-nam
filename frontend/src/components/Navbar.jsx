import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function useIsMobile(breakpoint = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setM(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return m;
}

export default function Navbar({ connected }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout(); navigate('/'); setMenuOpen(false);
  }

  const navLinks = (
    <>
      <NavItem to="/"          label="Trang chủ" onClick={() => setMenuOpen(false)} />
      <NavItem to="/thong-ke"  label="Thống kê"  onClick={() => setMenuOpen(false)} />
      <NavItem to="/lich-su"   label="Lịch sử"   onClick={() => setMenuOpen(false)} />
      {user?.role === 'admin' && <NavItem to="/admin" label="🛡️ Admin" onClick={() => setMenuOpen(false)} />}
    </>
  );

  const liveBadge = (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: connected ? '#dcfce7' : '#fee2e2',
      color: connected ? '#166534' : '#991b1b',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#22c55e' : '#ef4444',
        animation: connected ? 'blink 1.5s infinite' : 'none',
      }} />
      {!isMobile && (connected ? 'LIVE' : 'OFFLINE')}
    </span>
  );

  // ─── DESKTOP LAYOUT ─────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{
        background: '#0f2d52', color: '#fff', padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)', zIndex: 500, flexShrink: 0,
        height: 56,
      }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          💧 Thuỷ điện Quảng Nam
        </Link>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>{navLinks}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {liveBadge}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                {user.role === 'admin' ? '🛡️' : '👤'} <b style={{ color: '#fff' }}>{user.username}</b>
                {user.role === 'admin' && <span style={{ marginLeft: 4, padding: '1px 6px', background: '#fbbf24', color: '#1f2937', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>ADMIN</span>}
              </span>
              <button onClick={handleLogout} style={btnGhost}>Đăng xuất</button>
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

  // ─── MOBILE LAYOUT (hamburger menu) ─────────────────────────────
  return (
    <>
      <div style={{
        background: '#0f2d52', color: '#fff', padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)', zIndex: 700, flexShrink: 0,
        height: 52,
      }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          💧 TĐ Quảng Nam
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {liveBadge}

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            style={{
              background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
              color: '#fff', padding: '6px 10px', borderRadius: 8,
              cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Drawer ─── slide từ phải */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
              zIndex: 800, animation: 'fadeIn .2s',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(280px, 80vw)', background: '#0f2d52',
            zIndex: 801, padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 6,
            animation: 'slideIn .25s ease-out',
            color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} style={{
                background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1,
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{navLinks}</div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.15)', margin: '12px 0' }} />

            {user ? (
              <>
                <div style={{ fontSize: 12, color: '#cbd5e1', padding: '6px 10px' }}>
                  {user.role === 'admin' ? '🛡️' : '👤'} <b style={{ color: '#fff' }}>{user.username}</b>
                  {user.role === 'admin' && (
                    <span style={{ marginLeft: 4, padding: '1px 6px', background: '#fbbf24', color: '#1f2937', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>ADMIN</span>
                  )}
                </div>
                <button onClick={handleLogout} style={{ ...btnGhost, marginTop: 4, width: '100%', textAlign: 'left' }}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Link to="/login"    style={{ ...btnGhost, textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Đăng nhập</Link>
                <Link to="/register" style={{ ...btnPrimary, textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Đăng ký</Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function NavItem({ to, label, onClick }) {
  return (
    <NavLink to={to} end={to === '/'} onClick={onClick}
      style={({ isActive }) => ({
        color: isActive ? '#fff' : '#cbd5e1',
        textDecoration: 'none',
        fontSize: 13, fontWeight: 600,
        padding: '8px 14px', borderRadius: 8,
        background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
        transition: 'background .15s',
        whiteSpace: 'nowrap',
      })}
    >
      {label}
    </NavLink>
  );
}

const btnGhost = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: '1px solid rgba(255,255,255,.3)', background: 'transparent',
  color: '#fff', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};
const btnPrimary = {
  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: 'none', background: '#fbbf24', color: '#1f2937',
  cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};
