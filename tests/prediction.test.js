/**
 * Test thuật toán hồi quy tuyến tính dùng cho dự đoán mực nước.
 */

function linearRegression(points) {
  const n = points.length;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sumX  = xs.reduce((a, b) => a + b, 0);
  const sumY  = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

describe('Linear regression cho dự đoán mực nước', () => {
  it('phát hiện đúng xu hướng tăng', () => {
    const points = [
      { x: 0, y: 100 }, { x: 1, y: 101 }, { x: 2, y: 102 }, { x: 3, y: 103 },
    ];
    const { slope } = linearRegression(points);
    expect(slope).toBeCloseTo(1, 5);
  });

  it('phát hiện đúng xu hướng giảm', () => {
    const points = [
      { x: 0, y: 100 }, { x: 1, y: 99.5 }, { x: 2, y: 99 }, { x: 3, y: 98.5 },
    ];
    const { slope } = linearRegression(points);
    expect(slope).toBeCloseTo(-0.5, 5);
  });

  it('intercept đúng cho dữ liệu hằng số', () => {
    const points = [
      { x: 0, y: 50 }, { x: 1, y: 50 }, { x: 2, y: 50 },
    ];
    const { slope, intercept } = linearRegression(points);
    expect(slope).toBeCloseTo(0, 5);
    expect(intercept).toBeCloseTo(50, 5);
  });
});
