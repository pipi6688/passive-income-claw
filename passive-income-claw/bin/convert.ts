#!/usr/bin/env node
// Currency conversion using Binance spot price
import { BASE_URL, die, out, main } from "./lib.ts";

main(async () => {
const [amountStr, fromRaw, toRaw] = process.argv.slice(2);
if (!amountStr || !fromRaw || !toRaw) die("Usage: convert.ts <amount> <from> <to>");

const amount = parseFloat(amountStr);
if (isNaN(amount)) die("Invalid amount");

const from = fromRaw.toUpperCase();
const to = toRaw.toUpperCase();

if (from === to) {
  out({ amount, asset: to, rate: 1, source: "identity" });
  process.exit(0);
}

async function getPrice(symbol: string): Promise<number | null> {
  try {
    const resp = await fetch(`${BASE_URL}/api/v3/ticker/price?symbol=${symbol}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.price ? parseFloat(data.price) : null;
  } catch {
    return null;
  }
}

// Try TO+FROM (e.g. BNBUSDT → price of BNB in USDT)
const pair1 = `${to}${from}`;
let price = await getPrice(pair1);
if (price !== null) {
  out({
    amount: parseFloat((amount / price).toFixed(8)),
    asset: to,
    rate: price,
    source: pair1,
    direction: "divide",
  });
  process.exit(0);
}

// Try FROM+TO
const pair2 = `${from}${to}`;
price = await getPrice(pair2);
if (price !== null) {
  out({
    amount: parseFloat((amount * price).toFixed(8)),
    asset: to,
    rate: price,
    source: pair2,
    direction: "multiply",
  });
  process.exit(0);
}

die(`No trading pair found for ${from}/${to}`);
});
