export interface NewsItem {
  id: string;
  text: string;
  region: string;
  source: string;
  url: string;
  timestamp: number;
}

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || '';

// Daily limits (free tier)
const FINNHUB_DAILY_LIMIT = 250;    // Finnhub: 60/min but we'll cap daily to be safe
const NEWSDATA_DAILY_LIMIT = 190;   // NewsData: 200 credits/day, keep 10 buffer

const USAGE_STORAGE_KEY = 'polyverse_api_usage';

interface DailyUsage {
  date: string; // YYYY-MM-DD
  finnhub: number;
  newsdata: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(): DailyUsage {
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    if (stored) {
      const usage = JSON.parse(stored) as DailyUsage;
      if (usage.date === getToday()) return usage;
    }
  } catch { /* ignore */ }
  return { date: getToday(), finnhub: 0, newsdata: 0 };
}

function saveUsage(usage: DailyUsage): void {
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
}

function incrementUsage(api: 'finnhub' | 'newsdata'): boolean {
  const usage = getUsage();
  const limit = api === 'finnhub' ? FINNHUB_DAILY_LIMIT : NEWSDATA_DAILY_LIMIT;
  if (usage[api] >= limit) return false; // Over limit, don't call
  usage[api]++;
  saveUsage(usage);
  return true;
}

function isWithinLimit(api: 'finnhub' | 'newsdata'): boolean {
  const usage = getUsage();
  const limit = api === 'finnhub' ? FINNHUB_DAILY_LIMIT : NEWSDATA_DAILY_LIMIT;
  return usage[api] < limit;
}

// Region mapping from country codes to display regions
const COUNTRY_TO_REGION: Record<string, string> = {
  us: 'North America', ca: 'North America', mx: 'North America',
  gb: 'Europe', uk: 'Europe', de: 'Europe', fr: 'Europe', it: 'Europe', es: 'Europe', nl: 'Europe', ch: 'Europe', se: 'Europe', pl: 'Europe', ua: 'Europe',
  cn: 'Asia', jp: 'Asia', kr: 'Asia', in: 'Asia', tw: 'Asia', sg: 'Asia', th: 'Asia', vn: 'Asia', id: 'Asia', ph: 'Asia', my: 'Asia',
  il: 'Middle East', ir: 'Middle East', sa: 'Middle East', ae: 'Middle East', tr: 'Middle East', qa: 'Middle East', kw: 'Middle East',
  br: 'South America', ar: 'South America', cl: 'South America', co: 'South America', pe: 'South America',
  au: 'Asia', nz: 'Asia', za: 'Europe', ng: 'Global', eg: 'Middle East', ru: 'Europe',
};

// Keyword-based region detection for Finnhub (no country field)
function detectRegion(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(fed|sec|us |usa|wall street|nasdaq|s&p|dow jones|congress|white house|silicon valley|washington|new york)\b/.test(lower)) return 'North America';
  if (/\b(eu |ecb|bank of england|boe|uk |britain|germany|france|euro|europe|london|brussels|berlin|paris)\b/.test(lower)) return 'Europe';
  if (/\b(china|japan|india|boj|taiwan|tsmc|nikkei|shanghai|beijing|tokyo|modi|samsung|korea)\b/.test(lower)) return 'Asia';
  if (/\b(opec|iran|israel|saudi|dubai|oil price|middle east|gaza|hamas|hezbollah|tehran|crude)\b/.test(lower)) return 'Middle East';
  if (/\b(brazil|argentina|latin america|south america|amazon|petrobras)\b/.test(lower)) return 'South America';
  return 'Global';
}

// Cache
let cache: NewsItem[] = [];
let finnhubLastFetch = 0;
let newsdataLastFetch = 0;
// Spread calls evenly across 24h: 1440min / 250 calls ≈ 6min, 1440min / 190 calls ≈ 8min
const FINNHUB_INTERVAL = 6 * 60 * 1000;   // 6 minutes (max ~240 calls/day)
const NEWSDATA_INTERVAL = 8 * 60 * 1000;  // 8 minutes (max ~180 calls/day)

async function fetchFinnhub(): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return [];
  if (!isWithinLimit('finnhub')) return [];
  if (Date.now() - finnhubLastFetch < FINNHUB_INTERVAL && cache.length > 0) return [];

  if (!incrementUsage('finnhub')) return [];

  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    finnhubLastFetch = Date.now();

    return (data as any[])
      .filter((item: any) => {
        const src = (item.source || '').toLowerCase();
        return src !== 'marketwatch';
      })
      .slice(0, 15).map((item, i) => ({
        id: `fh-${item.id || i}`,
        text: item.headline || '',
        region: detectRegion(item.headline + ' ' + (item.summary || '')),
        source: item.source || 'Finnhub',
        url: item.url || '',
        timestamp: (item.datetime || 0) * 1000,
      })).filter(n => n.text.length > 0);
  } catch {
    return [];
  }
}

async function fetchNewsdata(): Promise<NewsItem[]> {
  if (!NEWSDATA_KEY) return [];
  if (!isWithinLimit('newsdata')) return [];
  if (Date.now() - newsdataLastFetch < NEWSDATA_INTERVAL && cache.length > 0) return [];

  if (!incrementUsage('newsdata')) return [];

  try {
    const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&category=politics,world&language=en&size=10`);
    if (!res.ok) return [];
    const data = await res.json();
    newsdataLastFetch = Date.now();

    const results = data.results || [];
    return results.map((item: any, i: number) => {
      const countries = item.country || [];
      const firstCountry = (Array.isArray(countries) ? countries[0] : countries || '').toLowerCase();
      return {
        id: `nd-${item.article_id || i}`,
        text: item.title || '',
        region: COUNTRY_TO_REGION[firstCountry] || detectRegion(item.title || ''),
        source: item.source_name || item.source_id || 'NewsData',
        url: item.link || '',
        timestamp: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      };
    }).filter((n: NewsItem) => n.text.length > 0);
  } catch {
    return [];
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  const [finnhubItems, newsdataItems] = await Promise.all([
    fetchFinnhub(),
    fetchNewsdata(),
  ]);

  const newItems = [...finnhubItems, ...newsdataItems];

  if (newItems.length > 0) {
    // Merge with existing cache, deduplicate by text similarity
    const seen = new Set(cache.map(n => n.text.toLowerCase().slice(0, 50)));
    const unique = newItems.filter(n => !seen.has(n.text.toLowerCase().slice(0, 50)));
    cache = [...unique, ...cache].slice(0, 30);
    cache.sort((a, b) => b.timestamp - a.timestamp);
  }

  return cache;
}

export function hasApiKeys(): boolean {
  return !!(FINNHUB_KEY || NEWSDATA_KEY);
}

export function getApiUsage(): { finnhub: number; newsdata: number; finnhubLimit: number; newsdataLimit: number } {
  const usage = getUsage();
  return {
    finnhub: usage.finnhub,
    newsdata: usage.newsdata,
    finnhubLimit: FINNHUB_DAILY_LIMIT,
    newsdataLimit: NEWSDATA_DAILY_LIMIT,
  };
}
