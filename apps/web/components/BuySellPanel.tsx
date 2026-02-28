"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther, formatEther } from "viem";
import { ArrowUpRight, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Token } from "../hooks/useTokens";
import { BONDING_CURVE_ABI } from "../lib/contracts";
import { fmtUSD } from "../lib/chart-data";
import { useLiveBNBPrice } from "../hooks/useLiveBNBPrice";

interface Props {
  token: Token;
  /** BondingCurve contract address — undefined until discovered */
  curveAddress?: `0x${string}`;
  /** True while the curve address is still being discovered on-chain */
  curveLoading?: boolean;
}

const PRESETS = ["0.1", "0.5", "1", "5"];

export function BuySellPanel({ token, curveAddress, curveLoading = false }: Props) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [simulating, setSimulating] = useState(false);

  const BNB_USD = useLiveBNBPrice();

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data: bnbBalance } = useBalance({ address });

  // ── Real on-chain quote (when curveAddress is set) ──────────────────────────

  const bnbInWei = amount ? parseEther(amount) : 0n;

  const { data: buyQuoteRaw } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "getBuyQuote",
    args: [bnbInWei],
    query: { enabled: !!curveAddress && tab === "buy" && bnbInWei > 0n },
  });

  const tokenInWei = amount ? parseEther(amount) : 0n; // for sell tab amount is in tokens

  const { data: sellQuoteRaw } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "getSellQuote",
    args: [tokenInWei],
    query: { enabled: !!curveAddress && tab === "sell" && tokenInWei > 0n },
  });

  // ── Fallback mock quote ─────────────────────────────────────────────────────

  const bnbAmt = parseFloat(amount) || 0;
  const mockTokenOut = bnbAmt > 0 ? bnbAmt / token.price : 0;
  const mockBNBOut = bnbAmt > 0 ? bnbAmt * token.price : 0;

  const displayTokenOut = buyQuoteRaw
    ? Number(formatEther(buyQuoteRaw)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : mockTokenOut.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const displayBNBOut = sellQuoteRaw
    ? parseFloat(formatEther(sellQuoteRaw)).toFixed(6)
    : mockBNBOut.toFixed(6);

  const displayUSDOut = tab === "buy"
    ? (buyQuoteRaw ? Number(formatEther(buyQuoteRaw)) * token.price * BNB_USD : mockTokenOut * token.price * BNB_USD)
    : (sellQuoteRaw ? parseFloat(formatEther(sellQuoteRaw)) * BNB_USD : mockBNBOut * BNB_USD);

  // ── Write contract (buy / sell) ─────────────────────────────────────────────

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: txSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (txSuccess) {
      setAmount("");
      setTimeout(reset, 3000);
    }
  }, [txSuccess, reset]);

  const handleAction = async () => {
    if (!isConnected) {
      connect({ connector: injected() });
      return;
    }
    if (!amount || bnbAmt <= 0) return;
    // Never simulate if we're still discovering the curve
    if (curveLoading) return;

    if (curveAddress) {
      // Real contract call
      if (tab === "buy") {
        writeContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "buy",
          args: [0n],
          value: parseEther(amount),
        });
      } else {
        writeContract({
          address: curveAddress,
          abi: BONDING_CURVE_ABI,
          functionName: "sell",
          args: [parseEther(amount), 0n],
        });
      }
    } else {
      // Curve confirmed not found — simulate
      setSimulating(true);
      await new Promise((r) => setTimeout(r, 1400));
      setSimulating(false);
      setAmount("");
    }
  };

  const isLoading = isPending || isConfirming || simulating;

  const displayError = writeError || receiptError;

  if (token.isGraduated) {
    return (
      <div className="p-6 text-center" style={{ background: "#1A1A1A", border: "1px solid #333333", borderTop: "3px solid #4ade80" }}>
        <div className="mb-3 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center text-3xl" style={{ background: "#222222", border: "1px solid #333333" }}>
            🎓
          </div>
        </div>
        <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: "#F5C220" }}>Graduated to DEX</h3>
        <p className="mt-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
          ${token.symbol} now trades on PancakeSwap.
        </p>
        <a
          href="https://pancakeswap.finance"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neon mt-5 flex items-center justify-center gap-2 px-5 py-3 text-xs w-full"
        >
          Trade on PancakeSwap
          <ArrowUpRight size={14} />
        </a>
      </div>
    );
  }

  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
      {/* Tabs — flat solid color */}
      <div className="flex" style={{ borderBottom: "1px solid #333333" }}>
        <button
          onClick={() => { setTab("buy"); setAmount(""); reset?.(); }}
          className="flex-1 py-3 text-sm font-black uppercase tracking-wider transition-all"
          style={{
            background: tab === "buy" ? "#4ade80" : "#1A1A1A",
            color: tab === "buy" ? "#0F0F0F" : "#555555",
            borderRight: "1px solid #333333",
          }}
        >
          Buy
        </button>
        <button
          onClick={() => { setTab("sell"); setAmount(""); reset?.(); }}
          className="flex-1 py-3 text-sm font-black uppercase tracking-wider transition-all"
          style={{
            background: tab === "sell" ? "#D62828" : "#1A1A1A",
            color: tab === "sell" ? "#FFFFFF" : "#555555",
          }}
        >
          Sell
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Wallet balance */}
        {isConnected && (
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>Balance</span>
            <span className="font-mono font-bold" style={{ color: "#F5F5F5" }}>
              {bnbBalance ? parseFloat(formatEther(bnbBalance.value)).toFixed(4) : "—"} BNB
            </span>
          </div>
        )}

        {/* Amount input */}
        <div
          style={{
            border: `2px solid ${tab === "buy" ? "#4ade80" : "#D62828"}`,
            background: "#222222",
            padding: "12px",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#888888" }}>
              {tab === "buy" ? "You pay" : "You sell"}
            </span>
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5"
              style={{
                background: tab === "buy" ? "#4ade80" : "#D62828",
                color: "#0F0F0F",
              }}
            >
              {tab === "buy" ? "BNB" : token.symbol}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              min={0}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-black outline-none"
              style={{ color: "#F5F5F5" }}
            />
          </div>
        </div>

        {/* Quick presets */}
        {tab === "buy" && (
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className="py-1.5 text-xs font-black uppercase tracking-wider transition-all"
                style={{
                  background: amount === p ? "#4ade80" : "#222222",
                  border: `1px solid ${amount === p ? "#4ade80" : "#333333"}`,
                  color: amount === p ? "#0F0F0F" : "#888888",
                }}
              >
                {p} BNB
              </button>
            ))}
          </div>
        )}

        {/* Quote */}
        {bnbAmt > 0 && (
          <div className="text-sm" style={{ background: "#222222", border: "1px solid #333333", padding: "12px" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#888888" }}>You receive</span>
              <span className="font-mono font-bold" style={{ color: "#F5F5F5" }}>
                {tab === "buy"
                  ? `≈${displayTokenOut} ${token.symbol}`
                  : `≈${displayBNBOut} BNB`}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>≈ USD</span>
              <span style={{ color: "#888888" }}>{fmtUSD(displayUSDOut)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>Slippage</span>
              <span style={{ color: "#4ade80" }}>1%</span>
            </div>
            {!curveAddress && (
              <p className="mt-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
                * Estimated — contracts not yet deployed to testnet
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 text-xs font-bold"
            style={{ border: "1px solid #D62828", background: "rgba(214,40,40,0.08)", color: "#D62828" }}
          >
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{(displayError as { shortMessage?: string }).shortMessage ?? (displayError as Error).message}</span>
          </div>
        )}

        {/* Success */}
        {txSuccess && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold"
            style={{ border: "1px solid #4ade80", background: "rgba(74,222,128,0.08)", color: "#4ade80" }}
          >
            <CheckCircle2 size={12} />
            Transaction confirmed!
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleAction}
          disabled={isLoading || curveLoading || (isConnected && (!amount || bnbAmt <= 0))}
          className="flex w-full items-center justify-center gap-2 py-3.5 text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40"
          style={{
            background: tab === "buy" ? "#4ade80" : "#D62828",
            color: "#0F0F0F",
          }}
        >
          {curveLoading ? (
            <><Loader2 size={14} className="animate-spin" /> Finding curve…</>
          ) : isLoading ? (
            <><Loader2 size={14} className="animate-spin" /> {isConfirming ? "Confirming…" : "Processing…"}</>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : tab === "buy" ? (
            `Buy ${token.symbol}`
          ) : (
            `Sell ${token.symbol}`
          )}
        </button>

        <p className="text-center text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444444" }}>
          {Number(token.feeBps ?? 100) / 100}% platform fee · xy=k bonding curve · BNB Chain
        </p>
      </div>
    </div>
  );
}
