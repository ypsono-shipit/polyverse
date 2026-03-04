import { GoogleGenAI } from '@google/genai';
import { NewsItem } from './newsService';
import { MarketData } from '../data/mockData';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const COMMONSTACK_KEY = process.env.COMMONSTACK_API_KEY || '';
const COMMONSTACK_URL = 'https://api.commonstack.ai/v1/chat/completions';

export interface TradingSignal {
  market: string;
  direction: 'BUY_YES' | 'BUY_NO' | 'HOLD';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  relatedNews: string;
  region: string;
  polymarketUrl?: string;
  lat?: number;
  lng?: number;
}

export interface AnalysisResult {
  signals: TradingSignal[];
  summary: string;
  timestamp: number;
}

// Cache + rate limiting
let cachedResult: AnalysisResult | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const USAGE_KEY = 'polyverse_gemini_usage';
const DAILY_LIMIT = 200;

interface DailyUsage {
  date: string;
  count: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(): DailyUsage {
  try {
    const stored = localStorage.getItem(USAGE_KEY);
    if (stored) {
      const usage = JSON.parse(stored) as DailyUsage;
      if (usage.date === getToday()) return usage;
    }
  } catch { /* ignore */ }
  return { date: getToday(), count: 0 };
}

function incrementUsage(): boolean {
  const usage = getUsage();
  if (usage.count >= DAILY_LIMIT) return false;
  usage.count++;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  return true;
}

// Match a signal's market text to the closest real market to get URL + location
function matchSignalToMarket(signalText: string, markets: MarketData[]): { polymarketUrl?: string; lat?: number; lng?: number } {
  const lower = signalText.toLowerCase();
  let bestScore = 0;
  let bestMatch: { polymarketUrl?: string; lat?: number; lng?: number } = {};

  for (const loc of markets) {
    for (const m of loc.markets) {
      // Count overlapping words between signal market text and real market question
      const mWords = new Set(m.question.toLowerCase().split(/\s+/));
      const sWords = lower.split(/\s+/);
      let score = 0;
      for (const w of sWords) {
        if (w.length > 2 && mWords.has(w)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { polymarketUrl: m.polymarketUrl, lat: loc.lat, lng: loc.lng };
      }
    }
  }

  return bestScore >= 2 ? bestMatch : {};
}

function buildPrompt(news: NewsItem[], markets: MarketData[]): string {
  const newsBlock = news
    .slice(0, 30)
    .map(n => `- ${n.text} | ${n.region} | ${n.source}`)
    .join('\n');

  const marketBlock: string[] = [];
  for (const loc of markets) {
    for (const m of loc.markets) {
      marketBlock.push(
        `- ${m.question} | YES: ${Math.round(m.yesPrice * 100)}¢ | NO: ${Math.round(m.noPrice * 100)}¢ | Vol: ${m.volume} | ${loc.title}`
      );
    }
  }

  return `You are PolyClaw — an elite prediction market analyst. Your job is to analyze breaking news and live market data to identify trading alpha across all active prediction markets on Polymarket.

BREAKING NEWS (most recent):
${newsBlock}

ACTIVE PREDICTION MARKETS:
${marketBlock.join('\n')}

Analyze how news, current events, and broader context impact these markets:
- Identify which markets are affected and how
- Determine if news makes YES or NO more likely
- Compare current market price to your estimated fair value based on all available information
- Consider not just breaking news but also historical patterns, base rates, and structural factors
- Look for arbitrage between Kalshi and Polymarket if both cover similar events
- Flag any markets that look significantly mispriced for any reason

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "signals": [
    {
      "market": "exact market question text",
      "direction": "BUY_YES" or "BUY_NO" or "HOLD",
      "confidence": "HIGH" or "MEDIUM" or "LOW",
      "reasoning": "1-2 sentences explaining the edge — cite specific news, price levels, or logic",
      "relatedNews": "the specific news headline or context driving this signal",
      "region": "geographic region"
    }
  ],
  "summary": "2-3 sentence overview of the current landscape and top alpha opportunities. Mention the best trades and why."
}

Rules:
- Maximum 8 signals, only include clear actionable ones
- HIGH confidence = strong direct causal link or severe mispricing
- MEDIUM confidence = meaningful but indirect connection
- LOW confidence = speculative but worth monitoring
- If no clear signals exist, return empty signals array with a summary
- Be specific — cite exact news, prices, and your estimated fair value`;
}

// --- Commonstack API helper ---
async function callCommonstack(systemPrompt: string, userPrompt: string): Promise<string> {
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

  if (!res.ok) {
    throw new Error(`Commonstack API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Parse analysis JSON from raw text (strips markdown fences)
function parseAnalysisJson(text: string): { signals: any[]; summary: string } {
  const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(jsonStr);
  return { signals: parsed.signals || [], summary: parsed.summary || '' };
}

// Call Commonstack first; fall back to Gemini on failure/limit
async function callAnalysisAI(prompt: string): Promise<{ signals: any[]; summary: string } | null> {
  // Try Commonstack first
  if (COMMONSTACK_KEY) {
    try {
      const systemMsg = 'You are PolyClaw — an elite prediction market analyst. Return ONLY valid JSON with no markdown fences.';
      const text = await callCommonstack(systemMsg, prompt);
      const parsed = parseAnalysisJson(text);
      if (parsed.signals.length > 0 || parsed.summary) return parsed;
    } catch (err) {
      console.warn('Commonstack analysis failed, falling back to Gemini:', err);
    }
  }

  // Fallback to Gemini
  if (GEMINI_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      const text = response.text?.trim() || '';
      return parseAnalysisJson(text);
    } catch (err) {
      console.error('Gemini analysis failed:', err);
    }
  }

  return null;
}

export async function analyzeMarkets(
  news: NewsItem[],
  markets: MarketData[],
  forceRefresh = false
): Promise<AnalysisResult> {
  // Return cache if fresh
  if (!forceRefresh && cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
    return cachedResult;
  }

  if (!GEMINI_KEY && !COMMONSTACK_KEY) {
    return {
      signals: [],
      summary: 'No API keys configured. Add GEMINI_API_KEY or COMMONSTACK_API_KEY to .env.local to enable AI analysis.',
      timestamp: Date.now(),
    };
  }

  if (news.length === 0 && markets.length === 0) {
    return {
      signals: [],
      summary: 'Waiting for news and market data to load...',
      timestamp: Date.now(),
    };
  }

  if (!incrementUsage()) {
    return cachedResult || {
      signals: [],
      summary: 'Daily API limit reached. Analysis will resume tomorrow.',
      timestamp: Date.now(),
    };
  }

  const prompt = buildPrompt(news, markets);
  const parsed = await callAnalysisAI(prompt);

  if (!parsed || (parsed.signals.length === 0 && !parsed.summary)) {
    return cachedResult || {
      signals: [],
      summary: 'Analysis failed. Will retry on next request.',
      timestamp: Date.now(),
    };
  }

  const result: AnalysisResult = {
    signals: (parsed.signals || []).slice(0, 8).map((s: any) => {
      const match = matchSignalToMarket(s.market || '', markets);
      return {
        market: s.market || '',
        direction: ['BUY_YES', 'BUY_NO', 'HOLD'].includes(s.direction) ? s.direction : 'HOLD',
        confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(s.confidence) ? s.confidence : 'MEDIUM',
        reasoning: s.reasoning || '',
        relatedNews: s.relatedNews || '',
        region: s.region || 'Global',
        polymarketUrl: match.polymarketUrl,
        lat: match.lat,
        lng: match.lng,
      };
    }),
    summary: parsed.summary || 'Analysis complete.',
    timestamp: Date.now(),
  };

  cachedResult = result;
  return result;
}

export function hasGeminiKey(): boolean {
  return !!(GEMINI_KEY || COMMONSTACK_KEY);
}

// --- Chat with PolyClaw ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function buildChatSystemPrompt(): string {
  return `You are PolyClaw — an expert prediction market analyst and trading advisor. You have deep knowledge of prediction markets (Polymarket), geopolitics, economics, sports, crypto, and current events. You have access to real-time breaking news and live prediction market data.

You can answer ANY question the user asks about prediction markets. This includes but is not limited to:
- BUY/SELL/HOLD recommendations with confidence levels and reasoning
- Explaining how specific markets work, what drives their prices, and how they resolve
- Portfolio strategy — which markets to combine, how to hedge, risk management
- Market mechanics — liquidity, slippage, fees, settlement, outcome tokens
- Historical context and precedents that inform current market pricing
- Interpreting news impact on specific markets
- General geopolitical, economic, sports, or crypto analysis as it relates to tradeable markets
- Explaining prediction market concepts to beginners

When giving trading advice:
- Name the specific market(s)
- Recommend BUY YES, BUY NO, or HOLD with confidence (HIGH/MEDIUM/LOW)
- Cite the current price and explain why it's mispriced
- Reference specific news if relevant
- Suggest entry strategy and price levels to watch

When answering general questions, be informative and thorough.

Be direct, concise, and knowledgeable. Do NOT return JSON — respond in plain text with clear formatting.`;
}

function buildChatUserPrompt(query: string, news: NewsItem[], markets: MarketData[], history: ChatMessage[]): string {
  const newsBlock = news
    .slice(0, 30)
    .map(n => `- ${n.text} | ${n.region} | ${n.source}`)
    .join('\n');

  const marketBlock: string[] = [];
  for (const loc of markets) {
    for (const m of loc.markets) {
      marketBlock.push(
        `- ${m.question} | YES: ${Math.round(m.yesPrice * 100)}¢ | NO: ${Math.round(m.noPrice * 100)}¢ | Vol: ${m.volume} | ${loc.title}`
      );
    }
  }

  const historyBlock = history
    .map(m => `${m.role === 'user' ? 'USER' : 'ANALYST'}: ${m.content}`)
    .join('\n');

  return `BREAKING NEWS (most recent):
${newsBlock}

ACTIVE PREDICTION MARKETS:
${marketBlock.join('\n')}

${historyBlock ? `CONVERSATION HISTORY:\n${historyBlock}\n` : ''}USER: ${query}`;
}

// Legacy combined prompt for Gemini (which uses a single string)
function buildChatPrompt(query: string, news: NewsItem[], markets: MarketData[], history: ChatMessage[]): string {
  return `${buildChatSystemPrompt()}\n\n${buildChatUserPrompt(query, news, markets, history)}`;
}

export async function chatWithOsint(
  query: string,
  news: NewsItem[],
  markets: MarketData[],
  history: ChatMessage[]
): Promise<string> {
  if (!GEMINI_KEY && !COMMONSTACK_KEY) {
    return 'No API keys configured. Add GEMINI_API_KEY or COMMONSTACK_API_KEY to .env.local to enable chat.';
  }

  if (!incrementUsage()) {
    return 'Daily API limit reached. Chat will resume tomorrow.';
  }

  // Try Commonstack first
  if (COMMONSTACK_KEY) {
    try {
      const systemMsg = buildChatSystemPrompt();
      const userMsg = buildChatUserPrompt(query, news, markets, history);
      const response = await callCommonstack(systemMsg, userMsg);
      if (response) return response;
    } catch (err) {
      console.warn('Commonstack chat failed, falling back to Gemini:', err);
    }
  }

  // Fallback to Gemini
  if (GEMINI_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: buildChatPrompt(query, news, markets, history),
      });
      return response.text?.trim() || 'No response generated.';
    } catch (err) {
      console.error('Gemini chat failed:', err);
    }
  }

  throw new Error('Chat request failed. Please try again.');
}
