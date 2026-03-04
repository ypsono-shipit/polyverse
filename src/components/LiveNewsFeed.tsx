import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Filter, ExternalLink } from 'lucide-react';
import { fetchNews, NewsItem as ServiceNewsItem, hasApiKeys } from '../services/newsService';

const REGIONS = ["All", "Global", "North America", "Europe", "Asia", "Middle East", "South America"];

interface DisplayItem {
  id: number;
  text: string;
  time: string;
  region: string;
  source: string;
  url: string;
}

export default function LiveNewsFeed() {
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const newsPool = useRef<ServiceNewsItem[]>([]);
  const poolIndex = useRef(0);
  const idCounter = useRef(0);

  // Fetch news on mount and refresh periodically
  useEffect(() => {
    const loadNews = async () => {
      const items = await fetchNews();
      newsPool.current = items;
      poolIndex.current = 0;
    };

    loadNews();
    const refreshInterval = setInterval(loadNews, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(refreshInterval);
  }, []);

  // Display cycle — show next item every 6 seconds
  useEffect(() => {
    const addNext = () => {
      if (newsPool.current.length === 0) return;

      const filtered = selectedRegion === "All"
        ? newsPool.current
        : newsPool.current.filter(n => n.region === selectedRegion || n.region === "Global");

      if (filtered.length === 0) return;

      const item = filtered[poolIndex.current % filtered.length];
      poolIndex.current++;

      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      setDisplayItems(prev => {
        const newItem: DisplayItem = {
          id: idCounter.current++,
          text: item.text,
          time: timeString,
          region: item.region,
          source: item.source,
          url: item.url,
        };
        return [newItem, ...prev].slice(0, 5);
      });
    };

    addNext();
    const interval = setInterval(addNext, 6000);
    return () => clearInterval(interval);
  }, [selectedRegion]);

  return (
    <div className="absolute left-6 top-24 bottom-24 w-80 pointer-events-none flex flex-col z-10">
      <div className="flex items-center justify-between mb-4 px-2 pointer-events-auto shrink-0">
        <div className="flex items-center gap-2 text-blue-400 font-mono text-sm">
          <Zap className="w-4 h-4 animate-pulse" />
          LIVE FEED
          {hasApiKeys() && (
            <span className="text-[9px] text-blue-500/50 font-mono">API</span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 text-xs font-mono bg-black/60 px-3 py-1.5 rounded border border-blue-500/30 transition-colors backdrop-blur-md"
          >
            <Filter className="w-4 h-4" />
            {selectedRegion}
          </button>

          {isFilterOpen && (
            <div className="absolute top-full mt-2 right-0 bg-black/90 border border-blue-500/30 rounded-lg p-1 w-40 backdrop-blur-md shadow-xl z-50">
              {REGIONS.map(region => (
                <button
                  key={region}
                  onClick={() => {
                    setSelectedRegion(region);
                    setIsFilterOpen(false);
                    setDisplayItems([]);
                    poolIndex.current = 0;
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-mono rounded transition-colors ${
                    selectedRegion === region
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-end gap-3 flex-1 overflow-hidden pb-2">
        <AnimatePresence mode="popLayout">
          {displayItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-black/60 border border-blue-500/30 backdrop-blur-md rounded-lg p-3 pointer-events-auto shadow-[0_0_15px_rgba(59,130,246,0.05)] shrink-0"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <div className="text-blue-500/70 text-xs font-mono">{item.time}</div>
                  {item.source && item.source !== 'Mock' && (
                    <div className="text-[9px] font-mono text-gray-500 truncate max-w-[100px]">{item.source}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
                    {item.region}
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-400 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="text-gray-200 text-sm leading-snug">{item.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
