import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Loader2, Calendar, Clock, BarChart3, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { analyzeUpcomingEarnings, analyzeCustomTickers, getPolymarketEarningsTickers, EarningsAnalysis } from '../services/earningsService';

interface PolyEarnPageProps {
  onClose: () => void;
}

type ViewMode = 'calendar' | 'custom';

const WATCHLIST_KEY = 'polyearn_watchlist';

function loadWatchlist(): string[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveWatchlist(tickers: string[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
}

type FilterTab = 'this_week' | 'next_week' | 'all';

function getWeekRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    from: monday.toISOString().slice(0, 10),
    to: friday.toISOString().slice(0, 10),
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatHour(hour: string): string {
  switch (hour) {
    case 'bmo': return 'Before Market Open';
    case 'amc': return 'After Market Close';
    case 'dmh': return 'During Market Hours';
    default: return 'Time TBD';
  }
}

function formatMarketCap(mc?: number): string {
  if (!mc) return '';
  if (mc >= 1000) return `$${(mc / 1000).toFixed(1)}T`;
  if (mc >= 1) return `$${mc.toFixed(0)}B`;
  return `$${(mc * 1000).toFixed(0)}M`;
}

function PredictionBadge({ prediction, confidence }: { prediction: 'BEAT' | 'MISS' | 'MEET' | null; confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  if (!prediction) return null;

  const colors = {
    BEAT: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    MISS: 'bg-red-500/20 text-red-400 border-red-500/40',
    MEET: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  };

  const confColors = {
    HIGH: 'text-yellow-400',
    MEDIUM: 'text-gray-400',
    LOW: 'text-gray-600',
  };

  const Icon = prediction === 'BEAT' ? TrendingUp : prediction === 'MISS' ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded border text-xs font-mono flex items-center gap-1 ${colors[prediction]}`}>
        <Icon className="w-3 h-3" />
        {prediction}
      </span>
      {confidence && (
        <span className={`text-[10px] font-mono ${confColors[confidence]}`}>
          {confidence}
        </span>
      )}
    </div>
  );
}

function PolymarketBadge({ yesPct, volume, slug }: { yesPct: number; volume: number; slug: string }) {
  const formatVol = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v)}`;
  };

  return (
    <a
      href={`https://polymarket.com/event/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
    >
      <span className="text-[10px] font-mono text-blue-400/70 uppercase">Poly</span>
      <span className={`text-xs font-mono font-bold ${yesPct >= 50 ? 'text-blue-400' : 'text-red-400'}`}>
        {yesPct.toFixed(0)}%
      </span>
      <span className="text-[10px] font-mono text-gray-600">{formatVol(volume)}</span>
      <ExternalLink className="w-2.5 h-2.5 text-blue-400/50" />
    </a>
  );
}

function BeatRateBar({ beatRate, total }: { beatRate: number; total: number }) {
  if (total === 0) return <span className="text-gray-600 text-xs font-mono">No history</span>;
  const width = Math.max(2, Math.min(100, beatRate));

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            beatRate >= 70 ? 'bg-blue-500' : beatRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-12 text-right">{beatRate.toFixed(0)}%</span>
    </div>
  );
}

function EarningsCard({ analysis, onRemove }: { analysis: EarningsAnalysis; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-black/40 border border-blue-500/15 rounded-lg p-4 hover:border-blue-500/40 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {analysis.logo ? (
            <img
              src={analysis.logo}
              alt={analysis.symbol}
              className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-500">{analysis.symbol.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-400 font-mono">{analysis.symbol}</span>
              <span className="text-sm text-gray-300 truncate">{analysis.name !== analysis.symbol ? analysis.name : ''}</span>
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="text-gray-700 hover:text-red-400 transition-colors ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {analysis.date && (
                <span className="text-[10px] text-gray-500 font-mono">{formatDate(analysis.date)}</span>
              )}
              {analysis.industry && (
                <span className="text-[10px] text-gray-600 font-mono">{analysis.industry}</span>
              )}
              {analysis.marketCap && (
                <span className="text-[10px] text-gray-600 font-mono">{formatMarketCap(analysis.marketCap)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <PredictionBadge prediction={analysis.prediction} confidence={analysis.confidence} />
          {analysis.polymarket && (
            <PolymarketBadge
              yesPct={analysis.polymarket.yesPct}
              volume={analysis.polymarket.volume}
              slug={analysis.polymarket.slug}
            />
          )}
          {analysis.epsEstimate != null && (
            <span className="text-xs font-mono text-gray-500">
              Est: ${analysis.epsEstimate.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Beat Rate</span>
          <span className="text-[10px] font-mono text-gray-500">
            {analysis.beatCount}B / {analysis.missCount}M / {analysis.meetCount}E of {analysis.history.length}Q
          </span>
        </div>
        <BeatRateBar beatRate={analysis.beatRate} total={analysis.history.length} />
      </div>

      {analysis.avgSurprisePct !== 0 && analysis.history.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600">Avg Surprise:</span>
          <span className={`text-xs font-mono ${analysis.avgSurprisePct >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {analysis.avgSurprisePct >= 0 ? '+' : ''}{analysis.avgSurprisePct.toFixed(1)}%
          </span>
        </div>
      )}

      {analysis.polymarket && analysis.prediction && (
        <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded bg-gray-900/50 border border-gray-800">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider shrink-0">AI vs Market</span>
          <div className="flex items-center gap-2 flex-1">
            <span className={`text-xs font-mono font-bold ${analysis.prediction === 'BEAT' ? 'text-blue-400' : analysis.prediction === 'MISS' ? 'text-red-400' : 'text-gray-400'}`}>
              {analysis.prediction === 'BEAT' ? 'BEAT' : analysis.prediction === 'MISS' ? 'MISS' : 'MEET'}
            </span>
            <span className="text-[10px] text-gray-600">vs</span>
            <span className={`text-xs font-mono font-bold ${analysis.polymarket.yesPct >= 50 ? 'text-blue-400' : 'text-orange-400'}`}>
              {analysis.polymarket.yesPct.toFixed(0)}% beat
            </span>
            {(() => {
              const aiSaysBeat = analysis.prediction === 'BEAT';
              const marketSaysBeat = analysis.polymarket.yesPct >= 50;
              const aligned = aiSaysBeat === marketSaysBeat;
              return (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${aligned ? 'text-blue-400 bg-blue-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                  {aligned ? 'ALIGNED' : 'DIVERGENT'}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {analysis.reasoning && (
        <p className={`mt-2 text-xs text-gray-500 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {analysis.reasoning}
        </p>
      )}

      {expanded && analysis.history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-500/10">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2 block">
            Earnings History (Last {analysis.history.length} Quarters)
          </span>
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {analysis.history.map((q, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-600 w-24">{q.period}</span>
                <span className="text-gray-400 w-16 text-right">A: {q.actual.toFixed(2)}</span>
                <span className="text-gray-500 w-16 text-right">E: {q.estimate.toFixed(2)}</span>
                <span className={`w-20 text-right ${q.surprise > 0.005 ? 'text-blue-400' : q.surprise < -0.005 ? 'text-red-400' : 'text-gray-500'}`}>
                  {q.surprise >= 0 ? '+' : ''}{q.surprise.toFixed(2)} ({q.surprisePct >= 0 ? '+' : ''}{q.surprisePct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-black/40 border border-blue-500/10 rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-800" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-gray-800 rounded mb-2" />
              <div className="h-3 w-40 bg-gray-800/60 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-800 rounded" />
          </div>
          <div className="mt-3 h-2 bg-gray-800 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function PolyEarnPage({ onClose }: PolyEarnPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('custom');
  const [earnings, setEarnings] = useState<EarningsAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('this_week');

  // Custom ticker input
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data when mode or watchlist changes
  useEffect(() => {
    let mounted = true;

    if (viewMode === 'calendar') {
      setLoading(true);
      analyzeUpcomingEarnings().then(data => {
        if (mounted) { setEarnings(data); setLoading(false); }
      }).catch(() => { if (mounted) setLoading(false); });
    } else if (viewMode === 'custom' && watchlist.length > 0) {
      setLoading(true);
      analyzeCustomTickers(watchlist).then(data => {
        if (mounted) { setEarnings(data); setLoading(false); }
      }).catch(() => { if (mounted) setLoading(false); });
    } else {
      setEarnings([]);
    }

    return () => { mounted = false; };
  }, [viewMode, watchlist]);

  const addTicker = (raw: string) => {
    // Support comma/space separated input
    const tickers = raw.toUpperCase().split(/[\s,]+/).filter(t => /^[A-Z]{1,5}$/.test(t));
    if (tickers.length === 0) return;
    const updated = [...new Set([...watchlist, ...tickers])];
    setWatchlist(updated);
    saveWatchlist(updated);
    setInputValue('');
  };

  const removeTicker = (symbol: string) => {
    const updated = watchlist.filter(t => t !== symbol);
    setWatchlist(updated);
    saveWatchlist(updated);
    setEarnings(prev => prev.filter(e => e.symbol !== symbol));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      addTicker(inputValue.trim());
    }
  };

  // Calendar mode filtering
  const thisWeek = getWeekRange(0);
  const nextWeek = getWeekRange(1);

  const displayed = viewMode === 'calendar'
    ? earnings.filter(e => {
        if (filter === 'this_week') return e.date >= thisWeek.from && e.date <= thisWeek.to;
        if (filter === 'next_week') return e.date >= nextWeek.from && e.date <= nextWeek.to;
        return true;
      })
    : earnings;

  // Group by date for calendar mode
  const grouped = new Map<string, EarningsAnalysis[]>();
  for (const e of displayed) {
    const key = e.date || 'unknown';
    const existing = grouped.get(key) || [];
    existing.push(e);
    grouped.set(key, existing);
  }
  const sortedDates = [...grouped.keys()].sort();

  const beatCount = displayed.filter(e => e.prediction === 'BEAT').length;
  const missCount = displayed.filter(e => e.prediction === 'MISS').length;
  const polyCount = displayed.filter(e => e.polymarket).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-[#0a0a0a] border border-blue-500/30 rounded-xl shadow-[0_0_40px_rgba(0,255,0,0.1)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-blue-500/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-2xl font-bold text-white tracking-tight">PolyEarn</h2>
            </div>
            <p className="text-gray-500 text-sm font-mono">AI predictions + Polymarket odds</p>
            <p className="text-gray-600 text-[10px] font-mono mt-1">powered by <span className="text-gray-500">commonstack ai</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-blue-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mode toggle + controls */}
        <div className="p-6 pb-0 space-y-3">
          {/* View mode toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('custom')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  viewMode === 'custom'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-blue-500/30 hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  Custom
                </span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  viewMode === 'calendar'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-blue-500/30 hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Calendar
                </span>
              </button>
            </div>

            {!loading && displayed.length > 0 && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-gray-500">{displayed.length} companies</span>
                {beatCount > 0 && <span className="text-blue-400">{beatCount} beats</span>}
                {missCount > 0 && <span className="text-red-400">{missCount} misses</span>}
                {polyCount > 0 && <span className="text-blue-400">{polyCount} on Poly</span>}
              </div>
            )}
          </div>

          {/* Custom ticker input */}
          {viewMode === 'custom' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter tickers (e.g. COST, AVGO, BBWI)"
                    className="w-full px-4 py-2 bg-black/60 border border-blue-500/20 rounded-lg text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <button
                  onClick={() => inputValue.trim() && addTicker(inputValue.trim())}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-sm font-mono hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
                <button
                  onClick={async () => {
                    const tickers = await getPolymarketEarningsTickers();
                    if (tickers.length > 0) {
                      const updated = [...new Set([...watchlist, ...tickers])];
                      setWatchlist(updated);
                      saveWatchlist(updated);
                    }
                  }}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-sm font-mono hover:bg-blue-500/30 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Polymarket
                </button>
              </div>

              {/* Ticker chips */}
              {watchlist.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {watchlist.map(ticker => (
                    <span
                      key={ticker}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs font-mono text-blue-400"
                    >
                      {ticker}
                      <button
                        onClick={() => removeTicker(ticker)}
                        className="text-blue-500/50 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {watchlist.length > 1 && (
                    <button
                      onClick={() => { setWatchlist([]); saveWatchlist([]); setEarnings([]); }}
                      className="text-[10px] font-mono text-gray-600 hover:text-red-400 transition-colors px-2"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Calendar filter tabs */}
          {viewMode === 'calendar' && (
            <div className="flex gap-2">
              {([
                { key: 'this_week', label: 'This Week' },
                { key: 'next_week', label: 'Next Week' },
                { key: 'all', label: 'All Upcoming' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    filter === tab.key
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-blue-500/30 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-blue-400/70 font-mono text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {viewMode === 'custom' ? 'Analyzing tickers...' : 'Loading earnings data & AI predictions...'}
              </div>
              <LoadingSkeleton />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              {viewMode === 'custom' ? (
                <>
                  <Search className="w-8 h-8 text-gray-700" />
                  <p className="text-gray-500 font-mono text-sm">Add tickers above to get started.</p>
                  <p className="text-gray-600 text-xs font-mono">e.g. COST, AVGO, BBWI, GPRO, VSCO</p>
                </>
              ) : (
                <>
                  <Calendar className="w-8 h-8 text-gray-700" />
                  <p className="text-gray-500 font-mono text-sm">No upcoming earnings found for this period.</p>
                  <p className="text-gray-600 text-xs font-mono">Try selecting a different time range.</p>
                </>
              )}
            </div>
          ) : viewMode === 'custom' ? (
            // Custom mode: flat grid
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {displayed.map(analysis => (
                <EarningsCard
                  key={analysis.symbol}
                  analysis={analysis}
                  onRemove={() => removeTicker(analysis.symbol)}
                />
              ))}
            </div>
          ) : (
            // Calendar mode: grouped by date
            <div className="space-y-6">
              {sortedDates.map(date => {
                const dayEarnings = grouped.get(date)!;
                const hourOrder = { bmo: 0, dmh: 1, amc: 2, '': 3 };
                dayEarnings.sort((a, b) => (hourOrder[a.hour as keyof typeof hourOrder] ?? 3) - (hourOrder[b.hour as keyof typeof hourOrder] ?? 3));

                const hourGroups = new Map<string, EarningsAnalysis[]>();
                for (const e of dayEarnings) {
                  const h = e.hour || 'tbd';
                  const existing = hourGroups.get(h) || [];
                  existing.push(e);
                  hourGroups.set(h, existing);
                }

                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-blue-500/60" />
                      <h3 className="text-sm font-bold text-white font-mono">
                        {date !== 'unknown' ? formatDate(date) : 'Date TBD'}
                      </h3>
                      <span className="text-[10px] text-gray-600 font-mono">{dayEarnings.length} companies</span>
                    </div>

                    {[...hourGroups.entries()].map(([hour, items]) => (
                      <div key={hour} className="mb-4">
                        <div className="flex items-center gap-2 mb-2 ml-6">
                          <Clock className="w-3 h-3 text-gray-600" />
                          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                            {formatHour(hour === 'tbd' ? '' : hour)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 ml-6">
                          {items.map(analysis => (
                            <EarningsCard key={analysis.symbol} analysis={analysis} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
