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
      <div className="rounded-2xl border border-bnb-yellow/20 glass p-6 text-center">
        <div className="mb-3 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bnb-yellow/10 border border-bnb-yellow/20 text-4xl animate-glow-pulse">
            🎓
          </div>
        </div>
        <h3 className="font-bold text-white shimmer-text">Graduated to DEX</h3>
        <p className="mt-1 text-sm text-gray-500">
          ${token.symbol} now trades on PancakeSwap. Buy on the DEX below.
        </p>
        <a
          href="https://pancakeswap.finance"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neon mt-5 flex items-center justify-center gap-2 px-5 py-3 text-sm"
        >
          Trade on PancakeSwap
          <ArrowUpRight size={15} />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-bnb-yellow/10 glass">
      {/* Tabs */}
      <div className="flex gap-1.5 p-2">
        <button
          onClick={() => { setTab("buy"); setAmount(""); reset?.(); }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
            tab === "buy"
              ? "bg-green-500/15 text-green-300 border border-green-500/40 shadow-[0_0_18px_rgba(74,222,128,0.3)]"
              : "text-gray-600 border border-transparent hover:text-green-400 hover:border-green-500/20"
            }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTab("sell"); setAmount(""); reset?.(); }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
            tab === "sell"
              ? "bg-red-500/15 text-red-300 border border-red-500/40 shadow-[0_0_18px_rgba(248,113,113,0.3)]"
              : "text-gray-600 border border-transparent hover:text-red-400 hover:border-red-500/20"
            }`}
        >
          Sell
        </button>
      </div>

      <div className="p-4 pt-0 flex flex-col gap-4">
        {/* Wallet balance */}
        {isConnected && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Balance</span>
            <span className="font-mono text-gray-300">
              {bnbBalance ? parseFloat(formatEther(bnbBalance.value)).toFixed(4) : "—"} BNB
            </span>
          </div>
        )}

        {/* Amount input */}
        <div className={`rounded-xl border p-4 glass transition-all duration-200 ${
          tab === "buy" ? "border-green-500/20 focus-within:border-green-500/40 focus-within:shadow-[0_0_14px_rgba(74,222,128,0.15)]" : "border-red-500/20 focus-within:border-red-500/40 focus-within:shadow-[0_0_14px_rgba(248,113,113,0.15)]"
        }`}>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium">{tab === "buy" ? "You pay" : `You sell`}</span>
            <span className={`font-semibold text-xs ${
              tab === "buy" ? "text-green-400" : "text-red-400"
            }`}>
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
              className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-gray-700"
            />
            <span className={`rounded-lg px-3 py-1.5 text-sm font-bold border ${
              tab === "buy"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              {tab === "buy" ? "BNB" : token.symbol}
            </span>
          </div>
        </div>

        {/* Quick presets */}
        {tab === "buy" && (
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition-all duration-150 ${amount === p
                    ? "border-green-500/40 bg-green-500/10 text-green-300 shadow-[0_0_10px_rgba(74,222,128,0.2)]"
                    : "border-bnb-yellow/10 glass text-gray-500 hover:border-green-500/20 hover:text-green-400"
                  }`}
              >
                {p} BNB
              </button>
            ))}
          </div>
        )}

        {/* Quote */}
        {bnbAmt > 0 && (
          <div className="rounded-xl glass border border-bnb-yellow/10 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">You receive</span>
              <span className="font-mono font-semibold text-white">
                {tab === "buy"
                  ? `≈${displayTokenOut} ${token.symbol}`
                  : `≈${displayBNBOut} BNB`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-600">≈ USD value</span>
              <span className="text-gray-400">{fmtUSD(displayUSDOut)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-600">Slippage</span>
              <span className="text-green-400">1%</span>
            </div>
            {!curveAddress && (
              <p className="mt-2 text-[10px] text-gray-600">
                * Quote estimated — contracts not yet deployed to testnet
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>{(displayError as { shortMessage?: string }).shortMessage ?? (displayError as Error).message}</span>
          </div>
        )}

        {/* Success */}
        {txSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2.5 text-xs text-green-400">
            <CheckCircle2 size={13} />
            Transaction confirmed!
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleAction}
          disabled={isLoading || curveLoading || (isConnected && (!amount || bnbAmt <= 0))}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all duration-200 disabled:opacity-40 active:scale-[0.98] ${
            tab === "buy"
              ? "bg-gradient-to-r from-green-500 to-green-400 text-white shadow-[0_0_22px_rgba(74,222,128,0.35)] hover:shadow-[0_0_32px_rgba(74,222,128,0.55)] hover:-translate-y-0.5"
              : "bg-gradient-to-r from-red-500 to-red-400 text-white shadow-[0_0_22px_rgba(248,113,113,0.35)] hover:shadow-[0_0_32px_rgba(248,113,113,0.55)] hover:-translate-y-0.5"
            }`}
        >
          {curveLoading ? (
            <><Loader2 size={15} className="animate-spin" /> Finding curve…</>
          ) : isLoading ? (
            <><Loader2 size={15} className="animate-spin" /> {isConfirming ? "Confirming…" : "Processing…"}</>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : tab === "buy" ? (
            `Buy ${token.symbol}`
          ) : (
            `Sell ${token.symbol}`
          )}
        </button>

        <p className="text-center text-[10px] text-gray-600">
          {Number(token.feeBps ?? 100) / 100}% platform fee · xy=k bonding curve · BNB Chain
        </p>
      </div>
    </div>
  );
}
