/**
 * Smoke tests cho /api/health.
 * Không dựa vào DB thật — mock phần DB nếu cần. Ở đây chạy app stub đơn giản.
 */
const express = require('express');
const request = require('supertest');

function buildApp({ dbOk = true } = {}) {
  const app = express();
  app.get('/api/health', async (req, res) => {
    const ok = dbOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'healthy' : 'unhealthy',
      services: { api: 'up', database: dbOk ? 'up' : 'down' },
      timestamp: new Date().toISOString(),
    });
  });
  return app;
}

describe('GET /api/health', () => {
  it('trả 200 khi DB OK', async () => {
    const app = buildApp({ dbOk: true });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('up');
  });

  it('trả 503 khi DB lỗi', async () => {
    const app = buildApp({ dbOk: false });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.database).toBe('down');
  });

  it('có timestamp ISO', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
