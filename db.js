const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     +(process.env.DB_PORT   || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '060704',
};
const DB_NAME = process.env.DB_NAME || 'water_level_db';

let pool = null;

async function initDb() {
  // 1. Kết nối không chỉ định DB để tạo DB nếu chưa có
  const setup = await mysql.createConnection(DB_CONFIG);
  await setup.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await setup.end();

  // 2. Pool kết nối tới DB chính
  pool = mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // 3. Tạo bảng users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50)  UNIQUE NOT NULL,
      email    VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: thêm cột nếu DB cũ
  try { await pool.query(`ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`); } catch {}

  // 4. Tạo bảng water_records (lưu lịch sử mực nước)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS water_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fingerprint VARCHAR(20) UNIQUE NOT NULL,
      ngay VARCHAR(10) NOT NULL,
      gio  VARCHAR(5)  NOT NULL,
      ts   DATETIME    NOT NULL,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ts (ts),
      INDEX idx_ngay (ngay)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 5. Bảng ảnh thành viên upload cho từng hồ
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ho_key VARCHAR(30) NOT NULL,
      user_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      caption TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ho (ho_key),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 6. Bảng bình luận
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      photo_id INT NOT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_photo (photo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log(`✅  MySQL connected → DB "${DB_NAME}"`);
  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB chưa init');
  return pool;
}

// "08/05/2026 14:00" → JS Date
function parseDateTime(ngay, gio) {
  const [d, m, y] = ngay.split('/').map(Number);
  const [h, mn] = (gio || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, mn);
}

// Lưu nhiều record (upsert theo fingerprint)
async function saveRecords(records) {
  if (!records?.length) return 0;
  const rows = records
    .filter((r) => r.ngay && r.gio)
    .map((r) => {
      const ts = parseDateTime(r.ngay, r.gio);
      const fp = `${r.ngay}_${r.gio}`;
      return [fp, r.ngay, r.gio, ts, JSON.stringify(r)];
    });
  if (!rows.length) return 0;

  const [result] = await pool.query(
    `INSERT INTO water_records (fingerprint, ngay, gio, ts, data)
     VALUES ?
     ON DUPLICATE KEY UPDATE data = VALUES(data), ts = VALUES(ts)`,
    [rows]
  );
  return result.affectedRows || 0;
}

// Lấy records theo khoảng thời gian
async function getRecords({ from, to, limit = 1000 } = {}) {
  let sql = 'SELECT data FROM water_records WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND ts >= ?'; params.push(from); }
  if (to)   { sql += ' AND ts <= ?'; params.push(to);   }
  sql += ' ORDER BY ts ASC LIMIT ?';
  params.push(+limit);

  const [rows] = await pool.query(sql, params);
  return rows.map((r) => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
}

async function getRecordCount() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM water_records');
  return rows[0].n;
}

module.exports = { initDb, getPool, saveRecords, getRecords, getRecordCount };
