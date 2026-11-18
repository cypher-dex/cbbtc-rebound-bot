import { BPS, runBars, type OrderInput } from './vendor/makefun-bars.ts';

const closes: number[] = [];
let heldSince = -1;
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
      if (
        value * 1000n >= held.cost * 1010n ||
        value * 1000n <= held.cost * 985n ||
        closes.length - heldSince >= 240
      ) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: 100 });
      }
      return orders;
    }

    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const peak = Math.max(...closes.slice(-11));
    if (last <= peak * (1 - 0.012) && last > prev) {
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      const size = state.cash < byWeight ? state.cash : byWeight;
      if (size >= minNotional) orders.push({ side: 'buy', symbol, notional_quote_units: size, max_slippage_bps: 100 });
      return orders;
    }

    if (!filled && !guardSent && closes.length >= 1380 && state.cash >= minNotional) {
      guardSent = true;
      orders.push({ side: 'buy', symbol, notional_quote_units: minNotional, max_slippage_bps: 100 });
    }
    return orders;
  },
});
