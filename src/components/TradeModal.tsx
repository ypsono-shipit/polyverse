import React, { useState, useCallback, useEffect } from 'react';
import { X, Loader2, ExternalLink, Wallet } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletName } from '@solana/wallet-adapter-base';
import { VersionedTransaction } from '@solana/web3.js';
import { createBuyOrder, waitForOrderCompletion, type OrderResponse } from '../services/dflowTradingService';

export interface TradeMarket {
  question: string;
  yesMint: string;
  noMint: string;
  yesPrice: number;
  noPrice: number;
}

interface TradeModalProps {
  market: TradeMarket;
  onClose: () => void;
}

type TradeState = 'idle' | 'submitting' | 'signing' | 'monitoring' | 'filled' | 'error';

export default function TradeModal({ market, onClose }: TradeModalProps) {
  const { publicKey, signTransaction, connected, connect, select, wallets, wallet } = useWallet();
  const { connection } = useConnection();

  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('10');
  const [state, setState] = useState<TradeState>('idle');
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [orderResult, setOrderResult] = useState<OrderResponse | null>(null);
  const [connecting, setConnecting] = useState(false);

  const outcomeMint = side === 'yes' ? market.yesMint : market.noMint;
  const currentPrice = side === 'yes' ? market.yesPrice : market.noPrice;
  const usdcAmount = parseFloat(amount) || 0;
  const estTokens = currentPrice > 0 ? usdcAmount / currentPrice : 0;

  const handleTrade = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }
    if (!outcomeMint) {
      setError('No mint address available for this market');
      return;
    }
    if (usdcAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setError('');
    setState('submitting');

    try {
      const order = await createBuyOrder(outcomeMint, usdcAmount, publicKey.toBase58());
      setOrderResult(order);
      setState('signing');

      const txBuffer = Buffer.from(order.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);
      const signed = await signTransaction(transaction);

      setState('monitoring');
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 3,
      });
      setTxSignature(sig);

      const result = await waitForOrderCompletion(sig);
      if (result.status === 'closed') {
        setState('filled');
      } else {
        setError(`Order ${result.status}`);
        setState('error');
      }
    } catch (err: any) {
      setError(err.message || 'Trade failed');
      setState('error');
    }
  }, [publicKey, signTransaction, outcomeMint, usdcAmount, connection]);

  // Once a wallet is selected but not connected, trigger connect
  useEffect(() => {
    if (wallet && !connected && connecting) {
      connect().catch((err) => {
        setError(err.message || 'Failed to connect wallet');
        setConnecting(false);
      });
    }
  }, [wallet, connected, connecting, connect]);

  const handleConnect = useCallback(async () => {
    setError('');
    setConnecting(true);

    // Check if Phantom is available in the browser
    const phantomAvailable = typeof window !== 'undefined' && (window as any).phantom?.solana?.isPhantom;
    if (!phantomAvailable) {
      setError('Phantom wallet not found. Please install the Phantom browser extension.');
      setConnecting(false);
      return;
    }

    try {
      // Select Phantom from the wallet list, then the useEffect above triggers connect()
      const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
      if (phantomWallet) {
        select(phantomWallet.adapter.name as WalletName);
      } else {
        // Fallback: connect directly via window.phantom
        const resp = await (window as any).phantom.solana.connect();
        if (!resp?.publicKey) throw new Error('Connection rejected');
        // Re-select to sync wallet adapter state
        select('Phantom' as WalletName);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      setConnecting(false);
    }
  }, [wallets, select]);

  const statusText: Record<TradeState, string> = {
    idle: '',
    submitting: 'Getting order from DFlow...',
    signing: 'Approve transaction in Phantom...',
    monitoring: 'Waiting for order to fill...',
    filled: 'Order filled!',
    error: error,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-black/90 border border-blue-500/30 backdrop-blur-xl rounded-xl p-6 shadow-[0_0_40px_rgba(59,130,246,0.1)] mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-blue-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-mono rounded border border-blue-500/30">
              KALSHI
            </span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500/70 text-xs font-mono rounded">
              DFlow
            </span>
          </div>
          <h2 className="text-lg font-bold text-white leading-snug">{market.question}</h2>
        </div>

        {!connected ? (
          <div className="space-y-3">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-4 rounded-lg font-mono text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {connecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
              ) : (
                <><Wallet className="w-4 h-4" /> Connect Phantom Wallet</>
              )}
            </button>
            {error && <p className="text-red-400 text-xs font-mono text-center">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide('yes')}
                className={`flex-1 py-3 rounded-lg font-mono text-sm transition-colors flex flex-col items-center gap-1 border ${
                  side === 'yes'
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    : 'bg-black/40 border-blue-500/10 text-gray-500 hover:border-blue-500/30'
                }`}
              >
                <span className="text-xs">BUY YES</span>
                <span className="font-bold">{Math.round(market.yesPrice * 100)}\u00a2</span>
              </button>
              <button
                onClick={() => setSide('no')}
                className={`flex-1 py-3 rounded-lg font-mono text-sm transition-colors flex flex-col items-center gap-1 border ${
                  side === 'no'
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-black/40 border-red-500/10 text-gray-500 hover:border-red-500/30'
                }`}
              >
                <span className="text-xs">BUY NO</span>
                <span className="font-bold">{Math.round(market.noPrice * 100)}\u00a2</span>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-gray-500 text-xs font-mono mb-1 block">Amount (USDC)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10"
                min="0.01"
                step="1"
                className="w-full bg-black/40 border border-blue-500/20 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-blue-500/50 transition-colors"
                disabled={state !== 'idle' && state !== 'error'}
              />
            </div>

            <div className="bg-black/40 border border-blue-500/10 rounded-lg px-4 py-3 mb-4 space-y-1">
              <div className="flex justify-between text-sm font-mono">
                <span className="text-gray-500">Est. tokens</span>
                <span className="text-gray-300">~{estTokens.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-gray-500">Slippage</span>
                <span className="text-gray-300">1%</span>
              </div>
              {orderResult && (
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-500">Price impact</span>
                  <span className="text-gray-300">{orderResult.priceImpactPct.toFixed(2)}%</span>
                </div>
              )}
            </div>

            {state === 'idle' || state === 'error' ? (
              <button
                onClick={handleTrade}
                disabled={usdcAmount <= 0 || !outcomeMint}
                className="w-full py-3 rounded-lg font-mono text-sm transition-colors flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Place Order
              </button>
            ) : state === 'filled' ? (
              <div className="text-center space-y-2">
                <div className="text-blue-400 font-mono text-sm font-bold">Order Filled!</div>
                {txSignature && (
                  <button
                    onClick={() => window.open(`https://solscan.io/tx/${txSignature}`, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center gap-1 text-blue-400/70 hover:text-blue-400 text-xs font-mono transition-colors"
                  >
                    View on Solscan <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 text-blue-400/70 font-mono text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {statusText[state]}
              </div>
            )}

            {state === 'error' && error && (
              <p className="mt-2 text-red-400 text-xs font-mono text-center">{error}</p>
            )}

            {txSignature && state !== 'filled' && (
              <div className="mt-2 text-center">
                <button
                  onClick={() => window.open(`https://solscan.io/tx/${txSignature}`, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-400 text-xs font-mono transition-colors"
                >
                  Tx: {txSignature.slice(0, 8)}...{txSignature.slice(-8)} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-blue-500/10 text-center">
              <span className="text-gray-600 text-[10px] font-mono">
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)} connected
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
