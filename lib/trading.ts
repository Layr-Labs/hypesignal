import { HttpTransport, InfoClient, ExchangeClient, type OrderSuccessResponse } from '@nktkas/hyperliquid';
import { SymbolConverter, formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { generateId } from 'ai';
import { privateKeyToAccount } from 'viem/accounts';

import { database } from './database';
import { ToastService } from './toastService';
import { TradingPosition, TRADING_CONFIG } from '@/config/trading';

export interface TradeRequest {
  token: string;
  tweet: string;
  influencer: string;
  tweetId: string;
  profileImageUrl?: string;
}

type HyperliquidClients = {
  transport: HttpTransport;
  infoClient: InfoClient;
  exchangeClient: ExchangeClient;
  symbolConverter: SymbolConverter;
};

type MarketMetadata = {
  symbol: string;
  assetId: number;
  sizeDecimals: number;
  infoSymbol: string;
  isSpot: boolean;
};

type OrderStatus = OrderSuccessResponse['response']['data']['statuses'][number];

let hyperliquidClientsPromise: Promise<HyperliquidClients> | null = null;
let hyperliquidAddress: string | null = null;

export async function executeTrade(request: TradeRequest): Promise<void> {
  console.log('🔍 [TRADE_EXEC] ===== STARTING HYPERLIQUID TRADE =====');
  console.log('🔍 [TRADE_EXEC] Trade request:', {
    token: request.token,
    influencer: request.influencer,
    tweetId: request.tweetId,
    tweetPreview: request.tweet.substring(0, 120)
  });

  const hyperConfig = TRADING_CONFIG.hyperliquid;

  if (process.env.TESTING === 'true') {
    console.log('🔍 [TRADE_EXEC] 🧪 TESTING MODE ENABLED - Simulating trade');
    await executeTestTrade(request);
    console.log('🔍 [TRADE_EXEC] ===== TEST TRADE COMPLETE =====');
    return;
  }

  if (!hyperConfig.enabled) {
    console.log('🔍 [TRADE_EXEC] ⚠️ Hyperliquid trading disabled via configuration. Skipping.');
    await database.markTweetAsProcessed(request.tweetId);
    return;
  }

  const normalizedSymbol = resolveMarketSymbol(request.token);
  if (!normalizedSymbol) {
    console.log('🔍 [TRADE_EXEC] ❌ Could not normalize token symbol, skipping trade.');
    await database.markTweetAsProcessed(request.tweetId);
    return;
  }

  if (!isSymbolAllowed(normalizedSymbol)) {
    console.log(`🔍 [TRADE_EXEC] ❌ ${normalizedSymbol} not in allowed markets (${hyperConfig.allowedMarkets.join(', ')})`);
    await database.markTweetAsProcessed(request.tweetId);
    return;
  }

  const alreadyHolding = await database.hasHoldingPosition(normalizedSymbol);
  if (alreadyHolding) {
    console.log(`🔍 [TRADE_EXEC] ⏸️ Already holding ${normalizedSymbol}. Skipping additional buy.`);
    await database.markTweetAsProcessed(request.tweetId);
    return;
  }

  const tradeUsd = TRADING_CONFIG.maxTradeAmountUSD;
  if (!Number.isFinite(tradeUsd) || tradeUsd <= 0) {
    throw new Error('Invalid trading configuration: maxTradeAmountUSD must be a positive number');
  }

  try {
    const clients = await getHyperliquidClients();

    const alreadyHoldingLocal = await database.hasHoldingPosition(normalizedSymbol);
    if (alreadyHoldingLocal) {
      console.log(`🔍 [TRADE_EXEC] ⏸️ Already holding ${normalizedSymbol} locally. Skipping additional buy.`);
      await database.markTweetAsProcessed(request.tweetId);
      return;
    }

    const alreadyHoldingRemote = await isHoldingOnExchange(clients.infoClient, normalizedSymbol);
    if (alreadyHoldingRemote) {
      console.log(`🔍 [TRADE_EXEC] ⏸️ Already holding ${normalizedSymbol} on Hyperliquid. Skipping additional buy.`);
      await database.markTweetAsProcessed(request.tweetId);
      return;
    }
    const market = await getMarketMetadata(clients.symbolConverter, normalizedSymbol);

    if (!market) {
      console.log(`🔍 [TRADE_EXEC] ❌ ${normalizedSymbol} is not listed on Hyperliquid. Skipping.`);
      await database.markTweetAsProcessed(request.tweetId);
      return;
    }

    const bestAsk = await getBestAskPrice(clients.infoClient, market.infoSymbol);
    if (!bestAsk) {
      throw new Error(`Unable to fetch order book data for ${market.symbol}`);
    }

    const limitPriceRaw = bestAsk * (1 + hyperConfig.slippageBps / 10_000);
    const limitPrice = formatPrice(limitPriceRaw, market.sizeDecimals, !market.isSpot);
    const sizeRaw = tradeUsd / parseFloat(limitPrice);
    const sizeFormatted = formatSize(sizeRaw.toString(), market.sizeDecimals);
    const numericSize = parseFloat(sizeFormatted);

    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      throw new Error(
        `Trade size (${sizeFormatted}) is below Hyperliquid lot size requirements for ${market.symbol}`
      );
    }

    ToastService.addInfoToast(
      'Executing Hyperliquid Order',
      `Buying ${market.symbol} with ~$${tradeUsd.toFixed(2)} notional`,
      {
        token: market.symbol,
        amount: sizeFormatted,
        influencer: request.influencer,
        price: limitPrice
      }
    );

    console.log('🔍 [TRADE_EXEC] Order parameters:', {
      market: market.symbol,
      assetId: market.assetId,
      bestAsk,
      limitPrice,
      size: sizeFormatted,
      slippageBps: hyperConfig.slippageBps,
      environment: hyperConfig.environment
    });

    const orderResponse = await clients.exchangeClient.order({
      orders: [
        {
          a: market.assetId,
          b: true, // long/buy
          p: limitPrice,
          s: sizeFormatted,
          r: false,
          t: { limit: { tif: hyperConfig.timeInForce } }
        }
      ],
      grouping: 'na'
    });

    const fill = extractFill(orderResponse);
    const filledSize = parseFloat(fill.totalSz);
    const avgPrice = parseFloat(fill.avgPx);

    if (!Number.isFinite(filledSize) || filledSize <= 0) {
      throw new Error('Hyperliquid did not return a valid fill size');
    }

    const position: TradingPosition = {
      id: generateId(),
      token: market.symbol,
      amount: filledSize,
      purchasePrice: avgPrice,
      purchaseTime: new Date(),
      tweet: request.tweet,
      influencer: request.influencer,
      profileImageUrl: request.profileImageUrl,
      status: 'holding'
    };

    await database.savePosition(position);
    await database.markTweetAsProcessed(request.tweetId);

    const explorerUrl = toExplorerUrl(market.symbol, fill.oid);
    const amountLabel = formatAmountLabel(filledSize, market.symbol, market.sizeDecimals);

    ToastService.addTradeBuyToast({
      token: market.symbol,
      amount: amountLabel,
      influencer: request.influencer,
      price: avgPrice.toFixed(4),
      txHash: fill.oid?.toString(),
      explorerUrl
    });

    console.log('🔍 [TRADE_EXEC] ✅ Hyperliquid order filled:', {
      orderId: fill.oid,
      symbol: market.symbol,
      filledSize,
      avgPrice,
      explorerUrl
    });
    console.log('🔍 [TRADE_EXEC] ===== HYPERLIQUID TRADE COMPLETE =====');
  } catch (error) {
    console.error('❌ [TRADE_EXEC] Hyperliquid trade failed:', error);
    throw error;
  }
}

