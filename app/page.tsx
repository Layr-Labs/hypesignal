import TradingControls from "./components/TradingControls";
import InfluencerList from "./components/InfluencerList";
import { headers } from "next/headers";
import type { TradingStatus } from "@/types/tradingStatus";

export const dynamic = 'force-dynamic';

export default async function Home() {
  let initialStatus: TradingStatus | null = null;

  try {
    const host = headers().get('host');
    if (host) {
      const protocol = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      const response = await fetch(`${protocol}://${host}/api/trading/status`, {
        cache: 'no-store'
      });

      if (response.ok) {
        initialStatus = await response.json();
      } else {
        console.error('Failed to fetch initial trading status:', await response.text());
      }
    } else {
      console.error('Unable to resolve request host for initial status fetch');
    }
  } catch (error) {
    console.error('Failed to fetch initial trading status:', error);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Influencer Monitoring Section */}
      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <InfluencerList />
      </div>

      {/* Main Trading Interface */}
      <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
        <TradingControls initialStatus={initialStatus} />
      </div>
    </div>
  );
}
