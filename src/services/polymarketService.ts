import { MarketData } from '../data/mockData';

export interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
  keywords: RegExp;
}

export const LOCATIONS: LocationInfo[] = [
  { name: 'Washington DC', lat: 38.89, lng: -77.03, keywords: /\b(fed\b|federal reserve|congress|white house|us election|trump|biden|republican|democrat|senate|house of rep|washington|us govern|doge |department of|tariff|state of the union|executive order|presidential|inaugur|scotus|supreme court|sec |fda |epa |irs |fbi |cia |doj |pentagon|medicaid|medicare|social security|government shutdown|debt ceiling|stimulus|immigration|border|impeach)/i },
  { name: 'New York', lat: 40.71, lng: -74.00, keywords: /\b(wall street|nyse|s&p|nasdaq|dow jones|new york|manhattan|stock market|nyc|goldman|jpmorgan|citibank|morgan stanley|interest rate|recession|inflation rate|cpi |ppi |gdp |unemployment rate|yield curve|treasury|bond market)/i },
  { name: 'San Francisco', lat: 37.77, lng: -122.42, keywords: /\b(ai |artificial intelligence|openai|gpt|tech |silicon valley|california|meta |google |apple |microsoft|nvidia|anthropic|chatgpt|tesla|spacex|elon musk|agi |llm |machine learning|deepmind|gemini ai|claude ai|robot|autonomous|self.driving)/i },
  { name: 'Las Vegas', lat: 36.17, lng: -115.14, keywords: /\b(nfl |nba |mlb |nhl |super bowl|world series|stanley cup|nba finals|march madness|ufc |mma |boxing |ncaa |college football|playoff|championship game|mvp |heisman|draft pick|all.star game|touchdown|home run|three.pointer|knockout)/i },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24, keywords: /\b(oscar|emmy|grammy|hollywood|box office|movie|film |netflix|disney|streaming|entertainment|celebrity|los angeles|la lakers|dodgers|rams |clippers|chargers)/i },
  { name: 'Miami', lat: 25.76, lng: -80.19, keywords: /\b(bitcoin|btc |ethereum|eth |crypto|solana|sol |defi|nft |web3|blockchain|binance|coinbase|altcoin|memecoin|token price|market cap|halving|stablecoin)/i },
  { name: 'Chicago', lat: 41.88, lng: -87.63, keywords: /\b(chicago|commodit|wheat |corn |soybean|cattle|pork|futures|cme |cbot|midwest|illinois)/i },
  { name: 'Houston', lat: 29.76, lng: -95.37, keywords: /\b(hurricane|tornado|wildfire|earthquake|flood|drought|heat wave|cold snap|weather|climate|storm|natural disaster|fema|category \d|landfall|evacuation)/i },
  { name: 'London', lat: 51.51, lng: -0.13, keywords: /\b(boe|bank of england|uk |britain|british|london|premier league|england|starmer|labour party|tory|manchester|liverpool|chelsea|arsenal|tottenham|epl )/i },
  { name: 'Brussels', lat: 48.86, lng: 2.35, keywords: /\b(eu |europe|ecb|european|france|french|macron|brussels|nato|germany|german|scholz|bundesliga|champions league|europa league|serie a|la liga|ligue 1)/i },
  { name: 'Kyiv', lat: 50.45, lng: 30.52, keywords: /\b(ukraine|kyiv|zelensky|crimea|donbas|kherson)/i },
  { name: 'Moscow', lat: 55.76, lng: 37.62, keywords: /\b(russia|moscow|putin|kremlin|ruble|wagner)/i },
  { name: 'Tel Aviv', lat: 32.09, lng: 34.78, keywords: /\b(israel|gaza|hamas|netanyahu|idf|palestinian|west bank|hezbollah|lebanon)/i },
  { name: 'Tehran', lat: 35.69, lng: 51.39, keywords: /\b(iran|tehran|nuclear deal|iaea|ayatollah|khamenei|persian gulf)/i },
  { name: 'Beijing', lat: 39.90, lng: 116.41, keywords: /\b(china|chinese|pboc|beijing|xi jinping|ccp|huawei|tiktok|south china sea|taiwan strait)/i },
  { name: 'Taipei', lat: 25.03, lng: 121.57, keywords: /\b(taiwan|tsmc|taipei|semiconductor)/i },
  { name: 'Tokyo', lat: 35.68, lng: 139.65, keywords: /\b(japan|boj|tokyo|yen |nikkei|nintendo|sony)/i },
  { name: 'Seoul', lat: 37.57, lng: 126.98, keywords: /\b(korea|korean|samsung|hyundai|k.pop|seoul|pyongyang|kim jong)/i },
  { name: 'New Delhi', lat: 28.61, lng: 77.21, keywords: /\b(india|modi|delhi|mumbai|nifty|rupee|bollywood|cricket|ipl )/i },
  { name: 'Dubai', lat: 25.20, lng: 55.27, keywords: /\b(opec|saudi|dubai|oil price|crude|uae|arab|mbs |qatar|bahrain)/i },
  { name: 'Sydney', lat: -33.87, lng: 151.21, keywords: /\b(australia|australian|sydney|melbourne|rba |aud |kangaroo|new zealand)/i },
  { name: 'Lagos', lat: 6.52, lng: 3.38, keywords: /\b(africa|nigeria|lagos|kenya|south africa|ethiopia|african union)/i },
  { name: 'Sao Paulo', lat: -23.55, lng: -46.63, keywords: /\b(brazil|latin america|south america|lula|argentina|milei|mexico|peso|bolsonaro)/i },
  { name: 'Ottawa', lat: 45.42, lng: -75.70, keywords: /\b(canada|canadian|trudeau|ottawa|toronto|cad |loonie|maple)/i },
  { name: 'Geneva', lat: 46.20, lng: 6.14, keywords: /\b(who |world health|pandemic|vaccine|virus|covid|monkeypox|bird flu|h5n1|outbreak|epidemic)/i },
  { name: 'Global', lat: 0, lng: -30, keywords: /.*/ },
];

