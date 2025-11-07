export type PositionSource = 'local' | 'synced';

export interface PositionSummary {
  id: string;
  token: string;
  influencer?: string;
  purchaseTime: string | null;
  amount: number;
  hoursHeld: number | null;
  marketPriceUsd: number | null;
  profileImageUrl?: string;
  source: PositionSource;
}

export interface TradingPositionsSummary {
  totalPositions: number;
  totalValue: number;
  positions: PositionSummary[];
}

export interface ActionableTweetSummary {
  id: string;
  token: string;
  tweet: string;
  influencer: string;
  purchaseTime: string;
  amount: number;
  status: string;
  profileImageUrl?: string;
}

export interface TradingStatus {
  isRunning: boolean;
  mode: 'streaming' | 'polling' | 'stopped';
  positions: TradingPositionsSummary;
  actionableTweets: ActionableTweetSummary[];
  startTime: string | null;
}