function resolveMarketSymbol(token: string): string {
  const normalized = token.trim().toUpperCase();
  return (
    TRADING_CONFIG.hyperliquid.symbolRouting[normalized] ||
    normalized
  );
}

function isSymbolAllowed(symbol: string): boolean {
  const { allowedMarkets } = TRADING_CONFIG.hyperliquid;
  if (!allowedMarkets.length) return true;
  return allowedMarkets.includes(symbol);
}

function normalizePrivateKey(value: string): `0x${string}` {
  return value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);
}

function getHyperliquidAddress(): string | null {
  if (hyperliquidAddress) {
    return hyperliquidAddress;
  }

  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  if (!privateKey) {
    console.warn('HYPERLIQUID_PRIVATE_KEY not set; unable to derive Hyperliquid address.');
    return null;
  }

  try {
    const normalized = normalizePrivateKey(privateKey);
    const account = privateKeyToAccount(normalized);
    hyperliquidAddress = account.address;
    return hyperliquidAddress;
  } catch (error) {
    console.error('Failed to derive Hyperliquid address from private key:', error);
    return null;
  }
}

export async function getHyperliquidClients(): Promise<HyperliquidClients> {
  if (!hyperliquidClientsPromise) {
    hyperliquidClientsPromise = (async () => {
      const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('HYPERLIQUID_PRIVATE_KEY environment variable is required for live trading');
      }

      const transport = new HttpTransport({
        isTestnet: TRADING_CONFIG.hyperliquid.environment !== 'mainnet',
        // Node's undici implementation currently throws on keepalive for POST requests,
        // so disable it until Hyperliquid's client updates its defaults.
        fetchOptions: { keepalive: false }
      });

      const infoClient = new InfoClient({ transport });
      const exchangeClient = new ExchangeClient({
        transport,
        wallet: normalizePrivateKey(privateKey)
      });
      const symbolConverter = await SymbolConverter.create({ transport });

      return { transport, infoClient, exchangeClient, symbolConverter };
    })();
  }

  return hyperliquidClientsPromise;
}

