import React, { useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { MarketData } from '../data/mockData';
import { OsintAlert } from './OsintPanel';

const geoUrl = "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

interface FlatMapViewProps {
  data: MarketData[];
  onMarkerClick: (market: MarketData) => void;
  osintAlerts?: OsintAlert[];
}

function fingerprint(d: MarketData): string {
  return d.markets.map(m => m.question).sort().join('|');
}

export default function FlatMapView({ data, onMarkerClick, osintAlerts = [] }: FlatMapViewProps) {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevFingerprints = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect new/changed locations
  useEffect(() => {
    if (data.length === 0) return;

    const prev = prevFingerprints.current;
    const changed = new Set<string>();

    for (const loc of data) {
      const fp = fingerprint(loc);
      const oldFp = prev.get(loc.id);
      if (oldFp === undefined || oldFp !== fp) {
        changed.add(loc.id);
      }
    }

    const next = new Map<string, string>();
    for (const loc of data) {
      next.set(loc.id, fingerprint(loc));
    }
    prevFingerprints.current = next;

    if (changed.size > 0) {
      setNewIds(changed);
      const timer = setTimeout(() => setNewIds(new Set()), 30_000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  return (
    <div className="absolute inset-0 z-0 bg-[#050505] flex items-center justify-center overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140 }}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1} minZoom={1} maxZoom={8}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(0, 20, 0, 0.4)"
                  stroke="#00ff0044"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "rgba(0, 40, 0, 0.6)", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {data.map((market) => {
            const isKalshi = market.id.startsWith('kalshi-');
            const color = isKalshi ? '#00FF00' : '#3B82F6';
            return (
              <Marker
                key={market.id}
                coordinates={[market.lng, market.lat]}
                onClick={() => onMarkerClick(market)}
              >
                {isKalshi ? (
                  <rect
                    x={-market.size * 1.4}
                    y={-market.size * 1.4}
                    width={market.size * 2.8}
                    height={market.size * 2.8}
                    rx={1}
                    fill={color}
                    transform="rotate(45)"
                    className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <circle r={market.size * 2} fill={color} className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity" />
                )}
                {newIds.has(market.id) && (
                  <circle r={market.size * 4} fill={color} opacity={0.3} className="animate-ping" />
                )}
              </Marker>
            );
          })}
          {osintAlerts.map((alert, idx) => (
            <Marker key={`osint-${idx}`} coordinates={[alert.lng, alert.lat]}>
              <circle r={alert.size * 2.5} fill="#FFAA00" opacity={0.6} />
              <circle r={alert.size * 5} fill="#FFAA00" opacity={0.25} className="animate-ping" />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
