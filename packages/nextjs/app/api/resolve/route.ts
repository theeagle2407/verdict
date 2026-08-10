// VERDICT — AI arbitration resolver (Gemini).
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    worker_bps: {
      type: "integer",
      description:
        "The worker's fair share of the locked funds in basis points, 0 to 10000, where 10000 = 100% to the worker and 0 = full refund to the client.",
    },
    reasoning: {
      type: "string",
      description:
        "A clear, neutral explanation (3-5 sentences) of how the terms and evidence justify this split. Reference specifics from both sides.",
    },
  },
  required: ["worker_bps", "reasoning"],
};

const SYSTEM = `You are VERDICT, a neutral, impartial arbitrator resolving a dispute over funds locked in an escrow between a CLIENT (who paid) and a WORKER (who was to deliver). You are given the terms both parties agreed to up front, and the evidence each side has submitted. Your job is to decide what fraction of the escrowed funds the worker has fairly earned, expressed in basis points (0 to 10000).

Principles you must follow:
- Judge only against the AGREED TERMS. Do not invent obligations neither party agreed to.
- Weigh the evidence on both sides. If the worker substantially delivered what was agreed, they earn most or all of the funds. If they delivered nothing usable, the client is refunded. Partial delivery earns a proportional share.
- Be specific and defensible. Cite concrete facts from the terms and evidence.
- Do not favor either role by default. Neutrality is the whole point.`;

export async function POST(req: NextRequest) {
  try {
    const { terms, clientEvidence, workerEvidence } = await req.json();
    if (!terms || typeof terms !== "string") {
      return NextResponse.json({ error: "Missing terms" }, { status: 400 });
    }

    const prompt = [
      SYSTEM,
      "",
      "AGREED TERMS:",
      terms,
      "",
      "CLIENT'S EVIDENCE / POSITION:",
      clientEvidence || "(none submitted)",
      "",
      "WORKER'S EVIDENCE / POSITION:",
      workerEvidence || "(none submitted)",
      "",
      "Rule on the fair split now.",
    ].join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text ?? "";
    let parsed: { worker_bps?: number; reasoning?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Model did not return valid JSON" }, { status: 502 });
    }

    let workerBps = Math.round(Number(parsed.worker_bps));
    if (!Number.isFinite(workerBps)) workerBps = 0;
    workerBps = Math.max(0, Math.min(10000, workerBps));

    return NextResponse.json({
      workerBps,
      clientBps: 10000 - workerBps,
      reasoning: parsed.reasoning ?? "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Resolver failed" }, { status: 500 });
  }
}
