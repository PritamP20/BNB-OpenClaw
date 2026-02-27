"use client";

import { useState, useEffect, useMemo } from "react";
import { usePublicClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatUnits } from "viem";
import {
    ADDRESSES,
    TOKEN_FACTORY_ABI,
    REPUTATION_ENGINE_ABI,
    BONDING_CURVE_ABI
} from "../lib/contracts";
import { fetchAllLogs } from "../lib/fetchLogs";


export type TokenType = "normal" | "agent" | "skill";

export interface Token {
    address: `0x${string}`;
    name: string;
    symbol: string;
    type: TokenType;
    description: string;
    price: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    graduationProgress: number;
    reputationScore: number;
    isGraduated: boolean;
    holders: number;
    createdAt: number;
    creator?: string;
    agentId?: bigint;
    parentAgent?: string;
    feeBps?: number;
    curveAddress?: `0x${string}`;
}

export function useTokens() {
    const publicClient = usePublicClient({ chainId: bscTestnet.id });
    const [tokens, setTokens] = useState<Token[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTokens = async () => {
        if (!publicClient || !ADDRESSES.tokenFactory) return;

        setIsLoading(true);
        setError(null);

        try {
            // ── Fetch Deployment Events ──────────────────────────────────────────
            // Using PublicNode RPC for reliable historical log fetching.
            const fetchLogs = async (name: "NormalTokenDeployed" | "AgentTokenDeployed" | "SkillTokenDeployed") => {
                const item = TOKEN_FACTORY_ABI.find(x => x.name === name);
                if (!item || item.type !== "event") return [];

                try {
                    return await fetchAllLogs({
                        client: publicClient,
                        address: ADDRESSES.tokenFactory as `0x${string}`,
                        event: item as any,
                        fromBlock: ADDRESSES.startBlock,
                    });
                } catch (e) {
                    console.error(`Error fetching RPC logs for ${name}:`, e);
                    return [];
                }
            };

            const [normalLogs, agentLogs, skillLogs] = await Promise.all([
                fetchLogs("NormalTokenDeployed"),
                fetchLogs("AgentTokenDeployed"),
                fetchLogs("SkillTokenDeployed")
            ]);

            console.log("Raw logs fetched:", {
                normal: normalLogs.length,
                agent: agentLogs.length,
                skill: skillLogs.length
            });

            const allEvents = [
                ...normalLogs.map(l => ({ ...l, type: "normal" as const })),
                ...agentLogs.map(l => ({ ...l, type: "agent" as const })),
                ...skillLogs.map(l => ({ ...l, type: "skill" as const }))
            ];

            console.log("Total events combined:", allEvents.length);

            // 2. Map basic info from events
            const tokenList: Token[] = allEvents.map((event: any) => {
                const args = event.args;
                return {
                    address: args.token,
                    name: args.name || "Unknown",
                    symbol: args.symbol || "TOKEN",
                    type: event.type,
                    description: "",
                    price: 0,
                    marketCap: 0,
                    volume24h: 0,
                    priceChange24h: 0,
                    graduationProgress: 0,
                    reputationScore: 0,
                    isGraduated: false,
                    holders: 0,
                    createdAt: 0,
                    creator: args.creator,
                    agentId: args.agentId
                };
            });

            // 3. Enrich with real-time data
            const enrichedTokens = await Promise.all(tokenList.map(async (token) => {
                try {
                    if (!ADDRESSES.reputationEngine) return token;

                    const reputation = await publicClient.readContract({
                        address: ADDRESSES.reputationEngine,
                        abi: REPUTATION_ENGINE_ABI,
                        functionName: "getReputation",
                        args: [token.address]
                    }) as any;

                    return {
                        ...token,
                        reputationScore: Number(reputation.score || 0n),
                        isGraduated: reputation.graduated || false,
                        createdAt: Number(reputation.launchTime || 0n)
                    } as Token;
                } catch (e) {
                    console.error(`Error enriching token ${token.address}:`, e);
                    return token;
                }
            }));

            console.log("Tokens after enrichment:", enrichedTokens.length);
            setTokens(enrichedTokens);
        } catch (err: any) {
            console.error("Error fetching tokens:", err);
            setError(err.message || "Failed to fetch tokens");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTokens();
    }, [publicClient]);

    return { tokens, isLoading, error, refresh: fetchTokens };
}
