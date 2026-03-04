import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dns from 'dns';
import net from 'net';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Force Node.js to use IPv4 — fixes ETIMEDOUT with Cloudflare-hosted APIs on Node 20+
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.FINNHUB_API_KEY': JSON.stringify(env.FINNHUB_API_KEY || ''),
      'process.env.NEWSDATA_API_KEY': JSON.stringify(env.NEWSDATA_API_KEY || ''),
      'process.env.DFLOW_API_KEY': JSON.stringify(env.DFLOW_API_KEY || ''),
      'process.env.COMMONSTACK_API_KEY': JSON.stringify(env.COMMONSTACK_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/poly-web': {
          target: 'https://polymarket.com',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/poly-web/, ''),
        },
        '/api/polymarket': {
          target: 'https://gamma-api.polymarket.com',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
        },
        '/api/kalshi': {
          target: 'https://dev-prediction-markets-api.dflow.net',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/kalshi/, ''),
        },
        '/api/dflow-trade': {
          target: 'https://dev-quote-api.dflow.net',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/dflow-trade/, ''),
        },
      },
    },
  };
});
