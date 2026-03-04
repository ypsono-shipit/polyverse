/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import GlobeView from './components/GlobeView';
import FlatMapView from './components/FlatMapView';
import TopBar from './components/TopBar';
import BottomOverlay from './components/BottomOverlay';
import MarketPanel from './components/MarketPanel';
import LiveNewsFeed from './components/LiveNewsFeed';
import EcosystemModal from './components/EcosystemModal';
import AdminModal from './components/AdminModal';
import OsintPanel, { OsintAlert } from './components/OsintPanel';
import TradeModal, { TradeMarket } from './components/TradeModal';
import PolyEarnPage from './components/PolyEarnPage';
import { MarketData } from './data/mockData';
import { fetchPolymarkets } from './services/polymarketService';
import { fetchKalshiMarkets } from './services/kalshiService';

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export default function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'flat'>('globe');
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [ecosystemKey, setEcosystemKey] = useState(0);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isOsintOpen, setIsOsintOpen] = useState(false);
  const [osintAlerts, setOsintAlerts] = useState<OsintAlert[]>([]);
  const [tradeMarket, setTradeMarket] = useState<TradeMarket | null>(null);
  const [isPolyEarnOpen, setIsPolyEarnOpen] = useState(false);

  const handleOpenOsint = () => {
    setIsOsintOpen(true);
    setSelectedMarket(null);
  };

  const handleSelectMarket = (market: MarketData) => {
    setSelectedMarket(market);
    setIsOsintOpen(false);
  };

  const handleRefreshMarkets = useCallback(async () => {
    const [poly, kalshi] = await Promise.all([fetchPolymarkets(true), fetchKalshiMarkets(true)]);
    const merged = [...poly, ...kalshi];
    setMarketData(merged);
    return merged;
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [poly, kalshi] = await Promise.all([fetchPolymarkets(), fetchKalshiMarkets()]);
      if (mounted) setMarketData([...poly, ...kalshi]);
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handleTrade = useCallback((m: TradeMarket) => {
    setTradeMarket(m);
    setSelectedMarket(null);
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white">
          {viewMode === 'globe' ? (
            <GlobeView data={marketData} onMarkerClick={handleSelectMarket} osintAlerts={osintAlerts} />
          ) : (
            <FlatMapView data={marketData} onMarkerClick={handleSelectMarket} osintAlerts={osintAlerts} />
          )}

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] opacity-60" />

          <TopBar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenEcosystem={() => setIsEcosystemOpen(true)}
            onOpenPolyEarn={() => setIsPolyEarnOpen(true)}
            onOpenOsint={handleOpenOsint}
            isOsintOpen={isOsintOpen}
            marketData={marketData}
            onSelectMarket={handleSelectMarket}
          />
          <LiveNewsFeed />

          {selectedMarket && (
            <MarketPanel
              market={selectedMarket}
              onClose={() => setSelectedMarket(null)}
              onTrade={handleTrade}
            />
          )}

          {tradeMarket && (
            <TradeModal market={tradeMarket} onClose={() => setTradeMarket(null)} />
          )}

          {isOsintOpen && (
            <OsintPanel
              marketData={marketData}
              onClose={() => setIsOsintOpen(false)}
              onAlerts={setOsintAlerts}
              onRefreshMarkets={handleRefreshMarkets}
            />
          )}

          {isEcosystemOpen && (
            <EcosystemModal
              key={ecosystemKey}
              onClose={() => setIsEcosystemOpen(false)}
              onOpenAdmin={() => setIsAdminOpen(true)}
            />
          )}

          {isPolyEarnOpen && (
            <PolyEarnPage onClose={() => setIsPolyEarnOpen(false)} />
          )}

          {isAdminOpen && (
            <AdminModal onClose={() => { setIsAdminOpen(false); setEcosystemKey(k => k + 1); }} />
          )}

          <BottomOverlay />
        </div>
      </WalletProvider>
    </ConnectionProvider>
  );
}
