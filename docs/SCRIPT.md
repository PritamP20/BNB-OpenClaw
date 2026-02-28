# 🎬 AgentLaunch — Video Script

---

## INTRO (30 sec)

> *"This is AgentLaunch — a next-gen launchpad built on BNB Chain. Think pump.fun, but for AI Agents. Every AI agent gets its own on-chain identity, its own token, and its own access-controlled API. Let me walk you through how every layer connects."*

---

## SECTION 1 — The Blockchain Layer (Smart Contracts)

> *"Everything starts on-chain. We have 3 phases of smart contracts."*

### Phase 1 — Identity & Factory

```
User clicks "Create Agent"
        ↓
NFAManager.sol  →  mints an NFT (the NFA — Non-Fungible Agent)
                   This NFT IS the agent's identity on-chain
                   States: Active → Paused → Terminated
        ↓
TokenFactory.sol  →  deploys one of 3 token types:
   • NormalToken   — standard ERC-20 (regular memecoin)
   • AgentToken    — ERC-20 bound to an NFA (1 per agent, enforced)
   • SkillToken    — pay-per-use ERC-20 (burns tokens on each AI call)
        ↓
AgentRegistry.sol  →  maps  agentId → tokenAddress
                       enforces: only 1 primary token per NFA
```

### Phase 2 — Liquidity Infrastructure

```
PLUVault.sol  →  Progressive Liquidity Unlock
   Creator locks tokens in up to 50 tranches
   Each tranche unlocks by: Time / Volume / HolderCount / AgentActivity
   cancelVault() only works if ZERO tranches released → no rug-pull

DAMMManager.sol  →  Dynamic AMM Configuration
   4 curve models: Linear, BondingCurve (k·supply²), Exponential, Flat
   Per-token: fee tier, anti-whale limits (maxBuyBps / maxSellBps)
   Dynamic fee adjustment based on volatility
   Token creator assigned as their own pool configuror
```

### Phase 3 — Bonding Curve & Growth

```
BondingCurve.sol  →  pump.fun-style xy=k curve
   Virtual BNB reserve → price rises as demand grows
   Formula: tokenOut = tokensLeft × bnbIn / (effectiveBNB + bnbIn)
   Auto-graduates to PancakeSwap when real BNB raised hits target

ReputationEngine.sol  →  0–100 on-chain health score
   5 components: trading activity, holder count, agent usage,
                 liquidity depth, community engagement

IncentiveEngine.sol  →  Merkle airdrops + referral tracking
```

---

## SECTION 2 — The Backend Layer (Express API)

> *"The API bridges the blockchain and the AI services."*

```
Browser / dApp
      ↓
Express API (port 4000)
      │
      ├── /api/agents   →  CRUD for agent deployments (talks to CreateOS)
      ├── /api/skills   →  skill module registry
      ├── /api/chat     →  AI chat (token-gated)
      └── /agent/:id/*  →  reverse proxy to the agent's AI container
                           ↑ protected by tokenGate middleware
```

### Token Gate — How it works

```
Request arrives at /agent/:agentId/*
        ↓
Headers required:
  x-wallet-address  →  user's BNB wallet
  x-signature       →  EIP-191 signed message proving wallet ownership
  x-timestamp       →  unix timestamp (prevents replay attacks)
        ↓
Middleware checks:
  1. Timestamp is within 300s (configurable TTL)
  2. Signature is valid for that wallet
  3. Wallet holds ≥ threshold of agent's ERC-20 token (on BNB Chain)
        ↓
If all pass → proxy request to agent's live Docker container
If fail     → 401 Unauthorized
```

### AI Agent Deployment (CreateOS)

```
Creator uploads a Dockerfile
        ↓
API calls CreateOS (NodeOps)  →  spins up the container
Returns a live URL
        ↓
API stores: agentId, containerUrl, tokenAddress in Neon DB
        ↓
Token holders can now call that container through the token gate
```

---

## SECTION 3 — The Frontend Layer (Next.js)

> *"The UI connects wallets, reads on-chain data, and calls the API."*

```
User opens AgentLaunch (Next.js 16 + React 19)
        ↓
Connects MetaMask / wallet  →  wagmi + viem (BSC Testnet)
        ↓
Pages:
  /          →  Hero + Live token feed (trending tokens from chain)
  /launch    →  3-type launch form (Normal / Agent / Skill token)
                → calls TokenFactory contract directly from browser
  /explore   →  Filter/sort all deployed tokens
  /token/:addr  →  Token detail + Bonding Curve chart + Buy/Sell panel
  /chat      →  Token-gated AI chat (signs message, calls /api/chat)
  /sdk       →  Developer docs
```

---

## SECTION 4 — Full End-to-End User Journey

> *"Here's what happens when a user launches an AI Agent from start to finish:"*

```
1. User connects wallet (MetaMask, BSC Testnet)

2. Clicks "Create Agent" on /launch
   → Frontend calls NFAManager.mintAgent()  (on-chain tx)
   → NFA NFT minted → agentId assigned

3. Frontend calls TokenFactory.deployAgentToken()  (on-chain tx)
   → AgentToken ERC-20 deployed
   → AgentRegistry records agentId → tokenAddress
   → BondingCurve activated for this token

4. User uploads AI as a Dockerfile in the LaunchForm
   → API calls CreateOS/NodeOps → container deployed → live URL returned

5. Community buys the AgentToken on the bonding curve
   → Price rises with each buy
   → When BNB raised hits graduation target → auto-lists on PancakeSwap

6. Token holder wants to use the AI
   → Signs EIP-191 message in browser
   → Calls /agent/:agentId/... with signed headers
   → Token gate verifies: balance ≥ threshold
   → Request proxied to the live AI container

7. Creator locks team tokens in PLUVault
   → Tranches unlock over time (no rug possible mid-unlock)

8. ReputationEngine scores the agent 0–100
   → Shown on token card in the UI
```

---

## SECTION 5 — Deployment Stack

> *"The infrastructure:"*

```
Smart Contracts  →  BNB Chain Testnet (deployed, verified)
Database         →  Neon (PostgreSQL, serverless)
AI Containers    →  CreateOS / NodeOps (Docker)
API              →  Railway  OR  NodeOps
Frontend         →  Vercel  OR  NodeOps
```

---

## OUTRO

> *"84 smart contract tests passing. Full token-gated AI infrastructure. Bonding curves, reputation scoring, progressive liquidity unlock — all on BNB Chain. This is AgentLaunch."*
