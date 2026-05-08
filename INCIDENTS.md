# 🚨 Incident Report

Ba incident thực tế đã xảy ra trong quá trình phát triển project, được phân tích theo **layer thinking**:

```
L4 Frontend  →  L3 Backend  →  L2 External (DB, Storage)  →  L1 Infrastructure
```

---

## INCIDENT #1 — `node-cron` crash khi start backend

### Hiện tượng
Khi chạy `npm start`, server thoát ngay lập tức với stack trace:

```
ReferenceError: require is not defined in ES module scope, you can use import instead
    at /node_modules/yargs/yargs:3:69
```

Backend không lên được, frontend hiển thị loading vô tận.

### Layer lỗi
**L1 — Infrastructure / Runtime** (Node.js v25 + dependency cũ).

### Nguyên nhân
- `node-cron@3.0.3` phụ thuộc `yargs` cũ.
- Node.js v25 thay đổi cơ chế ESM/CJS interop khiến `yargs` cũ không load được dưới `require()`.
- Đây là lỗi **runtime version mismatch** điển hình: code chạy ổn ở Node ≤ v22 nhưng break ở v25.

### Cách fix
Loại bỏ `node-cron` (chỉ dùng cho 1 cron string) và thay bằng `setInterval` native:

```js
// Trước
const cron = require('node-cron');
cron.schedule('*/10 * * * *', runScrape);

// Sau
setInterval(runScrape, 10 * 60 * 1000);
```

Đã `npm uninstall node-cron`.

### Cách phòng tránh
- Pin Node version trong CI và Docker (image `node:20-slim`) để dev/CI/production cùng version.
- Tránh dependency có quá nhiều transitive dep cho task đơn giản (xài native API trước).
- Thêm `engines.node` vào `package.json` để báo lỗi sớm.

---

## INCIDENT #2 — Scraper trả 0 dòng dữ liệu sau khi trang web đổi cấu trúc HTML

### Hiện tượng
Backend khởi động OK, nhưng `data.json` chỉ có:
```json
{ "lastUpdated": "2026-05-08T...", "records": [] }
```

UI hiển thị "—" cho tất cả 4 hồ. WebSocket không emit update.

### Layer lỗi
**L2 — External data source** (trang nguồn `pctt.danang.gov.vn`).

### Nguyên nhân
Phân tích DOM bằng debug script:
- Trang web đổi cấu trúc, header dùng **rowspan/colspan** → hàng đầu của `<table>` chỉ có **8 cells** (vì colspan gộp).
- Scraper cũ tìm bảng theo điều kiện `firstRow.cols >= 15` → không match bảng nào → trả `[]`.
- Cột dữ liệu thật vẫn là 20 (sau khi mở rộng colspan), nhưng **hàng đầu** đếm sai.

### Cách fix
Đổi heuristic: tìm bảng có **nhiều dòng dữ liệu nhất khớp regex ngày `dd/MM/yyyy`** thay vì đếm cột header:

```js
let dataTable = null, maxDataRows = 0;
for (const t of tables) {
  const trs = [...t.querySelectorAll('tr')];
  const count = trs.filter((tr) => {
    const cells = [...tr.querySelectorAll('td')];
    return cells.length >= 8 &&
           /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cells[0]?.innerText);
  }).length;
  if (count > maxDataRows) { maxDataRows = count; dataTable = t; }
}
```

Cũng đảo thứ tự records (`rows.reverse()`) vì trang giờ sort newest-first.

### Cách phòng tránh
- Scraper **không nên dựa vào layout HTML cố định**. Dùng heuristic linh hoạt (regex content, semantic).
- Thêm **alert/log** khi scraper trả 0 record liên tục N lần → cảnh báo trang đổi cấu trúc.
- Cache record cũ trong DB để API vẫn trả dữ liệu khi scraper tạm thời fail (đã có).
- Lý tưởng: nguồn cung cấp API chính thức thay vì scrape.

---

## INCIDENT #3 — Auth state biến mất khi đổi route, JWT cũ không có `role`

### Hiện tượng
1. User login thành công → được navigate về `/`.
2. Click sang `/lich-su` → navbar hiển thị lại "Đăng nhập / Đăng ký" như chưa login.
3. `localStorage.getItem('user')` trả `null`.

Sau khi thêm tính năng admin role:
4. JWT cũ (issue trước khi role tồn tại) verify OK nhưng `req.user.role` là `undefined` → admin endpoint trả 403 mặc dù user đã được set `role='admin'` trong DB.

### Layer lỗi
- Hiện tượng 1-3: **L4 — Frontend** (state management).
- Hiện tượng 4: **L3 — Backend** (JWT payload schema thay đổi nhưng client giữ token cũ).

### Nguyên nhân
1. Trên một số đường navigation (đặc biệt full reload do `location.href`), React Router không giữ context, khi `AuthProvider` re-mount với `useState` lazy initializer đọc từ `localStorage` — nhưng `useEffect` chạy ngay sau set lại `null` vào localStorage do logic xoá khi `user/token` là falsy chạy SAU lần render đầu.
2. JWT là **stateless**: payload đóng băng tại lúc issue. Khi schema/quyền thay đổi (thêm `role`), token cũ vẫn verify OK nhưng thiếu field mới → bug "tôi đã được lên admin rồi sao vẫn bị 403?"

### Cách fix
Frontend: kiểm tra `useEffect` chỉ ghi localStorage khi giá trị **thực sự thay đổi**, và kiểm tra version của user state.

Backend / phía vận hành: mọi thay đổi schema JWT phải kèm bước **bắt user re-login** (token cũ mất hiệu lực). Trong incident thật đã xử lý bằng cách logout + login lại.

```js
// Frontend - simplified guard
useEffect(() => {
  if (token === null && localStorage.getItem('token')) return; // hydration race
  if (token) localStorage.setItem('token', token);
  else        localStorage.removeItem('token');
}, [token]);
```

### Cách phòng tránh
- Khi đổi schema JWT (thêm field, đổi nghĩa), phải **rotate JWT_SECRET** hoặc thêm `iat` check để invalidate token cũ.
- Có endpoint `/api/auth/me` để frontend re-fetch profile thay vì chỉ trust JWT payload.
- Test E2E flow: login → navigate qua nhiều route → verify state persist.
- Dùng React DevTools để inspect Provider state khi nghi ngờ.

---

## Tổng kết

| # | Hiện tượng | Layer | Nguyên nhân gốc | Cách fix |
|---|---|---|---|---|
| 1 | Backend không start | L1 | Node v25 + node-cron cũ | Bỏ node-cron, dùng setInterval |
| 2 | Scraper trả 0 record | L2 | Trang web đổi HTML (colspan) | Đổi heuristic dò bảng |
| 3 | Auth state mất + JWT thiếu role | L4 + L3 | State race + JWT payload đóng băng | Hydration guard + force re-login |

**Bài học chung**: luôn debug **theo layer**, không đoán mò. Bắt đầu từ hiện tượng (network tab, console log, container log), khoanh vùng layer, rồi mới đào sâu vào nguyên nhân.
