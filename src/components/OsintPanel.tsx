import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, RefreshCw, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle, Info, ExternalLink, Send, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeMarkets, AnalysisResult, TradingSignal, ChatMessage, chatWithOsint, hasGeminiKey } from '../services/geminiService';
import { fetchNews, NewsItem } from '../services/newsService';
import { MarketData } from '../data/mockData';

export interface OsintAlert {
  lat: number;
  lng: number;
  size: number;
  direction: 'BUY_YES' | 'BUY_NO' | 'HOLD';
}

interface OsintPanelProps {
  marketData: MarketData[];
  onClose: () => void;
  onAlerts: (alerts: OsintAlert[]) => void;
  onRefreshMarkets: () => Promise<MarketData[]>;
}

const directionConfig = {
  BUY_YES: { label: 'BUY YES', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  BUY_NO: { label: 'BUY NO', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  HOLD: { label: 'HOLD', icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
};

const confidenceConfig = {
  HIGH: { label: 'HIGH', icon: Shield, color: 'text-blue-400' },
  MEDIUM: { label: 'MED', icon: AlertTriangle, color: 'text-yellow-400' },
  LOW: { label: 'LOW', icon: Info, color: 'text-gray-400' },
};

function SignalCard({ signal }: { signal: TradingSignal }) {
  const dir = directionConfig[signal.direction];
  const conf = confidenceConfig[signal.confidence];
  const DirIcon = dir.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => { if (signal.polymarketUrl) window.open(signal.polymarketUrl, '_blank', 'noopener,noreferrer'); }}
      className={`bg-black/40 border ${dir.border} rounded-lg p-4 ${signal.polymarketUrl ? 'cursor-pointer hover:border-blue-500/50' : ''} transition-colors group`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${dir.bg} ${dir.color} text-xs font-mono font-bold`}>
          <DirIcon className="w-3 h-3" />
          {dir.label}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${conf.color}`}>{conf.label}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
            {signal.region}
          </span>
          {signal.polymarketUrl && (
            <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-blue-400" />
          )}
        </div>
      </div>

      <h4 className="text-gray-200 text-sm font-medium leading-snug mb-2 group-hover:text-blue-400 transition-colors">{signal.market}</h4>
      <p className="text-gray-400 text-xs leading-relaxed mb-2">{signal.reasoning}</p>

      <div className="flex items-start gap-1.5 text-[10px] text-gray-500 font-mono">
        <Activity className="w-3 h-3 shrink-0 mt-0.5" />
        <span className="leading-snug">{signal.relatedNews}</span>
      </div>
    </motion.div>
  );
}

export default function OsintPanel({ marketData, onClose, onAlerts, onRefreshMarkets }: OsintPanelProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const latestNewsRef = useRef<NewsItem[]>([]);

  const runAnalysis = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      // When force-refreshing, fetch fresh markets + news first
      const freshMarkets = force ? await onRefreshMarkets() : marketData;
      const news = await fetchNews();
      latestNewsRef.current = news;
      const analysis = await analyzeMarkets(news, freshMarkets, force);
      setResult(analysis);

      // Emit alert locations for globe pings
      const alerts: OsintAlert[] = analysis.signals
        .filter(s => s.lat !== undefined && s.lng !== undefined)
        .map(s => ({
          lat: s.lat!,
          lng: s.lng!,
          size: s.confidence === 'HIGH' ? 3 : s.confidence === 'MEDIUM' ? 2 : 1.5,
          direction: s.direction,
        }));
      onAlerts(alerts);
    } catch (err) {
      setError('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    const query = chatInput.trim();
    if (!query || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: query, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const news = latestNewsRef.current.length > 0 ? latestNewsRef.current : await fetchNews();
      const response = await chatWithOsint(query, news, marketData, [...chatMessages, userMsg]);
      const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Request failed. Please try again.', timestamp: Date.now() };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    runAnalysis();
  }, []);

  const timeString = result
    ? new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="fixed inset-0 z-30 md:absolute md:inset-auto md:right-6 md:top-24 md:bottom-24 w-full md:w-96 bg-black/80 border border-blue-500/30 backdrop-blur-xl md:rounded-xl p-6 flex flex-col pointer-events-auto overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.1)]">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-blue-400 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-mono rounded border border-blue-500/30 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              PolyClaw
            </span>
            {result && (
              <span className="text-[10px] font-mono text-gray-500">
                {timeString}
              </span>
            )}
            {!hasGeminiKey() && (
              <span className="text-[10px] font-mono text-red-400">NO API KEY</span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">AI Analysis</h2>
          <p className="text-gray-500 text-xs font-mono">News-driven prediction market alpha</p>
          <p className="text-gray-600 text-[10px] font-mono mt-1">powered by <span className="text-gray-500">commonstack ai</span></p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-blue-500/30 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-blue-400 font-mono text-sm animate-pulse">
              Analyzing markets...
            </div>
            <div className="text-gray-600 font-mono text-[10px] text-center">
              Cross-referencing news with active positions
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Summary */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
              <h3 className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-2">
                Market Intelligence
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
            </div>

            {/* Signals */}
            {result.signals.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-blue-400 font-mono text-sm uppercase tracking-wider border-b border-blue-500/20 pb-2">
                  Trading Signals ({result.signals.length})
                </h3>
                <AnimatePresence>
                  {result.signals.map((signal, idx) => (
                    <SignalCard key={idx} signal={signal} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 font-mono text-sm">No actionable signals detected</p>
                <p className="text-gray-600 font-mono text-[10px] mt-1">Markets appear fairly priced given current news</p>
              </div>
            )}
          </>
        )}

        {/* Chat section */}
        {result && !loading && (
          <div className="mt-6 pt-4 border-t border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-blue-400 font-mono text-sm uppercase tracking-wider">Ask PolyClaw</h3>
            </div>

            {chatMessages.length === 0 && !chatLoading && (
              <p className="text-gray-600 text-xs font-mono mb-3">Ask about specific markets, trading strategies, or current events...</p>
            )}

            {/* Message thread */}
            {chatMessages.length > 0 && (
              <div className="space-y-3 mb-3">
                {chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={msg.role === 'user' ? 'flex justify-end' : ''}
                  >
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                        : 'bg-black/60 border border-gray-700/50 text-gray-300'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-blue-500/50' : 'text-gray-600'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {chatLoading && (
                  <div className="bg-black/60 border border-gray-700/50 rounded-lg px-3 py-2 max-w-[85%]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat input + Refresh */}
      <div className="pt-4 mt-4 border-t border-blue-500/20 space-y-2">
        {result && !loading && (
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask about a market..."
              disabled={chatLoading}
              className="flex-1 bg-black/60 border border-blue-500/30 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500/60 disabled:opacity-50"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
        <button
          onClick={() => runAnalysis(true)}
          disabled={loading}
          className="w-full py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg font-mono text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>
    </div>
  );
}
