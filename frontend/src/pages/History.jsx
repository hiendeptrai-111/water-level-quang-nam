import { useEffect, useMemo, useState } from 'react';
import { API } from '../auth.jsx';
import { HO_LIST, levelStatus } from '../constants';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function History() {
  const [from, setFrom]   = useState(daysAgo(7));
  const [to, setTo]       = useState(todayStr());
  const [records, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterHo, setFilterHo] = useState('all');

  function load() {
    setLoading(true);
    const f = new Date(from + 'T00:00:00').toISOString();
    const t = new Date(to + 'T23:59:59').toISOString();
    fetch(`${API}/api/history?from=${f}&to=${t}&limit=5000`)
      .then((r) => r.json())
      .then((d) => setRecs(d.records || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => [...records].reverse(), [records]);

  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📚 Lịch sử</h1>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{records.length} bản ghi</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Field label="Từ ngày">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inp} />
        </Field>
        <Field label="Đến ngày">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inp} />
        </Field>
        <Field label="Hồ">
          <select value={filterHo} onChange={(e) => setFilterHo(e.target.value)} style={inp}>
            <option value="all">Tất cả hồ</option>
            {HO_LIST.map((h) => <option key={h.key} value={h.key}>{h.ten}</option>)}
          </select>
        </Field>
        <button onClick={load} style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: '#0f2d52', color: '#fff', border: 'none', cursor: 'pointer',
          alignSelf: 'flex-end',
        }}>{loading ? 'Đang tải...' : 'Truy vấn'}</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
              <tr>
                <Th>Ngày</Th>
                <Th>Giờ</Th>
                {filterHo === 'all' ? (
                  HO_LIST.map((h) => <Th key={h.key} color={h.color}>{h.ten}</Th>)
                ) : (
                  <>
                    <Th>Mực nước</Th>
                    <Th>Q đến</Th>
                    <Th>Q chạy máy</Th>
                    <Th>Q qua tràn</Th>
                  </>
                )}
                {filterHo === 'all' && <>
                  <Th>Q→Vu Gia</Th>
                  <Th>Q→Thu Bồn</Th>
                </>}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading && (
                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Không có dữ liệu</td></tr>
              )}
              {sorted.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                  <Td>{r.ngay}</Td>
                  <Td>{r.gio}</Td>
                  {filterHo === 'all' ? (
                    HO_LIST.map((h) => {
                      const m = r[h.key]?.mucNuoc;
                      const c = levelStatus(m, h).color;
                      return <Td key={h.key} style={{ color: c, fontWeight: 600 }}>{m ?? '—'}</Td>;
                    })
                  ) : (() => {
                    const ho = HO_LIST.find((h) => h.key === filterHo);
                    const x = r[filterHo] || {};
                    const c = levelStatus(x.mucNuoc, ho).color;
                    return (
                      <>
                        <Td style={{ color: c, fontWeight: 600 }}>{x.mucNuoc ?? '—'}</Td>
                        <Td>{x.qDen ?? '—'}</Td>
                        <Td>{x.qChayMay ?? '—'}</Td>
                        <Td style={{ color: x.qQuaTran > 0 ? '#dc2626' : 'inherit', fontWeight: x.qQuaTran > 0 ? 600 : 400 }}>{x.qQuaTran ?? '—'}</Td>
                      </>
                    );
                  })()}
                  {filterHo === 'all' && <>
                    <Td>{r.qVeVuGia ?? '—'}</Td>
                    <Td>{r.qVeThuBon ?? '—'}</Td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}
const inp = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, fontFamily: 'inherit', minWidth: 140,
};

function Th({ children, color }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: color || '#374151', fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', ...style }}>{children}</td>;
}
