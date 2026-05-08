import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import { isToday, levelStatus, getLatestForHo } from '../constants';
import { useAuth } from '../auth.jsx';
import PhotoGallery from './PhotoGallery';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1f2937', color: '#f9fafb', borderRadius: 10,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,.3)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.filter((p) => p.value != null && !p.dataKey?.includes('band')).map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#9ca3af' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value} m</span>
        </div>
      ))}
    </div>
  );
}

export default function DetailPanel({ ho, data, onClose, socket }) {
  const { user, authFetch } = useAuth();
  const [prediction, setPrediction] = useState({ forecast: [], slope: null });
  const [loadingPred, setLoadingPred] = useState(false);

  const records = data?.records || [];
  const lastWithData = ho ? getLatestForHo(records, ho.key) : null;
  const r = lastWithData?.[ho?.key];
  const status = ho ? levelStatus(r?.mucNuoc, ho) : null;

  const todayCount = records.filter((rec) => isToday(rec.ngay)).length;
  const weekRecs = records.slice(-Math.min(records.length, 24 * 7));

  const stats = useMemo(() => {
    if (!ho) return null;
    const vals = weekRecs.map((rec) => rec[ho.key]?.mucNuoc).filter((v) => v != null);
    if (!vals.length) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      change: vals[vals.length - 1] - vals[0],
      count: vals.length,
    };
  }, [weekRecs, ho]);

  useEffect(() => {
    if (!ho || !user) { setPrediction({ forecast: [], slope: null }); return; }
    setLoadingPred(true);
    authFetch(`/api/prediction/${ho.key}?hours=12`)
      .then((r) => r.json())
      .then((d) => setPrediction(d))
      .catch(() => setPrediction({ forecast: [], slope: null }))
      .finally(() => setLoadingPred(false));
  }, [ho, user]);

  const chartData = useMemo(() => {
    if (!ho) return [];
    const real = weekRecs
      .map((rec) => ({
        label: `${rec.ngay.slice(0, 5)} ${rec.gio}`,
        v: rec[ho.key]?.mucNuoc,
      }))
      .filter((p) => p.v != null);
    const pred = (prediction.forecast || []).map((p) => {
      const t = new Date(p.t);
      return {
        label: `${t.toLocaleDateString('vi-VN').slice(0, 5)} ${t.toTimeString().slice(0, 5)}`,
        forecast: p.v,
        band: [p.lo, p.hi],
      };
    });
    const bridge = real.length ? [{ ...real[real.length - 1], forecast: real[real.length - 1].v }] : [];
    return [...real, ...bridge, ...pred];
  }, [weekRecs, prediction, ho]);

  if (!ho) return null;

  const trend = prediction.slope ?? 0;
  const trendLabel = trend > 0.02 ? '📈 Đang tăng' : trend < -0.02 ? '📉 Đang giảm' : '➡️ Ổn định';
  const trendColor = trend > 0.02 ? '#dc2626' : trend < -0.02 ? '#3b82f6' : '#16a34a';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 999, animation: 'fadeIn .2s' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(540px, 95vw)', background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,.18)',
        zIndex: 1000, overflowY: 'auto', animation: 'slideIn .3s ease-out',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 4, alignSelf: 'stretch', background: ho.color, borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Hồ {ho.ten}</h2>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Huyện {ho.huyen}, Quảng Nam · {ho.lat.toFixed(3)}°N, {ho.lng.toFixed(3)}°E
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: status.color, lineHeight: 1 }}>
                {r?.mucNuoc ?? '—'}
              </span>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>m</span>
              <span style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, background: status.color + '22', color: status.color, fontSize: 11, fontWeight: 700 }}>
                {status.label}
              </span>
            </div>
            {lastWithData && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Thời điểm: {lastWithData.ngay} {lastWithData.gio}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <Section title="Lưu lượng hiện tại">
            <Grid cols={3}>
              <Stat label="Q đến" value={r?.qDen} unit="m³/s" />
              <Stat label="Q chạy máy" value={r?.qChayMay} unit="m³/s" />
              <Stat label="Q qua tràn" value={r?.qQuaTran} unit="m³/s" warn={(r?.qQuaTran ?? 0) > 0} />
            </Grid>
          </Section>

          <Section title="Mức tham chiếu của hồ">
            <Grid cols={3}>
              <Stat label="Mức bình thường" value={ho.mucBT} unit="m" color="#dc2626" />
              <Stat label="Đón lũ" value={ho.mucDonLu} unit="m" color="#3b82f6" />
              <Stat label="Mực chết" value={ho.mucChet} unit="m" color="#6b7280" />
            </Grid>
          </Section>

          {stats && (
            <Section title="Thống kê 7 ngày qua">
              <Grid cols={4}>
                <Stat label="Cao nhất" value={stats.max} unit="m" color="#dc2626" />
                <Stat label="Thấp nhất" value={stats.min} unit="m" color="#3b82f6" />
                <Stat label="Trung bình" value={stats.avg.toFixed(2)} unit="m" />
                <Stat label="Biến động" value={(stats.change >= 0 ? '+' : '') + stats.change.toFixed(2)} unit="m"
                  color={stats.change > 0 ? '#dc2626' : stats.change < 0 ? '#3b82f6' : '#16a34a'} />
              </Grid>
              <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                {stats.count} bản ghi · Hôm nay: {todayCount} bản ghi
              </div>
            </Section>
          )}

          <Section title="Biểu đồ mực nước & Dự đoán 12 giờ tới">
            {!user ? (
              <LockedFeature />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: trendColor, fontWeight: 700 }}>
                    {loadingPred ? 'Đang tính...' : trendLabel}
                  </span>
                  {prediction.slope != null && (
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      Tốc độ: {(prediction.slope * 60).toFixed(2)} cm/giờ
                    </span>
                  )}
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`bandG-${ho.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={ho.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={ho.color} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(v) => v.split(' ')[1] || v}
                        interval={Math.floor(chartData.length / 10)} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={50} unit="m" domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={ho.mucBT} stroke="#dc2626" strokeDasharray="4 3" label={{ value: 'BT', fill: '#dc2626', fontSize: 10, position: 'right' }} />
                      <ReferenceLine y={ho.mucDonLu} stroke="#3b82f6" strokeDasharray="4 3" label={{ value: 'Đón lũ', fill: '#3b82f6', fontSize: 10, position: 'right' }} />
                      <Area dataKey="band" stroke="none" fill={`url(#bandG-${ho.key})`} connectNulls={false} />
                      <Line type="monotone" dataKey="v" stroke={ho.color} strokeWidth={2.5} dot={false} name="Thực tế" connectNulls />
                      <Line type="monotone" dataKey="forecast" stroke={ho.color} strokeWidth={2.5} strokeDasharray="6 4" dot={false} name="Dự đoán" connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>
                    Chưa đủ dữ liệu để vẽ biểu đồ
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
                  <b>Phương pháp:</b> Hồi quy tuyến tính trên 24h gần nhất · Vùng mờ = ±RMSE
                </div>
              </>
            )}
          </Section>

          <Section title="">
            <PhotoGallery ho={ho} socket={socket} />
          </Section>
        </div>
      </div>
    </>
  );
}

function LockedFeature() {
  return (
    <div style={{
      border: '2px dashed #cbd5e1', borderRadius: 12, padding: '24px 20px',
      textAlign: 'center', background: '#f8fafc',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
        Tính năng dự đoán dành cho thành viên
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
        Đăng nhập để xem biểu đồ lịch sử và dự đoán mực nước 12 giờ tới
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Link to="/login" style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#0f2d52', color: '#fff', textDecoration: 'none',
        }}>Đăng nhập</Link>
        <Link to="/register" style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#fbbf24', color: '#1f2937', textDecoration: 'none',
        }}>Đăng ký miễn phí</Link>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
function Grid({ cols = 3, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>{children}</div>;
}
function Stat({ label, value, unit, color, warn }) {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
      border: warn ? '1.5px solid #fca5a5' : '1px solid #e5e7eb',
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || (warn ? '#dc2626' : '#111827'), marginTop: 2 }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca3af', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}
