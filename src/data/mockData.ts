export interface MarketData {
  id: string;
  lat: number;
  lng: number;
  size: number;
  title: string;
  news: string;
  markets: {
    question: string;
    yesPrice: number;
    noPrice: number;
    volume: string;
    polymarketUrl?: string;
    yesMint?: string;
    noMint?: string;
  }[];
}

export const mockData: MarketData[] = [
  {
    id: "1",
    lat: 38.8951,
    lng: -77.0364,
    size: 2.0,
    title: "US Federal Reserve (Washington DC)",
    news: "Fed signals potential rate cuts later this year amid cooling inflation.",
    markets: [
      { question: "Fed to cut rates in September?", yesPrice: 0.65, noPrice: 0.35, volume: "$12.4M" },
      { question: "US GDP growth > 2.5% in Q3?", yesPrice: 0.40, noPrice: 0.60, volume: "$4.1M" }
    ]
  },
  {
    id: "2",
    lat: 40.7128,
    lng: -74.0060,
    size: 1.8,
    title: "Wall Street Earnings (New York)",
    news: "Major tech companies prepare to report Q3 earnings.",
    markets: [
      { question: "S&P 500 to hit 5500 by EOY?", yesPrice: 0.55, noPrice: 0.45, volume: "$8.2M" }
    ]
  },
  {
    id: "3",
    lat: 37.7749,
    lng: -122.4194,
    size: 1.5,
    title: "AI Regulation (San Francisco)",
    news: "California advances sweeping AI safety bill.",
    markets: [
      { question: "Will SB 1047 pass the assembly?", yesPrice: 0.70, noPrice: 0.30, volume: "$2.5M" }
    ]
  },
  {
    id: "4",
    lat: 51.5074,
    lng: -0.1278,
    size: 1.6,
    title: "Bank of England (London)",
    news: "UK inflation hits target, prompting rate cut discussions.",
    markets: [
      { question: "BoE to cut rates before Fed?", yesPrice: 0.82, noPrice: 0.18, volume: "$5.6M" }
    ]
  },
  {
    id: "5",
    lat: 48.8566,
    lng: 2.3522,
    size: 1.4,
    title: "EU Tech Act (Paris)",
    news: "European regulators target major tech platforms.",
    markets: [
      { question: "Will Apple face new EU fines in 2024?", yesPrice: 0.85, noPrice: 0.15, volume: "$3.2M" }
    ]
  },
  {
    id: "6",
    lat: 50.4501,
    lng: 30.5234,
    size: 2.5,
    title: "Eastern Europe Conflict (Kyiv)",
    news: "New developments in regional security agreements and aid packages.",
    markets: [
      { question: "Will a ceasefire agreement be signed in 2024?", yesPrice: 0.12, noPrice: 0.88, volume: "$15.5M" }
    ]
  },
  {
    id: "7",
    lat: 55.7558,
    lng: 37.6173,
    size: 1.8,
    title: "Russian Energy Exports (Moscow)",
    news: "Shifts in global energy supply chains continue.",
    markets: [
      { question: "Brent crude > $90 by EOY?", yesPrice: 0.45, noPrice: 0.55, volume: "$6.7M" }
    ]
  },
  {
    id: "8",
    lat: 32.0853,
    lng: 34.7818,
    size: 2.2,
    title: "Middle East Tensions (Tel Aviv)",
    news: "Ongoing geopolitical developments affecting regional stability.",
    markets: [
      { question: "Will a formal treaty be signed by Q4?", yesPrice: 0.25, noPrice: 0.75, volume: "$9.1M" }
    ]
  },
  {
    id: "9",
    lat: 35.6892,
    lng: 51.3890,
    size: 1.7,
    title: "Nuclear Deal Talks (Tehran)",
    news: "International observers monitor enrichment levels.",
    markets: [
      { question: "New IAEA resolution passed this month?", yesPrice: 0.60, noPrice: 0.40, volume: "$1.8M" }
    ]
  },
  {
    id: "10",
    lat: 39.9042,
    lng: 116.4074,
    size: 2.1,
    title: "China Economic Stimulus (Beijing)",
    news: "PBOC announces new measures to support property sector.",
    markets: [
      { question: "China 2024 GDP growth > 5%?", yesPrice: 0.35, noPrice: 0.65, volume: "$7.4M" }
    ]
  },
  {
    id: "11",
    lat: 25.0330,
    lng: 121.5654,
    size: 1.9,
    title: "Semiconductor Supply (Taipei)",
    news: "TSMC announces new expansion plans amid high AI chip demand.",
    markets: [
      { question: "TSMC revenue up >20% YoY?", yesPrice: 0.90, noPrice: 0.10, volume: "$4.9M" }
    ]
  },
  {
    id: "12",
    lat: 35.6762,
    lng: 139.6503,
    size: 1.6,
    title: "Bank of Japan (Tokyo)",
    news: "BOJ considers further rate hikes as yen weakens.",
    markets: [
      { question: "USD/JPY drops below 145 in 2024?", yesPrice: 0.42, noPrice: 0.58, volume: "$8.3M" }
    ]
  },
  {
    id: "13",
    lat: 28.6139,
    lng: 77.2090,
    size: 1.5,
    title: "India Elections Impact (New Delhi)",
    news: "New coalition government announces economic reforms.",
    markets: [
      { question: "Nifty 50 to cross 25,000?", yesPrice: 0.75, noPrice: 0.25, volume: "$3.6M" }
    ]
  },
  {
    id: "14",
    lat: 25.2048,
    lng: 55.2708,
    size: 1.4,
    title: "OPEC+ Meeting (Dubai)",
    news: "Oil producers discuss extending voluntary production cuts.",
    markets: [
      { question: "OPEC+ extends cuts into 2025?", yesPrice: 0.80, noPrice: 0.20, volume: "$5.2M" }
    ]
  }
];