async function isHoldingOnExchange(infoClient: InfoClient, symbol: string): Promise<boolean> {
  const address = getHyperliquidAddress();
  if (!address) return false;

  try {
    const state = await infoClient.clearinghouseState({ user: address });
    const positions = state?.assetPositions ?? [];
    return positions.some(({ position }) => {
      const token = position.coin.toUpperCase();
      if (token !== symbol.toUpperCase()) return false;
      const size = Number(position.szi);
      return Number.isFinite(size) && size !== 0;
    });
  } catch (error) {
    console.error('❌ [TRADE_EXEC] Failed to check remote holdings:', error);
    return false;
  }
}

async function getMarketMetadata(converter: SymbolConverter, symbol: string): Promise<MarketMetadata | null> {
  const assetId = converter.getAssetId(symbol);
  if (assetId === undefined) {
    return null;
  }

  const sizeDecimals = converter.getSzDecimals(symbol) ?? 3;
  const isSpot = symbol.includes('/') || symbol.includes(':');
  const infoSymbol = isSpot ? converter.getSpotPairId(symbol) ?? symbol : symbol;

  return {
    symbol,
    assetId,
    sizeDecimals,
    infoSymbol,
    isSpot
  };
}

async function getBestAskPrice(infoClient: InfoClient, infoSymbol: string): Promise<number | null> {
  try {
    const l2 = await infoClient.l2Book({ coin: infoSymbol, nSigFigs: 2 });
    if (!l2 || !l2.levels[1]?.length) {
      return null;
    }
    return parseFloat(l2.levels[1][0].px);
  } catch (error) {
    console.error('❌ [ORDERBOOK] Failed to fetch order book:', error);
    return null;
  }
}

function extractFill(response: OrderSuccessResponse) {
  const status = response.response.data.statuses[0];

  if (!status) {
    throw new Error('Hyperliquid did not return any order status');
  }

  if (isErrorStatus(status)) {
    throw new Error(status.error);
  }

  if (!isFilledStatus(status)) {
    throw new Error('Order was not filled. Consider adjusting size or slippage.');
  }

  return status.filled;
}

function isFilledStatus(status: OrderStatus): status is Extract<OrderStatus, { filled: unknown }> {
  return Boolean((status as { filled?: unknown }).filled);
}

function isErrorStatus(status: OrderStatus): status is Extract<OrderStatus, { error: string }> {
  return Boolean((status as { error?: string }).error);
}

function toExplorerUrl(symbol: string, orderId?: number): string | undefined {
  const base = TRADING_CONFIG.hyperliquid.explorerBaseUrl.replace(/\/$/, '');
  const encoded = symbol.includes('/') ? encodeURIComponent(symbol) : symbol;
  if (!base) return undefined;
  return orderId ? `${base}/${encoded}?orderId=${orderId}` : `${base}/${encoded}`;
}

function formatAmountLabel(amount: number, symbol: string, decimals: number): string {
  const precision = Math.min(decimals, 6);
  return `${amount.toFixed(precision)} ${symbol}`;
}

async function executeTestTrade(request: TradeRequest): Promise<void> {
  try {
    const tokenPrice = await getTokenPrice(request.token);
    const simulatedNotional = Math.min(1, TRADING_CONFIG.maxTradeAmountUSD);
    const tokenAmount = simulatedNotional / tokenPrice;
    const normalizedSymbol = resolveMarketSymbol(request.token);

    const position: TradingPosition = {
      id: generateId(),
      token: normalizedSymbol,
      amount: tokenAmount,
      purchasePrice: tokenPrice,
      purchaseTime: new Date(),
      tweet: request.tweet,
      influencer: request.influencer,
      profileImageUrl: request.profileImageUrl,
      status: 'holding'
    };

    await database.savePosition(position);
    await database.markTweetAsProcessed(request.tweetId);

    ToastService.addTradeBuyToast({
      token: normalizedSymbol,
      amount: `${tokenAmount.toFixed(6)} ${normalizedSymbol} (simulated)`,
      influencer: request.influencer,
      price: tokenPrice.toFixed(2),
      explorerUrl: toExplorerUrl(normalizedSymbol)
    });

    console.log('🧪 [TEST_TRADE] Simulated Hyperliquid trade complete:', {
      token: normalizedSymbol,
      tokenAmount: tokenAmount.toFixed(6),
      price: tokenPrice,
      notionalUSD: simulatedNotional
    });
  } catch (error) {
    console.error('❌ [TEST_TRADE] Simulation failed:', error);
    throw error;
  }
}

async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const mockPrices: Record<string, number> = {
    ETH: 2500,
    SOL: 100,
    ADA: 0.45,
    DOT: 7.2,
    LINK: 15,
    UNI: 6.5,
    AAVE: 95,
    MATIC: 0.85,
    AVAX: 37,
    EIGEN: 3.85,
    ENA: 0.92,
    BTC: 60_000
  };

  const price = mockPrices[tokenSymbol.toUpperCase()] ?? 1;
  return price;
}
