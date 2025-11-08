"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { TRADING_CONFIG } from "@/config/trading";
import { useToast } from "./Toast";
import type { ToastData } from "./Toast";

interface InfluencerProfile {
  username: string;
  displayName: string;
  profileImageUrl: string;
  isOnline?: boolean;
  followerCount?: number;
  followingCount?: number;
  tweetCount?: number;
  favouritesCount?: number;
  mediaCount?: number;
  verified?: boolean;
  description?: string;
  location?: string;
  url?: string;
  coverPicture?: string;
  createdAt?: string;
  protected?: boolean;
  canDm?: boolean;
  isAutomated?: boolean;
  error?: boolean;
  fallback?: boolean;
}

/**
 * Beautiful influencer list component showing who we're monitoring
 */
interface InfluencerListProps {}

export default function InfluencerList({}: InfluencerListProps) {
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts } = useToast();
  const [highlightMap, setHighlightMap] = useState<Record<string, number>>({});
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({});
  const processedToastIds = useRef<Set<string>>(new Set());
  const baseOrderRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Fetch real influencer profiles from Twitter API
    const fetchInfluencerProfiles = async () => {
      try {
        console.log('🐦 [INFLUENCER_LIST] Fetching profiles for', TRADING_CONFIG.influencers.length, 'influencers');

        const profilePromises = TRADING_CONFIG.influencers.map(async (username) => {
          try {
            console.log(`🐦 [INFLUENCER_LIST] Fetching profile for: ${username}`);

            const response = await fetch(`/api/twitter/user?username=${username}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`✅ [INFLUENCER_LIST] Got profile for: ${username}`, result.data);
              return {
                ...result.data,
                error: false,
                fallback: false
              };
            } else {
              // API failed, use fallback data
              console.warn(`⚠️ [INFLUENCER_LIST] API failed for ${username}, using fallback`);
              return {
                username,
                displayName: username.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
                profileImageUrl: `https://unavatar.io/twitter/${username}`,
                isOnline: false,
                followerCount: 0,
                verified: false,
                error: true,
                fallback: true
              };
            }
          } catch (error) {
            console.error(`❌ [INFLUENCER_LIST] Error fetching ${username}:`, error);
            // Use fallback data on error
            return {
              username,
              displayName: username.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
              profileImageUrl: `https://unavatar.io/twitter/${username}`,
              isOnline: false,
              followerCount: 0,
              verified: false,
              error: true,
              fallback: true
            };
          }
        });

        // Wait for all profiles to be fetched
        const profiles = await Promise.all(profilePromises);
        console.log('🐦 [INFLUENCER_LIST] All profiles fetched:', profiles);

        const baseOrder: Record<string, number> = {};
        profiles.forEach((profile, idx) => {
          baseOrder[profile.username.toLowerCase()] = idx;
        });
        baseOrderRef.current = baseOrder;
        setInfluencers(profiles);
      } catch (error) {
        console.error('❌ [INFLUENCER_LIST] Error fetching influencer profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfluencerProfiles();
  }, []);

  const isTradeTriggerToast = (toast: ToastData) => {
    if (toast.type !== 'info') return false;
    if (!toast.data?.influencer) return false;
    const title = toast.title?.toLowerCase() ?? '';
    return title.includes('executing hyperliquid order');
  };

  useEffect(() => {
    if (!toasts.length) return;
    const newTradeToasts = toasts
      .filter(isTradeTriggerToast)
      .filter(toast => !processedToastIds.current.has(toast.id));

    if (!newTradeToasts.length) return;

    const timestamp = Date.now();
    setHighlightMap(prev => {
      const updated = { ...prev };
      newTradeToasts.forEach(toast => {
        processedToastIds.current.add(toast.id);
        const key = toast.data?.influencer?.toLowerCase();
        if (!key) return;
        const entryStamp = timestamp + Math.random();
        updated[key] = entryStamp;
        setTimeout(() => {
          setHighlightMap(current => {
            if (current[key] !== entryStamp) return current;
            const clone = { ...current };
            delete clone[key];
            return clone;
          });
        }, 1200);
      });
      return updated;
    });

    setTradeCounts(prev => {
      const updated = { ...prev };
      newTradeToasts.forEach(toast => {
        const key = toast.data?.influencer?.toLowerCase();
        if (!key) return;
        updated[key] = (updated[key] ?? 0) + 1;
      });
      return updated;
    });
  }, [toasts]);

  const sortedInfluencers = useMemo(() => {
    const baseOrder = baseOrderRef.current;
    return [...influencers].sort((a, b) => {
      const aKey = a.username.toLowerCase();
      const bKey = b.username.toLowerCase();
      const aCount = tradeCounts[aKey] ?? 0;
      const bCount = tradeCounts[bKey] ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return (baseOrder[aKey] ?? 0) - (baseOrder[bKey] ?? 0);
    });
  }, [influencers, tradeCounts]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-medium text-muted-foreground">Monitoring Influencers</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 bg-gradient-to-br from-background to-muted/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-2 h-2 bg-blue-500 rounded-full animate-ping opacity-30"></div>
          </div>
          <h3 className="text-sm font-medium text-foreground">Monitoring Influencers</h3>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
          {influencers.length} Active
        </div>
      </div>

      {/* Influencer Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedInfluencers.map((influencer, index) => {
          const highlightKey = influencer.username.toLowerCase();
          const isHighlighted = Boolean(highlightMap[highlightKey]);
          const leaderCount = tradeCounts[highlightKey] ?? 0;
          return (
          <div
            key={influencer.username}
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/20 to-muted/5 border border-border/50 hover:border-border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${isHighlighted ? 'ring-2 ring-emerald-400 shadow-emerald-500/40 animate-pulse trade-pop' : ''}`}
            style={{ animationDelay: `${index * 100}ms` }}
            title={!influencer.error && influencer.description ? `${influencer.displayName}: ${influencer.description.substring(0, 100)}...` : `Click to open @${influencer.username} on Twitter`}
            onClick={() => window.open(`https://twitter.com/${influencer.username}`, '_blank')}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/[0.02] to-white/[0.05] group-hover:from-white/[0.02] group-hover:to-white/[0.08] transition-all duration-300"></div>

            <div className="relative p-4">
              {/* Profile Section */}
              <div className="flex items-center space-x-3">
                {/* Profile Image with Status */}
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-colors duration-300 ${
                    influencer.error
                      ? 'border-yellow-500/50 group-hover:border-yellow-500/80'
                      : 'border-border/30 group-hover:border-border/60'
                  }`}>
                    <img
                      src={influencer.profileImageUrl || `https://ui-avatars.com/api/?name=${influencer.displayName}&background=6366f1&color=fff&size=400`}
                      alt={influencer.displayName}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${influencer.displayName}&background=6366f1&color=fff&size=400`;
                      }}
                    />
                  </div>

                  {/* Online Status */}
                  {influencer.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <div className="w-4 h-4 bg-emerald-500 border-2 border-background rounded-full"></div>
                      <div className="absolute inset-0 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1">
                    <h4 className="font-medium text-foreground text-sm truncate">
                      {influencer.displayName && influencer.displayName.length >= 2 ? influencer.displayName : influencer.username}
                    </h4>
                    {influencer.verified && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    )}
                    {leaderCount > 0 && (
                      <span className="ml-1 text-[10px] font-semibold text-emerald-400">{leaderCount} trade{leaderCount === 1 ? '' : 's'}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{influencer.username}
                  </p>
                  <div className="flex flex-col space-y-1 mt-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {(influencer.followerCount || 0).toLocaleString()} followers
                      </span>
                      {influencer.isOnline && !influencer.error && (
                        <span className="text-xs text-emerald-500 font-medium">
                          Live Data
                        </span>
                      )}
                      {influencer.error && (
                        <span className="text-xs text-yellow-500 font-medium">
                          Fallback
                        </span>
                      )}
                    </div>
                    {!influencer.error && influencer.location && (
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate max-w-24">{influencer.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Hover Effect Border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-emerald-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/10 group-hover:to-emerald-500/20 transition-all duration-500 pointer-events-none"></div>
          </div>
        )})}
      </div>

      {/* Footer Stats */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>{influencers.filter(i => i.isOnline && !i.error).length} Live Data</span>
            </span>
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>{influencers.filter(i => i.verified).length} Verified</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
