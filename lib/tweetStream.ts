import type { StreamTweet } from '@/types/tweetStream';

const MAX_STREAM_TWEETS = 500;
let tweetStreamStore: StreamTweet[] = [];
let tweetSequence = 0;

export const TweetStream = {
  add(tweet: { id: string; influencer: string; tweet: string; createdAt: string }) {
    const entry: StreamTweet = {
      ...tweet,
      timestamp: new Date(tweet.createdAt).getTime(),
      sequence: ++tweetSequence
    };

    tweetStreamStore = [entry, ...tweetStreamStore.filter(t => t.id !== entry.id)];

    if (tweetStreamStore.length > MAX_STREAM_TWEETS) {
      tweetStreamStore = tweetStreamStore.slice(0, MAX_STREAM_TWEETS);
    }
  },

  getRecent(limit = 50, since?: number): StreamTweet[] {
    const filtered = since
      ? tweetStreamStore.filter(tweet => tweet.sequence > since)
      : tweetStreamStore;
    return filtered.slice(0, limit);
  },

  getLatestSequence(): number {
    return tweetSequence;
  }
};
