import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TokenDetailClient } from "./TokenDetailClient";
import { Token } from "../../../hooks/useTokens";

interface Props {
  params: Promise<{ address: string }>;
}

/** Build a minimal stub for a real on-chain token not yet in mock-data. */
function buildStubToken(address: string): Token {
  return {
    address: address as `0x${string}`,
    name: address.slice(0, 8) + "…" + address.slice(-6),
    symbol: "TOKEN",
    type: "normal",
    description: "",
    price: 0,
    marketCap: 0,
    volume24h: 0,
    priceChange24h: 0,
    graduationProgress: 0,
    reputationScore: 0,
    isGraduated: false,
    holders: 0,
    createdAt: Date.now(),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  // Metadata can't easily fetch from chain here, so we stub
  return {
    title: `Token ${address.slice(0, 10)}… — AgentLaunch`,
  };
}

export default async function TokenPage({ params }: Props) {
  const { address } = await params;

  // Must be a valid EVM address
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) notFound();

  const token = buildStubToken(address);

  return <TokenDetailClient token={token} />;
}
