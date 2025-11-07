function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseListEnv(value: string | undefined): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '*') {
    return [];
  }

  return trimmed
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);
}

const baseInfluencers = [
  'blknoiz06',
  'dabit3',
  'trading_axe',
  'notthreadguy',
  'gwartygwart',
  'tradermayne',
  'loomdart',
  'CryptoHayes',
  'divine_economy'
];

const defaultMaxTradeUsd = parseNumberEnv(process.env.MAX_TRADE_AMOUNT_USD, 30);
const hyperliquidMaxTradeUsd = parseNumberEnv(process.env.HYPERLIQUID_MAX_TRADE_USD, defaultMaxTradeUsd);
const allowedMarkets = parseListEnv(process.env.HYPERLIQUID_ALLOWED_MARKETS);
const hyperliquidEnvironment = (process.env.HYPERLIQUID_ENVIRONMENT || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';
const slippageBps = parseNumberEnv(process.env.HYPERLIQUID_SLIPPAGE_BPS, 50); // 0.50% default

export const TRADING_CONFIG = {
  influencers: baseInfluencers,
  maxTradeAmountUSD: hyperliquidMaxTradeUsd,
  tweetMaxAgeHours: parseInt(process.env.TWEET_MAX_AGE_HOURS || '6', 10),
  minimumConfidence: 70,
  useAISentiment: true,
  hyperliquid: {
    enabled: process.env.HYPERLIQUID_DISABLED === 'true' ? false : true,
    environment: hyperliquidEnvironment as 'mainnet' | 'testnet',
    allowedMarkets,
    slippageBps,
    timeInForce: (process.env.HYPERLIQUID_TIME_IN_FORCE || 'Ioc') as 'Gtc' | 'Ioc' | 'Alo' | 'FrontendMarket' | 'LiquidationMarket',
    explorerBaseUrl: process.env.HYPERLIQUID_EXPLORER_URL || 'https://app.hyperliquid.xyz/exchange',
    symbolRouting: {
      WETH: 'ETH',
      ETH: 'ETH',
      SOL: 'SOL',
      BTC: 'BTC',
      EIGEN: 'EIGEN',
      ENA: 'ENA'
    } as Record<string, string>
  }
};

export type TradingPosition = {
  id: string;
  token: string;
  amount: number;
  purchasePrice: number;
  purchaseTime: Date;
  sellTime?: Date;
  sellPrice?: number;
  profit?: number;
  tweet: string;
  influencer: string;
  profileImageUrl?: string;
  status: 'holding' | 'sold' | 'failed';
};
