"use client";

import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import type { TradingStatus } from '@/types/tradingStatus';

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const StopIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <rect width="14" height="14" x="5" y="5" rx="2"/>
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
  </svg>
);

// Persistent state keys
const TRADING_STATE_KEY = 'trading-agent-state';
const USER_STOPPED_KEY = 'user-explicitly-stopped';

interface TradingControlsProps {
  initialStatus?: TradingStatus | null;
}

export default function TradingControls({ initialStatus = null }: TradingControlsProps) {
  const [status, setStatus] = useState<TradingStatus | null>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [userExplicitlyStopped, setUserExplicitlyStopped] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem(USER_STOPPED_KEY) === 'true';
    }
    return false;
  });
  const { checkForNewToasts } = useToast();

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/trading/status');
      const data = await response.json();

      // Get persisted user intention from localStorage (also sync with React state)
      const userStoppedPersisted = localStorage.getItem(USER_STOPPED_KEY) === 'true';
      const lastKnownState = localStorage.getItem(TRADING_STATE_KEY);

      // Sync localStorage with React state if they differ
      if (userStoppedPersisted !== userExplicitlyStopped) {
        setUserExplicitlyStopped(userStoppedPersisted);
      }

      // Override the status if user hasn't explicitly stopped and we think it should be running
      if (!userStoppedPersisted && !data.isRunning) {
        // Check if we previously had a running state
        if (lastKnownState && JSON.parse(lastKnownState).isRunning) {
          console.log('🔧 UI Override: Preventing automatic transition to STOPPED - user did not click stop button');
          console.log('🔧 Persisted state indicates agent should still be running');
          data.isRunning = true;
          data.mode = 'polling';
        }
      }

      // Persist the current state to localStorage if it's a legitimate state change
      if (userStoppedPersisted && !data.isRunning) {
        // This is expected - user stopped the agent
        localStorage.setItem(TRADING_STATE_KEY, JSON.stringify(data));
      } else if (data.isRunning) {
        // Agent is running - persist this state
        localStorage.setItem(TRADING_STATE_KEY, JSON.stringify(data));
      }

      setStatus(data);

      // Only check for toasts when agent is running (trades might be happening)
      if (data.isRunning) {
        await checkForNewToasts();
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    // Initial load - validate persisted state against server reality
    const initializeStatus = async () => {
      try {
        const response = await fetch('/api/trading/status');
        const serverStatus = await response.json();

        // If server says stopped but we have persisted running state, clear the persistence
        // This handles server restarts where the agent is no longer running
        if (!serverStatus.isRunning) {
          const persistedState = localStorage.getItem(TRADING_STATE_KEY);
          if (persistedState && JSON.parse(persistedState).isRunning) {
            console.log('🔄 Server restart detected - clearing stale running state from localStorage');
            localStorage.setItem(USER_STOPPED_KEY, 'true');
            localStorage.setItem(TRADING_STATE_KEY, JSON.stringify(serverStatus));
          }
        }

        // Now fetch status normally (this will respect the cleaned up state)
        await fetchStatus();
      } catch (error) {
        console.error('Error during initial status check:', error);
        // Fallback to normal fetch
        await fetchStatus();
      }
    };

    initializeStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const startTrading = async () => {
    setLoading(true);

    try {
      // Clear the explicit stop flag when starting
      setUserExplicitlyStopped(false);
      localStorage.setItem(USER_STOPPED_KEY, 'false');

      const response = await fetch('/api/trading/start', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        // Immediately set expected running state
        const runningState = {
          isRunning: true,
          mode: 'polling',
          positions: { totalPositions: 0, totalValue: 0, positions: [] },
          actionableTweets: [],
          startTime: new Date().toISOString()
        };
        localStorage.setItem(TRADING_STATE_KEY, JSON.stringify(runningState));

        // Fetch updated status
        await fetchStatus();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error starting trading: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const stopTrading = async () => {
    setLoading(true);
    try {
      // Mark that user explicitly clicked stop
      setUserExplicitlyStopped(true);
      localStorage.setItem(USER_STOPPED_KEY, 'true');

      const response = await fetch('/api/trading/stop', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        // Immediately set expected stopped state
        const stoppedState = {
          isRunning: false,
          mode: 'stopped' as const,
          positions: { totalPositions: 0, totalValue: 0, positions: [] },
          actionableTweets: [],
          startTime: null
        };
        localStorage.setItem(TRADING_STATE_KEY, JSON.stringify(stoppedState));

        await fetchStatus();
      } else {
        alert(`Error: ${data.error}`);
        // Reset flag if stop failed
        setUserExplicitlyStopped(false);
        localStorage.setItem(USER_STOPPED_KEY, 'false');
      }
    } catch (error) {
      alert(`Error stopping trading: ${error}`);
      // Reset flag if stop failed
      setUserExplicitlyStopped(false);
      localStorage.setItem(USER_STOPPED_KEY, 'false');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

    {/* Main Control Panel */}
    <div className="card p-8 border-gray-00 geometric-accent">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Trading Controls</h3>
            <p className="text-muted-foreground">
              Start or stop the AI trading agent to manage your positions automatically
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={startTrading}
              disabled={loading || status?.isRunning}
              className={`px-4 py-3 h-10 relative overflow-hidden ${
                status?.isRunning
                  ? 'btn-secondary cursor-default animate-pulse'
                  : 'btn-primary'
              }`}
            >
              {/* Subtle shimmer effect when trading is active */}
              {status?.isRunning && (
                <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              )}

              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : status?.isRunning ? (
                <div className="relative flex items-center">
                  <div className="animate-pulse">
                    <ActivityIcon />
                  </div>
                  <span className="ml-2">Trading in Progress</span>
                  {/* Subtle dots animation */}
                  <span className="ml-1 inline-flex space-x-1">
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              ) : (
                <>
                  <PlayIcon />
                  <span className="ml-2">Start Trading</span>
                </>
              )}
            </button>

            <button
              onClick={stopTrading}
              disabled={loading || !status?.isRunning}
              className="btn-destructive px-4 py-3 h-10"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <StopIcon />
                  <span className="ml-2">Stop Trading</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* Agent Status */}
        <div className="card p-6 border-gray-800 status-card-accent connection-lines">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full relative ${
                status?.isRunning ? 'bg-green-500' : 'bg-red-500'
              } animate-pulse`}>
                {/* Additional pulse ring when active */}
                {status?.isRunning && (
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-30" />
                )}
              </div>
              <span className="font-semibold text-card-foreground">Agent Status</span>
            </div>
            <ActivityIcon />
          </div>
          <div className="space-y-2">
            <div className={`text-2xl font-bold not-italic ${
              status?.isRunning ? 'text-green-600' : 'text-red-500'
            }`}>
              {status?.isRunning ? 'ACTIVE' : 'STOPPED'}
            </div>
            {status?.isRunning && (
              <div className={`inline-flex items-center space-x-3 px-2 py-1 rounded-md text-xs font-medium ${
                status.mode === 'streaming'
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>{status.mode === 'streaming' ? 'STREAMING' : 'POLLING'}</span>
              </div>
            )}
            {status?.startTime && (
              <p className="text-sm text-muted-foreground">
                Started {new Date(status.startTime).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Total Positions */}
        <div className="card p-6 border-gray-800 status-card-accent connection-lines">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-card-foreground">Total Positions</span>
            <TrendingUpIcon />
          </div>
          <div className="text-3xl font-bold text-gray-600 dark:text-gray-300">
            {status?.positions?.totalPositions ?? 0}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Active positions</p>
        </div>

        {/* Portfolio Prices */}
        <div className="card p-6 border-gray-800 status-card-accent">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-card-foreground">Portfolio Prices</span>
            <WalletIcon />
          </div>
          {status?.positions?.positions?.length ? (
            <div className="space-y-3">
              {status.positions.positions.map(position => {
                const amount = Number(position.amount ?? 0);
                const amountLabel = `${amount < 0 ? '-' : ''}${Math.abs(amount).toFixed(4)} ${position.token}`;
                return (
                  <div key={position.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-card-foreground flex items-center gap-2">
                        {position.token}
                        {position.source === 'synced' && (
                          <span className="text-[9px] uppercase tracking-wide text-blue-400 ">
                            Exising position
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {amountLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {position.marketPriceUsd !== null ? `$${position.marketPriceUsd.toFixed(2)}` : 'Price unavailable'}
                      </div>
                      <div className="text-xs text-muted-foreground">USD</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active positions</p>
          )}
        </div>
      </div>

      {/* Current Positions */}
      {status?.positions && (
        <div className="card p-8 border-gray-800">
          <div className="flex items-center space-x-3 mb-6">
            <TrendingUpIcon />
            <h3 className="text-2xl font-bold not-italic">Current Positions</h3>
          </div>

          {status.positions.positions.length > 0 ? (
            <div className="space-y-4">
              {status.positions.positions.map((position, index) => (
                <div
                  key={position.id}
                  className="border border-border rounded-lg p-6 hover:border-border/80 transition-colors animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="font-sans text-lg font-bold text-gray-600 dark:text-gray-300">
                          {position.token}
                        </div>
                        {position.source === 'synced' ? (
                          <div className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-300 text-[9px] border border-blue-400/30 uppercase tracking-wide">
                            Existing position
                          </div>
                        ) : (
                          <div className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-sm">
                            @{position.influencer}
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-semibold">
                        {`${position.amount < 0 ? '-' : ''}${Math.abs(position.amount).toFixed(4)} ${position.token}`}
                      </div>
                    </div>

                    {position.source !== 'synced' && (
                      <div className="flex items-center space-x-6 text-sm">
                        <div className="flex items-center space-x-2">
                          <ClockIcon />
                          <span className="text-muted-foreground">
                            Held: {position.hoursHeld !== null && position.hoursHeld !== undefined ? `${position.hoursHeld.toFixed(1)}h` : '--'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <TrendingUpIcon />
              </div>
              <h4 className="text-lg font-semibold mb-2">No Active Positions</h4>
              <p className="text-muted-foreground">
                Start the trading agent to begin monitoring and executing trades
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actionable Tweets */}
      {status?.actionableTweets && status.actionableTweets.length > 0 && (
        <div className="card p-8 border-gray-800">
          <div className="flex items-center space-x-3 mb-6">
            <TwitterIcon />
            <h3 className="text-2xl font-bold not-italic">Actionable Tweets</h3>
            <div className="text-sm text-muted-foreground">
              Tweets that triggered trades
            </div>
          </div>

          <div className="space-y-4">
            {status.actionableTweets.map((actionableTweet, index) => (
              <div
                key={actionableTweet.id}
                className="border border-border rounded-lg p-6 hover:border-border/80 transition-colors animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="space-y-4">
                  {/* Tweet Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                        {actionableTweet.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={actionableTweet.profileImageUrl}
                            alt={`@${actionableTweet.influencer}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <TwitterIcon />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-blue-400">
                          @{actionableTweet.influencer}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(actionableTweet.purchaseTime).toLocaleDateString()} at{' '}
                          {new Date(actionableTweet.purchaseTime).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className="font-sans text-lg font-bold text-gray-600 dark:text-gray-300">
                          {actionableTweet.token}
                        </div>
                        <div className="text-sm font-semibold">
                          {actionableTweet.amount.toFixed(6)}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                        actionableTweet.status === 'holding'
                          ? 'bg-green-900/20 text-green-400 border border-green-800/30'
                          : actionableTweet.status === 'sold'
                          ? 'bg-blue-900/20 text-blue-400 border border-blue-800/30'
                          : 'bg-red-900/20 text-red-400 border border-red-800/30'
                      }`}>
                        {actionableTweet.status.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Tweet Content */}
                  <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-300 leading-relaxed">
                      "{actionableTweet.tweet}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning for Polling Mode */}
      {status?.mode === 'polling' && (
        <div className="card p-6 border-amber-300/50 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-900/20">
          <div className="flex items-start space-x-4">
            <div className="w-5 h-5 text-amber-600 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold text-amber-800 dark:text-amber-300">
                Running in Polling Mode
              </h4>
              <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                <p>Your Twitter API access doesn't support real-time streaming</p>
                <p>Checking tweets every 5 minutes instead of real-time</p>
                <p>Some opportunities might be missed due to delay</p>
                <p>
                  To upgrade: Visit{' '}
                  <a
                    href="https://twitterapi.io/"
                    target="_blank"
                    className="underline hover:no-underline font-medium"
                  >
                    twitterapi.io
                  </a>{' '}
                  and upgrade to Basic tier
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
