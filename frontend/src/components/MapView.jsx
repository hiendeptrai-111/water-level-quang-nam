import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip, Polygon, useMap } from 'react-leaflet';
import {
  HO_LIST, QUANG_NAM_CENTER, QUANG_NAM_BOUNDARY, WORLD_RING,
  levelStatus, getLatestForHo,
} from '../constants';

function FlyToHo({ ho }) {
  const map = useMap();
  useEffect(() => {
    if (ho) map.flyTo([ho.lat, ho.lng], 11, { duration: 1.0 });
    else    map.flyTo(QUANG_NAM_CENTER, 9, { duration: 0.8 });
  }, [ho, map]);
  return null;
}

export default function MapView({ data, selected, onSelect, height = '100%' }) {
  const latest = data?.records?.[data.records.length - 1];

  return (
    <MapContainer
      center={QUANG_NAM_CENTER}
      zoom={9}
      minZoom={8}
      maxZoom={13}
      style={{ height, width: '100%', background: '#cbd5e1' }}
      scrollWheelZoom
      maxBounds={[[14.0, 106.5], [16.8, 109.5]]}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap'
      />

      <Polygon
        positions={[WORLD_RING, QUANG_NAM_BOUNDARY]}
        pathOptions={{
          fillColor: '#0f2d52', fillOpacity: 0.55,
          color: '#0f2d52', weight: 0, interactive: false,
        }}
      />
      <Polygon
        positions={QUANG_NAM_BOUNDARY}
        pathOptions={{
          fill: false, color: '#fbbf24', weight: 2.5, dashArray: '6 4', interactive: false,
        }}
      />

      <FlyToHo ho={selected} />

      {HO_LIST.map((ho) => {
        const fallback = getLatestForHo(data?.records || [], ho.key);
        const r = (latest?.[ho.key]?.mucNuoc != null) ? latest[ho.key] : fallback?.[ho.key];
        const status = levelStatus(r?.mucNuoc, ho);
        const isSelected = selected?.key === ho.key;
        return (
          <CircleMarker
            key={ho.key}
            center={[ho.lat, ho.lng]}
            radius={isSelected ? 16 : 12}
            pathOptions={{
              color: '#fff', weight: 3,
              fillColor: status.color, fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect(ho) }}
          >
            <LTooltip direction="top" offset={[0, -8]} opacity={0.98} permanent>
              <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                {ho.ten}<br />
                <span style={{ color: status.color, fontSize: 12 }}>
                  {r?.mucNuoc != null ? `${r.mucNuoc} m` : '—'}
                </span>
              </div>
            </LTooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
