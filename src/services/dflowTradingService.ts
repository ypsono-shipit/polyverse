const TRADE_API = '/api/dflow-trade';
const DFLOW_KEY = process.env.DFLOW_API_KEY || '';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface OrderResponse {
  transaction: string;
  lastValidBlockHeight: number;
  computeUnitLimit: number;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
  inputMint: string;
  outputMint: string;
}

export interface OrderStatusResponse {
  status: 'pending' | 'expired' | 'failed' | 'open' | 'pendingClose' | 'closed';
  inAmount: string;
  outAmount: string;
  fills?: { signature: string; inputMint: string; inAmount: string; outputMint: string; outAmount: string }[];
  reverts?: { signature: string; mint: string; amount: string }[];
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {};
  if (DFLOW_KEY) h['x-api-key'] = DFLOW_KEY;
  return h;
}

export async function createBuyOrder(
  outcomeMint: string,
  usdcAmount: number,
  userPublicKey: string,
): Promise<OrderResponse> {
  const amount = Math.round(usdcAmount * 1e6);
  const params = new URLSearchParams({
    inputMint: USDC_MINT,
    outputMint: outcomeMint,
    amount: amount.toString(),
    userPublicKey,
    slippageBps: '100',
  });

  const res = await fetch(`${TRADE_API}/order?${params}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ msg: res.statusText }));
    throw new Error(err.msg || `Order failed: ${res.status}`);
  }
  return res.json();
}

export async function createSellOrder(
  outcomeMint: string,
  tokenAmount: number,
  userPublicKey: string,
): Promise<OrderResponse> {
  const params = new URLSearchParams({
    inputMint: outcomeMint,
    outputMint: USDC_MINT,
    amount: tokenAmount.toString(),
    userPublicKey,
    slippageBps: '100',
  });

  const res = await fetch(`${TRADE_API}/order?${params}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ msg: res.statusText }));
    throw new Error(err.msg || `Order failed: ${res.status}`);
  }
  return res.json();
}

export async function getOrderStatus(signature: string): Promise<OrderStatusResponse> {
  const params = new URLSearchParams({ signature });
  const res = await fetch(`${TRADE_API}/order-status?${params}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ msg: res.statusText }));
    throw new Error(err.msg || `Status check failed: ${res.status}`);
  }
  return res.json();
}

export async function waitForOrderCompletion(
  signature: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<OrderStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getOrderStatus(signature);
    if (status.status === 'closed' || status.status === 'expired' || status.status === 'failed') {
      return status;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Order timed out');
}
