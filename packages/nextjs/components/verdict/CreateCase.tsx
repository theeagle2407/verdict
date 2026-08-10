"use client";

import { useState } from "react";
import { keccak256, toHex, parseEther, isAddress } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

export function CreateCase({ onCreated }: { onCreated: () => void }) {
  const [worker, setWorker] = useState("");
  const [terms, setTerms] = useState("");
  const [amount, setAmount] = useState("1.0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "your-contract" });

  const valid = isAddress(worker) && terms.trim().length > 0 && Number(amount) > 0;

  async function submit() {
    setErr(null);
    if (!valid) {
      setErr("Enter a valid worker address, terms, and a positive amount.");
      return;
    }
    setBusy(true);
    try {
      const termsHash = keccak256(toHex(terms));
      await writeContractAsync({
        functionName: "createEscrow",
        args: [worker as `0x${string}`, termsHash],
        value: parseEther(amount),
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.message ?? "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="v-eyebrow">New filing</div>
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "0.02em", margin: "6px 0 22px" }}>File a case</h1>

      <div className="v-panel">
        <div className="v-panel-title">Escrow terms</div>

        <div className="v-field">
          <div className="v-field-label">Worker address (payee)</div>
          <input className="v-input" placeholder="0x…" value={worker} onChange={e => setWorker(e.target.value)} />
        </div>

        <div className="v-field">
          <div className="v-field-label">Agreed terms</div>
          <textarea
            className="v-textarea"
            placeholder="e.g. Deliver a 5-page website with a working contact form by Friday."
            value={terms}
            onChange={e => setTerms(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6, fontFamily: "monospace" }}>
            Hashed on-chain. The AI arbitrator judges disputes against these exact terms.
          </div>
        </div>

        <div className="v-field">
          <div className="v-field-label">Amount to lock (ETH)</div>
          <input
            className="v-input"
            type="number"
            step="0.1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {err && <div style={{ color: "var(--oxblood-bright)", fontSize: 13, marginBottom: 14 }}>{err}</div>}

        <button className="v-btn oxblood" disabled={!valid || busy} onClick={submit}>
          {busy ? "Locking funds…" : "Lock funds & file"}
        </button>
      </div>
    </div>
  );
}
