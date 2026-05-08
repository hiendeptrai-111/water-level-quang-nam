// Toạ độ & thông tin 4 hồ thuỷ điện trên Quảng Nam
export const HO_LIST = [
  { key: 'a_vuong',      ten: 'A Vương',      huyen: 'Đông Giang',  lat: 15.8810, lng: 107.6870, mucBT: 380,   mucDonLu: 370,   mucChet: 340,   color: '#3b82f6' },
  { key: 'song_bung_4',  ten: 'Sông Bung 4',  huyen: 'Nam Giang',   lat: 15.7615, lng: 107.6533, mucBT: 222.5, mucDonLu: 216,   mucChet: 195,   color: '#10b981' },
  { key: 'dak_mi_4',     ten: 'Đăk Mi 4',     huyen: 'Phước Sơn',   lat: 15.4467, lng: 107.7667, mucBT: 258,   mucDonLu: 251.5, mucChet: 240,   color: '#f59e0b' },
  { key: 'song_tranh_2', ten: 'Sông Tranh 2', huyen: 'Bắc Trà My',  lat: 15.3167, lng: 108.1167, mucBT: 175,   mucDonLu: 165,   mucChet: 140,   color: '#ef4444' },
];

export const QUANG_NAM_CENTER = [15.55, 107.85];

export const QUANG_NAM_BOUNDARY = [
  [16.20, 107.40], [16.18, 107.70], [16.10, 107.95], [16.08, 108.15],
  [16.00, 108.30], [15.92, 108.42], [15.88, 108.55], [15.70, 108.62],
  [15.45, 108.78], [15.30, 108.80], [15.10, 108.72], [14.95, 108.55],
  [14.80, 108.35], [14.78, 108.10], [14.85, 107.85], [15.00, 107.55],
  [15.20, 107.35], [15.40, 107.25], [15.60, 107.18], [15.80, 107.18],
  [15.95, 107.22], [16.05, 107.28], [16.15, 107.34], [16.20, 107.40],
];
export const WORLD_RING = [[-89, -179], [-89, 179], [89, 179], [89, -179]];

export function parseDateTime(ngay, gio) {
  const [d, m, y] = ngay.split('/').map(Number);
  const [h, mn]   = (gio || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, mn);
}

export function isToday(ngay) {
  const t = new Date();
  const dStr = `${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()}`;
  return ngay === dStr;
}

export function levelStatus(m, ho) {
  if (m == null) return { color: '#6b7280', label: 'Không có dữ liệu' };
  if (m >= ho.mucBT)         return { color: '#dc2626', label: 'Vượt mức bình thường' };
  if (m >= ho.mucBT - 2)     return { color: '#f59e0b', label: 'Gần mức BT' };
  if (m >= ho.mucDonLu)      return { color: '#16a34a', label: 'Bình thường' };
  if (m >= ho.mucChet)       return { color: '#3b82f6', label: 'Mức đón lũ' };
  return { color: '#6366f1', label: 'Thấp / mực chết' };
}

export function getLatestForHo(records, key) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i][key]?.mucNuoc != null) return records[i];
  }
  return null;
}
