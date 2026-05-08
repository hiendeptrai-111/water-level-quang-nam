import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import MapView from '../components/MapView';
import DetailPanel from '../components/DetailPanel';
import { HO_LIST, isToday, levelStatus, getLatestForHo } from '../constants';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1f2937', color: '#f9fafb', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#9ca3af' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value} m</span>
        </div>
      ))}
    </div>
  );
}

function TodayReport({ data, onSelectHo }) {
  const records = data?.records || [];
  const todayRecords = useMemo(() => records.filter((r) => isToday(r.ngay)), [records]);

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const summaries = HO_LIST.map((ho) => {
    const vals = todayRecords.map((r) => r[ho.key]?.mucNuoc).filter((v) => v != null);
    const lastRec = getLatestForHo(records, ho.key);
    const last = lastRec?.[ho.key];
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    const change = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0;
    const qTranMax = todayRecords.reduce((m, r) => Math.max(m, r[ho.key]?.qQuaTran || 0), 0);
    const status = levelStatus(last?.mucNuoc, ho);
    return { ho, last, min, max, change, qTranMax, status, count: vals.length };
  });

  const chartData = todayRecords.map((r) => ({
    label: r.gio,
    a_vuong:      r.a_vuong?.mucNuoc,
    song_bung_4:  r.song_bung_4?.mucNuoc,
    dak_mi_4:     r.dak_mi_4?.mucNuoc,
    song_tranh_2: r.song_tranh_2?.mucNuoc,
  }));

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 Báo cáo hôm nay</h2>
        <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{todayStr}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          {todayRecords.length} bản ghi
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
        {summaries.map((s) => (
          <div key={s.ho.key} onClick={() => onSelectHo(s.ho)}
            style={{
              background: '#fff', border: `1px solid #e5e7eb`,
              borderLeft: `4px solid ${s.ho.color}`, borderRadius: 10,
              padding: '12px 14px', cursor: 'pointer',
              transition: 'box-shadow .15s, transform .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = ''; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{s.ho.ten}</span>
              <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: s.status.color + '22', color: s.status.color }}>
                {s.status.label}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.status.color, lineHeight: 1.1 }}>
              {s.last?.mucNuoc ?? '—'}<span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>m</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
              <Mini label="Cao" value={s.max} unit="m" color="#dc2626" />
              <Mini label="Thấp" value={s.min} unit="m" color="#3b82f6" />
              <Mini label="Δ"
                value={s.change ? (s.change >= 0 ? '+' : '') + s.change.toFixed(2) : '0'}
                unit="m"
                color={s.change > 0 ? '#dc2626' : s.change < 0 ? '#3b82f6' : '#6b7280'} />
            </div>
            {s.qTranMax > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                ⚠️ Xả tràn tối đa: {s.qTranMax} m³/s
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Diễn biến mực nước theo giờ (hôm nay)</span>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
            {HO_LIST.map((h) => (
              <span key={h.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4b5563' }}>
                <span style={{ width: 10, height: 2, background: h.color }} />{h.ten}
              </span>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={42} unit="m" domain={['auto','auto']} />
              <Tooltip content={<ChartTooltip />} />
              {HO_LIST.map((h) => (
                <Line key={h.key} type="monotone" dataKey={h.key} name={h.ten} stroke={h.color} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
            Chưa có dữ liệu hôm nay
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, unit, color }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 6, padding: '4px 6px', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: color || '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value ?? '—'}<span style={{ fontSize: 9, fontWeight: 400, color: '#9ca3af', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function Home({ data, flash, socket }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '50%', position: 'relative', flexShrink: 0 }}>
        <MapView data={data} selected={selected} onSelect={setSelected} />

        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 400,
          background: 'rgba(255,255,255,.96)', padding: '8px 12px',
          borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,.15)', fontSize: 11,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 10, color: '#374151' }}>CHÚ THÍCH</div>
          <Legend color="#16a34a" label="Bình thường" />
          <Legend color="#3b82f6" label="Mức đón lũ" />
          <Legend color="#f59e0b" label="Gần mức BT" />
          <Legend color="#dc2626" label="Vượt mức BT" />
        </div>

        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 400,
          background: 'rgba(15,45,82,.92)', color: '#fff',
          padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        }}>
          📍 Tỉnh Quảng Nam
        </div>

        {flash && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 600, padding: '6px 14px', borderRadius: 999,
            background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700,
            animation: 'pop .5s ease-out',
          }}>
            ✨ Vừa cập nhật dữ liệu mới
          </div>
        )}

        {!data && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
            <div>Đang tải...</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', borderTop: '2px solid #e5e7eb', background: '#f1f5f9' }}>
        <TodayReport data={data} onSelectHo={setSelected} />
      </div>

      <DetailPanel ho={selected} data={data} onClose={() => setSelected(null)} socket={socket} />
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#4b5563', lineHeight: 1.6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
      {label}
    </div>
  );
}
