/**
 * server.js  - REALTIME + Auth + History (MySQL)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');
const { scrapeWaterLevels, DATA_FILE } = require('./scraper');
const { initDb, getPool, saveRecords, getRecords, getRecordCount } = require('./db');
const { attachAuthRoutes, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = +(process.env.PORT || 4000);
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());

// Structured logger
const log = {
  info:  (msg, meta) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO',  msg, ...meta })),
  warn:  (msg, meta) => console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'WARN',  msg, ...meta })),
  error: (msg, meta) => console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', msg, ...meta })),
};

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Request log
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      log.info('http', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
    }
  });
  next();
});

// ─── Health check (DevOps requirement) ─────────────────────────
app.get('/api/health', async (req, res) => {
  let dbOk;
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const ok = dbOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'healthy' : 'unhealthy',
    uptime_seconds: Math.round(process.uptime()),
    services: {
      api: 'up',
      database: dbOk ? 'up' : 'down',
      scraper: lastFingerprint ? 'up' : 'pending',
    },
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

let lastFingerprint = null;

function makeFingerprint(record) {
  if (!record) return null;
  return `${record.ngay}_${record.gio}`;
}

// ─── Auth routes ───────────────────────────────────────────────
attachAuthRoutes(app);

// ─── Static uploads ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
      return cb(new Error('Chỉ chấp nhận ảnh JPEG/PNG/WEBP/GIF'));
    cb(null, true);
  },
});

const VALID_HO = ['a_vuong', 'song_bung_4', 'dak_mi_4', 'song_tranh_2'];

// Upload ảnh (cần đăng nhập)
app.post('/api/photos', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { hoKey, caption } = req.body;
    if (!VALID_HO.includes(hoKey)) return res.status(400).json({ error: 'hoKey không hợp lệ' });
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });

    const pool = getPool();
    const ins = await pool.query(
      'INSERT INTO photos (ho_key, user_id, filename, caption) VALUES ($1, $2, $3, $4) RETURNING id',
      [hoKey, req.user.id, req.file.filename, caption?.slice(0, 500) || null]
    );

    const sel = await pool.query(
      `SELECT p.*, u.username FROM photos p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [ins.rows[0].id]
    );
    const photo = { ...sel.rows[0], comments_count: 0 };
    io.emit('photo:new', photo);
    res.json(photo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lấy danh sách ảnh của 1 hồ
app.get('/api/photos', async (req, res) => {
  try {
    const { hoKey } = req.query;
    if (!VALID_HO.includes(hoKey)) return res.status(400).json({ error: 'hoKey không hợp lệ' });
    const pool = getPool();
    const result = await pool.query(`
      SELECT p.id, p.ho_key, p.user_id, p.filename, p.caption, p.created_at, u.username,
             (SELECT COUNT(*)::int FROM comments c WHERE c.photo_id = p.id) AS comments_count
      FROM photos p
      JOIN users u ON u.id = p.user_id
      WHERE p.ho_key = $1
      ORDER BY p.created_at DESC
      LIMIT 200
    `, [hoKey]);
    res.json({ photos: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Xoá ảnh (chủ ảnh hoặc admin)
app.delete('/api/photos/:id', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const sel = await pool.query('SELECT * FROM photos WHERE id = $1', [req.params.id]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
    const photo = sel.rows[0];
    const isOwner = photo.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Không có quyền xoá' });

    await pool.query('DELETE FROM photos WHERE id = $1', [req.params.id]);
    try { fs.unlinkSync(path.join(UPLOAD_DIR, photo.filename)); } catch {}
    io.emit('photo:delete', { id: +req.params.id, hoKey: photo.ho_key });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Xoá comment (chủ comment hoặc admin)
app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const sel = await pool.query('SELECT id, photo_id, user_id FROM comments WHERE id = $1', [req.params.id]);
    if (!sel.rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
    const c = sel.rows[0];
    const isOwner = c.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Không có quyền xoá' });

    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    io.emit('comment:delete', { id: +req.params.id, photo_id: c.photo_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN: quản lý người dùng ─────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
             (SELECT COUNT(*)::int FROM photos   WHERE user_id = u.id) AS photos_count,
             (SELECT COUNT(*)::int FROM comments WHERE user_id = u.id) AS comments_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const id = +req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Không thể tự sửa chính mình' });

    const sets = [];
    const params = [];
    if (req.body.role !== undefined) {
      if (!['user', 'admin'].includes(req.body.role)) return res.status(400).json({ error: 'role không hợp lệ' });
      params.push(req.body.role);
      sets.push(`role = $${params.length}`);
    }
    if (req.body.is_active !== undefined) {
      params.push(!!req.body.is_active);
      sets.push(`is_active = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });

    params.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const id = +req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Không thể tự xoá chính mình' });

    const photos = await pool.query('SELECT filename FROM photos WHERE user_id = $1', [id]);
    photos.rows.forEach((p) => {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, p.filename)); } catch {}
    });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments của 1 ảnh
app.get('/api/photos/:id/comments', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, c.user_id, u.username
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.photo_id = $1 ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json({ comments: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Đăng comment (cần đăng nhập)
app.post('/api/photos/:id/comments', requireAuth, async (req, res) => {
  try {
    const content = (req.body?.content || '').trim().slice(0, 1000);
    if (!content) return res.status(400).json({ error: 'Nội dung trống' });

    const pool = getPool();
    const photo = await pool.query('SELECT id FROM photos WHERE id = $1', [req.params.id]);
    if (!photo.rows.length) return res.status(404).json({ error: 'Không tìm thấy ảnh' });

    const ins = await pool.query(
      'INSERT INTO comments (photo_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, req.user.id, content]
    );
    const comment = {
      id: ins.rows[0].id,
      photo_id: +req.params.id,
      user_id: req.user.id,
      username: req.user.username,
      content,
      created_at: new Date().toISOString(),
    };
    io.emit('comment:new', comment);
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REST: realtime data (public) ──────────────────────────────
app.get('/api/water-levels', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Chưa có dữ liệu' });
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
});

app.get('/api/water-levels/latest', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Chưa có dữ liệu' });
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const latest = data.records?.[data.records.length - 1] || null;
  res.json({ lastUpdated: data.lastUpdated, record: latest });
});

app.post('/api/scrape', async (req, res) => {
  try {
    const result = await runScrapeAndBroadcast();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── REST: history (public, đọc DB) ────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const records = await getRecords({
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
      limit: limit || 2000,
    });
    res.json({ count: records.length, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/history/stats', async (req, res) => {
  try {
    const total = await getRecordCount();
    res.json({ total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REST: prediction (chỉ user đăng nhập) ─────────────────────
app.get('/api/prediction/:hoKey', requireAuth, async (req, res) => {
  try {
    const { hoKey } = req.params;
    const hoursAhead = +(req.query.hours || 12);
    const records = await getRecords({ limit: 200 });

    const points = records
      .map((r) => {
        const [d, m, y] = r.ngay.split('/').map(Number);
        const [hh, mm] = (r.gio || '00:00').split(':').map(Number);
        return { t: new Date(y, m - 1, d, hh, mm).getTime(), v: r[hoKey]?.mucNuoc };
      })
      .filter((p) => p.v != null);

    if (points.length < 4)
      return res.json({ forecast: [], slope: null, rmse: null, message: 'Chưa đủ dữ liệu' });

    const recent = points.slice(-24);
    const n = recent.length;
    const x0 = recent[0].t;
    const xs = recent.map((p) => (p.t - x0) / 3600000);
    const ys = recent.map((p) => p.v);
    const sumX  = xs.reduce((a, b) => a + b, 0);
    const sumY  = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;
    const rmse = Math.sqrt(ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0) / n);

    const lastX = xs[n - 1];
    const lastT = recent[n - 1].t;
    const forecast = [];
    for (let h = 1; h <= hoursAhead; h++) {
      const x = lastX + h;
      const v = slope * x + intercept;
      forecast.push({
        t: new Date(lastT + h * 3600000),
        v: Math.round(v * 100) / 100,
        lo: Math.round((v - rmse) * 100) / 100,
        hi: Math.round((v + rmse) * 100) / 100,
      });
    }
    res.json({ forecast, slope, rmse });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Socket.IO ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌  Client kết nối: ${socket.id}`);
  if (fs.existsSync(DATA_FILE)) {
    socket.emit('snapshot', JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  }
  socket.on('disconnect', () => console.log(`🔌  Client ngắt kết nối: ${socket.id}`));
});

// ─── Scrape + broadcast + save DB ──────────────────────────────
async function runScrapeAndBroadcast() {
  const data = await scrapeWaterLevels();
  const latest = data.records?.[data.records.length - 1];
  const fp = makeFingerprint(latest);

  // Lưu vào DB (upsert)
  try {
    const saved = await saveRecords(data.records);
    if (saved > 0) console.log(`💾  Đã lưu/ cập nhật ${saved} record vào MySQL`);
  } catch (e) {
    console.error('Lỗi lưu DB:', e.message);
  }

  const isNew = fp && fp !== lastFingerprint;
  if (isNew) {
    console.log(`🆕  Dữ liệu MỚI: ${latest.ngay} ${latest.gio} → emit cho ${io.engine.clientsCount} client`);
    lastFingerprint = fp;
    io.emit('water-level:update', {
      lastUpdated: data.lastUpdated,
      latest,
      records: data.records,
    });
  } else {
    console.log(`⏸   Không có dữ liệu mới (vẫn là ${fp})`);
  }

  return { count: data.records.length, isNew, latest };
}

const SCRAPE_INTERVAL_MS = +(process.env.SCRAPE_INTERVAL_MS || 10 * 60 * 1000);
const SCRAPE_DISABLED = String(process.env.SCRAPE_DISABLED).toLowerCase() === 'true';
if (!SCRAPE_DISABLED) {
  setInterval(async () => {
    try { await runScrapeAndBroadcast(); }
    catch (err) { log.error('scrape interval', { error: err.message }); }
  }, SCRAPE_INTERVAL_MS);
} else {
  log.info('scrape disabled (production mode)');
}

// ─── Khởi động ─────────────────────────────────────────────────
(async () => {
  try {
    await initDb();

    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      lastFingerprint = makeFingerprint(data.records?.[data.records.length - 1]);
      // Backfill JSON cũ vào DB lần đầu
      try {
        const saved = await saveRecords(data.records || []);
        if (saved > 0) console.log(`📥  Backfill ${saved} record từ data.json vào MySQL`);
      } catch (e) {
        console.error('Backfill lỗi:', e.message);
      }
    }
    if (!SCRAPE_DISABLED) {
      console.log('Chạy scrape khởi động...');
      await runScrapeAndBroadcast();
    }
  } catch (err) {
    console.error('Khởi động lỗi:', err.message);
  }
})();

httpServer.listen(PORT, () => {
  console.log(`🚀  HTTP + WebSocket server: http://localhost:${PORT}`);
});
