import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { MarketData } from '../data/mockData';
import { OsintAlert } from './OsintPanel';

interface GlobeViewProps {
  data: MarketData[];
  onMarkerClick: (market: MarketData) => void;
  osintAlerts?: OsintAlert[];
}

// Build a fingerprint of each location's markets for change detection
function fingerprint(d: MarketData): string {
  return d.markets.map(m => m.question).sort().join('|');
}

// Approximate distance between two geo coordinates (degrees)
function geoDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function findNearestMarket(lat: number, lng: number, data: MarketData[]): MarketData | null {
  let best: MarketData | null = null;
  let bestDist = Infinity;
  for (const loc of data) {
    const d = geoDist(lat, lng, loc.lat, loc.lng);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return bestDist < 15 ? best : null; // ~15° threshold
}

function createSatelliteObject(): THREE.Object3D {
  const group = new THREE.Group();

  // Main body — small glowing green sphere
  const bodyGeom = new THREE.SphereGeometry(1.2, 16, 16);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  group.add(body);

  // Glow ring
  const ringGeom = new THREE.RingGeometry(1.8, 2.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Solar panels (two flat rectangles)
  const panelGeom = new THREE.BoxGeometry(4, 0.15, 1.2);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x1e3a5f });
  const panelLeft = new THREE.Mesh(panelGeom, panelMat);
  panelLeft.position.x = -3;
  group.add(panelLeft);
  const panelRight = new THREE.Mesh(panelGeom, panelMat);
  panelRight.position.x = 3;
  group.add(panelRight);

  // Antenna
  const antGeom = new THREE.CylinderGeometry(0.1, 0.1, 2, 6);
  const antMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
  const antenna = new THREE.Mesh(antGeom, antMat);
  antenna.position.y = 1.8;
  group.add(antenna);

  // Dish on top
  const dishGeom = new THREE.ConeGeometry(0.6, 0.5, 8);
  const dishMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.7 });
  const dish = new THREE.Mesh(dishGeom, dishMat);
  dish.position.y = 3;
  dish.rotation.x = Math.PI;
  group.add(dish);

  return group;
}

const SAT_STEP = 2; // degrees per keypress

