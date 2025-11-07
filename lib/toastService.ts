// Toast service for server-side components and API routes
// This uses a simple in-memory store and broadcast mechanism

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
  timestamp: number;
}

// Simple in-memory toast store (in production, consider using Redis or database)
let toastStore: ToastData[] = [];

export class ToastService {

  // Add a toast notification
  static addToast(toastData: Omit<ToastData, 'id' | 'timestamp'>): ToastData {
    const toast: ToastData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      duration: 6000, // Default 6 seconds
      ...toastData,
    };

    toastStore.push(toast);

    // Clean up old toasts (keep only last 50)
    if (toastStore.length > 50) {
      toastStore = toastStore.slice(-50);
    }

    console.log(`🍞 [TOAST] Added: ${toast.type} - ${toast.title}`);
    return toast;
  }

  // Get recent toasts (for polling from client)
  static getRecentToasts(since?: number): ToastData[] {
    const cutoff = since || Date.now() - 30000; // Default to last 30 seconds
    return toastStore.filter(toast => toast.timestamp > cutoff);
  }

  // Clear all toasts
  static clearAllToasts(): void {
    toastStore = [];
  }

  // Create trade buy notification
  static addTradeBuyToast(data: {
    token: string;
    amount: string;
    influencer: string;
    price?: string;
    txHash?: string;
    explorerUrl?: string;
  }): ToastData {
    return this.addToast({
      type: 'trade-buy',
      title: `Bought ${data.token}`,
      message: `Purchased ${data.amount} of ${data.token}`,
      duration: 8000, // Longer duration for trades
      data: {
        token: data.token,
        amount: data.amount,
        influencer: data.influencer,
        price: data.price,
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
      }
    });
  }

  // Create trade sell notification
  static addTradeSellToast(data: {
    token: string;
    amount: string;
    profit?: string;
    price?: string;
    txHash?: string;
    explorerUrl?: string;
  }): ToastData {
    return this.addToast({
      type: 'trade-sell',
      title: `Sold ${data.token}`,
      message: `Liquidated ${data.token} position`,
      duration: 8000, // Longer duration for trades
      data: {
        token: data.token,
        amount: data.amount,
        profit: data.profit,
        price: data.price,
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
      }
    });
  }

  // Create error notification
  static addErrorToast(title: string, message: string, data?: any): ToastData {
    return this.addToast({
      type: 'error',
      title,
      message,
      duration: 10000, // Longer duration for errors
      data
    });
  }

  // Create success notification
  static addSuccessToast(title: string, message: string, data?: any): ToastData {
    return this.addToast({
      type: 'success',
      title,
      message,
      data
    });
  }

  // Create info notification
  static addInfoToast(title: string, message: string, data?: any): ToastData {
    return this.addToast({
      type: 'info',
      title,
      message,
      data
    });
  }
}
