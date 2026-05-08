const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'water-level-secret-change-me-in-prod';
const JWT_EXPIRES = '7d';

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ admin mới có quyền' });
    next();
  });
}

function maybeAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

function attachAuthRoutes(app) {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      if (!username || !email || !password)
        return res.status(400).json({ error: 'Thiếu thông tin' });
      if (password.length < 6)
        return res.status(400).json({ error: 'Mật khẩu cần ≥ 6 ký tự' });
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
        return res.status(400).json({ error: 'Username 3-30 ký tự, chỉ chữ/số/_' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: 'Email không hợp lệ' });

      const pool = getPool();

      // User đầu tiên đăng ký → admin
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
      const role = n === 0 ? 'admin' : 'user';

      const hash = await bcrypt.hash(password, 10);
      try {
        const [result] = await pool.query(
          'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [username, email.toLowerCase(), hash, role]
        );
        const user = { id: result.insertId, username, email: email.toLowerCase(), role };
        res.json({ token: makeToken(user), user });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
          return res.status(409).json({ error: 'Username hoặc email đã tồn tại' });
        throw e;
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });

      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username, username.toLowerCase()]
      );
      if (!rows.length) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
      const u = rows[0];
      if (!u.is_active) return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return res.status(401).json({ error: 'Sai mật khẩu' });

      const user = { id: u.id, username: u.username, email: u.email, role: u.role };
      res.json({ token: makeToken(user), user });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
}

module.exports = { attachAuthRoutes, requireAuth, requireAdmin, maybeAuth };
