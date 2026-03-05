import React from 'react';
import { X, TrendingUp, ExternalLink } from 'lucide-react';
import { MarketData } from '../data/mockData';

interface MarketPanelProps {
  market: MarketData;
  onClose: () => void;
  onTrade?: (m: { question: string; yesMint: string; noMint: string; yesPrice: number; noPrice: number }) => void;
}

export default function MarketPanel({ market, onClose, onTrade }: MarketPanelProps) {
  const isKalshi = market.id.startsWith('kalshi-');
  const accentColor = isKalshi ? 'green' : 'blue';
  const borderClass = isKalshi ? 'border-blue-500/30' : 'border-blue-500/30';
  const shadowClass = isKalshi ? 'shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'shadow-[0_0_30px_rgba(59,130,246,0.1)]';

  return (
    <div className={`fixed inset-0 z-30 md:absolute md:inset-auto md:right-6 md:top-24 md:bottom-24 w-full md:w-96 bg-black/80 border ${borderClass} backdrop-blur-xl md:rounded-xl p-6 flex flex-col pointer-events-auto overflow-hidden ${shadowClass}`}>
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-blue-400 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs font-mono rounded border ${isKalshi ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
              {isKalshi ? 'KALSHI' : 'POLYMARKET'}
            </span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500/70 text-xs font-mono rounded">
              LIVE
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{market.title}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{market.news}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-blue-400 font-mono text-sm uppercase tracking-wider border-b border-blue-500/20 pb-2">
            Active Markets
          </h3>
          
          {market.markets.map((m, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (isKalshi && m.yesMint && onTrade) {
                  onTrade({ question: m.question, yesMint: m.yesMint, noMint: m.noMint || '', yesPrice: m.yesPrice, noPrice: m.noPrice });
                } else if (m.polymarketUrl) {
                  window.open(m.polymarketUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              className={`bg-black/40 border rounded-lg p-4 transition-colors group cursor-pointer ${
                isKalshi ? 'border-blue-500/20 hover:border-blue-500/40' : 'border-blue-500/20 hover:border-blue-500/40'
              }`}
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <h4 className="text-gray-200 text-sm font-medium leading-snug group-hover:text-blue-400 transition-colors">
                  {m.question}
                </h4>
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 bg-blue-500/10 border border-blue-500/30 rounded px-3 py-2 flex flex-col items-center justify-center relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-blue-500/20 transition-all duration-500"
                      style={{ height: `${m.yesPrice * 100}%` }}
                    />
                    <span className="text-blue-400 text-xs font-mono mb-1 relative z-10">YES</span>
                    <span className="text-white font-bold relative z-10">{Math.round(m.yesPrice * 100)}¢</span>
                  </div>
                  <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 flex flex-col items-center justify-center relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-red-500/20 transition-all duration-500"
                      style={{ height: `${m.noPrice * 100}%` }}
                    />
                    <span className="text-red-400 text-xs font-mono mb-1 relative z-10">NO</span>
                    <span className="text-white font-bold relative z-10">{Math.round(m.noPrice * 100)}¢</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-xs font-mono mb-1">Vol</div>
                  <div className="text-gray-300 font-mono text-sm">{m.volume}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className={`pt-4 mt-4 border-t ${isKalshi ? 'border-blue-500/20' : 'border-blue-500/20'}`}>
        <button
          onClick={() => {
            if (isKalshi && onTrade) {
              const m = market.markets.find(m => m.yesMint);
              if (m) {
                onTrade({ question: m.question, yesMint: m.yesMint!, noMint: m.noMint || '', yesPrice: m.yesPrice, noPrice: m.noPrice });
              }
            } else {
              const url = market.markets.find(m => m.polymarketUrl)?.polymarketUrl;
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            }
          }}
          className={`w-full py-3 rounded-lg font-mono text-sm transition-colors flex items-center justify-center gap-2 ${
            isKalshi
              ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400'
              : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {isKalshi ? 'Trade on DFlow (Solana)' : 'Trade on Polymarket'}
        </button>
      </div>
    </div>
  );
}
