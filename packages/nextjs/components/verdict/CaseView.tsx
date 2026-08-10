"use client";

import { useState } from "react";
import { keccak256, toHex } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

const STATE = { FUNDED: 1, DISPUTED: 2, RULED: 3, SETTLED: 4 };

function short(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

interface Ruling {
  workerBps: number;
  clientBps: number;
  reasoning: string;
}

export function CaseView({ id, connected }: { id: number; connected?: string }) {
  const [clientEvidence, setClientEvidence] = useState("");
  const [workerEvidence, setWorkerEvidence] = useState("");
  const [terms, setTerms] = useState("");
  const [ruling, setRuling] = useState<Ruling | null>(null);
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data, refetch } = useScaffoldReadContract({
    contractName: "your-contract",
    functionName: "getEscrow",
    args: [BigInt(id)],
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "your-contract" });

  if (!data) return <div className="v-empty">Loading case…</div>;
  const [client, worker, amount, state] = data as unknown as [string, string, bigint, bigint, bigint, bigint];
  const st = Number(state);
  const eth = Number(amount) / 1e18;

  const c = connected?.toLowerCase();
  const isClient = c && c === client.toLowerCase();
  const isWorker = c && c === worker.toLowerCase();
  const role = isClient ? "client" : isWorker ? "worker" : "observer";
  const isParty = isClient || isWorker;

  async function dispute() {
    setErr(null);
    setBusy(true);
    try {
      await writeContractAsync({ functionName: "requestResolution", args: [BigInt(id)] });
      await refetch();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to raise dispute.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveWithAI() {
    setErr(null);
    setThinking(true);
    setRuling(null);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: terms || "(terms recorded on-chain as a hash)", clientEvidence, workerEvidence }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setRuling(j);
    } catch (e: any) {
      setErr(e?.message ?? "AI resolution failed.");
    } finally {
      setThinking(false);
    }
  }

  async function postRuling() {
    if (!ruling) return;
    setErr(null);
    setBusy(true);
    try {
      const reasoningHash = keccak256(toHex(ruling.reasoning));
      await writeContractAsync({
        functionName: "submitRuling",
        args: [BigInt(id), BigInt(ruling.workerBps), reasoningHash],
      });
      await refetch();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to post ruling on-chain.");
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    setErr(null);
    setBusy(true);
    try {
      await writeContractAsync({ functionName: "settle", args: [BigInt(id)] });
      await refetch();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to settle.");
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = ["", "Funded", "Disputed", "Ruled", "Settled"][st] ?? "—";
  const roleLabel =
    role === "client"
      ? "You are the client on this case"
      : role === "worker"
        ? "You are the worker on this case"
        : "You are viewing as a third party";

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="v-eyebrow">Case on record</div>
      <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.02em", margin: "6px 0 4px" }}>
        Case #{String(id).padStart(3, "0")}
      </h1>
      <div className="v-mono" style={{ color: "var(--ink-faint)", marginBottom: 6, fontSize: 12 }}>
        Status: {stateLabel.toUpperCase()}
      </div>
      <div
        style={{
          display: "inline-block",
          fontFamily: "monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: 2,
          marginBottom: 24,
          border: "1px solid var(--line)",
          color: role === "observer" ? "var(--ink-faint)" : "var(--oxblood)",
          background: role === "observer" ? "transparent" : "var(--paper-panel)",
        }}
      >
        {roleLabel}
      </div>

      <div className="v-panel">
        <div className="v-panel-title">Parties & escrow</div>
        <div className="v-row">
          <span className="k">Client (payer)</span>
          <span className="val">
            {short(client)}
            {isClient ? " ← you" : ""}
          </span>
        </div>
        <div className="v-row">
          <span className="k">Worker (payee)</span>
          <span className="val">
            {short(worker)}
            {isWorker ? " ← you" : ""}
          </span>
        </div>
        <div className="v-row">
          <span className="k">Locked</span>
          <span className="val">{eth.toFixed(4)} ETH</span>
        </div>
        <div className="v-row">
          <span className="k">On-chain state</span>
          <span className="val">{stateLabel}</span>
        </div>
      </div>

      {st === STATE.FUNDED && (
        <div className="v-panel">
          <div className="v-panel-title">Raise a dispute</div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16 }}>
            If the work is contested, either party may escalate this case to AI arbitration. Funds stay locked until a
            ruling is settled on-chain.
          </p>
          {err && <div style={{ color: "var(--oxblood-bright)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button className="v-btn oxblood" disabled={busy || !isParty} onClick={dispute}>
            {busy ? "Escalating…" : isParty ? "Escalate to arbitration" : "Only a party may dispute"}
          </button>
        </div>
      )}

      {st === STATE.DISPUTED && (
        <div className="v-panel">
          <div className="v-panel-title">Arbitration</div>
          <div className="v-field">
            <div className="v-field-label">Agreed terms (as both sides understood them)</div>
            <textarea
              className="v-textarea"
              value={terms}
              onChange={e => setTerms(e.target.value)}
              placeholder="Restate the agreed terms for the arbitrator."
            />
          </div>
          <div className="v-field">
            <div className="v-field-label">Client&rsquo;s position</div>
            <textarea
              className="v-textarea"
              value={clientEvidence}
              onChange={e => setClientEvidence(e.target.value)}
              placeholder="What the client says went wrong."
            />
          </div>
          <div className="v-field">
            <div className="v-field-label">Worker&rsquo;s position</div>
            <textarea
              className="v-textarea"
              value={workerEvidence}
              onChange={e => setWorkerEvidence(e.target.value)}
              placeholder="What the worker says they delivered."
            />
          </div>
          {err && <div style={{ color: "var(--oxblood-bright)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button className="v-btn" disabled={thinking} onClick={resolveWithAI}>
            {thinking ? "Arbitrator deliberating…" : "Resolve with AI"}
          </button>

          {ruling && (
            <div className="v-ruling">
              <div className="v-eyebrow">The ruling</div>
              <div className="v-ruling-split">
                <div className="v-split-cell">
                  <div className="v-split-pct">{(ruling.workerBps / 100).toFixed(0)}%</div>
                  <div className="v-split-lbl">to worker</div>
                </div>
                <div className="v-split-cell">
                  <div className="v-split-pct">{(ruling.clientBps / 100).toFixed(0)}%</div>
                  <div className="v-split-lbl">to client</div>
                </div>
              </div>
              <p className="v-reasoning">{ruling.reasoning}</p>
              <button className="v-btn oxblood" style={{ marginTop: 16 }} disabled={busy} onClick={postRuling}>
                {busy ? "Posting on-chain…" : "Enter ruling on-chain"}
              </button>
            </div>
          )}
        </div>
      )}

      {st === STATE.RULED && (
        <div className="v-panel">
          <div className="v-panel-title">Ruling entered — awaiting settlement</div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 16 }}>
            The ruling is recorded on-chain. Settling executes the split and releases funds to both parties.
          </p>
          {err && <div style={{ color: "var(--oxblood-bright)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button className="v-btn oxblood" disabled={busy} onClick={settle}>
            {busy ? "Settling…" : "Settle & release funds"}
          </button>
        </div>
      )}

      {st === STATE.SETTLED && (
        <div className="v-panel" style={{ borderColor: "var(--brass)" }}>
          <div className="v-panel-title" style={{ color: "var(--brass)" }}>
            Case closed
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
            Funds have been released on-chain per the ruling. This case is settled and immutable.
          </p>
        </div>
      )}
    </div>
  );
}
