"use client";

import { useState, useEffect } from "react";
import { BNB_USD as FALLBACK } from "../lib/chart-data";

/**
 * Fetches the live BNB/USDT price from Binance public REST API.
 * Falls back to the hardcoded constant (620) if the request fails.
 */
export function useLiveBNBPrice() {
  const [price, setPrice] = useState<number>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    const fetch_ = async () => {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT",
          { cache: "no-store" }
        );
        const data = await res.json() as { price?: string };
        const p = parseFloat(data.price ?? "");
        if (!cancelled && p > 0) setPrice(p);
      } catch {
        // keep fallback value
      }
    };

    fetch_();
    // refresh every 30 s
    const id = setInterval(fetch_, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return price;
}
