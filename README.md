# Guild

**Grant one budget. Hire by on-chain reputation. Work inside attenuated permissions. Reputation updates from real results.**

Guild is a hackathon prototype for the MetaMask Smart Accounts Kit × 1Shot × Venice Dev Cook Off. An owner wallet grants a weekly USDC budget to a Contractor session account; the Contractor reads ERC-8004 reputation, hires the top eligible specialist, redelegates a capped sub-budget, pays for Venice private inference, and writes settlement feedback back to the registry. A second run re-reads on-chain scores and can hire a different specialist.

---

## The problem

Giving autonomous agents money is risky without scoped authority: raw private keys, blanket token approvals, and no way to compare agents on past performance. Guild uses **ERC-7715** so the owner grants a bounded periodic budget, **ERC-7710** so authority only shrinks down the delegation chain (2 USDC cap, USDC-only, Venice-scoped), and **ERC-8004** so hiring is driven by on-chain reputation that moves after each job. Payment for inference goes through **x402** (default) so settlement is explicit and linkable to feedback.

---

## What it does (built flow)

The homepage (`apps/web/src/app/page.tsx` → `GuildDashboard` → `useGuildApp.ts`) runs this path end-to-end on **Base Sepolia** by default:

| Step | What happens |
|------|----------------|
| **Connect** | Owner wallet on Base Sepolia; Contractor session EOA created in browser localStorage |
| **Grant** | `requestExecutionPermissions` — ERC-7715 periodic USDC budget (10 USDC/week) to Contractor |
| **Register** | Three specialist EOAs mint ERC-8004 identities + seeded uneven reputation via `giveFeedback` |
| **Post job & hire** | `getSummary` → rank by score → `redelegatePermissionContext` (2 USDC cap, Venice-only caveats) |
| **Settle** | Specialist pays via **x402** ERC-7710 delegation → `/api/x402/venice-inference` → Venice `/chat/completions` |
| **Feedback** | Contractor writes ERC-8004 `giveFeedback` (run 1 score 40 pulls leader below runner-up) |
| **Run again** | Fresh `getSummary` + re-hire; **Researcher → Analyst** flip when on-chain rank changes |
| **Attempt overspend** | Real delegated USDC transfer above cap; on-chain revert surfaced in job log |

No mock sim runs on the default path. `useGuildSim.ts` and `guild-spike.tsx` remain in the repo as unused reference code.

---

## Tracks & qualification

| Track | How Guild qualifies |
|-------|---------------------|
| **MetaMask Smart Accounts Kit** (qualification gate) | **ERC-7715** grant in `useGuildApp.ts` (`grantBudget`). **ERC-7710** attenuated redelegation in `delegation-chain.ts` + overspend proof via `sendTransactionWithDelegation`. Kit deps: `@metamask/smart-accounts-kit` 1.6.0, `@metamask/x402` 0.2.0. |
| **Best A2A coordination** | Contractor → Specialist redelegation with spending cap and `allowedTargets` / `allowedMethods` caveats; authority cannot expand down-chain. |
| **Best use of Venice** | Inference via Venice API; x402-gated proxy at `apps/web/src/app/api/x402/venice-inference/route.ts`. |
| **1Shot relayer** | **Optional, flag-gated.** `submitSpecialistVeniceRelay()` is called when `RELAYER_MODE=relayer` (requires `CHAIN_MODE=mainnet`, public `NEXT_PUBLIC_APP_URL`, mainnet funding). **Default settlement is x402 on Base Sepolia**, not the relayer. |

**Kit in the main user flow:** Connect → **Grant (7715)** → Register → **Hire + redelegate (7710)** → x402 pay → feedback. Every job run exercises grant context and a fresh redelegation.

---

## Architecture

```
Owner wallet (MetaMask Flask)
    │ ERC-7715 periodic USDC grant
    ▼
Contractor session EOA (localStorage key)
    │ read ReputationRegistry.getSummary
    │ hire top specialist
    │ ERC-7710 redelegate (2 USDC, USDC transfer only)
    ▼
Specialist EOA (Researcher / Analyst / Writer)
    │ x402 wrapFetchWithPayment (default)
    │   OR 1Shot send7710 + webhook (RELAYER_MODE=relayer, mainnet)
    ▼
/api/x402/venice-inference  →  Venice API  →  settlement tx
    │
    ▼
Contractor giveFeedback  →  standings re-rank  →  next hire
```

