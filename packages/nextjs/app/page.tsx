"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { CreateCase } from "~~/components/verdict/CreateCase";
import { CaseList } from "~~/components/verdict/CaseList";
import { CaseView } from "~~/components/verdict/CaseView";
import "~~/styles/verdict.css";

const Home: NextPage = () => {
  const { address } = useAccount();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: totalEscrows } = useScaffoldReadContract({
    contractName: "your-contract",
    functionName: "totalEscrows",
  });

  const { data: resolver } = useScaffoldReadContract({
    contractName: "your-contract",
    functionName: "getResolver",
  });

  const total = totalEscrows ? Number(totalEscrows) : 0;

  return (
    <div className="verdict-root">
      <div className="v-topbar">
        <div className="v-brand">
          <span className="v-wordmark">
            VERDICT<span className="dot">.</span>
          </span>
          <span className="v-tagline">AI-refereed escrow · Arbitrum Stylus</span>
        </div>
        <div className="v-topmeta">
          <div className="v-meta-block">
            <div className="v-meta-label">Arbitrator</div>
            <div className="v-meta-value">{resolver ? `${resolver.slice(0, 6)}…${resolver.slice(-4)}` : "—"}</div>
          </div>
          <div className="v-divider" />
          <div className="v-wallet-slot">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>

      <div className="v-shell">
        <aside className="v-rail">
          <div className="v-rail-head">
            <div className="v-rail-title">The Docket</div>
            <div className="v-rail-count">
              {total} case{total === 1 ? "" : "s"} on record
            </div>
          </div>
          <CaseList
            total={total}
            selectedId={selectedId}
            onSelect={id => {
              setSelectedId(id);
              setCreating(false);
            }}
          />
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--line)", marginTop: "auto" }}>
            <button
              className="v-btn oxblood"
              style={{ width: "100%" }}
              onClick={() => {
                setCreating(true);
                setSelectedId(null);
              }}
            >
              File new case
            </button>
          </div>
        </aside>

        <main className="v-main">
          {creating ? (
            <CreateCase onCreated={() => setCreating(false)} />
          ) : selectedId !== null ? (
            <CaseView id={selectedId} connected={address} />
          ) : (
            <div className="v-empty">
              <div className="v-empty-title">No case selected</div>
              <div>Select a case from the docket, or file a new one to lock funds in escrow.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
