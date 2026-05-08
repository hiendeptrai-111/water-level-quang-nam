const { Pool } = require('pg');

// Cho phép cấu hình bằng DATABASE_URL (Neon/Render style) HOẶC từng biến rời
const DATABASE_URL = process.env.DATABASE_URL;
const DB_CONFIG = DATABASE_URL
  ? {
      connectionString: DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     +(process.env.DB_PORT   || 5432),
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME     || 'water_level_db',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

let pool = null;

async function initDb() {
  // Retry để chờ DB sẵn sàng (Docker race condition / Neon cold start)
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      pool = new Pool({ ...DB_CONFIG, max: 10, idleTimeoutMillis: 30000 });
      await pool.query('SELECT 1');
      break;
    } catch (e) {
      if (pool) await pool.end().catch(() => {});
      pool = null;
      if (i === maxAttempts) throw new Error(`Postgres không lên sau ${maxAttempts} lần thử: ${e.message}`, { cause: e });
      console.log(`⏳  Chờ Postgres... (lần ${i}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Tạo bảng users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50)  UNIQUE NOT NULL,
      email    VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng water_records (lịch sử)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS water_records (
      id SERIAL PRIMARY KEY,
      fingerprint VARCHAR(20) UNIQUE NOT NULL,
      ngay VARCHAR(10) NOT NULL,
      gio  VARCHAR(5)  NOT NULL,
      ts   TIMESTAMPTZ  NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_water_ts   ON water_records (ts)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_water_ngay ON water_records (ngay)`);

  // Bảng photos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      ho_key VARCHAR(30) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      caption TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_photos_ho      ON photos (ho_key)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_photos_created ON photos (created_at)`);

  // Bảng comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_photo ON comments (photo_id)`);

  console.log(`✅  Postgres connected → ${DATABASE_URL ? 'remote' : (DB_CONFIG.database || 'water_level_db')}`);
  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB chưa init');
  return pool;
}

function parseDateTime(ngay, gio) {
  const [d, m, y] = ngay.split('/').map(Number);
  const [h, mn] = (gio || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, mn);
}

// Lưu nhiều record (upsert theo fingerprint)
async function saveRecords(records) {
  if (!records?.length) return 0;
  const valid = records.filter((r) => r.ngay && r.gio);
  if (!valid.length) return 0;

  // Postgres không có VALUES ? như mysql, dùng pg-format hoặc unnest. Dùng unnest đơn giản.
  const fps    = valid.map((r) => `${r.ngay}_${r.gio}`);
  const ngays  = valid.map((r) => r.ngay);
  const gios   = valid.map((r) => r.gio);
  const tses   = valid.map((r) => parseDateTime(r.ngay, r.gio));
  const datas  = valid.map((r) => JSON.stringify(r));

  const result = await pool.query(`
    INSERT INTO water_records (fingerprint, ngay, gio, ts, data)
    SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::jsonb[])
    ON CONFLICT (fingerprint) DO UPDATE SET data = EXCLUDED.data, ts = EXCLUDED.ts
  `, [fps, ngays, gios, tses, datas]);

  return result.rowCount || 0;
}

async function getRecords({ from, to, limit = 1000 } = {}) {
  let sql = 'SELECT data FROM water_records WHERE 1=1';
  const params = [];
  if (from) { params.push(from); sql += ` AND ts >= $${params.length}`; }
  if (to)   { params.push(to);   sql += ` AND ts <= $${params.length}`; }
  params.push(+limit);
  sql += ` ORDER BY ts ASC LIMIT $${params.length}`;

  const { rows } = await pool.query(sql, params);
  return rows.map((r) => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
}

async function getRecordCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM water_records');
  return rows[0].n;
}

module.exports = { initDb, getPool, saveRecords, getRecords, getRecordCount };