| Component | File(s) | Role |
|-----------|---------|------|
| Chain config | `packages/core/src/config.ts`, `chain-mode.ts` | Base Sepolia / mainnet, USDC, registry addresses, relayer URL |
| ERC-8004 bindings | `packages/core/src/identity.ts` | `register`, `getSummary`, `giveFeedback` |
| Agent roster | `apps/web/src/lib/agents.ts` | Researcher / Analyst / Writer EOAs + seed scores |
| Registration | `apps/web/src/lib/agent-registry.ts` | Mint identities, seed reputation |
| Hiring | `apps/web/src/lib/agent-hiring.ts` | `listSpecialistCandidates`, `hireTopSpecialist` |
| Redelegation | `apps/web/src/lib/delegation-chain.ts` | 2 USDC cap, Venice-only caveats |
| x402 client | `apps/web/src/lib/specialist-client.ts` | `runVeniceViaX402` via `@x402/fetch` |
| x402 server | `apps/web/src/lib/x402-server.ts`, `api/x402/venice-inference/route.ts` | Payment gate + Venice proxy |
| Feedback | `apps/web/src/lib/agent-feedback.ts` | Post-settlement `giveFeedback` |
| UI orchestration | `apps/web/src/hooks/useGuildApp.ts` | Connect → grant → register → job loop |
| Registry check | `apps/web/src/lib/verify-registry.ts` | `getCode` on singleton addresses |
| 1Shot relayer (optional) | `apps/web/src/lib/specialist-relayer.ts`, `relayer-settlement.ts` | `estimate7710` → `send7710`, EIP-7702 upgrade |
| Relayer webhooks | `api/relayer-webhook`, `api/relayer-events` | Push status + SSE to job log |
| Pre-flight | `scripts/healthcheck.ts` | RPC, registries, Venice, x402, wallet balances |

**Monorepo:** `packages/core` (viem + Kit bindings), `apps/web` (Next.js 14 UI + API routes).

---

## On-chain

Guild does **not** deploy a custom market contract. It calls the **public ERC-8004 singleton registries** already on Base Sepolia (bytecode verified via `verify-registry.ts`):

| Registry | Base Sepolia address |
|----------|-------------------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

USDC (Circle test token): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

Agents are ERC-8004 NFT identities owned by fixed specialist EOAs. Reputation is per-client (`getSummary` scoped to Contractor address + `guild` / `venice-inference` tags). Using the standard registries is intentional — Guild is a client of ERC-8004, not a new registry deploy.

---

## Run it locally

### Prerequisites

