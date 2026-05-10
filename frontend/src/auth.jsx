import { createContext, useContext, useEffect, useState } from 'react';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) localStorage.setItem('token', token); else localStorage.removeItem('token');
    if (user)  localStorage.setItem('user', JSON.stringify(user)); else localStorage.removeItem('user');
  }, [token, user]);

  async function login(username, password) {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Đăng nhập thất bại');
    setUser(data.user); setToken(data.token);
    return data.user;
  }

  async function register({ username, email, password, captchaToken, captchaAnswer, hp }) {
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, captchaToken, captchaAnswer, hp }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Đăng ký thất bại');
    setUser(data.user); setToken(data.token);
    return data.user;
  }

  async function getCaptcha() {
    const r = await fetch(`${API}/api/auth/captcha`);
    if (!r.ok) throw new Error('Không tải được mã xác minh');
    return r.json();
  }

  function logout() {
    setUser(null);
    setToken(null);
  }

  async function authFetch(path, options = {}) {
    const r = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return r;
  }

  return (
    <AuthCtx.Provider value={{ user, token, login, register, getCaptcha, logout, authFetch }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
