[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/cypher-dex/cbbtc-rebound-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/cypher-dex/cbbtc-rebound-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

# cbbtc-rebound-bot

A cbBTC/USDC dip-rebound bot for make.fun's 24-hour BTC race (protocol agent-fun/bars-replay/v1, Node 22, `node main.ts`).

## Strategy

- **Entry (flat):** the latest close is at least 1.2% below the highest of the latest 11 closes and above the previous close. Buys with the smaller of the cash and `max_weight_bps` of equity, 100 bps slippage cap.
- **Exit (holding):** sells the whole position when its value is at least +1.0% or at most −1.5% against its cost, or after 240 bars held.
- **Guardrail:** if nothing has filled by the 1,380th close, buys the minimum notional once, so the entry always trades.
- Deterministic: no wall clock, no randomness.

## Dev result

Local grade on the dev window (`grade-local --driver process`): net PnL **+9.337934 USDC**, 2 trades, max drawdown 0.48%, guardrails met, regrade reproduced byte for byte.

Built for [make.fun](https://make.fun/).
