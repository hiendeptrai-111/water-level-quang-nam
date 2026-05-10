const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const svgCaptcha = require('svg-captcha');
const rateLimit = require('express-rate-limit');
const { getPool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'water-level-secret-change-me-in-prod';
const JWT_EXPIRES = '7d';

// ─── CAPTCHA store: token → {answer, expires} ─────────────────
const captchaStore = new Map();
const CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 phút

function cleanupCaptcha() {
  const now = Date.now();
  for (const [k, v] of captchaStore.entries()) if (v.expires < now) captchaStore.delete(k);
}
setInterval(cleanupCaptcha, 60 * 1000); // dọn mỗi phút

function makeCaptcha() {
  // ignoreChars: bỏ ký tự dễ nhầm (0/O/o/1/l/I)
  const opts = {
    size: 5,
    noise: 3,
    color: true,
    background: '#f8fafc',
    ignoreChars: '0o1ilI',
    width: 160,
    height: 60,
    fontSize: 50,
  };
  const cap = svgCaptcha.create(opts);
  const token = crypto.randomBytes(16).toString('hex');
  captchaStore.set(token, {
    answer: cap.text.toLowerCase(),
    expires: Date.now() + CAPTCHA_TTL_MS,
  });
  return { token, svg: cap.data };
}

function verifyCaptcha(token, answer) {
  if (!token || !answer) return { ok: false, reason: 'Thiếu mã xác minh' };
  const c = captchaStore.get(token);
  if (!c) return { ok: false, reason: 'Mã đã hết hạn, vui lòng làm mới' };
  captchaStore.delete(token); // 1 lần dùng
  if (c.expires < Date.now()) return { ok: false, reason: 'Mã đã hết hạn' };
  if (c.answer !== String(answer).trim().toLowerCase()) return { ok: false, reason: 'Mã xác minh không đúng' };
  return { ok: true };
}

// ─── Rate limiters ────────────────────────────────────────────
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 lần / 15 phút / IP
  message: { error: 'Bạn đăng ký quá nhiều lần. Thử lại sau 15 phút.' },
  standardHeaders: true, legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20, // 20 lần / 10 phút / IP (đủ cho user nhập sai vài lần)
  message: { error: 'Quá nhiều lần đăng nhập sai. Thử lại sau 10 phút.' },
  standardHeaders: true, legacyHeaders: false,
});

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
  // Cấp CAPTCHA mới
  app.get('/api/auth/captcha', (req, res) => {
    const { token, svg } = makeCaptcha();
    res.json({ token, svg });
  });

  app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
      const { username, email, password, captchaToken, captchaAnswer, hp } = req.body || {};

      // Honeypot: bot tự fill mọi field, user thật để trống
      if (hp) return res.status(400).json({ error: 'Phát hiện bot' });

      // Verify CAPTCHA trước (chống spam DB)
      const cap = verifyCaptcha(captchaToken, captchaAnswer);
      if (!cap.ok) return res.status(400).json({ error: cap.reason });

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
      const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM users');
      const role = cnt.rows[0].n === 0 ? 'admin' : 'user';

      const hash = await bcrypt.hash(password, 10);
      try {
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [username, email.toLowerCase(), hash, role]
        );
        const user = { id: result.rows[0].id, username, email: email.toLowerCase(), role };
        res.json({ token: makeToken(user), user });
      } catch (e) {
        if (e.code === '23505') // unique_violation
          return res.status(409).json({ error: 'Username hoặc email đã tồn tại' });
        throw e;
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });

      const pool = getPool();
      const result = await pool.query(
        'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = $1 OR email = $2 LIMIT 1',
        [username, username.toLowerCase()]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
      const u = result.rows[0];
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
