"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StreamTweet } from '@/types/tweetStream';

const MAX_TWEETS = 200;
const POLL_INTERVAL_MS = 5000;

export default function TweetMatrix() {
  const [tweets, setTweets] = useState<StreamTweet[]>([]);
  const lastCursorRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateCursor = (incoming: StreamTweet[]) => {
    if (!incoming?.length) return;
    const latest = incoming.reduce(
      (max, tweet) => (tweet.sequence > max ? tweet.sequence : max),
      lastCursorRef.current
    );
    if (latest > lastCursorRef.current) {
      lastCursorRef.current = latest;
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const response = await fetch(`/api/tweets?limit=${MAX_TWEETS}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted || !data?.tweets) return;
        setTweets(data.tweets);
        updateCursor(data.tweets);
      } catch (error) {
        console.error('Failed to prime tweet matrix:', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const sinceParam = lastCursorRef.current ? `?since=${lastCursorRef.current}` : '';
        const response = await fetch(`/api/tweets${sinceParam}`, { cache: 'no-store' });
        if (!response.ok) return;

        const data = await response.json();
        if (!isMounted || !data?.tweets) return;

        setTweets(prev => {
          const map = new Map<string, StreamTweet>();
          [...prev, ...data.tweets].forEach(tweet => {
            map.set(tweet.id, tweet);
          });
          const combined = Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
          return combined.slice(-MAX_TWEETS);
        });

        updateCursor(data.tweets);
      } catch (error) {
        console.error('Failed to refresh tweet matrix:', error);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const sortedTweets = useMemo(
    () => [...tweets].sort((a, b) => b.sequence - a.sequence),
    [tweets]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [sortedTweets]);

  return (
    <div className="h-full">
      <div className="
      max-h-[850px]
      relative h-full min-h-[520px] rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="absolute inset-0 matrix-scan pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40 opacity-40 pointer-events-none" />

        <div
          ref={scrollContainerRef}
          className="relative h-full overflow-y-auto px-6 py-4 flex flex-col gap-3 text-white font-mono text-xs tracking-tight"
        >
          {sortedTweets.length === 0 ? (
            <div className="text-white/50 text-center mt-4">
              Listening for tweets…
            </div>
          ) : (
            sortedTweets.map((tweet, index) => (
              <div
                key={`${tweet.id}-${tweet.sequence}`}
                className="matrix-line text-white/80"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex justify-between text-[10px] uppercase text-white/50 mb-1">
                  <span>@{tweet.influencer}</span>
                  <span>{new Date(tweet.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="leading-snug whitespace-pre-line">
                  {tweet.tweet.length > 200 ? `${tweet.tweet.slice(0, 200)}…` : tweet.tweet}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
