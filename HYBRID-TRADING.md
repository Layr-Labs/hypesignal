# 🌊 Hyperliquid Trading Flow

## Architecture Overview

```
🧠 Sentiment Signal → 🎯 Market Routing → 📈 Orderbook Quote → ⚡ Hyperliquid Order
```

- Tweets are scored for sentiment and token mentions.
- Symbols are normalized and routed to Hyperliquid markets (e.g., `WETH → ETH`).
- The bot fetches the current best ask directly from Hyperliquid via `InfoClient`.
- An IOC limit order is sent through `ExchangeClient` with configurable slippage.

## What’s Included

| Component | Description |
| --- | --- |
| `lib/trading.ts` | End-to-end execution against Hyperliquid (route, quote, order, persistence). |
| `config/trading.ts` | Controls influencers, trade size, sentiment confidence, allowed markets, and Hyperliquid params. |
| `.env` variables | Provide the API wallet private key, environment (`mainnet` / `testnet`), and slippage settings. |
| `toastService` | Adds buy notifications with Hyperliquid order ids + explorer links. |

## Key Features

- ✅ **Single venue** — All fills are executed on Hyperliquid using the official TypeScript SDK.
- ✅ **Market allowlist** — Restrict trading to markets you trust via `HYPERLIQUID_ALLOWED_MARKETS`.
- ✅ **Symbol routing** — Map noisy tweet tickers (`WETH`, `ENA`, etc.) onto Hyperliquid listing names.
- ✅ **Dynamic quoting** — Uses Level 2 books to derive the live best ask before building the order.
- ✅ **Slippage controls** — Configurable `HYPERLIQUID_SLIPPAGE_BPS` feeds the IOC limit price buffer.
- ✅ **Position tracking** — Every successful fill is saved to SQLite with the originating tweet metadata.

## Environment Variables

```
HYPERLIQUID_PRIVATE_KEY=0x...         # API wallet private key
HYPERLIQUID_ENVIRONMENT=testnet       # mainnet | testnet
HYPERLIQUID_ALLOWED_MARKETS=ETH,BTC   # Comma separated, uppercase
HYPERLIQUID_SLIPPAGE_BPS=50           # 0.50% default
HYPERLIQUID_TIME_IN_FORCE=Ioc         # Ioc | Gtc | Alo | FrontendMarket | LiquidationMarket
HYPERLIQUID_EXPLORER_URL=https://app.hyperliquid.xyz/exchange (optional override)
MAX_TRADE_AMOUNT_USD=30               # USD notional per trade
```

## Configuration Snapshot (`config/trading.ts`)

```ts
export const TRADING_CONFIG = {
  influencers: ['blknoiz06', 'dabit3', 'trading_axe'],
  maxTradeAmountUSD: 30,
  tweetMaxAgeHours: 6,
  minimumConfidence: 70,
  hyperliquid: {
    enabled: true,
    environment: 'testnet',
    allowedMarkets: [],
    slippageBps: 50,
    timeInForce: 'Ioc',
    symbolRouting: {
      WETH: 'ETH',
      ETH: 'ETH',
      SOL: 'SOL',
      BTC: 'BTC',
      EIGEN: 'EIGEN'
    }
  }
};
```

## Execution Flow

1. **Sentiment** – Tweet qualifies (confidence ≥ threshold).
2. **Routing** – Token ticker normalized via `symbolRouting`.
3. **Allowance Check** – Reject tokens not present in `allowedMarkets` (skipped when empty or set to `*`).
4. **Metadata Fetch** – Use `SymbolConverter` to obtain asset id + size decimals.
5. **Quote** – `InfoClient.l2Book` retrieves the best ask.
6. **Order Build** – IOC limit order with notional `MAX_TRADE_AMOUNT_USD`, slippage buffer, lot-size rounding.
7. **Submission** – `ExchangeClient.order` signs and submits with the API wallet.
8. **Persistence** – Successful fills saved to SQLite + toast notification dispatched.

## Example Log Snippet

```
🔍 [TRADE_EXEC] Order parameters: { market: 'EIGEN', bestAsk: 3.84, limitPrice: '3.86', size: '7.7748', slippageBps: 50 }
🔍 [TRADE_EXEC] ✅ Hyperliquid order filled: { orderId: 123456, symbol: 'EIGEN', filledSize: 7.7748, avgPrice: 3.859 }
```

## Next Steps / Ideas

- Add shorting support (set `b: false` with reduce-only logic).
- Implement position management / stop-losses using Hyperliquid trigger orders.
- Extend `symbolRouting` with programmatic mappings using the Hyperliquid metadata feed.
- Subscribe to WebSocket fills for real-time UI updates.
