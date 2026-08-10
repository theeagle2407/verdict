# VERDICT — Architecture

```mermaid
flowchart TB
    subgraph OFFCHAIN["OFF-CHAIN"]
        direction TB
        UI["VERDICT frontend<br/>Next.js · Scaffold-Stylus<br/>courtroom docket UI"]
        API["AI Arbitrator<br/>server-side API route<br/>structured-output ruling"]
        LLM["LLM<br/>reads terms + evidence<br/>returns split + reasoning"]
    end

    subgraph CHAIN["ON-CHAIN · Arbitrum Sepolia"]
        direction TB
        SC["VERDICT contract<br/>Rust · Arbitrum Stylus<br/>0x28ce...967b"]
        subgraph STATE["escrow registry"]
            E["id → client, worker, amount,<br/>state, termsHash, ruling"]
        end
        SC --- E
    end

    CLIENT(["Client<br/>payer"])
    WORKER(["Worker<br/>payee"])

    CLIENT -->|"createEscrow(worker, terms)<br/>+ locks funds"| SC
    WORKER -->|"requestResolution(id)"| SC
    CLIENT -.->|"or either party disputes"| SC

    UI <-->|"reads live state<br/>wagmi / viem"| SC
    CLIENT --> UI
    WORKER --> UI

    UI -->|"terms + both sides' evidence"| API
    API --> LLM
    LLM -->|"{ workerBps, reasoning }"| API
    API -->|"submitRuling(id, workerBps, rulingRef)"| SC

    SC -->|"settle(id): split math on-chain,<br/>release funds to both parties"| PAYOUT{{"Funds released<br/>client + worker<br/>state: settled"}}

    classDef chain fill:#EDE8DC,stroke:#6B2020,stroke-width:2px,color:#1A1714;
    classDef off fill:#F3EEE3,stroke:#8A6D3B,stroke-width:1px,color:#1A1714;
    classDef actor fill:#6B2020,stroke:#1A1714,color:#EDE8DC;
    classDef payout fill:#8A6D3B,stroke:#1A1714,color:#EDE8DC;
    class SC,E,STATE chain;
    class UI,API,LLM off;
    class CLIENT,WORKER actor;
    class PAYOUT payout;
```

## The trust boundary

Everything inside **ON-CHAIN** is enforced by code that neither party controls and anyone can verify. The AI proposes a ruling off-chain; the contract records and enforces it on-chain. The AI can only set a split between the two real parties — it can never move funds to itself or a third party, because `settle` pays only `client` and `worker` from stored state.

## Component responsibilities

| Component | Where | Job |
|---|---|---|
| VERDICT contract | On-chain (Stylus/Rust) | Holds funds, records disputes and rulings, computes the split, releases funds. The neutral party. |
| Escrow registry | On-chain | One contract, many escrows keyed by id. |
| AI Arbitrator | Off-chain (server) | Reads terms + evidence, calls the LLM, returns a structured ruling, posts it on-chain. |
| Frontend | Off-chain (client) | Reads live contract state, drives the create → dispute → rule → settle flow, role-aware per connected wallet. |
```
