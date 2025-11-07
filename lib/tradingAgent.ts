import { twitterApiService } from './twitterapi-tweets';
import { tradingScheduler } from './scheduler';
import { database } from './database';
import { executeTrade } from './trading';
import { TRADING_CONFIG } from '@/config/trading';
import { generateId } from 'ai';
import { ToastService } from './toastService';

export class TradingAgent {
  private isRunning: boolean = false;
  private startTime: Date | null = null;

  async start() {
    if (this.isRunning) {
      console.log('Trading agent is already running');
      return;
    }

    try {
      console.log('Starting Trading Agent...');

      // Set running state immediately
      this.isRunning = true;
      this.startTime = new Date();

      // Start the scheduler for sell orders first
      console.log('1. Starting trading scheduler...');
      tradingScheduler.start();

      // Start Twitter API monitoring
      console.log('2. Starting Twitter API monitoring...');
      try {
        await twitterApiService.initialize();
        await twitterApiService.startPolling();
        console.log('✅ Twitter API monitoring started successfully');
      } catch (error: any) {
        console.error('❌ Twitter API monitoring failed:', error.message);
        console.log('⚠️ Trading agent will continue running but may miss some tweets');
        // Don't throw error - allow the agent to continue running
      }

      console.log('✅ Trading Agent started successfully!');
      console.log('📊 Monitoring influencer tweets via Twitter API...');

      // Check if we're in testing mode
      if (process.env.TESTING === 'true') {
        console.log('🧪 TESTING MODE ENABLED - Running test scenario...');
        await this.runTestScenario();
      }

    } catch (error) {
      this.isRunning = false;
      this.startTime = null;
      console.error('Failed to start Trading Agent:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Trading agent is not running');
      return;
    }

    try {
      console.log('Stopping Trading Agent...');

      // Stop Twitter API monitoring
      twitterApiService.stopPolling();

      // Stop scheduler
      tradingScheduler.stop();

      this.isRunning = false;
      this.startTime = null;
      console.log('✅ Trading Agent stopped successfully');

    } catch (error) {
      console.error('Error stopping Trading Agent:', error);
    }
  }

  async getStatus() {
    const positionsSummary = await tradingScheduler.getPositionsSummary();
    const actionableTweets = await database.getActionableTweets();

    // The agent status should only depend on whether we've explicitly started/stopped it
    // Don't let temporary TwitterAPI issues affect the overall agent status
    const twitterApiStatus = twitterApiService.getStatus();

    // Log TwitterAPI status for debugging, but don't let it control agent status
    if (this.isRunning && !twitterApiStatus.isRunning) {
      console.log('🔍 [STATUS] TwitterAPI service temporarily not running, but agent remains active');
    }

    return {
      isRunning: this.isRunning,
      mode: this.isRunning ? 'polling' : 'stopped',
      positions: positionsSummary,
      actionableTweets: actionableTweets,
      startTime: this.startTime
    };
  }

  async getRecentTrades() {
    // This would need to be implemented in the database service
    // For now, we'll return the current holdings
    return await database.getHoldingPositions();
  }

  /**
   * Testing mode: Creates a fake bullish ETH tweet and executes a 1 USDC -> ETH trade
   */
  private async runTestScenario() {
    try {
      // Check if test scenario has already been run
      const existingTestPositions = await database.getHoldingPositions();
      const hasTestPosition = existingTestPositions.some(pos =>
        pos.tweet.includes('ETH is looking absolutely incredible right now') &&
        pos.influencer === TRADING_CONFIG.influencers[0]
      );

      if (hasTestPosition) {
        console.log('🧪 Test scenario already exists, skipping duplicate run...');
        return;
      }

      console.log('🔥 Starting test scenario...');

      // Get the first influencer from our config
      const firstInfluencer = TRADING_CONFIG.influencers[0];
      console.log(`📝 Creating fake bullish tweet from @${firstInfluencer}`);

      // Create a fake bullish ETH tweet
      const fakeTweet = {
        id: `test_tweet_${generateId()}`,
        text: "🚀 ETH is looking absolutely incredible right now! Technical analysis showing massive bullish divergence and institutional interest is at all-time highs. This could be the breakout we've been waiting for! $ETH #ethereum #bullish 📈",
        created_at: new Date().toISOString(),
        author_id: 'test_author',
        public_metrics: {
          like_count: 1000,
          retweet_count: 500,
          reply_count: 100
        }
      };

      console.log(`\n📱 Fake Tweet from @${firstInfluencer}:`);
      console.log(`   "${fakeTweet.text}"`);
      console.log(`   💰 Tokens mentioned: ETH`);
      console.log(`   📊 Analysis: BULLISH (95% confidence)`);
      console.log(`   📝 Reasoning: Strong bullish sentiment with technical and institutional indicators`);
      console.log(`   🚀 Trade decision: YES - Executing 1 USDC -> ETH swap`);

      // Execute the test trade
      console.log(`\n🔄 Executing test trade: 1 USDC -> ETH`);

      await this.executeTestTrade({
        token: 'ETH',
        tweet: fakeTweet.text,
        influencer: firstInfluencer,
        tweetId: fakeTweet.id
      });

      console.log(`✅ Test scenario completed successfully!`);
      console.log(`💡 Check the trading dashboard to see the test position`);

    } catch (error) {
      console.error('❌ Error in test scenario:', error);
    }
  }

  /**
   * Execute a test trade with 1 USDC worth of ETH (simulated)
   */
  private async executeTestTrade(params: {
    token: string;
    tweet: string;
    influencer: string;
    tweetId: string;
    profileImageUrl?: string;
  }) {
    try {
      console.log(`🧪 TEST TRADE: Simulating purchase of ${params.token} with 1 USDC`);

      // Create a test position directly in the database
      const testPosition = {
        id: generateId(),
        token: params.token,
        amount: 1, // 1 USDC worth
        purchasePrice: 2500, // Simulated ETH price
        purchaseTime: new Date(),
        tweet: params.tweet,
        influencer: params.influencer,
        profileImageUrl: params.profileImageUrl,
        status: 'holding' as const
      };

      // Mark the fake tweet as processed to avoid reprocessing
      await database.markTweetAsProcessed(params.tweetId);

      // Save the test position
      await database.savePosition(testPosition);

      ToastService.addTradeBuyToast({
        token: testPosition.token,
        amount: `${testPosition.amount.toFixed(4)} ${testPosition.token} (simulated)`,
        influencer: params.influencer,
        price: testPosition.purchasePrice.toFixed(2)
      });

      console.log(`✅ Test position created: ${testPosition.id}`);
      console.log(`   Token: ${testPosition.token}`);
      console.log(`   Amount: $${testPosition.amount} USDC`);
      console.log(`   Price: $${testPosition.purchasePrice}`);
      console.log(`   Status: ${testPosition.status}`);

    } catch (error) {
      console.error('Error executing test trade:', error);
      throw error;
    }
  }
}

export const tradingAgent = new TradingAgent();
