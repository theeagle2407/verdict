# VERDICT

**AI-refereed escrow on Arbitrum Stylus. Disputes resolved by AI, settled trustlessly on-chain.**

Two parties lock funds against agreed terms. When they disagree, an AI arbitrator reads the terms and both sides' evidence and rules on a fair split. A Rust smart contract on Arbitrum computes the settlement and releases the funds. Neither party has to trust the other — or us.

**Live on Arbitrum Sepolia**
Contract: [`0x28ce2c3d820f7d62ca1f25300d884a69ffb4967b`](https://sepolia.arbiscan.io/address/0x28ce2c3d820f7d62ca1f25300d884a69ffb4967b)
Network: Arbitrum Sepolia (chain 421614)

---

## The problem

Escrow is one of the oldest trust problems in commerce. A client pays for work; a worker delivers it. When they disagree — "this isn't what we agreed" — someone neutral has to decide who gets the money. Today that neutral party is a company: a marketplace, a bank, a payment processor. You have to trust that company to hold your funds and to rule fairly, and their decision arrives through a support ticket you cannot audit.

Freelance and marketplace disputes are a massive, unglamorous, unsolved pain. The arbitration is slow, opaque, and biased toward whoever the platform would rather keep.

## The answer

VERDICT replaces the trusted company with two things that cannot be biased: a smart contract that holds the funds, and an AI arbitrator whose ruling is enforced by code rather than a human's discretion.

1. **Lock** — the client opens an escrow, naming the worker's address and the agreed terms, and locks the payment. `createEscrow(worker, termsHash)` — payable.
2. **Dispute** — if the work is contested, either party escalates to arbitration. `requestResolution(id)`.
3. **Rule** — the AI reads the terms and both sides' evidence and returns a fair split in basis points, with written reasoning. The ruling is posted on-chain. `submitRuling(id, workerBps, rulingRef)`.
4. **Settle** — the contract computes the split and releases the funds to both parties. `settle(id)`.

## Why this has to be on-chain

This is the question the Arbitrum track asks every project to answer, and VERDICT's answer is structural, not decorative.

An escrow's entire value is that a neutral party both sides trust holds the money. If that party is a company, you are back to trusting the company. Putting the escrow in a smart contract removes the company: the funds are held and released by code that neither party controls and everyone can read. The AI's ruling is recorded permanently and publicly; it cannot be edited, deleted, or quietly overridden. Remove the blockchain and VERDICT is just another company asking you to trust it. The chain *is* the neutrality.

## Why Arbitrum Stylus

The settlement is real computation, and it runs inside the contract. Stylus lets us write the contract in Rust and run the split math — validating the ruling against the locked amount, computing each party's cut, guarding against re-entrancy — cheaply and verifiably on-chain, where in the EVM it would be clumsy and expensive. The contract is deployed and activated on Arbitrum Sepolia via `cargo stylus`.

## Why the AI is essential, not decorative

The AI *is* the arbitrator. Without it there is no ruling and no product — just a pot of locked funds with no way to resolve a disagreement. It performs genuine analysis: it reads the agreed terms and each party's evidence and produces a structured, defensible judgment (a basis-point split plus written reasoning). The reasoning is shown in full so the ruling is auditable rather than a black box.

Crucially, the AI can only *rule*. It sets a split between the two real parties; it can never redirect funds to itself or a third party. Even a compromised arbitrator can only mis-split between the client and the worker — it can never steal. That boundary is enforced by the contract, not by trust.

## How it works

```
Client                Contract (Stylus/Rust)           AI Arbitrator
  |                          |                                |
  |-- createEscrow() ------->| funds locked                   |
  |   (+ terms, worker)      |                                |
  |                          |                                |
Worker                       |                                |
  |-- requestResolution() -->| state: disputed                |
  |                          |                                |
  |   evidence submitted ------------------------------------>| reads terms
  |                          |                                | + evidence,
  |                          |<-- submitRuling(workerBps) ----| returns split
  |                          |   ruling recorded on-chain     | + reasoning
  |                          |                                |
  |-- settle() ------------->| computes split,                |
  |                          | releases funds to both,        |
  |                          | state: settled (immutable)     |
```

## Tech

- **Smart contract:** Rust, Arbitrum Stylus SDK, deployed via `cargo stylus`. Registry pattern — one contract holds many escrows keyed by id. On-chain settlement math, re-entrancy-safe (checks-effects-interactions), typed errors.
- **AI arbitrator:** server-side API route calling an LLM with a structured-output schema, so every ruling returns machine-readable `{ workerBps, reasoning }`.
- **Frontend:** Next.js + Scaffold-Stylus, wagmi/viem, a courtroom-docket interface reading live contract state. Role-aware: the same case shows differently to the client, the worker, and an observer.
- **Chain:** Arbitrum Sepolia (421614).

## Contract addresses

| Item | Value |
|---|---|
| Contract | `0x28ce2c3d820f7d62ca1f25300d884a69ffb4967b` |
| Network | Arbitrum Sepolia (421614) |
| Explorer | https://sepolia.arbiscan.io/address/0x28ce2c3d820f7d62ca1f25300d884a69ffb4967b |

## Run locally

```bash
# 1. install
yarn install
git submodule update --init --recursive

# 2. local chain (terminal 1)
yarn chain

# 3. deploy the Stylus contract (terminal 2)
yarn deploy

# 4. frontend (terminal 3)
yarn start   # http://localhost:3000
```

For the AI arbitrator, set an LLM API key in `packages/nextjs/.env.local` (see `.env.example`).
To deploy to Arbitrum Sepolia, set `PRIVATE_KEY_SEPOLIA` and `ACCOUNT_ADDRESS_SEPOLIA` in `packages/stylus/.env`, then `yarn deploy --network sepolia`.

## Honest notes

The arbitrator's ruling is produced by an LLM and shown with its full reasoning so it can be audited; it is a decision aid enforced by the contract, not an infallible oracle. The demo runs on Arbitrum Sepolia testnet. Work delivery happens off-platform — VERDICT holds the funds and resolves the dispute; it is not where the work itself is uploaded.