- **Node.js** ≥ 18, **pnpm**
- **MetaMask Flask 13.5+** with Advanced Permissions (ERC-7715). Other wallets (e.g. Rabby) may connect but often cannot complete the grant step.
- Wallet on **Base Sepolia** with test **USDC** (Circle faucet) and a small amount of **ETH**
- **Venice API key** with account credits at [venice.ai/settings/api](https://venice.ai/settings/api)

### Environment

Copy `.env.example` → `.env` at repo root:

| Variable | Purpose |
|----------|---------|
| `CHAIN_MODE` / `NEXT_PUBLIC_CHAIN_MODE` | `testnet` (Base Sepolia, default) or `mainnet` |
| `BASE_SEPOLIA_RPC_URL` | RPC for Sepolia reads/writes |
| `VENICE_API_KEY` / `VENICE_MODEL` | Server-side Venice inference |
| `X402_PAYTO_ADDRESS` / `NEXT_PUBLIC_X402_PAYTO_ADDRESS` | Wallet receiving x402 inference payment (~$0.01) |
| `NEXT_PUBLIC_APP_URL` | App origin; must be a **public tunnel URL** if using relayer webhooks |
| `RELAYER_MODE` / `NEXT_PUBLIC_RELAYER_MODE` | `x402` (default) or `relayer` (1Shot mainnet path) |
| `BUNDLER_RPC_URL` | Required by `pnpm health` only; not used in the default job loop |
| `GUILD_CONTRACTOR_ADDRESS` | Optional; copy from UI after Connect for `pnpm health` wallet check |

### Funding (beyond the owner wallet)

The Contractor session EOA and three specialist EOAs (derived from `agents.ts`) need **Base Sepolia ETH** (registry + feedback gas) and **USDC** (x402 delegated spend). `pnpm health` prints balances and FAILs on zero ETH or USDC.

### Commands

```bash
pnpm install
cp .env.example .env   # fill Venice key, x402 pay-to, etc.
pnpm health            # pre-flight; exits non-zero on any FAIL
pnpm dev               # http://localhost:3000
```

Restart the dev server after changing `.env` (Next.js reads server vars at boot).

### User flow

1. **Connect** — MetaMask Flask on Base Sepolia  
2. **Grant budget** — ERC-7715 USDC permission to Contractor  
3. **Register agents** — mint 3 ERC-8004 IDs + seed reputation txs  
4. **Post job & hire** — hire, x402 Venice payment, on-chain feedback  
5. **Run again** — re-read reputation; watch Analyst overtake Researcher after run-1 feedback  
6. **Attempt overspend** — real revert when specialist exceeds 2 USDC cap  

Job log lines include Base Sepolia explorer links for settlement and feedback txs.

### Optional: 1Shot relayer mode (mainnet prize path)

```env
RELAYER_MODE=relayer
NEXT_PUBLIC_RELAYER_MODE=relayer
CHAIN_MODE=mainnet
NEXT_PUBLIC_CHAIN_MODE=mainnet
NEXT_PUBLIC_APP_URL=https://your-tunnel.ngrok.app
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

Requires mainnet ETH/USDC on contractor + specialists and a public webhook URL. Settlement uses `relayer.1shotapi.com` + EIP-7702 upgrade; Venice text comes from `/api/venice` after webhook confirmation. **Sepolia demo should stay on `RELAYER_MODE=x402`.**

---

## Honest scope

### What's real in this build

- ERC-7715 budget grant and ERC-7710 attenuated redelegation (MetaMask Smart Accounts Kit)
- ERC-8004 identity registration, `getSummary` hiring, and `giveFeedback` write-back against live Sepolia singletons
- x402 ERC-7710 delegated payment to a gated Venice proxy (default settlement path)
- Two consecutive job runs with on-chain re-rank (Researcher → Analyst after run-1 feedback score 40)
- Real overspend revert via delegated USDC transfer above cap
- Optional 1Shot mainnet relayer path behind `RELAYER_MODE=relayer` (webhook + SSE status in job log)

### Out of scope by design

- **Custom market / escrow contract** — hiring logic is off-chain orchestration + standard ERC-8004 reads/writes
- **General LLM agent framework** — no Claude, LangChain, or autonomous planner; specialists are role-scoped EOAs; **Venice** is the inference layer
- **1Shot on Sepolia demo path** — default x402 settlement; relayer is opt-in mainnet only
- **Production auth, persistence, or multi-tenant registry** — browser localStorage for contractor key and agent IDs

---

## Demo

**Video:** [Demo video](TODO)

**Verify on-chain (Base Sepolia):**

- Agent registration tx: [TODO — basescan link]
- Reputation feedback tx (run 1): [TODO — basescan link]
- x402 settlement tx: [TODO — basescan link]
- Overspend revert tx: [TODO — basescan link]

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Smart accounts | MetaMask Smart Accounts Kit 1.6.0 — ERC-7715, ERC-7710, x402 experimental delegation |
| Payments | `@metamask/x402`, `@x402/core`, `@x402/fetch` — x402.org facilitator on Sepolia |
| Identity & reputation | ERC-8004 singleton registries via viem (`packages/core/src/identity.ts`) |
| Inference | Venice API (`venice-uncensored` or configured model) |
| Relayer (optional) | 1Shot `relayer.1shotapi.com` — `packages/core/src/relayer.ts` |
| Frontend | Next.js 14, React 18, Tailwind |
| Chain | Base Sepolia (84532) default; Base mainnet for relayer mode |
| Tooling | TypeScript, viem 2.x, pnpm monorepo, `tsx` healthcheck |

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install workspace dependencies |
| `pnpm health` | Pre-flight: RPC, ERC-8004 bytecode, Venice call, x402 402 response, wallet balances |
| `pnpm dev` | Start Next.js at `http://localhost:3000` |
| `pnpm build` | Production build (all packages) |
| `pnpm typecheck` | TypeScript check (all packages) |

---

## License

MIT — see repository license file if present.
