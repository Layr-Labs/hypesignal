import { TRADING_CONFIG } from '@/config/trading';
import { analyzeTweetSentiment, extractTokenMentions, shouldTrade } from './sentiment';
import { database } from './database';
import { executeTrade } from './trading';

interface TwitterApiTweet {
  type: string;
  id: string;
  url: string;
  twitterUrl: string;
  text: string;
  source: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  lang: string;
  bookmarkCount: number;
  isReply: boolean;
  inReplyToId: string | null;
  conversationId: string;
  displayTextRange: number[];
  inReplyToUserId: string | null;
  inReplyToUsername: string | null;
  author: {
    type: string;
    userName: string;
    url: string;
    twitterUrl: string;
    id: string;
    name: string;
    isVerified: boolean;
    isBlueVerified: boolean;
    verifiedType: string;
    profilePicture: string;
    coverPicture: string;
    description: string;
    location: string;
    followers: number;
    following: number;
    status: string;
    canDm: boolean;
    canMediaTag: boolean;
    createdAt: string;
  };
}

interface TwitterApiResponse {
  status: string;
  code: number;
  msg: string;
  data: {
    pin_tweet: any | null;
    tweets: TwitterApiTweet[];
  };
}

export class TwitterApiMonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private apiKey: string;
  private endpoint: string = 'https://api.twitterapi.io/twitter/user/last_tweets';

  constructor() {
    if (!process.env.TWITTER_API_KEY) {
      throw new Error('TWITTER_API_KEY is required in environment variables');
    }

    this.apiKey = process.env.TWITTER_API_KEY;
  }

  async startPolling() {
    if (this.isRunning) {
      console.log('Twitter API monitoring is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting Twitter API monitoring mode...');

    // Check tweets every 5 minutes
    this.intervalId = setInterval(async () => {
      try {
        await this.checkRecentTweets();
      } catch (error) {
        console.error('🔍 [TWITTER_API] ❌ Critical error in polling interval:', error);
        console.log('🔍 [TWITTER_API] 🔄 Continuing to poll despite error...');
      }
    }, 5 * 60 * 1000);

    console.log('Twitter API monitoring started - checking every 5 minutes');

    // Do initial check in background to avoid blocking startup
    setTimeout(async () => {
      try {
        console.log('🔍 [TWITTER_API] Running initial tweet check...');
        await this.checkRecentTweets();
        console.log('🔍 [TWITTER_API] Initial tweet check completed');
      } catch (error) {
        console.error('🔍 [TWITTER_API] ❌ Initial tweet check failed:', error);
        console.log('🔍 [TWITTER_API] 🔄 Will continue with scheduled polling...');
      }
    }, 2000); // 2 second delay
  }

  async startMonitoring() {
    // Alias for compatibility with existing code
    return this.startPolling();
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Twitter API monitoring stopped');
  }

  async stopMonitoring() {
    // Alias for compatibility with existing code
    this.stopPolling();
  }

  async initialize() {
    console.log('Twitter API service initialized for influencers:', TRADING_CONFIG.influencers);
    return Promise.resolve();
  }

  async checkRecentTweets() {
    if (!this.isRunning) {
      console.log('🔍 [TWITTER_API] Not running, skipping tweet check');
      return;
    }

    console.log('🔍 [TWITTER_API] ===== STARTING RECENT TWEETS CHECK =====');
    console.log(`🔍 [TWITTER_API] Monitoring ${TRADING_CONFIG.influencers.length} influencers: ${TRADING_CONFIG.influencers.join(', ')}`);

    for (const username of TRADING_CONFIG.influencers) {
      try {
        console.log(`🔍 [TWITTER_API] Checking @${username}...`);

        const tweets = await this.fetchUserTweets(username);

        if (!tweets || tweets.length === 0) {
          console.log(`🔍 [TWITTER_API] No recent tweets found for @${username}`);
          continue;
        }

        console.log(`🔍 [TWITTER_API] Found ${tweets.length} tweets for @${username}`);

        // Process only the first 5 tweets as requested
        const tweetsToProcess = tweets.slice(0, 5);
        console.log(`🔍 [TWITTER_API] Processing first 5 tweets for @${username}`);

        for (const tweet of tweetsToProcess) {
          console.log(`🔍 [TWITTER_API] --- Processing tweet ${tweet.id} ---`);

          // Calculate tweet age
          const tweetAge = Date.now() - new Date(tweet.createdAt).getTime();
          const ageHours = (tweetAge / (60 * 60 * 1000)).toFixed(1);

          console.log(`🔍 [TWITTER_API] 📱 Tweet from @${username} (${ageHours}h ago):`);
          console.log(`🔍 [TWITTER_API]    Text: "${tweet.text}"`);
          console.log(`🔍 [TWITTER_API]    Created: ${tweet.createdAt}`);
          console.log(`🔍 [TWITTER_API]    Tweet ID: ${tweet.id}`);
          console.log(`🔍 [TWITTER_API]    Views: ${tweet.viewCount}, Likes: ${tweet.likeCount}, Retweets: ${tweet.retweetCount}`);

          // Only process tweets from the configured time window to avoid old tweets
          const maxAgeMs = TRADING_CONFIG.tweetMaxAgeHours * 60 * 60 * 1000;
          if (tweetAge > maxAgeMs) {
            console.log(`🔍 [TWITTER_API]    ⏰ Skipping - too old (${ageHours}h ago, max ${TRADING_CONFIG.tweetMaxAgeHours}h)`);
            continue;
          }

          console.log(`🔍 [TWITTER_API]    ✅ Tweet age OK (${ageHours}h ago)`);

          // Skip replies as they're less likely to contain trading signals
          if (tweet.isReply) {
            console.log(`🔍 [TWITTER_API]    💬 Skipping - is a reply`);
            continue;
          }

          // Skip if already processed
          const isProcessed = await database.isTweetProcessed(tweet.id);
          if (isProcessed) {
            console.log(`🔍 [TWITTER_API]    ✅ Skipping - already processed`);
            continue;
          }

          console.log(`🔍 [TWITTER_API]    🆕 New tweet - processing for crypto content...`);
          await this.processTweet(tweet, username);
        }

        console.log(`🔍 [TWITTER_API] Completed processing ${username} - waiting 2s before next user`);
        // Add delay between users to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`🔍 [TWITTER_API] ❌ Error checking tweets for @${username}:`, error.message);
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          console.log(`🔍 [TWITTER_API] 🚫 Rate limited for @${username}, waiting 10 minutes...`);
          await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000)); // Wait 10 minutes
        }
      }
    }

    console.log('🔍 [TWITTER_API] ===== RECENT TWEETS CHECK COMPLETE =====');
  }

  private async fetchUserTweets(username: string): Promise<TwitterApiTweet[]> {
    try {
      console.log(`🔍 [TWITTER_API] Calling Twitter API for @${username}...`);

      const url = `${this.endpoint}?userName=${username}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data: TwitterApiResponse = await response.json();
      console.log(`🔍 [TWITTER_API] API response status for @${username}:`, data.status, data.msg);

      if (data.status !== 'success' || data.code !== 0) {
        console.log('🔍 [TWITTER_API] API returned unsuccessful status:', data);
        return [];
      }

      if (!data.data || !data.data.tweets || !Array.isArray(data.data.tweets)) {
        console.log('🔍 [TWITTER_API] No tweets in response data');
        return [];
      }

      const tweets = data.data.tweets;
      console.log(`🔍 [TWITTER_API] Successfully fetched ${tweets.length} tweets for @${username}`);

      // Log first tweet for debugging
      if (tweets.length > 0) {
        console.log(`🔍 [TWITTER_API] Sample tweet:`, {
          id: tweets[0].id,
          text: tweets[0].text.substring(0, 100) + '...',
          createdAt: tweets[0].createdAt,
          isReply: tweets[0].isReply
        });
      }

      return tweets;

    } catch (error) {
      console.error(`🔍 [TWITTER_API] Error fetching tweets for @${username}:`, error);
      return [];
    }
  }

  private async processTweet(tweet: TwitterApiTweet, username: string) {
    console.log('🔍 [TWEET_PROC] ===== STARTING TWEET PROCESSING =====');
    console.log('🔍 [TWEET_PROC] Tweet details:', {
      id: tweet.id,
      author: username,
      text: tweet.text.substring(0, 200) + '...',
      views: tweet.viewCount,
      likes: tweet.likeCount,
      retweets: tweet.retweetCount,
      isReply: tweet.isReply
    });

    try {
      // Extract tokens mentioned in the tweet using LLM analysis
      console.log('🔍 [TWEET_PROC] Starting token extraction...');
      const tokens = await extractTokenMentions(tweet.text);

      if (tokens.length === 0) {
        console.log(`🔍 [TWEET_PROC] ❌ No crypto tokens mentioned in tweet`);
        console.log('🔍 [TWEET_PROC] Marking tweet as processed (no tokens)');
        await database.markTweetAsProcessed(tweet.id);
        console.log('🔍 [TWEET_PROC] ===== TWEET PROCESSING COMPLETE (NO TOKENS) =====');
        return;
      }

      console.log(`🔍 [TWEET_PROC] ✅ Crypto tokens found: ${tokens.join(', ')}`);
      console.log(`🔍 [TWEET_PROC] Starting sentiment analysis and trade decision...`);

      // Analyze sentiment and determine if we should trade
      const tradeDecision = await shouldTrade(tweet.text, tokens);

      console.log(`🔍 [TWEET_PROC] 📊 Analysis: ${tradeDecision.sentimentData?.sentiment.toUpperCase()} (${tradeDecision.sentimentData?.confidence}% confidence)`);
      console.log(`🔍 [TWEET_PROC] 📝 Reasoning: ${tradeDecision.sentimentData?.reasoning}`);
      console.log(`🔍 [TWEET_PROC] 🚀 Trade decision: ${tradeDecision.shouldTrade ? 'YES' : 'NO'} - ${tradeDecision.reason}`);

      if (tradeDecision.shouldTrade) {
        console.log(`🔍 [TWEET_PROC] ✅ EXECUTING TRADES for ${tradeDecision.tokens.length} tokens...`);

        // Execute trades for each token
        for (const token of tradeDecision.tokens) {
          try {
            console.log(`🔍 [TWEET_PROC] 🚀 Executing trade for ${token} based on @${username}'s tweet`);

            await executeTrade({
              token,
              tweet: tweet.text,
              influencer: username,
              tweetId: tweet.id,
              profileImageUrl: tweet.author?.profilePicture
            });

            console.log(`🔍 [TWEET_PROC] ✅ Trade executed successfully for ${token}`);
          } catch (error) {
            console.error(`🔍 [TWEET_PROC] ❌ Error executing trade for ${token}:`, error);
          }
        }
        console.log(`🔍 [TWEET_PROC] All trades completed`);
      } else {
        console.log(`🔍 [TWEET_PROC] ❌ No trades executed - ${tradeDecision.reason}`);
      }

      // Mark tweet as processed
      console.log('🔍 [TWEET_PROC] Marking tweet as processed...');
      await database.markTweetAsProcessed(tweet.id);
      console.log('🔍 [TWEET_PROC] Tweet marked as processed successfully');
      console.log('🔍 [TWEET_PROC] ===== TWEET PROCESSING COMPLETE =====');

    } catch (error) {
      console.error('🔍 [TWEET_PROC] ❌ Error processing tweet:', error);
      console.log('🔍 [TWEET_PROC] ===== TWEET PROCESSING FAILED =====');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: 'polling',
      checkInterval: '5 minutes',
      service: 'TwitterAPI.io'
    };
  }

  // Manual trigger for testing
  async manualCheck() {
    console.log('Running manual tweet check via Twitter API...');
    await this.checkRecentTweets();
  }
}

export const twitterApiService = new TwitterApiMonitoringService();
