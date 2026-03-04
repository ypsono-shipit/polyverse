import { GoogleGenAI } from '@google/genai';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const COMMONSTACK_KEY = process.env.COMMONSTACK_API_KEY || '';
const COMMONSTACK_URL = 'https://api.commonstack.ai/v1/chat/completions';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// --- Types ---

export interface UpcomingEarning {
  symbol: string;
  name: string;
  date: string;
  hour: 'bmo' | 'amc' | 'dmh' | '';
  epsEstimate: number | null;
  revenueEstimate: number | null;
  logo?: string;
  industry?: string;
  marketCap?: number;
}

export interface HistoricalQuarter {
  period: string;
  actual: number;
  estimate: number;
  surprise: number;
  surprisePct: number;
}

export interface PolymarketEarningsData {
  yesPct: number;
  volume: number;
  liquidity: number;
  slug: string;
  endDate: string;
}

export interface EarningsAnalysis {
  symbol: string;
  name: string;
  date: string;
  hour: string;
  epsEstimate: number | null;
  history: HistoricalQuarter[];
  beatCount: number;
  missCount: number;
  meetCount: number;
  beatRate: number;
  avgSurprisePct: number;
  prediction: 'BEAT' | 'MISS' | 'MEET' | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  reasoning: string;
  logo?: string;
  industry?: string;
  marketCap?: number;
  exchange?: string;
  polymarket?: PolymarketEarningsData;
}

// --- Rate limiting ---
// Finnhub free tier: 60 calls/minute. We use a per-minute sliding window.

const USAGE_KEY = 'polyearn_finnhub_usage';
const MINUTE_LIMIT = 50; // stay under 60/min

const recentCalls: number[] = [];

function incrementUsage(): boolean {
  const now = Date.now();
  // Prune calls older than 60s
  while (recentCalls.length > 0 && recentCalls[0] < now - 60000) {
    recentCalls.shift();
  }
  if (recentCalls.length >= MINUTE_LIMIT) return false;
  recentCalls.push(now);
  return true;
}

// --- Caching ---

let calendarCache: { data: UpcomingEarning[]; ts: number } | null = null;
const profileCache = new Map<string, { name: string; logo?: string; industry?: string; marketCap?: number; exchange?: string }>();
const historyCache = new Map<string, HistoricalQuarter[]>();
const analysisCache: { data: EarningsAnalysis[]; ts: number } | null = null;
let fullAnalysisCache: { data: EarningsAnalysis[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// --- Finnhub API calls ---

export async function fetchUpcomingEarnings(): Promise<UpcomingEarning[]> {
  if (calendarCache && Date.now() - calendarCache.ts < CACHE_TTL) {
    return calendarCache.data;
  }

  if (!FINNHUB_KEY || !incrementUsage()) return [];

  try {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    const items = data.earningsCalendar || [];

    const earnings: UpcomingEarning[] = items
      .filter((e: any) => e.symbol && e.date)
      .map((e: any) => ({
        symbol: e.symbol,
        name: e.symbol, // will be enriched by profile
        date: e.date,
        hour: e.hour === 'bmo' ? 'bmo' : e.hour === 'amc' ? 'amc' : e.hour === 'dmh' ? 'dmh' : '',
        epsEstimate: e.epsEstimate ?? null,
        revenueEstimate: e.revenueEstimate ?? null,
      }));

    calendarCache = { data: earnings, ts: Date.now() };
    return earnings;
  } catch {
    return [];
  }
}

export async function fetchEarningsHistory(symbol: string): Promise<HistoricalQuarter[]> {
  if (historyCache.has(symbol)) return historyCache.get(symbol)!;
  if (!FINNHUB_KEY || !incrementUsage()) return [];

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const quarters: HistoricalQuarter[] = data
      .filter((q: any) => q.actual != null && q.estimate != null)
      .map((q: any) => {
        const actual = q.actual;
        const estimate = q.estimate;
        const surprise = actual - estimate;
        const surprisePct = estimate !== 0 ? (surprise / Math.abs(estimate)) * 100 : 0;
        return {
          period: q.period || '',
          actual,
          estimate,
          surprise,
          surprisePct,
        };
      });

    historyCache.set(symbol, quarters);
    return quarters;
  } catch {
    return [];
  }
}

export async function fetchCompanyProfile(symbol: string): Promise<{ name: string; logo?: string; industry?: string; marketCap?: number; exchange?: string }> {
  if (profileCache.has(symbol)) return profileCache.get(symbol)!;
  if (!FINNHUB_KEY || !incrementUsage()) return { name: symbol };

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return { name: symbol };

    const data = await res.json();
    const profile = {
      name: data.name || symbol,
      logo: data.logo || undefined,
      industry: data.finnhubIndustry || undefined,
      marketCap: data.marketCapitalization || undefined,
      exchange: data.exchange || undefined,
    };

    profileCache.set(symbol, profile);
    return profile;
  } catch {
    return { name: symbol };
  }
}

