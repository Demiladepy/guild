# Guild

MetaMask Smart Accounts Kit hackathon monorepo — ERC-7715 permissions, attenuated delegation chains, ERC-8004 agent identities, reputation-weighted hiring, x402 Venice payments, and 1Shot stablecoin gas relay.

## Quick start

```powershell
pnpm install
Copy-Item .env.example .env
# Fill VENICE_API_KEY, VENICE_MODEL, X402_PAYTO_ADDRESS, NEXT_PUBLIC_* mirrors
pnpm health
pnpm --filter web dev
```

## Monorepo layout

| Path | Purpose |
|------|---------|
| `packages/core` | Chain config, Venice, ERC-8004 viem bindings, 1Shot relayer |
| `apps/web` | Spike UI — Connect → Grant → Register → Hire → Run Job |
| `scripts/healthcheck.ts` | Base Sepolia connectivity + env validation |

## ERC-8004 agent economy (Prompt 4)

Registry addresses verified against [erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts) README:

| `CHAIN_MODE` | IdentityRegistry | ReputationRegistry |
|--------------|------------------|-------------------|
| `testnet` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| `mainnet` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Flow:

1. **Grant** — User ERC-7715 consent gate → Contractor budget (Prompt 1)
2. **Register** — Researcher (84), Analyst (77), Writer (71) as ERC-8004 identities with uneven seed reputation
3. **Hire** — Contractor reads `getSummary`, ranks by score, redelegates attenuated budget to winner
4. **Work** — Hired specialist pays via x402 ERC-7710 delegation → Venice `/chat/completions`
5. **Write-back** — Contractor posts settlement feedback (run 1 scores 40 — pulls leader below runner-up)
6. **Run again** — Re-hire by updated scores; **Analyst overtakes Researcher**; UI animates re-rank

Bindings: `packages/core/src/identity.ts` (ABIs trimmed from the contracts repo `abis/` folder).

**Funding:** Contractor, Researcher, and Writer EOAs each need a small amount of Base Sepolia ETH for `register` and reputation txs. Specialists also need USDC for 1Shot relay fees.

## 1Shot relayer integration

Specialist redemptions route through the [1Shot public relayer](https://www.1shotapi.com/solutions/gas-relayer) so agents pay gas in **USDC**, not ETH.

Flow (see `.agents/skills/public-relayer/SKILL.md`):

1. `relayer_getCapabilities` — confirm chain + stablecoin support
2. Specialist initialized as `Implementation.Stateless7702` with optional EIP-7702 `authorizationList` on first use
3. `relayer_estimate7710Transaction` → `relayer_send7710Transaction` with redelegated `permissionContext`, fee + work executions, and locked `context`
4. Webhook at `/api/relayer-webhook` receives signed status pushes; UI listens via SSE `/api/relayer-events`
5. `relayer_getStatus` is **fallback only** if webhooks are unreachable

### Relayer endpoints (per installed 1Shot skill)

| `CHAIN_MODE` | Chain | Relayer URL |
|--------------|-------|-------------|
| `testnet` (default) | Base Sepolia (84532) | `https://relayer.1shotapi.dev/relayers` |
| `mainnet` | Base (8453) | `https://relayer.1shotapi.com/relayers` |

> **Note:** This prompt listed `https://relayer.1shotapi.com/relayers` for all chains. The installed 1Shot skill specifies **`.dev`** for Base Sepolia and Sepolia testnets. Guild follows the skill; `packages/core/src/chain-mode.ts` documents the divergence.

### Webhooks for local dev

1Shot must POST to a **public** URL. Set `NEXT_PUBLIC_APP_URL` to your tunnel origin (e.g. ngrok) so `destinationUrl` resolves to `{APP_URL}/api/relayer-webhook`.

## Testnet vs mainnet (1Shot prize qualification)

The **1Shot hackathon prize** requires the final project to relay ERC-7710 transactions through the **mainnet** relayer using EIP-7702 upgrades.

| Concern | Decision |
|---------|----------|
| Daily development | `CHAIN_MODE=testnet` — Base Sepolia, `.dev` relayer, x402.org facilitator |
| Prize demo / qualification | `CHAIN_MODE=mainnet` — Base mainnet, `relayer.1shotapi.com`, real USDC |
| Must mainnet be the only mode? | **No** — Guild keeps testnet as the default dev path. Switch `CHAIN_MODE` + RPC URLs + fund mainnet USDC for the prize recording. |
| What changes on mainnet? | `packages/core/src/chain-mode.ts` selects chain, USDC address, relayer URL, and explorer links. Attenuation caveats and delegation tree logic are unchanged. |

Guild does **not** require mainnet for local acceptance testing; it **does** support mainnet-pointable relayer config without breaking the Sepolia flow.

## Environment variables

See `.env.example` for the full list. Critical for Prompt 3:

- `CHAIN_MODE` / `NEXT_PUBLIC_CHAIN_MODE`
- `NEXT_PUBLIC_APP_URL` — webhook target
- `NEXT_PUBLIC_X402_PAYTO_ADDRESS` — inference work-transfer recipient
- `VENICE_API_KEY` / `VENICE_MODEL`

## Scripts

```powershell
pnpm health          # RPC + env check
pnpm --filter web dev
pnpm -r typecheck
```
