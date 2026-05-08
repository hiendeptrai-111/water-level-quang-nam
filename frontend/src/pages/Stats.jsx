import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { API } from '../auth.jsx';
import { HO_LIST, parseDateTime, levelStatus } from '../constants';

const RANGES = [
  { key: '24h', label: '24 giờ', hours: 24 },
  { key: '7d',  label: '7 ngày', hours: 24 * 7 },
  { key: '30d', label: '30 ngày', hours: 24 * 30 },
];

export default function Stats() {
  const [range, setRange] = useState('7d');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalDb, setTotalDb] = useState(0);

  useEffect(() => {
    setLoading(true);
    const r = RANGES.find((x) => x.key === range);
    const from = new Date(Date.now() - r.hours * 3600000).toISOString();
    fetch(`${API}/api/history?from=${from}&limit=2000`)
      .then((r) => r.json())
      .then((d) => setRecords(d.records || []))
      .finally(() => setLoading(false));

    fetch(`${API}/api/history/stats`)
      .then((r) => r.json())
      .then((d) => setTotalDb(d.total || 0));
  }, [range]);

  const stats = useMemo(() => HO_LIST.map((ho) => {
    const vals = records.map((r) => r[ho.key]?.mucNuoc).filter((v) => v != null);
    if (!vals.length) return { ho, count: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const change = vals[vals.length - 1] - vals[0];
    const qTranTotal = records.reduce((s, r) => s + (r[ho.key]?.qQuaTran || 0), 0);
    const qDenAvg = records.map((r) => r[ho.key]?.qDen).filter((v) => v != null).reduce((a,b,_,arr) => a + b/arr.length, 0);
    const status = levelStatus(vals[vals.length - 1], ho);
    return { ho, count: vals.length, min, max, avg, change, qTranTotal, qDenAvg, status };
  }), [records]);

  const chartData = useMemo(() => records.map((r) => ({
    label: `${r.ngay.slice(0, 5)} ${r.gio}`,
    a_vuong:      r.a_vuong?.mucNuoc,
    song_bung_4:  r.song_bung_4?.mucNuoc,
    dak_mi_4:     r.dak_mi_4?.mucNuoc,
    song_tranh_2: r.song_tranh_2?.mucNuoc,
  })), [records]);

  const qDayData = useMemo(() => {
    // Tổng Q qua tràn theo ngày
    const byDay = {};
    records.forEach((r) => {
      if (!byDay[r.ngay]) byDay[r.ngay] = { ngay: r.ngay };
      HO_LIST.forEach((h) => {
        byDay[r.ngay][h.key] = (byDay[r.ngay][h.key] || 0) + (r[h.key]?.qQuaTran || 0);
      });
    });
    return Object.values(byDay).slice(-14);
  }, [records]);

  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📈 Thống kê</h1>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Tổng cộng {totalDb.toLocaleString('vi-VN')} bản ghi trong DB
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${range === r.key ? '#0f2d52' : '#e5e7eb'}`,
              background: range === r.key ? '#0f2d52' : '#fff',
              color: range === r.key ? '#fff' : '#374151',
              cursor: 'pointer',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Đang tải...</div>}

      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 18 }}>
            {stats.map((s) => (
              <div key={s.ho.key} style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${s.ho.color}`, borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{s.ho.ten}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{s.count} điểm</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                  <Cell label="Cao" v={s.max?.toFixed(2)} u="m" c="#dc2626" />
                  <Cell label="Thấp" v={s.min?.toFixed(2)} u="m" c="#3b82f6" />
                  <Cell label="TB" v={s.avg?.toFixed(2)} u="m" />
                  <Cell label="Δ" v={s.change != null ? (s.change >= 0 ? '+' : '') + s.change.toFixed(2) : '—'} u="m"
                    c={s.change > 0 ? '#dc2626' : s.change < 0 ? '#3b82f6' : '#16a34a'} />
                  <Cell label="Q đến TB" v={s.qDenAvg?.toFixed(1)} u="m³/s" />
                  <Cell label="Tổng xả tràn" v={s.qTranTotal?.toFixed(0)} u="m³"
                    c={s.qTranTotal > 0 ? '#dc2626' : undefined} />
                </div>
              </div>
            ))}
          </div>

          <Section title={`Diễn biến mực nước - ${RANGES.find((x) => x.key === range).label}`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  interval={Math.floor(chartData.length / 14)} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={50} unit="m" domain={['auto', 'auto']} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {HO_LIST.map((h) => (
                  <Line key={h.key} type="monotone" dataKey={h.key} name={h.ten} stroke={h.color} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Tổng lượng xả tràn theo ngày (m³/s · giờ)">
            {qDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={qDayData} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ngay" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {HO_LIST.map((h) => (
                    <Bar key={h.key} dataKey={h.key} name={h.ten} fill={h.color} stackId="qtran" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>Không có dữ liệu xả tràn</div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function Cell({ label, v, u, c }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 6, padding: '5px 8px' }}>
      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c || '#111827' }}>
        {v ?? '—'}<span style={{ fontSize: 9, fontWeight: 400, color: '#9ca3af', marginLeft: 2 }}>{u}</span>
      </div>
    </div>
  );
}