// --- Polymarket earnings lookup ---

const POLYMARKET_API = '/api/polymarket';
const POLYMARKET_WEB = '/api/poly-web';

// Ticker -> slug map scraped from Polymarket earnings page
let earningsSlugMap: Map<string, string> | null = null;
let earningsSlugMapTs = 0;

async function getEarningsSlugMap(): Promise<Map<string, string>> {
  if (earningsSlugMap && Date.now() - earningsSlugMapTs < CACHE_TTL) {
    return earningsSlugMap;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${POLYMARKET_WEB}/predictions/earnings`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Failed to fetch earnings page');
    const html = await res.text();

    // Extract event slugs matching quarterly-earnings pattern
    const slugRegex = /\/event\/([a-z0-9-]+-quarterly-earnings-[a-z0-9-]+)/g;
    const map = new Map<string, string>();
    let match;
    while ((match = slugRegex.exec(html)) !== null) {
      const slug = match[1];
      const ticker = slug.split('-quarterly-earnings')[0].toUpperCase();
      if (!map.has(ticker)) {
        map.set(ticker, slug);
      }
    }

    earningsSlugMap = map;
    earningsSlugMapTs = Date.now();
    console.log(`[PolyEarn] Found ${map.size} Polymarket earnings markets`);
    return map;
  } catch (err) {
    console.warn('[PolyEarn] Could not fetch Polymarket earnings page:', err);
    return earningsSlugMap || new Map();
  }
}

const polymarketCache = new Map<string, PolymarketEarningsData | null>();

async function fetchPolymarketEventBySlug(slug: string): Promise<PolymarketEarningsData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${POLYMARKET_API}/events?slug=${slug}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) return null;

    const event = events[0];
    const markets = event.markets || [];
    if (markets.length === 0) return null;

    const market = markets[0];
    const outcomePrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : market.outcomePrices;

    const yesPct = parseFloat(outcomePrices?.[0] || '0') * 100;
    if (yesPct === 0) return null;

    return {
      yesPct,
      volume: parseFloat(market.volume || '0'),
      liquidity: parseFloat(market.liquidity || '0'),
      slug: event.slug,
      endDate: market.endDate || '',
    };
  } catch {
    return null;
  }
}

export async function fetchPolymarketEarnings(
  symbol: string,
): Promise<PolymarketEarningsData | null> {
  if (polymarketCache.has(symbol)) return polymarketCache.get(symbol) || null;

  const slugMap = await getEarningsSlugMap();
  const slug = slugMap.get(symbol);

  if (!slug) {
    polymarketCache.set(symbol, null);
    return null;
  }

  const data = await fetchPolymarketEventBySlug(slug);
  polymarketCache.set(symbol, data);
  return data;
}

// Get all available Polymarket earnings tickers
export async function getPolymarketEarningsTickers(): Promise<string[]> {
  const slugMap = await getEarningsSlugMap();
  return [...slugMap.keys()].sort();
}

// --- NYSE/NASDAQ filter ---

function isMajorExchange(exchange?: string): boolean {
  if (!exchange) return true; // include if unknown
  const upper = exchange.toUpperCase();
  return upper.includes('NYSE') || upper.includes('NASDAQ') || upper.includes('NEW YORK STOCK EXCHANGE');
}

// Pre-filter tickers that look like standard US exchange stocks
// Avoids wasting Finnhub API calls on OTC/foreign tickers
function looksLikeUSStock(symbol: string): boolean {
  // Standard US tickers: 1-5 uppercase letters, no dots/special chars
  // Exclude 5-letter tickers ending in F/Y (foreign ADRs on OTC)
  if (!/^[A-Z]{1,5}$/.test(symbol)) return false;
  if (symbol.length === 5 && /[FY]$/.test(symbol)) return false;
  return true;
}

// --- AI prediction ---

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try Commonstack first
  if (COMMONSTACK_KEY) {
    try {
      const res = await fetch(COMMONSTACK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COMMONSTACK_KEY}`,
        },
        body: JSON.stringify({
          model: 'commonstack-ai',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        if (text) return text;
      }
    } catch (err) {
      console.warn('Commonstack earnings prediction failed, falling back to Gemini:', err);
    }
  }

  // Fallback to Gemini
  if (GEMINI_KEY) {
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${systemPrompt}\n\n${userPrompt}`,
    });
    return response.text?.trim() || '';
  }

  return '';
}

function buildPredictionPrompt(companies: {
  symbol: string;
  name: string;
  industry?: string;
  epsEstimate: number | null;
  history: HistoricalQuarter[];
  beatRate: number;
  avgSurprisePct: number;
}[]): { system: string; user: string } {
  const system = `You are PolyEarn — an expert earnings analyst. For each company, predict whether they will BEAT, MISS, or MEET their upcoming EPS estimate based on their historical earnings track record and patterns. Return ONLY valid JSON (no markdown fences).`;

  const companiesBlock = companies.map(c => {
    const historyStr = c.history.slice(0, 20).map(q =>
      `  ${q.period}: actual=${q.actual.toFixed(2)} est=${q.estimate.toFixed(2)} surprise=${q.surprise >= 0 ? '+' : ''}${q.surprise.toFixed(2)} (${q.surprisePct >= 0 ? '+' : ''}${q.surprisePct.toFixed(1)}%)`
    ).join('\n');

    return `${c.symbol} (${c.name})${c.industry ? ` — ${c.industry}` : ''}
EPS Estimate: ${c.epsEstimate != null ? `$${c.epsEstimate.toFixed(2)}` : 'N/A'}
Beat Rate: ${c.beatRate.toFixed(0)}% | Avg Surprise: ${c.avgSurprisePct >= 0 ? '+' : ''}${c.avgSurprisePct.toFixed(1)}%
Historical Earnings (most recent first):
${historyStr || '  No history available'}`;
  }).join('\n\n');

  const user = `Analyze these upcoming earnings and predict beat/miss:

${companiesBlock}

Return JSON:
{
  "predictions": [
    {
      "symbol": "AAPL",
      "prediction": "BEAT" or "MISS" or "MEET",
      "confidence": "HIGH" or "MEDIUM" or "LOW",
      "reasoning": "1-2 sentences citing historical patterns, beat rate, and any notable trends"
    }
  ]
}

Rules:
- HIGH confidence = very strong historical pattern (>80% beat rate or <30% beat rate with consistent trend)
- MEDIUM confidence = moderate pattern or mixed recent results
- LOW confidence = insufficient data or conflicting signals
- MEET = within 1% of estimate`;

  return { system, user };
}

export async function getEarningsPredictions(
  companies: {
    symbol: string;
    name: string;
    industry?: string;
    epsEstimate: number | null;
    history: HistoricalQuarter[];
    beatRate: number;
    avgSurprisePct: number;
  }[]
): Promise<Map<string, { prediction: 'BEAT' | 'MISS' | 'MEET'; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasoning: string }>> {
  const results = new Map<string, { prediction: 'BEAT' | 'MISS' | 'MEET'; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasoning: string }>();

  if (companies.length === 0) return results;

  // Batch in groups of 5
  for (let i = 0; i < companies.length; i += 5) {
    const batch = companies.slice(i, i + 5);
    const { system, user } = buildPredictionPrompt(batch);

    try {
      const text = await callAI(system, user);
      const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(jsonStr);

      for (const p of parsed.predictions || []) {
        if (p.symbol && p.prediction) {
          results.set(p.symbol, {
            prediction: ['BEAT', 'MISS', 'MEET'].includes(p.prediction) ? p.prediction : 'MEET',
            confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(p.confidence) ? p.confidence : 'MEDIUM',
            reasoning: p.reasoning || '',
          });
        }
      }
    } catch (err) {
      console.error('AI earnings prediction failed for batch:', err);
    }
  }

  return results;
}

// --- Main analysis function ---

export async function analyzeUpcomingEarnings(forceRefresh = false): Promise<EarningsAnalysis[]> {
  if (!forceRefresh && fullAnalysisCache && Date.now() - fullAnalysisCache.ts < CACHE_TTL) {
    return fullAnalysisCache.data;
  }

  const upcoming = await fetchUpcomingEarnings();
  if (upcoming.length === 0) return [];

  // Pre-filter to likely NYSE/NASDAQ tickers (cheap heuristic, no API calls)
  // Then take top 30 to limit API usage
  const topCompanies = upcoming
    .filter(e => looksLikeUSStock(e.symbol))
    .slice(0, 30);

  // Fetch profiles, history, and Polymarket data in parallel batches (3 at a time)
  const enriched: EarningsAnalysis[] = [];

  for (let i = 0; i < topCompanies.length; i += 3) {
    const batch = topCompanies.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (earning) => {
        const [profile, history, polymarket] = await Promise.all([
          fetchCompanyProfile(earning.symbol),
          fetchEarningsHistory(earning.symbol),
          fetchPolymarketEarnings(earning.symbol),
        ]);

        // Skip if profile reveals non-US exchange
        if (profile.exchange && !isMajorExchange(profile.exchange)) {
          return null;
        }

        const beatCount = history.filter(q => q.surprise > 0.005).length;
        const missCount = history.filter(q => q.surprise < -0.005).length;
        const meetCount = history.length - beatCount - missCount;
        const beatRate = history.length > 0 ? (beatCount / history.length) * 100 : 0;
        const avgSurprisePct = history.length > 0
          ? history.reduce((sum, q) => sum + q.surprisePct, 0) / history.length
          : 0;

        return {
          symbol: earning.symbol,
          name: profile.name,
          date: earning.date,
          hour: earning.hour,
          epsEstimate: earning.epsEstimate,
          history,
          beatCount,
          missCount,
          meetCount,
          beatRate,
          avgSurprisePct,
          prediction: null,
          confidence: null,
          reasoning: '',
          logo: profile.logo,
          industry: profile.industry,
          marketCap: profile.marketCap,
          exchange: profile.exchange,
          polymarket: polymarket || undefined,
        } as EarningsAnalysis;
      })
    );
    enriched.push(...results.filter((r): r is EarningsAnalysis => r !== null));
  }

  // Get AI predictions for companies with history
  const withHistory = enriched.filter(e => e.history.length > 0);
  if (withHistory.length > 0) {
    const predictions = await getEarningsPredictions(
      withHistory.map(e => ({
        symbol: e.symbol,
        name: e.name,
        industry: e.industry,
        epsEstimate: e.epsEstimate,
        history: e.history,
        beatRate: e.beatRate,
        avgSurprisePct: e.avgSurprisePct,
      }))
    );

    for (const e of enriched) {
      const pred = predictions.get(e.symbol);
      if (pred) {
        e.prediction = pred.prediction;
        e.confidence = pred.confidence;
        e.reasoning = pred.reasoning;
      }
    }
  }

  fullAnalysisCache = { data: enriched, ts: Date.now() };
  return enriched;
}

// --- Analyze specific tickers (manual input mode) ---

const customTickerCache = new Map<string, { data: EarningsAnalysis; ts: number }>();

export async function analyzeCustomTickers(symbols: string[]): Promise<EarningsAnalysis[]> {
  if (symbols.length === 0) return [];

  // Check which ones we already have cached
  const results: EarningsAnalysis[] = [];
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = customTickerCache.get(sym);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      results.push(cached.data);
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length === 0) return results;

  // Fetch the Finnhub calendar once to try to match dates/estimates
  const calendar = await fetchUpcomingEarnings();
  const calendarMap = new Map(calendar.map(e => [e.symbol, e]));

  // Fetch profile + history + polymarket for each ticker (3 at a time)
  const enriched: EarningsAnalysis[] = [];

  for (let i = 0; i < toFetch.length; i += 3) {
    if (i > 0) await new Promise(r => setTimeout(r, 500)); // pace API calls
    const batch = toFetch.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        const calEntry = calendarMap.get(symbol);
        const earningsDate = calEntry?.date || '';
        const epsEstimate = calEntry?.epsEstimate ?? null;
        const hour = calEntry?.hour || '';

        const [profile, history, polymarket] = await Promise.all([
          fetchCompanyProfile(symbol),
          fetchEarningsHistory(symbol),
          fetchPolymarketEarnings(symbol),
        ]);

        const beatCount = history.filter(q => q.surprise > 0.005).length;
        const missCount = history.filter(q => q.surprise < -0.005).length;
        const meetCount = history.length - beatCount - missCount;
        const beatRate = history.length > 0 ? (beatCount / history.length) * 100 : 0;
        const avgSurprisePct = history.length > 0
          ? history.reduce((sum, q) => sum + q.surprisePct, 0) / history.length
          : 0;

        return {
          symbol,
          name: profile.name,
          date: earningsDate,
          hour,
          epsEstimate,
          history,
          beatCount,
          missCount,
          meetCount,
          beatRate,
          avgSurprisePct,
          prediction: null,
          confidence: null,
          reasoning: '',
          logo: profile.logo,
          industry: profile.industry,
          marketCap: profile.marketCap,
          exchange: profile.exchange,
          polymarket: polymarket || undefined,
        } as EarningsAnalysis;
      })
    );
    enriched.push(...batchResults);
  }

  // Get AI predictions for companies with history
  const withHistory = enriched.filter(e => e.history.length > 0);
  if (withHistory.length > 0) {
    const predictions = await getEarningsPredictions(
      withHistory.map(e => ({
        symbol: e.symbol,
        name: e.name,
        industry: e.industry,
        epsEstimate: e.epsEstimate,
        history: e.history,
        beatRate: e.beatRate,
        avgSurprisePct: e.avgSurprisePct,
      }))
    );

    for (const e of enriched) {
      const pred = predictions.get(e.symbol);
      if (pred) {
        e.prediction = pred.prediction;
        e.confidence = pred.confidence;
        e.reasoning = pred.reasoning;
      }
    }
  }

  // Cache each result
  for (const e of enriched) {
    customTickerCache.set(e.symbol, { data: e, ts: Date.now() });
  }

  return [...results, ...enriched];
}
