# AgentLaunch — Full Project Walkthrough

> Complete summary of everything built, every decision made, and everything remaining.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Phase 1 — Identity & Factory (Smart Contracts)](#3-phase-1--identity--factory-smart-contracts)
4. [Phase 2 — Liquidity Infrastructure (Smart Contracts)](#4-phase-2--liquidity-infrastructure-smart-contracts)
5. [Phase 3 — Bonding Curve & Growth Tools (Smart Contracts)](#5-phase-3--bonding-curve--growth-tools-smart-contracts)
6. [Phase 4 — Frontend (Next.js App)](#6-phase-4--frontend-nextjs-app)
7. [Test Coverage Summary](#7-test-coverage-summary)
8. [Deployment Order & Script](#8-deployment-order--script)
9. [What Remains — Integration Checklist](#9-what-remains--integration-checklist)
10. [Architecture Diagram](#10-architecture-diagram)

---

## 1. Project Overview

**AgentLaunch** is a BNB Chain launchpad for AI Agents and fungible tokens.

Key inspiration: pump.fun's viral simplicity, but extended with AI-native infrastructure — Non-Fungible Agent identities (NFAs), skill token marketplaces, progressive liquidity unlock, bonding curves with auto-DEX graduation, and on-chain reputation scoring.

**Design Theme:** Dark UI (`#0e0e11`), BNB yellow accent (`#F3BA2F`), pump.fun-style token card grid.

**Monorepo root:** `/Users/Pritam/Documents/BNB-Openclaw`

**Stack:**

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin v5, Hardhat |
| Frontend | Next.js 16, React 19, Tailwind CSS v3, wagmi v2, viem |
| Tooling | Turborepo, TypeChain (ethers-v6), dotenv |
| Chain | BNB Chain Testnet (chainId 97) / Mainnet (chainId 56) |

---

## 2. Repository Structure

```
BNB-Openclaw/
├── apps/
│   └── web/                          ← Next.js 16 frontend
│       ├── app/
│       │   ├── layout.tsx            ← Root layout (Providers + Navbar)
│       │   ├── page.tsx              ← Home page (hero + stats + trending feed)
│       │   ├── globals.css           ← Tailwind base + BNB theme vars
│       │   ├── launch/
│       │   │   └── page.tsx          ← /launch route
│       │   └── token/[address]/
│       │       └── page.tsx          ← /token/[address] route
│       ├── components/
│       │   ├── Navbar.tsx            ← Sticky nav + Connect Wallet
│       │   ├── TokenCard.tsx         ← Card for trending feed
│       │   ├── TrendingFeed.tsx      ← Filter/sort/search token grid
│       │   ├── StatsBar.tsx          ← Platform-wide stats strip
│       │   ├── LaunchForm.tsx        ← Full 3-type launch form + live preview
│       │   ├── BuySellPanel.tsx      ← Buy/sell widget for token detail page
│       │   └── ReputationScore.tsx   ← 5-component score breakdown widget
│       ├── lib/
│       │   ├── wagmi.ts              ← wagmi config (BSC Testnet + Mainnet)
│       │   └── mock-data.ts          ← Mock tokens + platform stats + helpers
│       ├── providers.tsx             ← WagmiProvider + QueryClientProvider
│       ├── tailwind.config.ts        ← Tailwind theme (BNB colours)
│       └── postcss.config.js
│
├── packages/
│   └── contracts/                    ← Hardhat workspace
│       ├── contracts/
│       │   ├── identity/
│       │   │   ├── NFAManager.sol    ← ERC-721 NFA with lifecycle states
│       │   │   └── AgentRegistry.sol ← Maps agentId → tokens (FACTORY_ROLE)
│       │   ├── tokens/
│       │   │   ├── NormalToken.sol   ← Standard ERC-20Burnable
│       │   │   ├── AgentToken.sol    ← ERC-20 bound to an NFA agentId
│       │   │   └── SkillToken.sol    ← ERC-20 with consumeSkill() burn
│       │   ├── factory/
│       │   │   └── TokenFactory.sol  ← Single-entry deploy for all token types
│       │   ├── liquidity/
│       │   │   ├── PLUVault.sol      ← Progressive Liquidity Unlock vault
│       │   │   └── DAMMManager.sol   ← Dynamic AMM configuration registry
│       │   ├── bonding/
│       │   │   └── BondingCurve.sol  ← xy=k pump.fun-style curve
│       │   └── growth/
│       │       ├── BuybackBurn.sol   ← Treasury buyback + burn module
│       │       ├── ReputationEngine.sol ← 0-100 on-chain health scoring
│       │       └── IncentiveEngine.sol  ← Merkle airdrops + referral tracking
│       ├── scripts/
│       │   └── deploy.ts             ← 10-step deployment script
│       ├── test/
│       │   ├── AgentLaunch.test.ts   ← 21 Phase 1 tests
│       │   ├── Phase2.test.ts        ← 25 Phase 2 tests
│       │   └── Phase3.test.ts        ← 38 Phase 3 tests
│       └── hardhat.config.ts         ← Solc 0.8.24, BSC Testnet/Mainnet config
│
└── docs/
    ├── PROJECT.md
    ├── TECHNICAL.md
    ├── EXTRAS.md
    └── WALKTHROUGH.md                ← This file
```

---

## 3. Phase 1 — Identity & Factory (Smart Contracts)

**Status: ✅ Complete — 21/21 tests passing**

### What was built

#### `NFAManager.sol` — Non-Fungible Agent identity

- Inherits `ERC721URIStorage` + `Ownable` (OpenZeppelin v5)
- Each AI agent is a unique NFT token — the NFA identity
- Lifecycle state machine with 3 states: `Active`, `Paused`, `Terminated`
- Key design: uses `_ownerOf()` internal function for existence checks because OZ v5's public `ownerOf()` reverts on unminted tokens
- Functions: `mintAgent()`, `pauseAgent()`, `resumeAgent()`, `terminateAgent()`, `updateLogicAddress()`, `toggleLearning()`
- Struct stored per agent: `{ logicAddress, learningEnabled, state, createdAt }`

#### `AgentRegistry.sol` — Agent → Token mapping

- Inherits `AccessControl` with a custom `FACTORY_ROLE`
- Only addresses holding `FACTORY_ROLE` can register agent/skill tokens
- `FACTORY_ROLE = keccak256("FACTORY_ROLE")` — granted to TokenFactory post-deploy
- Functions: `registerAgent(agentId, tokenAddr)`, `registerSkillToken(agentId, skillToken)`, `grantFactoryRole(factory)`
- Enforcement: `hasAgentToken(agentId)` checked in factory — one primary token per NFA

#### `NormalToken.sol` — Standard ERC-20

- `ERC20Burnable` + `Ownable`
- Optional `maxSupply` cap (0 = uncapped)
- Immutable `creator` address stored at deploy time

#### `AgentToken.sol` — Agent-bound ERC-20

- `ERC20Burnable` + `Ownable`
- Immutable `agentId` (links back to NFAManager) and `creator`
- Mutable `treasury` address (for future fee routing)

#### `SkillToken.sol` — Pay-per-use skill module

- `ERC20Burnable` + `Ownable`
- Immutable `agentId` and `skillId` (bytes32 identifier)
- `costPerUse`: tokens burned per invocation
- `consumeSkill()`: burns `costPerUse` from caller's balance — the monetisation mechanism
- `verifySkillAccess(user)`: returns true if user holds ≥ `costPerUse` tokens

#### `TokenFactory.sol` — Single deploy entry point

- `Ownable` + `ReentrancyGuard`
- `collectFee` modifier: deducts `launchFee` from `msg.value`, refunds excess BNB
- `deployNormalToken()`, `deployAgentToken()`, `deploySkillToken()`
- On `deployAgentToken`: checks `agentExists()` on NFAManager, checks `!hasAgentToken()` on AgentRegistry, registers after deploy
- On `deploySkillToken`: checks `agentExists()`, registers skill in AgentRegistry

### Key design decisions

- **OZ v5 compatibility**: `ownerOf()` reverts on unminted tokens — solved with `_ownerOf()` internal function exposed via `agentExists()`
- **One primary token per NFA**: enforced in TokenFactory via `AgentRegistry.hasAgentToken()` — trying to deploy a second AgentToken for the same agentId reverts
- **FACTORY_ROLE wiring**: must be done post-deploy in step 4 of the deploy script

---

## 4. Phase 2 — Liquidity Infrastructure (Smart Contracts)

**Status: ✅ Complete — 46/46 tests passing (25 new)**

### What was built

#### `PLUVault.sol` — Progressive Liquidity Unlock

- `Ownable` + `ReentrancyGuard` + `SafeERC20`
- Tranche-based token vault: deposit tokens split across scheduled unlock tranches
- `ConditionType` enum: `Time`, `Volume`, `HolderCount`, `AgentActivity`
- Each tranche has: `releaseTime`, `basisPoints` (share of vault, sum must = 10,000), `condition`, `conditionValue`, `released`
- **Time condition**: enforced fully on-chain — `block.timestamp >= releaseTime`
- **Other conditions**: scaffolded (return `true`) — designed for Phase 3 oracle/backend integration
- `createVault()`: pulls tokens from creator, validates bps sum = 10,000, validates future release times
- `release(vaultId, trancheIndex)`: sends `(basisPoints / 10000) × totalDeposited` tokens to beneficiary
- `releaseAll(vaultId)`: loops all tranches, releases all eligible
- `cancelVault(vaultId)`: creator-only, only if zero tranches released yet — returns full deposit

#### `DAMMManager.sol` — Dynamic AMM Configuration

- `Ownable`
- Per-token AMM config registry — stores configuration for each token's trading pool
- `CurveModel` enum: `Linear`, `BondingCurve`, `Exponential`, `Flat`
- `AMMConfig` struct: `initialPrice`, `feeTier`, `dynamicFeesEnabled`, `antiWhaleEnabled`, `maxBuyBps`, `maxSellBps`, `curveModel`, `configured`
- `MAX_FEE_BPS = 1000` (10% hard cap)
- `onlyAuthorized(token)` modifier: allows platform owner OR a per-token assigned configuror
- `setConfigurator(token, configuror)`: owner can delegate config rights to a token creator
- Functions: `configurePool()`, `updateFee()`, `setAntiWhale()`, `toggleDynamicFees()`, `updateCurveModel()`

---

## 5. Phase 3 — Bonding Curve & Growth Tools (Smart Contracts)

**Status: ✅ Complete — 84/84 tests passing (38 new)**

### What was built

#### `BondingCurve.sol` — xy=k price discovery

The core trading engine. Identical in concept to pump.fun on Solana.

**Pricing model (constant product):**
```
effectiveBNB = virtualBNB + bnbRaised   (virtual BNB reserve)
tokensLeft   = tokenSupply - tokensSold  (token reserve)

Buy:  tokenOut = tokensLeft × bnbIn  / (effectiveBNB + bnbIn)
Sell: bnbOut   = effectiveBNB × tokenIn / (tokensLeft + tokenIn)
```

- `virtualBNB`: sets the initial price without requiring the creator to deposit real BNB
- Fees deducted on every buy and sell (`feeBps / 10000`), forwarded to `feeRecipient`
- `MAX_FEE_BPS = 500` (5% hard cap)
- Auto-graduation: when `bnbRaised >= graduationThreshold`, sets `graduated = true`, emits `Graduated` event, locks all trading
- `withdrawForLiquidity(recipient)`: post-graduation — sends all BNB + remaining tokens to recipient for DEX LP seeding
- **xy=k reversibility proven in tests**: buy X tokens then immediately sell them back → receive exactly the original BNB (minus fees on both legs)

**Lifecycle:**
1. Creator deploys `BondingCurve` with config
2. Creator approves token, calls `init(amount)` — deposits tokens, opens trading
3. Users `buy()` / `sell()` until `bnbRaised >= graduationThreshold`
4. Curve graduates → owner calls `withdrawForLiquidity()` to seed PancakeSwap LP

#### `BuybackBurn.sol` — Treasury buyback module

- `Ownable` + `ReentrancyGuard`
- Anyone can fund the treasury by sending BNB to the contract (`receive()`)
- `executeBuyback(curve, bnbAmount, minTokens)`: owner-only, buys tokens from a BondingCurve using treasury BNB, then immediately burns them via `ERC20Burnable.burn()`
- `burnTokens(tokenAddr, amount)`: owner-only, burns ERC-20 tokens already held (for post-graduation DEX buybacks)
- `withdrawBNB(recipient, amount)`: emergency owner withdrawal
- Tracks `totalBurned[token]` and `totalBNBSpent[token]` per token address

#### `ReputationEngine.sol` — On-chain health scoring (0–100)

Reads directly from `BondingCurve` and `BuybackBurn` state — no oracle needed.

**Score components:**

| Component | Max Points | Formula |
|---|---|---|
| Fundraising | 30 | `bnbRaised / graduationThreshold × 30` |
| Graduation | 20 | `+20 if graduated` |
| Distribution | 20 | `tokensSold / tokenSupply × 20` |
| Burn Ratio | 20 | `totalBurned / tokenSupply × 20` |
| Longevity | 10 | `+10 if age ≥ 7 days` |

- `updateScore(curve)`: callable by anyone — reads on-chain state, stores result
- Snapshot values stored per token: `snapshotBNBRaised`, `snapshotTokensSold`, `snapshotBurned`, `graduated`
- `_computeScore()` extracted as internal helper to avoid stack-too-deep compiler error
- `setBuybackBurn(address)`: owner sets the BuybackBurn module address (wired in deploy step 10)

#### `IncentiveEngine.sol` — Airdrops + Referrals

- `Ownable` + `ReentrancyGuard` + `SafeERC20` + `MerkleProof` (OpenZeppelin v5)

**Merkle-tree airdrops:**
- `createAirdrop(token, merkleRoot, totalAmount, deadline)`: creator deposits tokens, sets Merkle root
- `claimAirdrop(campaignId, amount, proof)`: verifies `keccak256(abi.encodePacked(msg.sender, amount))` against root, transfers tokens, marks claimed
- `reclaimExpired(campaignId)`: creator reclaims unclaimed tokens after deadline passes
- Double-claim protection via `hasClaimed[campaignId][address]` mapping

**Referral tracking:**
- `registerReferral(referrer)`: links `msg.sender → referrer` (set once, immutable, cannot self-refer)
- `referralCount[referrer]`: tracks total referrals made
- `getReferrer(user)`: read referrer for any user

### Bugs encountered and fixed

| Bug | Root Cause | Fix |
|---|---|---|
| `ParserError: Invalid character in string` | Unicode em-dash `—` in a Solidity string literal | Replaced with `--` ASCII double-dash |
| `ParserError: Function, variable, struct or modifier declaration expected` | `interface` declarations placed inside contract bodies | Moved interfaces to file scope, renamed to avoid collisions (`IBondingCurveBB`, `IBondingCurveRE`, `IBuybackBurnRE`) |
| `CompilerError: Stack too deep` | 17+ local variables in `ReputationEngine.updateScore()` | Extracted `_computeScore(tokenAddr, bc)` as an `internal view` helper |
| Test: graduation revert mismatch | Test expected em-dash string, contract has `--` | Updated test assertion string |
| Test: `ERC20InsufficientBalance` in airdrop `beforeEach` | `curve.init(TOKEN_SUPPLY)` moved all creator tokens into the curve in the outer `beforeEach` | Added `token.mint(creator, AIRDROP_AMOUNT)` at the start of the airdrop `beforeEach` |

---

## 6. Phase 4 — Frontend (Next.js App)

**Status: ✅ Complete (mock data, wallet-ready) — build passing**

Located in: `apps/web/`

### Installed dependencies

```bash
tailwindcss@3  postcss  autoprefixer    # styling
wagmi          viem                     # wallet + contract interaction
@tanstack/react-query                   # data fetching / caching
lucide-react                            # icons
recharts                                # (installed, available for charts)
```

### Pages

#### `/` — Home

- **HeroSection**: headline, subtext, two CTAs (Launch a Token + Explore Tokens), feature pills
- **StatsBar**: 4 platform-wide stats — Total Launched, Total Volume, Active Agents, Tokens Burned
- **TrendingFeed**: filter by All / Agents / Tokens / Skills; sort by Trending / New / Market Cap; live search by name or symbol; responsive 1–4 column grid of `TokenCard` components

#### `/launch` — Launch Form (fully rebuilt in improvement pass)

Two-column layout (form on left, live preview on right — sticky on desktop):

**Left — Form:**
- 3-type selector cards with feature bullets (Normal Token / AI Agent / Skill Token) — AI Agent tagged "POPULAR"
- Numbered section headings (1. Basic Info, 2. Config, 3. Identity)
- Inline validation with red borders + error messages (validates on submit, re-validates on change after first attempt)
- Common fields: Name, Symbol (auto-uppercase), Total Supply, Description (with 280-char counter)
- **Normal token extras**: Max Supply Cap
- **Agent extras**: Virtual BNB, Graduation Target, Fee (bps), Logic Contract Address, Learning Module toggle
- **Skill extras**: Parent Agent ID, Cost Per Use, Skill ID
- Launch fee line (0 BNB testnet)
- Validation summary banner if errors exist
- Deploy button: connect-gates if wallet not connected, shows spinner during deploy

**Right — Live Preview (sticky):**
- **Emoji avatar picker**: 12 emojis per token type, highlights selected, updates card preview instantly
- **Token card preview**: real-time preview of how the card will appear in the trending feed
- **Curve stats panel** (agent only): Start price, Graduation market cap, Price multiple (computed live from form values)
- **"What happens next"** explainer: type-specific ordered list of post-deploy steps

**Success Screen:**
- Confetti emoji, green checkmark
- Mock contract address + transaction hash with copy/BscScan links
- "View Token Page" CTA → `/token/[address]`
- "Launch Another" resets form

#### `/token/[address]` — Token Detail

- Back navigation to Explore
- Token header: avatar emoji, name, symbol, type badge, GRADUATED badge, address with copy + BscScan link, live price + 24h % change
- 4-cell stats grid: Market Cap, 24h Volume, Holders, Launch time
- Token description
- **Left column (2/3 width):**
  - `BondingCurveBar`: graduation progress bar with %, or "Graduated + PancakeSwap" message
  - `ReputationScore`: circular score ring (color-coded), 5-component breakdown bars
  - `TradeHistory`: mock recent buy/sell table (type, wallet, amount, BNB, timestamp)
- **Right column (1/3 width, sticky):**
  - `BuySellPanel`: Buy/Sell tabs, amount input, quick-select presets, live quote display, Connect Wallet gate; if graduated → PancakeSwap redirect instead

### Wallet integration

- wagmi v2 config in `lib/wagmi.ts`
- Supports: BSC Testnet (chainId 97) + BSC Mainnet (chainId 56)
- Connector: `injected()` (MetaMask, Trust Wallet, etc.)
- `Navbar`: Connect Wallet / disconnect button showing shortened address
- `LaunchForm` + `BuySellPanel`: gates behind wallet connect, calls `connect({ connector: injected() })` inline

### Mock data (`lib/mock-data.ts`)

8 mock tokens representing all 3 types:

| Name | Symbol | Type | Status |
|---|---|---|---|
| ResearchAgent | RSCH | Agent | Active (78%) |
| TradeSage | SAGE | Agent | Graduated |
| Void Protocol | VOID | Normal | Early (12%) |
| RAG Skill | RAG | Skill | Active (41%) |
| AlphaHunter | ALPHA | Agent | Active (55%) |
| Debug Module | DEBUG | Skill | Active (27%) |
| BNBpepe | BPEPE | Normal | Very early (4%) |
| TradeSage: Trade Skill | TRADE | Skill | Active (69%) |

---

## 7. Test Coverage Summary

```
packages/contracts/test/AgentLaunch.test.ts   21 tests  Phase 1
packages/contracts/test/Phase2.test.ts        25 tests  Phase 2
packages/contracts/test/Phase3.test.ts        38 tests  Phase 3
─────────────────────────────────────────────────────────────────
Total                                         84 tests  84 passing
```

All tests run with: `cd packages/contracts && npx hardhat test`

---

## 8. Deployment Order & Script

Script: `packages/contracts/scripts/deploy.ts`

Run on testnet: `npx hardhat run scripts/deploy.ts --network bscTestnet`

```
Step 1:  Deploy NFAManager
Step 2:  Deploy AgentRegistry(nfaManagerAddress)
Step 3:  Deploy TokenFactory(nfaManager, agentRegistry, launchFee=0, feeCollector=deployer)
Step 4:  agentRegistry.grantFactoryRole(tokenFactory)        ← critical wiring
Step 5:  Deploy PLUVault
Step 6:  Deploy DAMMManager
Step 7:  Deploy BuybackBurn
Step 8:  Deploy ReputationEngine
Step 9:  Deploy IncentiveEngine
Step 10: reputationEngine.setBuybackBurn(buybackBurnAddress) ← critical wiring
```

> `BondingCurve` is **not** deployed by this script — it is deployed per-token by the token creator (one curve per token).

---

## 9. What Remains — Integration Checklist

### 🔴 Critical (required for testnet launch)

- [ ] **Deploy all contracts to BSC Testnet** — run `deploy.ts`, save addresses to a config file
- [ ] **Create `lib/contracts.ts`** in `apps/web` — export deployed addresses + ABIs from TypeChain artifacts
- [ ] **Wire `TokenFactory` to frontend** — replace simulated deploy in `LaunchForm.tsx` with real `wagmi writeContract` calls:
  - `deployNormalToken()` for Normal type
  - `deployAgentToken()` → also deploys `BondingCurve` and calls `curve.init()`
  - `deploySkillToken()` for Skill type
- [ ] **Wire `BondingCurve` to `BuySellPanel`** — replace mock quote/execute with real contract reads (`getBuyQuote`, `getSellQuote`) and writes (`buy`, `sell`)
- [ ] **Wire `ReputationEngine` to `ReputationScore`** — read `getReputation(tokenAddr)` and display live on-chain score
- [ ] **Replace mock token data with on-chain reads** — query `TokenFactory` events (`NormalTokenDeployed`, `AgentTokenDeployed`, `SkillTokenDeployed`) to build the token list

### 🟡 Important (needed for good UX)

- [ ] **Token detail page — real data** — use `wagmi useReadContract` to read `BondingCurve` state (`bnbRaised`, `tokensSold`, `graduated`, `graduationProgress`)
- [ ] **Trade history** — index `Buy` and `Sell` events from `BondingCurve` via viem `getLogs` or a subgraph
- [ ] **Bonding curve price chart** — plot historical price using `Buy`/`Sell` event data + recharts (already installed)
- [ ] **Copy-to-clipboard** — wire the `Copy` icon buttons in the token detail header
- [ ] **`TrendingFeed` live data** — replace `mockTokens` with on-chain event indexing + sorting by recent volume
- [ ] **StatsBar live data** — aggregate from contract state (total deploys, volume, burn counts)
- [ ] **Platform fee config** — make `launchFee` configurable in deploy script for mainnet (currently hardcoded to 0)

### 🟢 Nice to Have (Phase 4+ features)

- [ ] **PLU Vault UI** — after token launch, show a "Configure Liquidity Unlock" form that calls `PLUVault.createVault()`
- [ ] **DAMMManager UI** — advanced settings panel on token detail page for creators to configure their AMM
- [ ] **BuybackBurn dashboard** — treasury balance display, trigger buyback button (owner-only)
- [ ] **Airdrop creator UI** — form to build a Merkle tree, call `IncentiveEngine.createAirdrop()`, let users claim
- [ ] **Referral link system** — generate shareable links that auto-call `registerReferral()` on first visit
- [ ] **MetaTags / OG images** — per-token open graph images for social sharing
- [ ] **`not-found` page** — custom 404 for unknown token addresses in `/token/[address]`
- [ ] **Wallet network guard** — detect wrong network, prompt "Switch to BSC Testnet"
- [ ] **Mobile responsiveness audit** — test and polish all pages on small screens
- [ ] **PancakeSwap router integration** (Phase 4) — auto-seed LP on graduation via `IUniswapV2Router02`

### 🔵 Infrastructure

- [ ] **`.env` setup** — create `apps/web/.env.local` with `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID`, deployed contract addresses
- [ ] **Contract addresses config file** — `apps/web/lib/contracts.ts` exporting all deployed addresses keyed by chainId
- [ ] **Subgraph (optional)** — deploy a The Graph subgraph indexing all contract events for fast historical data
- [ ] **TypeChain output shared** — expose `packages/contracts/typechain-types` to `apps/web` via Turborepo workspace
- [ ] **Testnet faucet link** — add a faucet link in the Navbar/footer for new users

---

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  /        │  │  /launch     │  │  /token/[address]            │  │
│  │  Home     │  │  Launch Form │  │  Token Detail                │  │
│  │  + Feed   │  │  3 types     │  │  Buy/Sell + Reputation       │  │
│  └──────────┘  └──────────────┘  └──────────────────────────────┘  │
│       │               │                        │                    │
│       └───────────────┴────────────────────────┘                   │
│                       │                                             │
│              wagmi v2 + viem                                        │
│              (BSC Testnet / Mainnet)                                │
└───────────────────────┼─────────────────────────────────────────────┘
                        │  RPC calls
┌───────────────────────▼─────────────────────────────────────────────┐
│                       BNB CHAIN                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1 — IDENTITY                                          │   │
│  │                                                             │   │
│  │  NFAManager (ERC-721)  ←──→  AgentRegistry (FACTORY_ROLE)  │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│  ┌──────────────────────────────────▼──────────────────────────┐   │
│  │  LAYER 2 — FACTORY                                           │   │
│  │                                                             │   │
│  │  TokenFactory ──deploys──► NormalToken                      │   │
│  │                       └──► AgentToken                       │   │
│  │                       └──► SkillToken                       │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│  ┌──────────────────────────────────▼──────────────────────────┐   │
│  │  LAYER 3 — PRICE DISCOVERY                                   │   │
│  │                                                             │   │
│  │  BondingCurve (per token)                                   │   │
│  │  xy=k model · virtualBNB · auto-graduation                  │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│  ┌──────────────────────────────────▼──────────────────────────┐   │
│  │  LAYER 4 — LIQUIDITY                                         │   │
│  │                                                             │   │
│  │  PLUVault (tranche unlock)  +  DAMMManager (AMM config)     │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│  ┌──────────────────────────────────▼──────────────────────────┐   │
│  │  LAYER 5 — GROWTH                                            │   │
│  │                                                             │   │
│  │  BuybackBurn ──feeds──► ReputationEngine                    │   │
│  │  IncentiveEngine (Merkle airdrops + referrals)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────── Post-graduation ─────────────────────────────────────     │
│                                                                     │
│  BondingCurve.withdrawForLiquidity() ──► PancakeSwap LP Pool        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Commands

```bash
# Run all smart contract tests (from packages/contracts)
npx hardhat test

# Compile contracts
npx hardhat compile

# Deploy to BSC Testnet
npx hardhat run scripts/deploy.ts --network bscTestnet

# Run frontend dev server (from apps/web)
npm run dev

# Build frontend
npm run build

# Run everything from monorepo root
npx turbo dev       # all apps in parallel
npx turbo build     # build all packages
```

---

*Last updated: Phase 1 + 2 + 3 (smart contracts) + Phase 4 (frontend) — 84 tests passing, build clean.*
