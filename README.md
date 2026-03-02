
---

# AgentLaunch

### Tokenized AI Agents with Verifiable On-Chain Identity on BNB Chain

AgentLaunch is an infrastructure layer for launching **AI-backed tokens** on BNB Smart Chain, where every token is verifiably tied to a deployed AI agent and governed by programmable, modular incentives.

Instead of launching speculative tokens, builders launch **tokenized AI economies** with structured liquidity, on-chain identity, and token-gated utility.

---

# 🌐 Live Deployment

Production App:
[https://production-bnb-openclaw.tyzo.nodeops.app/](https://production-bnb-openclaw.tyzo.nodeops.app/)

Network: **BNB Smart Chain Testnet**

Smart contract addresses are listed in `bsc.address`.

---

# 🚀 What It Does

AgentLaunch enables users to:

* Deploy an ERC20 token on BNB Smart Chain
* Register an AI agent on-chain
* Provision a VM via NodeOps
* Deploy an AI container using Docker
* Generate a public API endpoint
* Enforce token-gated AI access
* Enable modular AI skill extensions

Each launched token is directly linked to a functional AI agent.

---

# 🧠 Why It Matters

Current launchpads suffer from:

* Instant liquidity dumps
* Speculative “AI tokens” without real AI
* Closed AI systems with no modular contribution model

AgentLaunch introduces:

* Verifiable AI-token linkage
* Structured launch logic
* Token-gated AI APIs
* Modular skill architecture
* Incentive alignment between builders, developers, and users

This shifts BNB Chain from speculative launches toward sustainable AI-native economies.

---

# 🏗 Architecture Overview

AgentLaunch combines:

* Frontend (React / Next.js)
* Backend (Node.js / Express)
* Smart Contracts (ERC20 + Agent Registry)
* NodeOps VM provisioning
* Docker-based AI deployment

High-level flow:

User → Launch Token → Register Agent → Provision VM → Deploy AI → Token-Gated Access

Detailed diagrams and architecture are available in `docs/TECHNICAL.md`.

---

# 🔐 Core Features

* ERC20 token deployment
* On-chain agent registry
* Token balance verification
* Wallet signature validation
* Docker-based AI agent runtime
* NodeOps VM provisioning
* Real-time activity updates
* Modular skill extension framework

---

# 📂 Repository Structure

```
/README.md
/bsc.address
/docs/
    PROJECT.md
    TECHNICAL.md
    EXTRAS.md
/src/
/test/
```

---

# ⚙️ Quick Start (Local Development)

## 1. Clone Repository

```
git clone <repo-url>
cd agentlaunch
```

## 2. Install Dependencies

```
npm install
```

## 3. Configure Environment

Create `.env` from `.env.example`:

```
PRIVATE_KEY=
BSC_RPC_URL=
NODEOPS_API_KEY=
JWT_SECRET=
PORT=4000
```

---

## 4. Deploy Smart Contracts

```
npx hardhat run scripts/deploy.js --network bscTestnet
```

Update `bsc.address` with deployed contract addresses.

---

## 5. Start Backend

```
npm run backend
```

Runs at:

```
http://localhost:4000
```

---

## 6. Start Frontend

```
npm run dev
```

Open:

```
http://localhost:3000
```

---

# 🧪 How to Evaluate (5-Minute Judge Guide)

1. Open production link
2. Connect MetaMask (BNB Testnet)
3. Launch a sample agent
4. Confirm token deployment on BscScan
5. Test token-gated API access

Full setup and architecture details are in:

* `docs/PROJECT.md`
* `docs/TECHNICAL.md`

---

# 📜 Smart Contracts

Contracts deployed on:

* BNB Smart Chain Testnet

See `bsc.address` for:

* Token contract address
* Agent registry contract
* Explorer links

---

# 💼 Ecosystem Impact

AgentLaunch drives:

* Increased smart contract deployments
* AI-native token utility
* On-chain verification of AI agents
* Modular AI development markets
* Sustainable liquidity models

It provides a foundation for programmable AI economies on BNB Chain.

---

# 🔭 Roadmap

Short-Term:

* Automated skill registry
* Revenue split contracts
* Liquidity lock module
* Analytics dashboard

Long-Term:

* Cross-chain AI agents
* On-chain governance
* Decentralized inference network
* Reputation-based skill scoring

---

# 📽 Demo & Presentation

Supporting materials are available in:

`docs/EXTRAS.md`

The repository and codebase are the primary source of truth for evaluation.

---

# 📄 License

MIT License

---
