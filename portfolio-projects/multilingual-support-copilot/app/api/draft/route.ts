import { ai, auth, db, err } from "@/lib/production";

export async function POST(request: Request) {
  try {
    auth(request);
    const body = await request.json() as { ticketId?: string; message?: string; language?: string; verifiedFacts?: string[] };
    if (!body.message) return Response.json({ ok: false, error: "message is required" }, { status: 400 });
    const prompt = [
      "You are a multilingual customer-support copilot.",
      "Draft a helpful, concise reply in the requested language.",
      "Never invent refunds, policies, order facts, account actions, SLAs, or troubleshooting results.",
      "Use only the customer message and verified facts supplied below.",
      `LANGUAGE: ${body.language || "same as customer"}`,
      `CUSTOMER MESSAGE:\n${body.message}`,
      `VERIFIED FACTS:\n${(body.verifiedFacts || []).map(x => `- ${x}`).join("\n") || "- none"}`,
    ].join("\n\n");
    const draft = await ai(prompt);
    if (!draft.trim()) throw new Error("AI provider returned an empty draft");
    const saved = await db("support_drafts", { method: "POST", body: JSON.stringify({ ticket_id: body.ticketId || null, customer_message: body.message, language: body.language || null, draft }) });
    return Response.json({ ok: true, draft, saved });
  } catch (error) {
    return err(error);
  }
}
