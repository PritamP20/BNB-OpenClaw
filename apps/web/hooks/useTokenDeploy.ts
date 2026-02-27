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
import { useWriteContract, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { parseEventLogs, parseEther, stringToHex } from "viem";
import { ADDRESSES, TOKEN_FACTORY_ABI, NFA_MANAGER_ABI, BONDING_CURVE_ABI, ERC20_ABI } from "../lib/contracts";

// ── BondingCurve deployment bytecode (compiled from packages/contracts) ──────
const BONDING_CURVE_BYTECODE =
  "0x6101206040523480156200001257600080fd5b5060405162001b4e38038062001b4e8339810160408190526200003591620002c4565b806001600160a01b0381166200006657604051631e4fbdf760e01b8152600060048201526024015b60405180910390fd5b620000718162000257565b50600180556001600160a01b038616620000ce5760405162461bcd60e51b815260206004820152601860248201527f426f6e64696e6743757276653a207a65726f20746f6b656e000000000000000060448201526064016200005d565b60008511620001205760405162461bcd60e51b815260206004820152601d60248201527f426f6e64696e6743757276653a207a65726f207669727475616c424e4200000060448201526064016200005d565b60008411620001825760405162461bcd60e51b815260206004820152602760248201527f426f6e64696e6743757276653a207a65726f2067726164756174696f6e2074686044820152661c995cda1bdb1960ca1b60648201526084016200005d565b6101f4831115620001d65760405162461bcd60e51b815260206004820152601c60248201527f426f6e64696e6743757276653a2066656520657863656564732035250000000060448201526064016200005d565b6001600160a01b0382166200022e5760405162461bcd60e51b815260206004820181905260248201527f426f6e64696e6743757276653a207a65726f2066656520726563697069656e7460448201526064016200005d565b506001600160a01b0394851660805260a09390935260c09190915260e05216610100526200032a565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b80516001600160a01b0381168114620002bf57600080fd5b919050565b60008060008060008060c08789031215620002de57600080fd5b620002e987620002a7565b95506020870151945060408701519350606087015192506200030e60808801620002a7565b91506200031e60a08801620002a7565b90509295509295509295565b60805160a05160c05160e05161010051611761620003ed600039600081816101f301528181610d9b01526111330152600081816101bf01528181610490015281816107ef01528181610bf00152610f720152600081816102d6015281816109d601528181610a06015261121f0152600081816102550152818161093e015261140a015260008181610445015281816105c30152818161064b0152818161090d0152818161096c01528181610cbd0152818161110201526114d501526117616000f3fe6080604052600436106101445760003560e01c806398d5fdca116100b6578063d55be8c61161006f578063d55be8c6146103ab578063d79875eb146103c1578063d96a094a146103e1578063e7c2b772146103f4578063f2fde38b14610413578063fc0c546a1461043357600080fd5b806398d5fdca14610316578063b31f8f931461032b578063b390452c14610340578063b7b0422d14610360578063c8ae000c14610380578063d47a20101461039557600080fd5b80636a700938116101085780636a70093814610243578063715018a6146102775780637824407f1461028e578063851f1061146102a45780638b0bc501146102c45780638da5cb5b146102f857600080fd5b80630812530e14610150578063158ef93e1461018357806324a9d853146101ad57806346904840146101e1578063518ab2a81461022d57600080fd5b3661014b57005b600080fd5b34801561015c57600080fd5b5061017061016b3660046115ab565b610467565b6040519081526020015b60405180910390f35b34801561018f57600080fd5b5060055461019d9060ff1681565b604051901515815260200161017a565b3480156101b957600080fd5b506101707f000000000000000000000000000000000000000000000000000000000000000081565b3480156101ed57600080fd5b506102157f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200161017a565b34801561023957600080fd5b5061017060035481565b34801561024f57600080fd5b506101707f000000000000000000000000000000000000000000000000000000000000000081565b34801561028357600080fd5b5061028c6104d3565b005b34801561029a57600080fd5b5061017060025481565b3480156102b057600080fd5b5061028c6102bf3660046115c4565b6104e7565b3480156102d057600080fd5b506101707f000000000000000000000000000000000000000000000000000000000000000081565b34801561030457600080fd5b506000546001600160a01b0316610215565b34801561032257600080fd5b5061017061077b565b34801561033757600080fd5b506101706107c4565b34801561034c57600080fd5b5061017061035b3660046115ab565b6107d3565b34801561036c57600080fd5b5061028c61037b3660046115ab565b610839565b34801561038c57600080fd5b506101706109bb565b3480156103a157600080fd5b5061017060045481565b3480156103b757600080fd5b506101706101f481565b3480156103cd57600080fd5b5061028c6103dc3660046115ed565b610a56565b61028c6103ef3660046115ab565b610e96565b34801561040057600080fd5b5060055461019d90610100900460ff1681565b34801561041f57600080fd5b5061028c61042e3660046115c4565b61125a565b34801561043f57600080fd5b506102157f000000000000000000000000000000000000000000000000000000000000000081565b60008160000361047957506000919050565b600061048483611295565b905060006127106104b57f000000000000000000000000000000000000000000000000000000000000000084611625565b6104bf9190611642565b90506104cb8183611664565b949350505050565b6104db6112e6565b6104e56000611313565b565b6104ef6112e6565b6104f7611363565b600554610100900460ff166105535760405162461bcd60e51b815260206004820152601f60248201527f426f6e64696e6743757276653a206e6f7420677261647561746564207965740060448201526064015b60405180910390fd5b6001600160a01b0381166105a95760405162461bcd60e51b815260206004820152601c60248201527f426f6e64696e6743757276653a207a65726f20726563697069656e7400000000604482015260640161054a565b6040516370a0823160e01b815230600482015247906000907f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316906370a0823190602401602060405180830381865afa158015610612573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106369190611677565b90508015610672576106726001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016848361138d565b8115610729576000836001600160a01b03168360405160006040518083038185875af1925050503d80600081146106c5576040519150601f19603f3d011682016040523d82523d6000602084013e6106ca565b606091505b50509050806107275760405162461bcd60e51b815260206004820152602360248201527f426f6e64696e6743757276653a20424e42207769746864726177616c206661696044820152621b195960ea1b606482015260840161054a565b505b60408051838152602081018390526001600160a01b038516917fb195a67e698c5700e4f48f7b7748dda3a206ee2767ef024b61a26d7b17b2d63a910160405180910390a2505061077860018055565b50565b6000806107866113f1565b9050806000036107995760001991505090565b806107a2611403565b6107b490670de0b6b3a7640000611625565b6107be9190611642565b91505090565b60006107ce6113f1565b905090565b6000816000036107e557506000919050565b60006127106108147f000000000000000000000000000000000000000000000000000000000000000085611625565b61081e9190611642565b905061083261082d8285611664565b611433565b9392505050565b6108416112e6565b60055460ff161561089e5760405162461bcd60e51b815260206004820152602160248201527f426f6e64696e6743757276653a20616c726561647920696e697469616c697a656044820152601960fa1b606482015260840161054a565b600081116108ee5760405162461bcd60e51b815260206004820152601960248201527f426f6e64696e6743757276653a207a65726f20616d6f756e7400000000000000604482015260640161054a565b6005805460ff1916600117905560028190556109356001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001633308461147a565b604080518281527f000000000000000000000000000000000000000000000000000000000000000060208201526001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016917f05e703b6301500a913515a2e4d7c1cff034efb385763c84c8ec04f072627a862910160405180910390a250565b600554600090610100900460ff16156109d45750606490565b7f0000000000000000000000000000000000000000000000000000000000000000600003610a025750606490565b60007f00000000000000000000000000000000000000000000000000000000000000006004546064610a349190611625565b610a3e9190611642565b905060648111610a4e57806107be565b606491505090565b610a5e611363565b60055460ff16610ab05760405162461bcd60e51b815260206004820152601d60248201527f426f6e64696e6743757276653a206e6f7420696e697469616c697a6564000000604482015260640161054a565b600554610100900460ff1615610ad85760405162461bcd60e51b815260040161054a90611690565b60008211610b285760405162461bcd60e51b815260206004820152601f60248201527f426f6e64696e6743757276653a207a65726f20746f6b656e20616d6f756e7400604482015260640161054a565b6000610b3383611295565b905060008111610b855760405162461bcd60e51b815260206004820152601d60248201527f426f6e64696e6743757276653a207a65726f20424e42206f7574707574000000604482015260640161054a565b806004541015610be65760405162461bcd60e51b815260206004820152602660248201527f426f6e64696e6743757276653a20696e73756666696369656e7420424e42207260448201526565736572766560d01b606482015260840161054a565b6000612710610c157f000000000000000000000000000000000000000000000000000000000000000084611625565b610c1f9190611642565b90506000610c2d8284611664565b905083811015610c7f5760405162461bcd60e51b815260206004820152601f60248201527f426f6e64696e6743757276653a20736c69707061676520657863656564656400604482015260640161054a565b8260046000828254610c919190611664565b925050819055508460036000828254610caa9190611664565b90915550610ce590506001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001633308861147a565b604051600090339083908381818185875af1925050503d8060008114610d27576040519150601f19603f3d011682016040523d82523d6000602084013e610d2c565b606091505b5050905080610d915760405162461bcd60e51b815260206004820152602b60248201527f426f6e64696e6743757276653a20424e42207472616e7366657220746f20736560448201526a1b1b195c8819985a5b195960aa1b606482015260840161054a565b8215610e2c5760007f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168460405160006040518083038185875af1925050503d8060008114610e04576040519150601f19603f3d011682016040523d82523d6000602084013e610e09565b606091505b5050905080610e2a5760405162461bcd60e51b815260040161054a906116d7565b505b337f20a7fc03b19d7f251cc907f177ff82194c6aebe9a2b47e1cd734dcb6bf772cc287868587610e5a61077b565b604080519586526020860194909452928401919091526060830152608082015260a00160405180910390a250505050610e9260018055565b5050565b610e9e611363565b60055460ff16610ef05760405162461bcd60e51b815260206004820152601d60248201527f426f6e64696e6743757276653a206e6f7420696e697469616c697a6564000000604482015260640161054a565b600554610100900460ff1615610f185760405162461bcd60e51b815260040161054a90611690565b60003411610f685760405162461bcd60e51b815260206004820152601b60248201527f426f6e64696e6743757276653a207a65726f20424e422073656e740000000000604482015260640161054a565b6000612710610f977f000000000000000000000000000000000000000000000000000000000000000034611625565b610fa19190611642565b90506000610faf8234611664565b90506000610fbc82611433565b90506000811161100e5760405162461bcd60e51b815260206004820152601f60248201527f426f6e64696e6743757276653a207a65726f20746f6b656e206f757470757400604482015260640161054a565b8381101561105e5760405162461bcd60e51b815260206004820152601f60248201527f426f6e64696e6743757276653a20736c69707061676520657863656564656400604482015260640161054a565b6110666113f1565b8111156110c45760405162461bcd60e51b815260206004820152602660248201527f426f6e64696e6743757276653a206578636565647320617661696c61626c6520604482015265737570706c7960d01b606482015260840161054a565b81600460008282546110d69190611718565b9250508190555080600360008282546110ef9190611718565b9091555061112990506001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016338361138d565b82156111c45760007f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168460405160006040518083038185875af1925050503d806000811461119c576040519150601f19603f3d011682016040523d82523d6000602084013e6111a1565b606091505b50509050806111c25760405162461bcd60e51b815260040161054a906116d7565b505b337f178f20a8980b4e6cdc2c84f3ef670f5047f63638f90a8acc6b724b43f1da778d348484876111f261077b565b604080519586526020860194909452928401919091526060830152608082015260a00160405180910390a27f00000000000000000000000000000000000000000000000000000000000000006004541061124e5761124e6114b9565b50505061077860018055565b6112626112e6565b6001600160a01b03811661128c57604051631e4fbdf760e01b81526000600482015260240161054a565b61077881611313565b6000806112a0611403565b905060006112ac6113f1565b90508115806112b9575083155b156112c8575060009392505050565b6112d28482611718565b6112dc8584611625565b6104cb9190611642565b6000546001600160a01b031633146104e55760405163118cdaa760e01b815233600482015260240161054a565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b60026001540361138657604051633ee5aeb560e01b815260040160405180910390fd5b6002600155565b6040516001600160a01b038381166024830152604482018390526113ec91859182169063a9059cbb906064015b604051602081830303815290604052915060e01b6020820180516001600160e01b03838183161783525050505061153a565b505050565b60006003546002546107ce9190611664565b60006004547f00000000000000000000000000000000000000000000000000000000000000006107ce9190611718565b60008061143e611403565b9050600061144a6113f1565b9050801580611457575083155b15611466575060009392505050565b6114708483611718565b6112dc8583611625565b6040516001600160a01b0384811660248301528381166044830152606482018390526114b39186918216906323b872dd906084016113ba565b50505050565b6005805461ff0019166101001790556004546001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016907f1c858049e704460ab9455025be4078f9e746e3fd426a56040d06389edb8197db906115206113f1565b6040805192835260208301919091520160405180910390a2565b600080602060008451602086016000885af18061155d576040513d6000823e3d81fd5b50506000513d91508115611575578060011415611582565b6001600160a01b0384163b155b156114b357604051635274afe760e01b81526001600160a01b038516600482015260240161054a565b6000602082840312156115bd57600080fd5b5035919050565b6000602082840312156115d657600080fd5b81356001600160a01b038116811461083257600080fd5b6000806040838503121561160057600080fd5b50508035926020909101359150565b634e487b7160e01b600052601160045260246000fd5b808202811582820484141761163c5761163c61160f565b92915050565b60008261165f57634e487b7160e01b600052601260045260246000fd5b500490565b8181038181111561163c5761163c61160f565b60006020828403121561168957600080fd5b5051919050565b60208082526027908201527f426f6e64696e6743757276653a20677261647561746564202d2d207472616465604082015266040dedc40888ab60cb1b606082015260800190565b60208082526021908201527f426f6e64696e6743757276653a20666565207472616e73666572206661696c656040820152601960fa1b606082015260800190565b8082018082111561163c5761163c61160f56fea26469706673582212203d1c44b0b2c15fbf74c120c9637e23e854e27abdfec1101237bd2154c090ad7364736f6c63430008180033" as `0x${string}`;

// Minimal ABI for deployContract (only constructor needed by viem)
const BONDING_CURVE_CONSTRUCTOR_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_token",               type: "address" },
      { name: "_virtualBNB",          type: "uint256" },
      { name: "_graduationThreshold", type: "uint256" },
      { name: "_feeBps",              type: "uint256" },
      { name: "_feeRecipient",        type: "address" },
      { name: "_owner",               type: "address" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

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
  | "deploying-curve"
  | "approving-curve"
  | "initializing-curve"
  | "calling-api"
  | "done"
  | "error";

export const STEP_LABELS: Record<DeployStep, string> = {
  "idle": "",
  "minting-nfa": "Minting NFA identity on-chain…",
  "deploying-token": "Deploying token contract…",
  "deploying-curve": "Deploying bonding curve…",
  "approving-curve": "Approving curve to hold tokens… (2/3)",
  "initializing-curve": "Initialising bonding curve… (3/3)",
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
  // Bonding curve config
  virtualBNB: bigint;        // in wei (e.g. parseEther("10"))
  graduationTarget: bigint;  // in wei (e.g. parseEther("69"))
  feeBps: bigint;            // e.g. 100n = 1%
  creator: `0x${string}`;   // used as feeRecipient + curve owner
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

  const { data: walletClient } = useWalletClient({ chainId: bscTestnet.id });

  const [step, setStep] = useState<DeployStep>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(null);
  const [curveAddress, setCurveAddress] = useState<`0x${string}` | null>(null);
  const [agentNFAId, setAgentNFAId] = useState<bigint | null>(null);
  const [agentDbId, setAgentDbId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setTxHash(null);
    setTokenAddress(null);
    setCurveAddress(null);
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
    setCurveAddress(null);
    setAgentNFAId(null);
    setAgentDbId(null);

    // ── Helper: deploy + init bonding curve ──────────────────────────────────
    const setupBondingCurve = async (
      tokenAddr: `0x${string}`,
      supply: bigint,
      virtualBNB: bigint,
      graduationTarget: bigint,
      feeBps: bigint,
      creator: `0x${string}`,
    ) => {
      if (!walletClient || !publicClient) throw new Error("Wallet not connected");

      // 1. Deploy BondingCurve contract
      setStep("deploying-curve");
      const deployHash = await walletClient.deployContract({
        abi: BONDING_CURVE_CONSTRUCTOR_ABI,
        bytecode: BONDING_CURVE_BYTECODE,
        args: [tokenAddr, virtualBNB, graduationTarget, feeBps, creator, creator],
        account: walletClient.account!,
        chain: walletClient.chain,
      });
      setTxHash(deployHash);
      const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
      const curveAddr = deployReceipt.contractAddress;
      if (!curveAddr) throw new Error("BondingCurve deploy failed — no contract address in receipt");
      setCurveAddress(curveAddr);

      // 2. Approve curve to pull all tokens
      setStep("approving-curve");
      const approveHash = await writeContractAsync({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [curveAddr, supply],
      });
      setTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 3. Init curve (transfers tokens in)
      setStep("initializing-curve");
      const initHash = await writeContractAsync({
        address: curveAddr,
        abi: BONDING_CURVE_ABI,
        functionName: "init",
        args: [supply],
      });
      setTxHash(initHash);
      await publicClient.waitForTransactionReceipt({ hash: initHash });

      return curveAddr;
    };

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

        // Step 3 — Deploy bonding curve for the agent token
        await setupBondingCurve(
          tokenAddr,
          params.supply,
          parseEther("10"),  // 10 BNB virtual reserve
          parseEther("69"),  // 69 BNB graduation threshold
          100n,              // 1% fee
          params.treasury,
        );

        // Step 4 — Register Docker agent on API
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

        // Deploy and initialise bonding curve so buyers can trade
        await setupBondingCurve(
          tokenAddr,
          params.supply,
          params.virtualBNB,
          params.graduationTarget,
          params.feeBps,
          params.creator,
        );
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
  }, [writeContractAsync, publicClient, walletClient, currentChainId, switchChainAsync]);

  return {
    deploy,
    step,
    stepLabel: STEP_LABELS[step],
    txHash,
    tokenAddress,
    agentNFAId,
    agentDbId,
    error,
    curveAddress,
    isDeploying: step !== "idle" && step !== "done" && step !== "error",
    isSuccess: step === "done",
    reset,
  };
}
