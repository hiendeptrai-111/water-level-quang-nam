/**
 * scraper.js
 * Lấy dữ liệu mực nước 4 hồ thủy điện từ trang PCTT Đà Nẵng
 * Hồ: A Vương | Sông Bung 4 (SB4) | Đăk Mi 4 (ĐM4) | Sông Tranh 2 (ST2)
 *
 * Trang web là ASP.NET Web Forms (DotNetNuke) -> dùng Puppeteer
 * để giả lập click nút "Tìm kiếm" rồi lấy bảng dữ liệu.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'https://pctt.danang.gov.vn/so-lieu/thuy-%C4%91ien/a-vuong-sb4-%C4%91m4-st2';
const DATA_FILE = path.join(__dirname, 'data.json');

/**
 * Hàm chính: mở trang, bấm Tìm kiếm, parse bảng kết quả
 */
async function scrapeWaterLevels() {
  console.log(`[${new Date().toISOString()}] Bắt đầu scrape...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 1. Mở trang
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 2. Đợi bảng dữ liệu xuất hiện (trang tự load data khi mở)
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // 4. Parse bảng dữ liệu
    // Tìm bảng có nhiều hàng dữ liệu dạng ngày nhất
    // (header dùng colspan nên không thể đếm cột từ hàng đầu)
    /* eslint-disable no-undef */
    const rows = await page.evaluate(() => {
      const tables = [...document.querySelectorAll('table')];
      let dataTable = null;
      let maxDataRows = 0;
      for (const t of tables) {
        const trs = [...t.querySelectorAll('tr')];
        const count = trs.filter((tr) => {
          const cells = [...tr.querySelectorAll('td')];
          return cells.length >= 8 && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test((cells[0]?.innerText || '').trim());
        }).length;
        if (count > maxDataRows) { maxDataRows = count; dataTable = t; }
      }
      if (!dataTable) return [];

      const trs = [...dataTable.querySelectorAll('tr')];
      const result = [];
      for (const tr of trs) {
        const cells = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim());
        if (cells.length < 8) continue;
        if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cells[0])) continue;
        result.push(cells);
      }
      return result;
    });
    /* eslint-enable no-undef */

    if (rows.length === 0) {
      console.warn('⚠️  Không có dòng dữ liệu nào được parse. Có thể trang web đổi cấu trúc.');
    }

    // 5. Map sang object có nghĩa
    //    Cấu trúc cột (theo header trên trang):
    //    [0] Ngày  [1] Giờ
    //    A Vương:  [2] mực nước (m), [3] Q đến, [4] Q chạy máy, [5] Q qua tràn
    //    Đăk Mi 4: [6] mực nước,     [7] Q đến, [8] Q chạy máy, [9] Q qua tràn
    //    Sông Bung 4: [10] mực nước, [11] Q đến,[12] Q chạy máy,[13] Q qua tràn
    //    [14] Q về Vu Gia
    //    Sông Tranh 2: [15] mực nước,[16] Q đến,[17] Q chạy máy,[18] Q qua tràn
    //    [19] Q về Thu Bồn
    const toNum = (s) => {
      if (!s) return null;
      const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return Number.isNaN(n) ? null : n;
    };

    // Trang web hiển thị mới nhất trước → đảo lại để oldest-first
    rows.reverse();

    const data = rows.map((c) => ({
      ngay: c[0],
      gio: c[1],
      a_vuong:    { mucNuoc: toNum(c[2]),  qDen: toNum(c[3]),  qChayMay: toNum(c[4]),  qQuaTran: toNum(c[5])  },
      dak_mi_4:   { mucNuoc: toNum(c[6]),  qDen: toNum(c[7]),  qChayMay: toNum(c[8]),  qQuaTran: toNum(c[9])  },
      song_bung_4:{ mucNuoc: toNum(c[10]), qDen: toNum(c[11]), qChayMay: toNum(c[12]), qQuaTran: toNum(c[13]) },
      qVeVuGia:   toNum(c[14]),
      song_tranh_2:{mucNuoc: toNum(c[15]), qDen: toNum(c[16]), qChayMay: toNum(c[17]), qQuaTran: toNum(c[18]) },
      qVeThuBon:  toNum(c[19]),
    }));

    // 6. Lưu vào file JSON (kèm timestamp)
    const payload = {
      lastUpdated: new Date().toISOString(),
      source: URL,
      records: data,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`✅  Đã lấy ${data.length} dòng dữ liệu, lưu vào ${DATA_FILE}`);
    return payload;
  } finally {
    await browser.close();
  }
}

// Cho phép chạy trực tiếp: node scraper.js
if (require.main === module) {
  scrapeWaterLevels().catch((err) => {
    console.error('❌  Lỗi scrape:', err.message);
    process.exit(1);
  });
}

module.exports = { scrapeWaterLevels, DATA_FILE };
