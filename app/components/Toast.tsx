"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'trade-buy' | 'trade-sell';
  title: string;
  message: string;
  duration?: number;
  data?: {
    token?: string;
    amount?: string;
    influencer?: string;
    txHash?: string;
    price?: string;
    profit?: string;
    explorerUrl?: string;
  };
}

interface ToastContextType {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
  checkForNewToasts: () => Promise<void>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const lastFetchRef = useRef<number>(0);

  const addToast = (toastData: Omit<ToastData, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const toast: ToastData = {
      id,
      duration: 6000, // Default 6 seconds
      ...toastData,
    };

    setToasts(prev => [...prev, toast]);

    // Auto remove toast after duration
    setTimeout(() => {
      removeToast(id);
    }, toast.duration);
  };

  // Simplified approach - only poll when trading is active
  // We'll check for new toasts only when needed instead of continuous polling
  const checkForNewToasts = useCallback(async () => {
    try {
      const sinceParam = lastFetchRef.current ? `?since=${lastFetchRef.current}` : '';
      const response = await fetch(`/api/toasts${sinceParam}`, { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();

      data.toasts.forEach((serverToast: any) => {
        const clientToast: ToastData = {
          id: serverToast.id,
          type: serverToast.type,
          title: serverToast.title,
          message: serverToast.message,
          duration: serverToast.duration || 6000,
          data: serverToast.data
        };

        setToasts(prev => {
          if (prev.find(t => t.id === clientToast.id)) {
            return prev;
          }
          return [...prev, clientToast];
        });

        setTimeout(() => {
          removeToast(clientToast.id);
        }, clientToast.duration);
      });

      lastFetchRef.current = data.timestamp || Date.now();
    } catch (error) {
      console.error('Failed to check for toasts:', error);
    }
  }, []);

  useEffect(() => {
    checkForNewToasts();
    const interval = setInterval(checkForNewToasts, 5000);
    return () => clearInterval(interval);
  }, [checkForNewToasts]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, checkForNewToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
          index={index}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastData;
  onRemove: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onRemove, index }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'trade-buy':
        return 'bg-gradient-to-r from-emerald-500/90 to-green-600/90 border-emerald-400/50';
      case 'trade-sell':
        return 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90 border-blue-400/50';
      case 'success':
        return 'bg-gradient-to-r from-green-500/90 to-emerald-600/90 border-green-400/50';
      case 'error':
        return 'bg-gradient-to-r from-red-500/90 to-rose-600/90 border-red-400/50';
      case 'info':
      default:
        return 'bg-gradient-to-r from-gray-700/90 to-gray-800/90 border-gray-600/50';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'trade-buy':
        return (
          <div className="relative">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14l5-5 5 5H7z"/>
            </svg>
            <div className="absolute inset-0 animate-ping">
              <svg className="w-5 h-5 text-white opacity-30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14l5-5 5 5H7z"/>
              </svg>
            </div>
          </div>
        );
      case 'trade-sell':
        return (
          <div className="relative">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5H7z"/>
            </svg>
            <div className="absolute inset-0 animate-ping">
              <svg className="w-5 h-5 text-white opacity-30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5H7z"/>
              </svg>
            </div>
          </div>
        );
      case 'success':
        return (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-sm shadow-lg
        transform transition-all duration-300 ease-out
        ${getToastStyles()}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
        ${isLeaving ? 'translate-x-full opacity-0 scale-95' : ''}
      `}
      style={{
        animationDelay: `${index * 100}ms`,
        maxWidth: '400px'
      }}
    >
      {/* Shimmer effect for trade toasts */}
      {(toast.type === 'trade-buy' || toast.type === 'trade-sell') && (
        <div className="absolute inset-0 -skew-x-12 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}

      <div className="relative p-4">
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className="flex-shrink-0 pt-0.5">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white mb-1">
                  {toast.title}
                </h4>
                <p className="text-sm text-white/90 leading-relaxed">
                  {toast.message}
                </p>

                {/* Trade specific data */}
                {toast.data && (toast.type === 'trade-buy' || toast.type === 'trade-sell') && (
                  <div className="mt-2 space-y-1">
                    {toast.data.token && toast.data.amount && (
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Amount:</span>
                        <span className="font-mono">{toast.data.amount} ETH → {toast.data.token}</span>
                      </div>
                    )}
                    {toast.data.price && (
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Price:</span>
                        <span className="font-mono">${toast.data.price}</span>
                      </div>
                    )}
                    {toast.data.profit && toast.type === 'trade-sell' && (
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Profit:</span>
                        <span className={`font-mono ${parseFloat(toast.data.profit) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                          {parseFloat(toast.data.profit) >= 0 ? '+' : ''}${toast.data.profit}
                        </span>
                      </div>
                    )}
                    {toast.data.influencer && (
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span>Signal:</span>
                        <span>@{toast.data.influencer}</span>
                      </div>
                    )}
                    {toast.data.explorerUrl && (
                      <div className="mt-2">
                        <a
                          href={toast.data.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/90 hover:text-white underline hover:no-underline transition-colors"
                        >
                          View Transaction →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="flex-shrink-0 ml-2 p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-white/70 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full">
          <div
            className="h-full bg-white/40 animate-progress-bar"
            style={{
              animationDuration: `${toast.duration}ms`,
              animationTimingFunction: 'linear'
            }}
          />
        </div>
      </div>
    </div>
  );
}