export default function GlobeView({ data, onMarkerClick, osintAlerts = [] }: GlobeViewProps) {
  const globeRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [countries, setCountries] = useState({ features: [] });
  const [pingData, setPingData] = useState<MarketData[]>([]);
  const prevFingerprints = useRef<Map<string, string>>(new Map());

  // Satellite state
  const [satPos, setSatPos] = useState({ lat: 38.89, lng: -77.03 });
  const [nearbyMarket, setNearbyMarket] = useState<MarketData | null>(null);
  const [satScreenPos, setSatScreenPos] = useState<{ x: number; y: number } | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const satObjRef = useRef<THREE.Object3D | null>(null);

  const satData = useMemo(() => [{ lat: satPos.lat, lng: satPos.lng, alt: 0.12 }], [satPos]);

  const getSatelliteObj = useCallback(() => {
    if (!satObjRef.current) {
      satObjRef.current = createSatelliteObject();
    }
    return satObjRef.current;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minDistance = 120;
      controls.maxDistance = 500;
      globeRef.current.pointOfView({ altitude: 1.8 });
    }
  }, []);

  // Keyboard controls for satellite
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      let dLat = 0;
      let dLng = 0;
      switch (e.key) {
        case 'ArrowUp': dLat = SAT_STEP; break;
        case 'ArrowDown': dLat = -SAT_STEP; break;
        case 'ArrowLeft': dLng = -SAT_STEP; break;
        case 'ArrowRight': dLng = SAT_STEP; break;
        default: return;
      }
      e.preventDefault();

      setSatPos(prev => {
        let newLat = Math.max(-80, Math.min(80, prev.lat + dLat));
        let newLng = prev.lng + dLng;
        if (newLng > 180) newLng -= 360;
        if (newLng < -180) newLng += 360;
        return { lat: newLat, lng: newLng };
      });

      // Pause auto-rotate while controlling
      if (globeRef.current) {
        const controls = globeRef.current.controls();
        controls.autoRotate = false;
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
          if (globeRef.current) globeRef.current.controls().autoRotate = true;
        }, 5000);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(idleTimer.current);
    };
  }, []);

  // Camera follow + nearby market detection on satellite move
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: satPos.lat, lng: satPos.lng }, 300);
    }
    setNearbyMarket(findNearestMarket(satPos.lat, satPos.lng, data));
  }, [satPos, data]);

  // Track satellite screen position for overlay
  useEffect(() => {
    let animId: number;
    const updateScreenPos = () => {
      if (globeRef.current) {
        const coords = globeRef.current.getScreenCoords(satPos.lat, satPos.lng, 0.12);
        if (coords) {
          setSatScreenPos({ x: coords.x, y: coords.y });
        }
      }
      animId = requestAnimationFrame(updateScreenPos);
    };
    animId = requestAnimationFrame(updateScreenPos);
    return () => cancelAnimationFrame(animId);
  }, [satPos]);

  // Detect new/changed locations and trigger pings
  useEffect(() => {
    if (data.length === 0) return;

    const prev = prevFingerprints.current;
    const changed: MarketData[] = [];

    for (const loc of data) {
      const fp = fingerprint(loc);
      const oldFp = prev.get(loc.id);
      if (oldFp === undefined || oldFp !== fp) {
        changed.push(loc);
      }
    }

    const next = new Map<string, string>();
    for (const loc of data) {
      next.set(loc.id, fingerprint(loc));
    }
    prevFingerprints.current = next;

    if (changed.length > 0) {
      setPingData(changed);
      const timer = setTimeout(() => setPingData([]), 30_000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // Combine new-market pings with OSINT alert pings
  const combinedRings = useMemo(() => {
    const rings: { lat: number; lng: number; size: number; type: 'polymarket' | 'kalshi' | 'osint' }[] = [];

    for (const p of pingData) {
      rings.push({
        lat: p.lat,
        lng: p.lng,
        size: p.size,
        type: p.id.startsWith('kalshi-') ? 'kalshi' : 'polymarket',
      });
    }

    for (const a of osintAlerts) {
      rings.push({ lat: a.lat, lng: a.lng, size: a.size, type: 'osint' });
    }

    return rings;
  }, [pingData, osintAlerts]);

  return (
    <div className="absolute inset-0 z-0">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="#050505"
        polygonsData={countries.features}
        polygonAltitude={0.005}
        polygonCapColor={() => 'rgba(0, 10, 30, 0.4)'}
        polygonSideColor={() => 'rgba(59, 130, 246, 0.05)'}
        polygonStrokeColor={() => '#3b82f644'}
        pointsData={data}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#3B82F6'}
        pointAltitude={0.005}
        pointRadius="size"
        pointsMerge={false}
        onPointClick={(point: object) => onMarkerClick(point as MarketData)}
        pointResolution={12}
        atmosphereColor="#3B82F6"
        atmosphereAltitude={0.15}
        ringsData={combinedRings}
        ringLat="lat"
        ringLng="lng"
        ringColor={(d: object) => {
          const ring = d as { type: string };
          if (ring.type === 'osint') return (t: number) => `rgba(255, 170, 0, ${1 - t})`;
          if (ring.type === 'kalshi') return (t: number) => `rgba(59, 130, 246, ${1 - t})`;
          return (t: number) => `rgba(59, 130, 246, ${1 - t})`;
        }}
        ringMaxRadius={(d: object) => (d as { size: number }).size * 3}
        ringPropagationSpeed={2}
        ringRepeatPeriod={(d: object) => (d as { type: string }).type === 'osint' ? 600 : 800}
        objectsData={satData}
        objectLat="lat"
        objectLng="lng"
        objectAltitude="alt"
        objectThreeObject={getSatelliteObj}
        objectFacesSurface={true}
      />

      {/* Satellite info overlay */}
      {nearbyMarket && satScreenPos && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: satScreenPos.x + 20, top: satScreenPos.y - 20, maxWidth: 280 }}
        >
          <div className="bg-black/90 border border-blue-500/40 backdrop-blur-xl rounded-lg px-4 py-3 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-blue-400 font-mono font-bold text-sm">{nearbyMarket.title}</span>
            </div>
            <div className="space-y-1.5">
              {nearbyMarket.markets.slice(0, 3).map((m, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <span className="text-gray-300 text-[11px] leading-snug flex-1">{m.question}</span>
                  <span className="text-blue-400 font-mono text-[11px] shrink-0">
                    {Math.round(m.yesPrice * 100)}¢
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-1.5 border-t border-blue-500/20 text-gray-500 font-mono text-[9px]">
              {nearbyMarket.news}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
