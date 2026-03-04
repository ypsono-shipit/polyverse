import { MarketData } from '../data/mockData';
import { detectLocation, getLocationInfo, formatVolume, computeSize, spreadCoords } from './polymarketService';

const DFLOW_KEY = process.env.DFLOW_API_KEY || '';

const API_BASE = '/api/kalshi';
const API_URL = `${API_BASE}/api/v1/markets?limit=200&status=active&sort=volume&order=desc`;

let cache: MarketData[] = [];
let lastFetch = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface ParsedMarket {
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  volumeRaw: number;
  yesMint: string;
  noMint: string;
  locationKey: string;
}

export async function fetchKalshiMarkets(forceRefresh = false): Promise<MarketData[]> {
  if (!forceRefresh && Date.now() - lastFetch < REFRESH_INTERVAL && cache.length > 0) {
    return cache;
  }

  try {
    const headers: Record<string, string> = {};
    if (DFLOW_KEY) {
      headers['x-api-key'] = DFLOW_KEY;
    }

    const res = await fetch(API_URL, { headers });
    if (!res.ok) return cache;
    const data = await res.json();

    const markets = data.markets;
    if (!Array.isArray(markets) || markets.length === 0) return cache;

    const parsed: ParsedMarket[] = [];

    for (const item of markets) {
      if (!item.title && !item.ticker) continue;

      const question = item.title || item.ticker;
      const ticker = item.ticker || '';

      // Compute YES/NO prices from bid/ask
      const yesBid = parseFloat(item.yesBid) || 0;
      const yesAsk = parseFloat(item.yesAsk) || 0;
      const noBid = parseFloat(item.noBid) || 0;
      const noAsk = parseFloat(item.noAsk) || 0;

      // Use midpoint if both bid and ask exist, otherwise use whichever is available
      let yesPrice = 0.5;
      if (yesBid > 0 && yesAsk > 0) {
        yesPrice = (yesBid + yesAsk) / 2;
      } else if (yesAsk > 0) {
        yesPrice = yesAsk;
      } else if (yesBid > 0) {
        yesPrice = yesBid;
      }

      let noPrice = 0.5;
      if (noBid > 0 && noAsk > 0) {
        noPrice = (noBid + noAsk) / 2;
      } else if (noAsk > 0) {
        noPrice = noAsk;
      } else if (noBid > 0) {
        noPrice = noBid;
      }

      // DFlow returns Kalshi volume in cents — convert to dollars
      const vol = (parseFloat(item.volume) || 0) / 100;
      const text = `${question} ${item.subtitle || ''}`;
      const locationKey = detectLocation(text);

      // Extract outcome token mints for in-app trading via DFlow
      const accounts = item.accounts || {};
      const firstAccount = Object.values(accounts)[0] as { yesMint?: string; noMint?: string } | undefined;
      const yesMint = firstAccount?.yesMint || '';
      const noMint = firstAccount?.noMint || '';

      parsed.push({
        question,
        yesPrice,
        noPrice,
        volume: formatVolume(vol),
        volumeRaw: vol,
        yesMint,
        noMint,
        locationKey,
      });
    }

    // Group by location
    const groups = new Map<string, ParsedMarket[]>();
    for (const m of parsed) {
      const existing = groups.get(m.locationKey) || [];
      existing.push(m);
      groups.set(m.locationKey, existing);
    }

    // Convert to MarketData[] — one point per market, spread around city
    const result: MarketData[] = [];
    for (const [locationKey, markets] of groups) {
      const loc = getLocationInfo(locationKey);

      // Sort by volume, take top 5
      markets.sort((a, b) => b.volumeRaw - a.volumeRaw);
      const top = markets.slice(0, 5);

      top.forEach((m, idx) => {
        const { lat, lng } = spreadCoords(loc.lat, loc.lng, idx, top.length);
        result.push({
          id: `kalshi-${locationKey.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
          lat,
          lng,
          size: computeSize(m.volumeRaw),
          title: `${locationKey} — Kalshi`,
          news: `${m.question} • ${m.volume} volume`,
          markets: [{
            question: m.question,
            yesPrice: m.yesPrice,
            noPrice: m.noPrice,
            volume: m.volume,
            yesMint: m.yesMint,
            noMint: m.noMint,
          }],
        });
      });
    }

    result.sort((a, b) => b.size - a.size);

    cache = result;
    lastFetch = Date.now();
    return cache;
  } catch (err) {
    console.error('Kalshi/DFlow fetch failed:', err);
    return cache;
  }
}
