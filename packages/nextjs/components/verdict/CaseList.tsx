"use client";

import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";

const STATE_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: "Funded", cls: "funded" },
  2: { label: "Disputed", cls: "disputed" },
  3: { label: "Ruled", cls: "ruled" },
  4: { label: "Settled", cls: "settled" },
};

function short(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function CaseRow({
  id,
  selectedId,
  onSelect,
}: {
  id: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { data } = useScaffoldReadContract({
    contractName: "your-contract",
    functionName: "getEscrow",
    args: [BigInt(id)],
  });

  if (!data) return null;
  const [client, worker, amount, state] = data as unknown as [string, string, bigint, bigint, bigint, bigint];
  const st = STATE_LABEL[Number(state)] ?? { label: "—", cls: "funded" };
  const eth = Number(amount) / 1e18;

  return (
    <div className={`v-case${selectedId === id ? " active" : ""}`} onClick={() => onSelect(id)}>
      <div className="v-case-id">CASE #{String(id).padStart(3, "0")}</div>
      <div className="v-case-parties v-mono">
        {short(client)} → {short(worker)}
      </div>
      <div className="v-case-foot">
        <span className="v-amount">{eth.toFixed(2)} ETH</span>
        <span className={`v-badge ${st.cls}`}>{st.label}</span>
      </div>
    </div>
  );
}

export function CaseList({
  total,
  selectedId,
  onSelect,
}: {
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (total === 0) {
    return (
      <div style={{ padding: "22px", color: "var(--ink-faint)", fontSize: 13 }}>
        No cases yet. File the first to lock funds in escrow.
      </div>
    );
  }
  // Newest first.
  const ids = Array.from({ length: total }, (_, i) => total - 1 - i);
  return (
    <div style={{ overflowY: "auto" }}>
      {ids.map(id => (
        <CaseRow key={id} id={id} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
