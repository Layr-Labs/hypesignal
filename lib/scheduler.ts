import { database } from './database';
import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { TRADING_CONFIG } from '@/config/trading';
import { privateKeyToAccount } from 'viem/accounts';
import type { PositionSummary } from '@/types/tradingStatus';

export class TradingScheduler {
  private priceInfoClientPromise: Promise<InfoClient> | null = null;
  private hyperliquidAddress: string | null = null;

  start() {
    console.log('Trading scheduler initialized (auto-sell disabled).');
  }

  stop() {
    console.log('Trading scheduler stopped.');
  }

  private async getPriceInfoClient() {
    if (!this.priceInfoClientPromise) {
      this.priceInfoClientPromise = (async () => {
        const transport = new HttpTransport({
          isTestnet: TRADING_CONFIG.hyperliquid.environment !== 'mainnet',
          fetchOptions: { keepalive: false }
        });
        return new InfoClient({ transport });
      })();
    }
    return this.priceInfoClientPromise;
  }

  private getHyperliquidAddress(): string | null {
    if (this.hyperliquidAddress !== null) {
      return this.hyperliquidAddress;
    }

    const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
    if (!privateKey) {
      console.warn('HYPERLIQUID_PRIVATE_KEY is not set; unable to sync remote positions.');
      this.hyperliquidAddress = null;
      return null;
    }

    try {
      const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const account = privateKeyToAccount(normalized as `0x${string}`);
      this.hyperliquidAddress = account.address;
      return this.hyperliquidAddress;
    } catch (error) {
      console.error('Failed to derive Hyperliquid address from private key:', error);
      this.hyperliquidAddress = null;
      return null;
    }
  }

  private async getMarketPrices(tokens: string[]) {
    const uniqueSymbols = Array.from(new Set(tokens.map(token => token.toUpperCase())));
    if (!uniqueSymbols.length) {
      return {};
    }

    try {
      const infoClient = await this.getPriceInfoClient();
      const mids = await infoClient.allMids();

      return uniqueSymbols.reduce<Record<string, number>>((acc, symbol) => {
        const price = mids?.[symbol];
        if (price !== undefined) {
          acc[symbol] = typeof price === 'string' ? parseFloat(price) : Number(price);
        }
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching market prices from Hyperliquid:', error);
      return {};
    }
  }

  private async getRemotePositions(existingTokens: Set<string>): Promise<PositionSummary[]> {
    const address = this.getHyperliquidAddress();
    if (!address) {
      return [];
    }

    try {
      const infoClient = await this.getPriceInfoClient();
      const state = await infoClient.clearinghouseState({ user: address });
      const assetPositions = state?.assetPositions ?? [];

      const syncedPositions = assetPositions
        .map(({ position }) => {
          const token = position.coin.toUpperCase();
          if (existingTokens.has(token)) {
            return null;
          }

          const size = Number(position.szi);
          if (!Number.isFinite(size) || size === 0) {
            return null;
          }

          existingTokens.add(token);

          return {
            id: `hyperliquid-${token}`,
            token,
            influencer: 'synced',
            purchaseTime: null,
            amount: size,
            hoursHeld: null,
            marketPriceUsd: null,
            source: 'synced' as const
          };
        })
        .filter((pos): pos is PositionSummary => Boolean(pos));

      return syncedPositions;
    } catch (error) {
      console.error('Error syncing Hyperliquid positions:', error);
      return [];
    }
  }

  // Get status of current positions
  async getPositionsSummary() {
    try {
      const positions = await database.getHoldingPositions();

      const basePositions: PositionSummary[] = positions.map(pos => {
        const hoursHeld = (Date.now() - pos.purchaseTime.getTime()) / (60 * 60 * 1000);
        return {
          id: pos.id,
          token: pos.token.toUpperCase(),
          influencer: pos.influencer,
          purchaseTime: pos.purchaseTime?.toISOString?.() ?? null,
          amount: pos.amount,
          hoursHeld,
          profileImageUrl: pos.profileImageUrl,
          marketPriceUsd: null,
          source: 'local'
        };
      });

      const tokenSet = new Set(basePositions.map(pos => pos.token.toUpperCase()));
      const syncedPositions = await this.getRemotePositions(tokenSet);
      const combinedPositions = [...basePositions, ...syncedPositions];

      const priceMap = await this.getMarketPrices(combinedPositions.map(pos => pos.token));
      const enrichedPositions = combinedPositions.map(pos => ({
        ...pos,
        marketPriceUsd: priceMap[pos.token.toUpperCase()] ?? pos.marketPriceUsd ?? null
      }));

      return {
        totalPositions: enrichedPositions.length,
        totalValue: enrichedPositions.reduce((total, pos) => total + (pos.amount || 0), 0),
        positions: enrichedPositions
      };
    } catch (error) {
      console.error('Error getting positions summary:', error);
      throw error;
    }
  }
}

export const tradingScheduler = new TradingScheduler();