export function detectLocation(text: string): string {
  for (const loc of LOCATIONS) {
    if (loc.name === 'Global') continue;
    if (loc.keywords.test(text)) return loc.name;
  }
  return 'Global';
}

export function getLocationInfo(name: string): LocationInfo {
  return LOCATIONS.find(l => l.name === name) || LOCATIONS[LOCATIONS.length - 1];
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${Math.round(vol)}`;
}

export function computeSize(totalVolume: number): number {
  if (totalVolume <= 0) return 0.3;
  return Math.max(0.3, Math.min(0.8, Math.log10(totalVolume / 10_000) * 0.25 + 0.3));
}

// Golden-angle spiral to spread points around a city center
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export function spreadCoords(centerLat: number, centerLng: number, index: number, _total: number, spreadDeg = 4): { lat: number; lng: number } {
  if (index === 0) return { lat: centerLat, lng: centerLng };
  const r = spreadDeg * index * 0.45;
  const theta = index * GOLDEN_ANGLE;
  return {
    lat: centerLat + r * Math.cos(theta),
    lng: centerLng + r * Math.sin(theta),
  };
}

function parseOutcomePrices(raw: string): { yes: number; no: number } {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const yes = parseFloat(parsed[0]);
      const no = parseFloat(parsed[1]);
      if (!isNaN(yes) && !isNaN(no)) return { yes, no };
    }
  } catch { /* ignore */ }
  return { yes: 0.5, no: 0.5 };
}

const API_BASE = '/api/polymarket';
const API_URL = `${API_BASE}/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false`;

let cache: MarketData[] = [];
let lastFetch = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function fetchPolymarkets(forceRefresh = false): Promise<MarketData[]> {
  if (!forceRefresh && Date.now() - lastFetch < REFRESH_INTERVAL && cache.length > 0) {
    return cache;
  }

  try {
    const res = await fetch(API_URL);
    if (!res.ok) return cache;
    const raw = await res.json();

    if (!Array.isArray(raw) || raw.length === 0) return cache;

    // Parse each market and detect location
    interface ParsedMarket {
      question: string;
      yesPrice: number;
      noPrice: number;
      volume: string;
      volumeRaw: number;
      polymarketUrl: string;
      locationKey: string;
    }

    const parsed: ParsedMarket[] = [];

    for (const item of raw) {
      if (!item.question || !item.outcomePrices) continue;

      // Build Polymarket URL — skip markets without a valid link
      let polymarketUrl = '';
      if (item.events && item.events.length > 0 && item.events[0].slug) {
        polymarketUrl = `https://polymarket.com/event/${item.events[0].slug}`;
      } else if (item.slug) {
        polymarketUrl = `https://polymarket.com/event/${item.slug}`;
      }
      if (!polymarketUrl) continue;

      const prices = parseOutcomePrices(item.outcomePrices);
      const vol = parseFloat(item.volume) || 0;
      const text = `${item.question} ${item.description || ''}`;
      const locationKey = detectLocation(text);

      parsed.push({
        question: item.question,
        yesPrice: prices.yes,
        noPrice: prices.no,
        volume: formatVolume(vol),
        volumeRaw: vol,
        polymarketUrl,
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
          id: `poly-${locationKey.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
          lat,
          lng,
          size: computeSize(m.volumeRaw),
          title: `${locationKey} — Polymarket`,
          news: `${m.question} • ${m.volume} volume`,
          markets: [{
            question: m.question,
            yesPrice: m.yesPrice,
            noPrice: m.noPrice,
            volume: m.volume,
            polymarketUrl: m.polymarketUrl,
          }],
        });
      });
    }

    // Sort by size (largest first)
    result.sort((a, b) => b.size - a.size);

    cache = result;
    lastFetch = Date.now();
    return cache;
  } catch (err) {
    console.error('Polymarket fetch failed:', err);
    return cache;
  }
}
