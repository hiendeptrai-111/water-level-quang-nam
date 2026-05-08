/**
 * scrape-once.js — Standalone job:
 * 1. Connect tới Postgres
 * 2. Chạy Puppeteer scrape PCTT Đà Nẵng
 * 3. Upsert records vào DB
 * 4. Exit
 *
 * Chạy bởi GitHub Actions cron mỗi giờ.
 */

require('dotenv').config();
const { initDb, saveRecords, getPool } = require('../db');
const { scrapeWaterLevels } = require('../scraper');

const startTime = Date.now();

(async () => {
  console.log(`🔄  Scrape job bắt đầu lúc ${new Date().toISOString()}`);
  try {
    await initDb();

    const data = await scrapeWaterLevels();
    const total = data.records?.length || 0;
    const saved = await saveRecords(data.records || []);

    const ms = Date.now() - startTime;
    console.log(`✅  Scrape thành công: lấy ${total} dòng, upsert ${saved} record vào DB (${ms}ms)`);

    if (data.records?.length) {
      const latest = data.records[data.records.length - 1];
      console.log(`📊  Bản ghi mới nhất: ${latest.ngay} ${latest.gio}`);
    }

    await getPool().end();
    process.exit(0);
  } catch (e) {
    console.error(`❌  Scrape lỗi: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
})();
