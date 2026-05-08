# 💧 Water Level Quảng Nam — DevOps Project

Hệ thống theo dõi mực nước **realtime** 4 hồ thuỷ điện lưu vực Vu Gia – Thu Bồn (A Vương, Sông Bung 4, Đăk Mi 4, Sông Tranh 2). Có bản đồ tương tác, dự đoán mực nước, gallery ảnh thực tế từ thành viên và panel admin.

## Mục lục
- [Kiến trúc](#kiến-trúc)
- [Tính năng](#tính-năng)
- [Cách chạy](#cách-chạy)
- [Biến môi trường](#biến-môi-trường)
- [CI/CD](#cicd)
- [API](#api)
- [Phân vai (DevOps roles)](#phân-vai-devops-roles)
- [Tài liệu khác](#tài-liệu-khác)

---

## Kiến trúc

```
                        ┌──────────────────────┐
                        │ pctt.danang.gov.vn   │  (nguồn dữ liệu thật)
                        └──────────┬───────────┘
                                   │ Puppeteer scrape /10'
                                   ▼
   ┌──────────┐    ws    ┌────────────────────┐
   │ Frontend │◄────────►│  Backend (Express) │──► MySQL 8
   │  React   │  REST    │  + Socket.IO       │     ▲
   │  Vite    │◄────────►│  + Puppeteer       │     │
   │  nginx   │          │  + JWT auth        │     │
   └──────────┘          └────────────────────┘     │
       :80                       :4000              │
                                                  :3306

   Layer (DevOps debugging):
   L4 Frontend  →  L3 Backend  →  L2 Database  →  L1 Infrastructure
```

**Stack:**
- **Frontend**: React 19, Vite 8, react-router-dom, Leaflet (bản đồ), Recharts (biểu đồ), socket.io-client
- **Backend**: Node 20, Express, Socket.IO, Puppeteer, multer, bcryptjs, jsonwebtoken
- **Database**: MySQL 8 (users, water_records, photos, comments)
- **DevOps**: Docker (multi-stage), docker-compose, GitHub Actions, ESLint, Jest

## Tính năng

| Tính năng | Public | User | Admin |
|---|:-:|:-:|:-:|
| Xem mực nước realtime trên bản đồ | ✓ | ✓ | ✓ |
| Báo cáo hôm nay + lịch sử 7 ngày | ✓ | ✓ | ✓ |
| Trang Thống kê | ✓ | ✓ | ✓ |
| Trang Lịch sử (chọn khoảng ngày) | ✓ | ✓ | ✓ |
| Dự đoán 12h tới (linear regression) | – | ✓ | ✓ |
| Upload ảnh thực tế cho hồ | – | ✓ | ✓ |
| Bình luận ảnh realtime | – | ✓ | ✓ |
| Xoá ảnh / bình luận của bất kỳ ai | – | – | ✓ |
| Quản lý user (lên admin / khoá / xoá) | – | – | ✓ |

User đầu tiên đăng ký được tự động làm admin.

## Cách chạy

### Cách 1 — Docker (production-like, KHUYẾN NGHỊ)

```bash
# 1. Clone repo
git clone <repo-url> water-level && cd water-level

# 2. Tạo .env từ template (sửa secrets nếu cần)
cp .env.example .env

# 3. Build + chạy 3 services
docker compose up -d --build

# 4. Kiểm tra
docker compose ps
docker compose logs -f backend          # xem log container
curl http://localhost:4000/api/health   # health check

# Frontend:  http://localhost
# Backend:   http://localhost:4000
# MySQL:     localhost:3306
```

Để tắt: `docker compose down` (giữ data) hoặc `docker compose down -v` (xoá volume).

### Cách 2 — Chạy local (dev)

```bash
# Backend
cp .env.example .env   # sửa DB_HOST=localhost
npm install
npm run dev            # nodemon

# Frontend (terminal khác)
cd frontend
cp .env.example .env
npm install
npm run dev            # vite dev server :5173
```

Cần MySQL chạy sẵn ở localhost:3306.

## Biến môi trường

### Backend (`.env`)
| Var | Default | Mô tả |
|---|---|---|
| `PORT` | 4000 | Port HTTP/WebSocket |
| `CORS_ORIGIN` | * | Origin được phép, tách bằng `,` |
| `DB_HOST` | mysql | MySQL host (dùng `mysql` trong compose) |
| `DB_PORT` | 3306 | MySQL port |
| `DB_USER` | root | MySQL user |
| `DB_PASSWORD` | – | MySQL password |
| `DB_NAME` | water_level_db | DB name (tự tạo nếu chưa có) |
| `JWT_SECRET` | – | Secret cho JWT, đổi ở production |

### Frontend (`frontend/.env`)
| Var | Default | Mô tả |
|---|---|---|
| `VITE_API_URL` | http://localhost:4000 | Backend URL (compile-time, Vite quy ước prefix `VITE_`) |

> ⚠️ **KHÔNG commit file `.env`**. Chỉ commit `.env.example`. `.gitignore` đã loại trừ `.env`.

## CI/CD

GitHub Actions workflow `.github/workflows/ci.yml` tự động chạy khi:
- Push lên bất kỳ branch nào
- Mở/cập nhật pull request vào `main` hoặc `dev`

Pipeline có 3 jobs chạy song song:

```
backend          frontend         docker
  ├ npm ci         ├ npm ci         ├ build backend image
  ├ npm run lint   ├ npm run lint   └ build frontend image
  ├ npm test       └ npm run build
  └ verify modules
```

Pipeline **fail** nếu bất kỳ bước nào lỗi (lint error, test fail, build error). Không bypass.

## API

### Public
- `GET  /api/health` — health check {status, uptime, services, version}
- `GET  /api/water-levels` — toàn bộ dữ liệu realtime
- `GET  /api/water-levels/latest` — bản ghi mới nhất
- `GET  /api/history?from=...&to=...` — lịch sử từ DB
- `GET  /api/history/stats` — tổng số bản ghi
- `GET  /api/photos?hoKey=...` — danh sách ảnh của hồ
- `GET  /api/photos/:id/comments` — comments của ảnh
- `POST /api/auth/register` — đăng ký
- `POST /api/auth/login` — đăng nhập

### Cần đăng nhập (Bearer token)
- `GET  /api/auth/me`
- `GET  /api/prediction/:hoKey?hours=12` — dự đoán linear regression
- `POST /api/photos` (multipart) — upload ảnh
- `POST /api/photos/:id/comments` — bình luận
- `DELETE /api/photos/:id` — xoá ảnh (chủ ảnh hoặc admin)
- `DELETE /api/comments/:id` — xoá comment (chủ hoặc admin)

### Admin only
- `GET    /api/admin/users` — danh sách user
- `PATCH  /api/admin/users/:id` — đổi role / khoá tài khoản
- `DELETE /api/admin/users/:id` — xoá tài khoản (cascade ảnh, comments)

### WebSocket events
- `snapshot`            — server → client khi connect
- `water-level:update`  — server → client khi có data mới
- `photo:new` / `photo:delete`
- `comment:new` / `comment:delete`

## Phân vai (DevOps roles)

| Role | Phụ trách |
|---|---|
| **Backend Engineer** | `server.js`, `auth.js`, `db.js`, `scraper.js`, REST API, WebSocket, JWT |
| **Frontend Engineer** | `frontend/src/`, React routing, components, không hardcode URL — dùng `import.meta.env.VITE_API_URL` |
| **DevOps Engineer** | `.github/workflows/ci.yml`, ESLint config, Jest tests |
| **Infrastructure Engineer** | `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `nginx.conf`, deploy |
| **QA / SRE Engineer** | [INCIDENTS.md](./INCIDENTS.md) — 3 incident thật được phân tích theo layer |

## Tài liệu khác
- [INCIDENTS.md](./INCIDENTS.md) — Báo cáo 3 incident thực tế đã gặp & cách fix
- [.env.example](./.env.example) — Template biến môi trường

## Branching strategy

```
main           ← production, chỉ merge từ dev sau khi CI pass
 │
 └── dev       ← integration, nơi merge các feature
      │
      ├── feature/auth
      ├── feature/photo-gallery
      ├── feature/admin-panel
      └── feature/...
```

Mỗi feature → branch `feature/*` → PR vào `dev` → khi ổn định merge `dev` → `main`.

## License

MIT — Đồ án DevOps môn học.
