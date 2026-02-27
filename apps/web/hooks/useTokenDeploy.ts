"use client";

/**
 * useTokenDeploy — multi-step on-chain deployment hook.
 *
 * Agent flow:
 *   1. mintAgent() on NFAManager → parse ERC-721 Transfer event for agentId
 *   2. deployAgentToken() on TokenFactory → parse AgentTokenDeployed event for token address
 *   3. POST /api/agents/list (Dockerfile upload) → returns agentDbId (UUID)
 *
 * Normal flow:
 *   deployNormalToken() → parse NormalTokenDeployed event
 *
 * Skill flow:
 *   deploySkillToken() → parse SkillTokenDeployed event
 */

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient, useChainId, useSwitchChain } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { parseEventLogs, parseEther, stringToHex } from "viem";
import { ADDRESSES, TOKEN_FACTORY_ABI, NFA_MANAGER_ABI } from "../lib/contracts";

// ── ERC-721 Transfer event (emitted by NFAManager on mintAgent) ─────────────

const ERC721_TRANSFER_EVENT = {
  name: "Transfer",
  type: "event" as const,
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

// ── Step state machine ────────────────────────────────────────────────────────

export type DeployStep =
  | "idle"
  | "minting-nfa"
  | "deploying-token"
  | "calling-api"
  | "done"
  | "error";

export const STEP_LABELS: Record<DeployStep, string> = {
  "idle": "",
  "minting-nfa": "Minting NFA identity on-chain…",
  "deploying-token": "Deploying token contract…",
  "calling-api": "Registering agent on CreateOS…",
  "done": "Done!",
  "error": "Failed",
};

// ── Param types ───────────────────────────────────────────────────────────────

export interface DeployAgentParams {
  type: "agent";
  // Token
  name: string;
  symbol: string;
  supply: bigint; // already in base units (18 dec)
  // NFA
  logicAddress: `0x${string}`;
  metadataURI: string;
  learningEnabled: boolean;
  treasury: `0x${string}`;
  developerWallet: `0x${string}`;
  // Docker
  dockerImage: string;  // pre-built Docker Hub image, e.g. "username/myagent:latest"
  containerPort: number;
  runEnvsJson: string;
}

export interface DeployNormalParams {
  type: "normal";
  name: string;
  symbol: string;
  supply: bigint;
  maxSupply: bigint;
}

export interface DeploySkillParams {
  type: "skill";
  name: string;
  symbol: string;
  supply: bigint;
  agentId: bigint;
  skillId: string; // human-readable → bytes32
  costPerUse: bigint;
}

export type DeployParams = DeployAgentParams | DeployNormalParams | DeploySkillParams;

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTokenDeploy() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  /** Read the current launchFee from the contract (returns 0n if call fails). */
  const getLaunchFee = async (): Promise<bigint> => {
    if (!publicClient || !ADDRESSES.tokenFactory) return 0n;
    try {
      return await publicClient.readContract({
        address: ADDRESSES.tokenFactory,
        abi: TOKEN_FACTORY_ABI,
        functionName: "launchFee",
      }) as bigint;
    } catch {
      return 0n;
    }
  };

  const [step, setStep] = useState<DeployStep>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(null);
  const [agentNFAId, setAgentNFAId] = useState<bigint | null>(null);
  const [agentDbId, setAgentDbId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setTxHash(null);
    setTokenAddress(null);
    setAgentNFAId(null);
    setAgentDbId(null);
    setError(null);
  }, []);

  const deploy = useCallback(async (params: DeployParams) => {
    if (!publicClient) {
      setStep("error");
      setError("Wallet not connected or chain not supported.");
      return;
    }

    // Reset before each new deploy attempt
    setStep("idle");
    setError(null);
    setTxHash(null);
    setTokenAddress(null);
    setAgentNFAId(null);
    setAgentDbId(null);

    try {
      // ── Ensure wallet is on BSC Testnet ───────────────────────────────────
      if (currentChainId !== bscTestnet.id) {
        await switchChainAsync({ chainId: bscTestnet.id });
      }

      // ── Agent ─────────────────────────────────────────────────────────────
      if (params.type === "agent") {
        const nfaAddr = ADDRESSES.nfaManager;
        const factoryAddr = ADDRESSES.tokenFactory;
        if (!nfaAddr || !factoryAddr) {
          throw new Error("Contracts not deployed yet. Check NEXT_PUBLIC_NFA_MANAGER and NEXT_PUBLIC_TOKEN_FACTORY.");
        }

        // Step 1 — Mint NFA (ERC-721)
        setStep("minting-nfa");
        const mintHash = await writeContractAsync({
          address: nfaAddr,
          abi: NFA_MANAGER_ABI,
          functionName: "mintAgent",
          args: [
            params.developerWallet,
            params.logicAddress || ZERO_ADDR,
            params.metadataURI,
            params.learningEnabled,
          ],
        });
        setTxHash(mintHash);

        const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

        // Extract agentId from ERC-721 Transfer(from=0, to=dev, tokenId=agentId)
        const transferLogs = parseEventLogs({
          abi: [ERC721_TRANSFER_EVENT],
          eventName: "Transfer",
          logs: mintReceipt.logs,
        });
        const agentId = transferLogs[0]?.args.tokenId;
        if (agentId === undefined) {
          throw new Error("Could not read agentId from Transfer event — tx may have failed.");
        }
        setAgentNFAId(agentId);

        // Step 2 — Deploy AgentToken via TokenFactory
        setStep("deploying-token");
        const agentFee = await getLaunchFee();
        const deployHash = await writeContractAsync({
          address: factoryAddr,
          abi: TOKEN_FACTORY_ABI,
          functionName: "deployAgentToken",
          args: [
            params.name,
            params.symbol,
            params.supply,
            0n,            // maxSupply: 0 = uncapped
            agentId,
            params.treasury,
          ],
          value: agentFee,
        });
        setTxHash(deployHash);

        const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
        if (deployReceipt.status === "reverted") {
          throw new Error("deployAgentToken transaction reverted — check launchFee or agent parameters.");
        }

        const agentTokenLogs = parseEventLogs({
          abi: TOKEN_FACTORY_ABI,
          eventName: "AgentTokenDeployed",
          logs: deployReceipt.logs,
        });
        const tokenAddr = agentTokenLogs[0]?.args.token;
        if (!tokenAddr) {
          throw new Error("Could not read token address from AgentTokenDeployed event.");
        }
        setTokenAddress(tokenAddr);

        // Step 3 — Register Docker agent on API
        setStep("calling-api");
        const body = new URLSearchParams();
        body.append("name", params.name);
        body.append("description", params.metadataURI);
        body.append("developer_wallet", params.developerWallet);
        body.append("token_address", tokenAddr);
        body.append("container_port", params.containerPort.toString());
        body.append("docker_image", params.dockerImage);
        if (params.runEnvsJson && params.runEnvsJson !== "{}") {
          body.append("run_envs", params.runEnvsJson);
        }

        const resp = await fetch(`${API_URL}/api/agents/list`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const data = await resp.json() as {
          agentId?: string; errors?: string[]; error?: string;
        };
        if (resp.status !== 202 || !data.agentId) {
          throw new Error(data.errors?.join(" · ") ?? data.error ?? "Agent API registration failed.");
        }
        setAgentDbId(data.agentId);
        setStep("done");

        // ── Normal Token ────────────────────────────────────────────────────────
      } else if (params.type === "normal") {
        const factoryAddr = ADDRESSES.tokenFactory;
        if (!factoryAddr) {
          throw new Error("TokenFactory contract not deployed. Check NEXT_PUBLIC_TOKEN_FACTORY.");
        }

        setStep("deploying-token");
        const fee = await getLaunchFee();
        const hash = await writeContractAsync({
          address: factoryAddr,
          abi: TOKEN_FACTORY_ABI,
          functionName: "deployNormalToken",
          args: [params.name, params.symbol, params.supply, params.maxSupply],
          value: fee,
        });
        setTxHash(hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          // Replay the call to extract the actual revert reason
          let reason = "deployNormalToken reverted on-chain.";
          try {
            await publicClient.simulateContract({
              address: factoryAddr,
              abi: TOKEN_FACTORY_ABI,
              functionName: "deployNormalToken",
              args: [params.name, params.symbol, params.supply, params.maxSupply],
              value: fee,
              account: receipt.from,
            });
          } catch (simErr: unknown) {
            const e = simErr as { shortMessage?: string; message?: string };
            reason = e.shortMessage ?? e.message ?? reason;
          }
          throw new Error(reason);
        }

        const logs = parseEventLogs({
          abi: TOKEN_FACTORY_ABI,
          eventName: "NormalTokenDeployed",
          logs: receipt.logs,
        });
        const tokenAddr = logs[0]?.args.token;
        if (!tokenAddr) throw new Error("Could not read token address from NormalTokenDeployed event.");
        setTokenAddress(tokenAddr);
        setStep("done");

        // ── Skill Token ─────────────────────────────────────────────────────────
      } else if (params.type === "skill") {
        const factoryAddr = ADDRESSES.tokenFactory;
        if (!factoryAddr) {
          throw new Error("TokenFactory contract not deployed. Check NEXT_PUBLIC_TOKEN_FACTORY.");
        }

        setStep("deploying-token");
        // Encode skillId string as bytes32 (left-padded, max 32 bytes)
        const skillIdBytes32 = stringToHex(params.skillId.slice(0, 32), { size: 32 });
        const skillFee = await getLaunchFee();
        const hash = await writeContractAsync({
          address: factoryAddr,
          abi: TOKEN_FACTORY_ABI,
          functionName: "deploySkillToken",
          args: [params.name, params.symbol, params.supply, params.agentId, skillIdBytes32, params.costPerUse],
          value: skillFee,
        });
        setTxHash(hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") {
          throw new Error("deploySkillToken transaction reverted — check launchFee or skill parameters.");
        }
        const logs = parseEventLogs({
          abi: TOKEN_FACTORY_ABI,
          eventName: "SkillTokenDeployed",
          logs: receipt.logs,
        });
        const tokenAddr = logs[0]?.args.token;
        if (!tokenAddr) throw new Error("Could not read token address from SkillTokenDeployed event.");
        setTokenAddress(tokenAddr);
        setStep("done");
      }

    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "shortMessage" in err
            ? (err as { shortMessage: string }).shortMessage
            : "Unknown error";
      setStep("error");
      setError(msg);
    }
  }, [writeContractAsync, publicClient, currentChainId, switchChainAsync]);

  return {
    deploy,
    step,
    stepLabel: STEP_LABELS[step],
    txHash,
    tokenAddress,
    agentNFAId,
    agentDbId,
    error,
    isDeploying: step !== "idle" && step !== "done" && step !== "error",
    isSuccess: step === "done",
    reset,
  };
}
