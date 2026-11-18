// cbbtc-rebound-bot: buy a short, sharp dip in cbBTC once it ticks back up, and take a small profit.
//
// One symbol (the universe's only one), one-minute bars, long only. Every close is kept as a number.
//   - Entry, when flat: the latest close is at least DIP (1.2%) below the highest of the latest
//     PEAK_LOOKBACK (11) closes, the current one and the 10 before it, AND above the previous close
//     (the rebound has started). It buys with the smaller of the cash and caps.max_weight_bps of
//     equity, if that is at least fees.min_notional_quote_units.
//   - Exit, when holding: the position's value at the latest close (state.value) against its cost,
//     fees included. The whole position is sold when the value is at least TAKE_PROFIT (+1.0%) above
//     the cost, at least STOP_LOSS (-1.5%) below it, or it has been held MAX_HOLD_BARS (240) bars.
//   - Guardrail: the race ranks an entry with no trade last, so if nothing has filled by close
//     GUARD_CLOSE (1,380), it buys the minimum notional once.
//   - No order while state.warmingUp. Every order caps its slippage at MAX_SLIPPAGE_BPS from the close
//     it was decided on. No wall clock, no randomness: the same bars give the same orders.

import { BPS, runBars, type OrderInput } from './vendor/makefun-bars.ts';

/** Entry: how far below the recent peak the close must be (1.2%). */
const DIP = 0.012;
/** Entry: the closes the peak is taken over, the current one included. */
const PEAK_LOOKBACK = 11;
/** Exit: value / cost at or above 1010 / 1000 (+1.0%). */
const TAKE_PROFIT = [1010n, 1000n] as const;
/** Exit: value / cost at or below 985 / 1000 (-1.5%). */
const STOP_LOSS = [985n, 1000n] as const;
/** Exit: bars held before the position is sold whatever its value. */
const MAX_HOLD_BARS = 240;
/** Guardrail: the close by which a bot with no fill buys the minimum notional once. */
const GUARD_CLOSE = 1380;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
/** closes.length when the open position first showed in the account; -1 when flat. */
let heldSince = -1;
/** Whether any order of ours has filled. */
let filled = false;
let guardSent = false;

await runBars({
  onBatch(state, batch) {
    const symbol = state.hello.symbols[0].symbol;
    for (const bar of batch.bars) if (bar.symbol === symbol) closes.push(Number(bar.c));
    for (const f of batch.fills) if (f.status === 'filled') filled = true;

    const held = state.positions.get(symbol);
    if (held === undefined) heldSince = -1;
    else if (heldSince < 0) heldSince = closes.length;

    if (state.warmingUp || closes.length < 2) return [];
    const { caps, fees } = state.hello;
    const minNotional = BigInt(fees.min_notional_quote_units);
    const orders: OrderInput[] = [];

    if (held !== undefined) {
      const value = state.value(symbol, held.qty);
      const takeProfit = value * TAKE_PROFIT[1] >= held.cost * TAKE_PROFIT[0];
      const stopLoss = value * STOP_LOSS[1] <= held.cost * STOP_LOSS[0];
      const expired = closes.length - heldSince >= MAX_HOLD_BARS;
      if (takeProfit || stopLoss || expired) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
      return orders;
    }

    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const peak = Math.max(...closes.slice(-PEAK_LOOKBACK));
    if (last <= peak * (1 - DIP) && last > prev) {
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      const size = state.cash < byWeight ? state.cash : byWeight;
      if (size >= minNotional) orders.push({ side: 'buy', symbol, notional_quote_units: size, max_slippage_bps: MAX_SLIPPAGE_BPS });
      return orders;
    }

    if (!filled && !guardSent && closes.length >= GUARD_CLOSE && state.cash >= minNotional) {
      guardSent = true;
      orders.push({ side: 'buy', symbol, notional_quote_units: minNotional, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders;
  },
});
