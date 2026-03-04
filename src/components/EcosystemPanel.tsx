import React, { useState } from 'react';
import { X, ExternalLink, Layers } from 'lucide-react';

const ECOSYSTEM_APPS = [
  { id: 1, name: "Polymarket", category: "Exchange", platform: "Polymarket", desc: "The world's largest prediction market. Trade on the world's most highly-debated topics.", url: "#", token: "TBA", tokenUrl: "#" },
  { id: 2, name: "Kalshi", category: "Exchange", platform: "Kalshi", desc: "Regulated financial exchange for events. Trade on economics, politics, and more.", url: "#", token: "None", tokenUrl: "#" },
  { id: 3, name: "Polywhale", category: "Analytics", platform: "Polymarket", desc: "Track large trades, whale wallets, and market movements in real-time.", url: "#", token: "$WHALE", tokenUrl: "#" },
  { id: 4, name: "Kalshi Terminal", category: "Trading Tool", platform: "Kalshi", desc: "Advanced trading interface and API wrapper for Kalshi power users.", url: "#", token: "$KTERM", tokenUrl: "#" },
  { id: 5, name: "ElectionBettingOdds", category: "Aggregator", platform: "Both", desc: "Aggregates odds from various prediction markets to provide a consensus view.", url: "#", token: "None", tokenUrl: "#" },
  { id: 6, name: "Polymarket News", category: "News", platform: "Polymarket", desc: "Latest news, insights, and analysis directly from the Polymarket community.", url: "#", token: "$PMN", tokenUrl: "#" },
  { id: 7, name: "dFlow", category: "Infrastructure", platform: "Both", desc: "Decentralized order flow marketplace powering next-gen prediction markets.", url: "#", token: "$DFLOW", tokenUrl: "#" },
  { id: 8, name: "MarketMaker Bot", category: "Automation", platform: "Both", desc: "Open-source automated market making bot for prediction markets.", url: "#", token: "$MMB", tokenUrl: "#" },
];

interface EcosystemPanelProps {
  onClose: () => void;
}

export default function EcosystemPanel({ onClose }: EcosystemPanelProps) {
  const [filter, setFilter] = useState('All');

  const filteredApps = filter === 'All' 
    ? ECOSYSTEM_APPS 
    : ECOSYSTEM_APPS.filter(app => app.platform === filter || app.platform === 'Both');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm">
      <div className="w-[600px] max-h-[80vh] bg-black/90 border border-blue-500/30 rounded-xl p-6 flex flex-col shadow-[0_0_30px_rgba(59,130,246,0.15)]">
        <div className="flex justify-between items-center mb-6 border-b border-blue-500/20 pb-4">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Ecosystem Projects</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-blue-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {['All', 'Polymarket', 'Kalshi'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-mono transition-colors ${
                filter === f 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                  : 'bg-black/40 text-gray-400 border border-blue-500/20 hover:text-blue-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {filteredApps.map(app => (
            <div key={app.id} className="bg-black/40 border border-blue-500/20 rounded-lg p-4 hover:border-blue-500/40 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-200 group-hover:text-blue-400 transition-colors">{app.name}</h3>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
                      {app.platform}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
                      {app.category}
                    </span>
                    {app.token !== 'None' && (
                      <a href={app.tokenUrl} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400/70 border border-yellow-500/20 hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors flex items-center gap-1">
                        Token: {app.token} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                <a href={app.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
              <p className="text-gray-400 text-sm mt-3 leading-relaxed">{app.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
