import { useMemo } from 'react';

/**
 * Hình cắt ngang đập thuỷ điện với mực nước thực dâng đến đâu.
 *
 * Layout SVG (W x H = 360 x 280):
 *   - Bầu trời ở trên
 *   - Đập (bê tông trapezoid) ở phía phải
 *   - Hồ chứa nước ở trái + sông phía sau đập (hạ lưu)
 *   - Mực nước được tô màu lên đến tỉ lệ tương ứng
 *   - Đường tham chiếu BT / Đón lũ / Mực chết với label bên trái
 *   - Wave animation trên mặt nước
 */
export default function DamVisualization({ ho, currentLevel, qQuaTran = 0, qChayMay = 0 }) {
  const { mucBT, mucDonLu, mucChet } = ho;

  // Domain hiển thị: từ mực chết - 5m → mực BT + 5m
  const yMin = mucChet - 5;
  const yMax = mucBT + 5;
  const range = yMax - yMin;

  // Layout
  const W = 380, H = 280;
  const padTop = 16, padBottom = 30, padLeft = 78, padRight = 20;
  const damX = padLeft + 200;       // bắt đầu đập
  const groundY = H - padBottom;
  const waterX1 = padLeft;          // phía thượng lưu
  const drawableH = groundY - padTop;

  // Map giá trị mực nước (m) → pixel y
  const yPx = (level) => {
    const t = (level - yMin) / range; // 0 = đáy, 1 = đỉnh khung
    return groundY - t * drawableH;
  };

  // Mực nước hiện tại
  const waterLevelPx = currentLevel != null
    ? Math.max(yPx(yMax), Math.min(groundY, yPx(currentLevel)))
    : yPx(mucChet);

  // Trạng thái màu
  const status = useMemo(() => {
    if (currentLevel == null) return { color: '#94a3b8', label: 'Không có dữ liệu' };
    if (currentLevel >= mucBT)         return { color: '#dc2626', label: 'Vượt mức bình thường' };
    if (currentLevel >= mucBT - 2)     return { color: '#f59e0b', label: 'Gần mức BT' };
    if (currentLevel >= mucDonLu)      return { color: '#16a34a', label: 'Bình thường' };
    if (currentLevel >= mucChet)       return { color: '#3b82f6', label: 'Mức đón lũ' };
    return { color: '#6366f1', label: 'Thấp / mực chết' };
  }, [currentLevel, mucBT, mucDonLu, mucChet]);

  // Phần trăm so với khoảng [mực chết, mức BT]
  const pct = currentLevel != null
    ? Math.max(0, Math.min(100, ((currentLevel - mucChet) / (mucBT - mucChet)) * 100))
    : 0;

  // Wave path (sóng nhấp nhô trên mặt nước)
  const waveAmplitude = 3;
  const waveLen = 30;
  const waves = (yPos, phase = 0) => {
    let path = `M ${waterX1} ${yPos}`;
    for (let x = waterX1; x <= damX; x += waveLen) {
      path += ` Q ${x + waveLen / 2} ${yPos - waveAmplitude + phase} ${x + waveLen} ${yPos}`;
    }
    return path;
  };

  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          🏞️ Mặt cắt hồ – đập thủy điện
        </div>
        <div style={{ fontSize: 11, color: status.color, fontWeight: 700 }}>
          Đầy {pct.toFixed(0)}%
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: 'linear-gradient(#dbeafe, #f0f9ff)', borderRadius: 8 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gradient nước */}
          <linearGradient id={`water-${ho.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={status.color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={status.color} stopOpacity="0.55" />
          </linearGradient>

          {/* Gradient đập bê tông */}
          <linearGradient id="concrete" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          {/* Pattern bê tông */}
          <pattern id="concrete-tex" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="url(#concrete)" />
            <line x1="0" y1="5" x2="10" y2="5" stroke="#475569" strokeOpacity="0.3" strokeWidth="0.5" />
            <line x1="5" y1="0" x2="5" y2="10" stroke="#475569" strokeOpacity="0.3" strokeWidth="0.5" />
          </pattern>

          {/* Mặt đất / đáy hồ */}
          <pattern id="ground" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#a16207" />
            <circle cx="2" cy="2" r="0.5" fill="#78350f" />
            <circle cx="6" cy="5" r="0.5" fill="#78350f" />
          </pattern>

          {/* Animation sóng */}
          <clipPath id={`water-clip-${ho.key}`}>
            <rect x={waterX1} y={waterLevelPx} width={damX - waterX1} height={groundY - waterLevelPx} />
          </clipPath>
        </defs>

        {/* Nền trời với mặt trời */}
        <circle cx={W - 50} cy="35" r="14" fill="#fde68a" opacity="0.8" />

        {/* Đáy hồ + đất */}
        <rect x="0" y={groundY} width={W} height={padBottom} fill="url(#ground)" />

        {/* Bờ trái hồ (đường viền nhẹ, không che label) */}
        <polygon
          points={`0,${groundY} 0,${groundY - 12} ${padLeft},${groundY - 6} ${padLeft},${groundY}`}
          fill="#65a30d" opacity="0.55"
        />

        {/* Đường tham chiếu (vẽ trước nước để hiện đè lên) */}
        {[
          { y: yPx(mucBT),    color: '#dc2626', label: `BT ${mucBT}m`,        dash: '4 3' },
          { y: yPx(mucDonLu), color: '#3b82f6', label: `Đón lũ ${mucDonLu}m`, dash: '4 3' },
          { y: yPx(mucChet),  color: '#6b7280', label: `Mực chết ${mucChet}m`, dash: '2 4' },
        ].map(({ y, color, label, dash }, i) => (
          <g key={i}>
            <line x1={waterX1 - 5} y1={y} x2={damX} y2={y}
              stroke={color} strokeDasharray={dash} strokeWidth="1.2" opacity="0.85" />
            <text x={waterX1 - 8} y={y + 3} fontSize="9" fill={color} fontWeight="600" textAnchor="end">
              {label}
            </text>
          </g>
        ))}

        {/* Khối nước (rectangle với đỉnh là wave) */}
        {currentLevel != null && (
          <g>
            <path
              d={`${waves(waterLevelPx)} L ${damX} ${groundY} L ${waterX1} ${groundY} Z`}
              fill={`url(#water-${ho.key})`}
            >
              <animate
                attributeName="d"
                dur="3s"
                repeatCount="indefinite"
                values={`
                  ${waves(waterLevelPx, 0)} L ${damX} ${groundY} L ${waterX1} ${groundY} Z;
                  ${waves(waterLevelPx, 4)} L ${damX} ${groundY} L ${waterX1} ${groundY} Z;
                  ${waves(waterLevelPx, 0)} L ${damX} ${groundY} L ${waterX1} ${groundY} Z
                `}
              />
            </path>

            {/* Đường mực nước hiện tại */}
            <line x1={waterX1} y1={waterLevelPx} x2={damX} y2={waterLevelPx}
              stroke="#fff" strokeWidth="0.5" opacity="0.9" />

            {/* Label mực nước hiện tại */}
            <g transform={`translate(${(waterX1 + damX) / 2}, ${waterLevelPx - 8})`}>
              <rect x="-30" y="-12" width="60" height="14" rx="3" fill={status.color} />
              <text x="0" y="-2" fontSize="10" fill="#fff" fontWeight="700" textAnchor="middle">
                {currentLevel} m
              </text>
            </g>
          </g>
        )}

        {/* Đập bê tông (trapezoid) */}
        <polygon
          points={`${damX},${padTop + 5} ${damX + 30},${padTop + 5} ${damX + 60},${groundY} ${damX},${groundY}`}
          fill="url(#concrete-tex)"
          stroke="#475569" strokeWidth="1"
        />

        {/* Đỉnh đập có lan can */}
        <rect x={damX} y={padTop} width="35" height="6" fill="#475569" />

        {/* Xả tràn: vẽ nước rơi từ mức BT (đỉnh tràn) xuống hạ du khi qQuaTran > 0 */}
        {qQuaTran > 0 && (
          <g>
            {/* Cửa van xả - nhỏ trên thân đập tại mức BT */}
            <rect x={damX - 1} y={yPx(mucBT) - 4} width="3" height="10" fill="#1e3a8a" opacity="0.8" />
            {/* Dòng nước xả: từ chân đập (góc dưới) chảy xuống hạ du, độ dày tỉ lệ qQuaTran */}
            <path
              d={`M ${damX + 60} ${groundY - 6} Q ${damX + 70} ${groundY - 8} ${damX + 90} ${groundY - 6}`}
              stroke="#3b82f6"
              strokeWidth={Math.min(8, 2 + qQuaTran / 10)}
              fill="none" strokeLinecap="round" opacity="0.85"
            >
              <animate attributeName="opacity" dur="1.2s" repeatCount="indefinite"
                values="0.6;1;0.6" />
            </path>
            {/* Bọt nước */}
            {[0, 1, 2].map((i) => (
              <circle key={i}
                cx={damX + 65 + i * 8}
                cy={groundY - 8}
                r="1.5"
                fill="#bfdbfe"
              >
                <animate attributeName="cy" dur="1s"
                  values={`${groundY - 8};${groundY - 12};${groundY - 8}`}
                  begin={`${i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" dur="1s"
                  values="0.3;1;0.3" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            ))}
            {/* Label */}
            <text x={damX + 75} y={groundY - 16} fontSize="9" fill="#1e40af" fontWeight="700" textAnchor="middle">
              {qQuaTran} m³/s
            </text>
          </g>
        )}

        {/* Tua-bin chạy máy: nước chảy qua thân đập xuống hạ du khi qChayMay > 0 */}
        {qChayMay > 0 && (
          <g opacity="0.8">
            <path
              d={`M ${damX + 5} ${groundY - 10} L ${damX + 55} ${groundY - 6}`}
              stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="3 2" strokeLinecap="round"
            >
              <animate attributeName="stroke-dashoffset" dur="0.8s"
                values="0;-5" repeatCount="indefinite" />
            </path>
          </g>
        )}

        {/* Sông hạ lưu phía sau đập */}
        <rect x={damX + 60} y={groundY - 6} width={W - (damX + 60)} height="6" fill="#60a5fa" opacity="0.6" />

        {/* Trục Y bên trái: chỉ vẽ giá trị min và max */}
        <text x={waterX1 - 8} y={padTop + 5} fontSize="9" fill="#64748b" textAnchor="end">{yMax} m</text>
        <text x={waterX1 - 8} y={groundY} fontSize="9" fill="#64748b" textAnchor="end">{yMin} m</text>

        {/* Label hồ chứa */}
        <text x={(waterX1 + damX) / 2} y={groundY + 18} fontSize="10" fill="#475569" textAnchor="middle" fontWeight="600">
          ← Hồ chứa
        </text>
        <text x={damX + (W - damX) / 2 + 30} y={groundY + 18} fontSize="10" fill="#475569" textAnchor="middle" fontWeight="600">
          Hạ du →
        </text>
      </svg>

      {/* Chú thích nhanh */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: '#6b7280', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#dc2626' }}>━ ━ Mực BT</span>
        <span style={{ color: '#3b82f6' }}>━ ━ Đón lũ</span>
        <span style={{ color: '#6b7280' }}>┄ ┄ Mực chết</span>
        {qQuaTran > 0 && (
          <span style={{ color: '#1e40af', fontWeight: 700 }}>💦 Xả tràn {qQuaTran} m³/s</span>
        )}
        {qChayMay > 0 && (
          <span style={{ color: '#0ea5e9', fontWeight: 700 }}>⚡ Chạy máy {qChayMay} m³/s</span>
        )}
      </div>
    </div>
  );
}
