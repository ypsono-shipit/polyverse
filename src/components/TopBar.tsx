import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe2, Map, Zap, Activity, Layers, TrendingUp, ExternalLink } from 'lucide-react';
import { MarketData } from '../data/mockData';

interface SearchResult {
  question: string;
  yesPrice: number;
  volume: string;
  polymarketUrl?: string;
  market: MarketData;
}

interface TopBarProps {
  viewMode: 'globe' | 'flat';
  onViewModeChange: (mode: 'globe' | 'flat') => void;
  onOpenEcosystem: () => void;
  onOpenPolyEarn: () => void;
  onOpenOsint: () => void;
  isOsintOpen: boolean;
  marketData: MarketData[];
  onSelectMarket: (market: MarketData) => void;
}

export default function TopBar({ viewMode, onViewModeChange, onOpenEcosystem, onOpenPolyEarn, onOpenOsint, isOsintOpen, marketData, onSelectMarket }: TopBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const lower = value.toLowerCase();
    const matched: SearchResult[] = [];

    for (const loc of marketData) {
      for (const m of loc.markets) {
        if (m.question.toLowerCase().includes(lower) || loc.title.toLowerCase().includes(lower)) {
          matched.push({
            question: m.question,
            yesPrice: m.yesPrice,
            volume: m.volume,
            polymarketUrl: m.polymarketUrl,
            market: loc,
          });
        }
      }
    }

    setResults(matched.slice(0, 10));
    setIsOpen(matched.length > 0);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/60 border border-blue-500/30 backdrop-blur-md px-4 py-2 rounded-lg text-blue-400 font-mono font-bold text-xl tracking-wider">
          <Globe2 className="w-6 h-6" />
          POLYVERSE
        </div>

        <div className="flex items-center bg-black/60 border border-blue-500/30 backdrop-blur-md rounded-lg overflow-hidden p-1">
          <button
            onClick={() => onViewModeChange('globe')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'globe' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
          >
            <Globe2 className="w-4 h-4" /> Globe
          </button>
          <button
            onClick={() => onViewModeChange('flat')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'flat' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
          >
            <Map className="w-4 h-4" /> Flat
          </button>
        </div>

        <div className="flex items-center bg-black/60 border border-blue-500/30 backdrop-blur-md rounded-lg overflow-hidden p-1 gap-1">
          <button className="px-4 py-1.5 border border-blue-500/50 text-blue-400 rounded-md text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" /> Breaking
          </button>
          <button
            onClick={onOpenOsint}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${isOsintOpen ? 'border border-blue-500/50 text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-blue-400'}`}
          >
            <Activity className="w-4 h-4" /> PolyClaw
          </button>
        </div>

        <div className="flex items-center bg-black/60 border border-blue-500/30 backdrop-blur-md rounded-lg px-2 py-1 gap-1">
          <button
            onClick={onOpenEcosystem}
            className="text-gray-300 hover:text-blue-400 hover:bg-blue-500/10 px-3 py-1.5 rounded text-sm font-mono flex items-center gap-2 transition-colors"
          >
            <Layers className="w-4 h-4"/> Ecosystem
          </button>
          <button
            onClick={onOpenPolyEarn}
            className="text-gray-300 hover:text-blue-400 hover:bg-blue-500/10 px-3 py-1.5 rounded text-sm font-mono flex items-center gap-2 transition-colors"
          >
            <TrendingUp className="w-4 h-4"/> PolyEarn
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="relative" ref={wrapperRef}>
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50 z-10" />
          <input
            type="text"
            placeholder="Search markets..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            className="bg-black/60 border border-blue-500/30 backdrop-blur-md rounded-lg pl-10 pr-4 py-2 text-sm text-blue-50 focus:outline-none focus:border-blue-500 w-64 placeholder:text-blue-500/30 transition-colors"
          />

          {isOpen && results.length > 0 && (
            <div className="absolute top-full mt-2 right-0 w-96 max-h-80 overflow-y-auto bg-black/95 border border-blue-500/30 rounded-lg backdrop-blur-xl shadow-2xl z-50">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelectMarket(r.market);
                    setIsOpen(false);
                    setQuery('');
                    setResults([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-blue-500/10 border-b border-blue-500/10 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 leading-snug truncate">{r.question}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono text-blue-400">YES {Math.round(r.yesPrice * 100)}¢</span>
                        <span className="text-xs font-mono text-gray-500">{r.volume}</span>
                        <span className="text-[10px] font-mono text-gray-600">{r.market.title}</span>
                      </div>
                    </div>
                    {r.polymarketUrl && (
                      <ExternalLink
                        className="w-3.5 h-3.5 text-gray-600 hover:text-blue-400 shrink-0 mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(r.polymarketUrl, '_blank', 'noopener,noreferrer');
                        }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
