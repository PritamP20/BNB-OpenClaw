import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AgentPageClient } from "./AgentPageClient";
import type { Token } from "../../../hooks/useTokens";

interface Props {
  params: Promise<{ address: string }>;
}

function buildStubAgent(address: string): Token {
  return {
    address: address as `0x${string}`,
    name: address.slice(0, 8) + "…" + address.slice(-6),
    symbol: "AGENT",
    type: "agent",
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
  return {
    title: `Agent ${address.slice(0, 10)}… — AgentLaunch`,
    description: "AI Agent detail page on AgentLaunch — BNB Chain's intelligent token & AI agent launchpad.",
  };
}

export default async function AgentPage({ params }: Props) {
  const { address } = await params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) notFound();

  const token = buildStubAgent(address);

  return <AgentPageClient token={token} />;
}
