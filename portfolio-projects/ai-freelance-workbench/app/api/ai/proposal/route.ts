import { assertAuthorized, errorResponse, generateWithOpenAI, heartbeat, supabase } from "@/lib/production";

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = await request.json() as { projectId?: string; brief?: string; verifiedFacts?: string[] };
    if (!body.projectId || !body.brief) {
      return Response.json({ ok: false, error: "projectId and brief are required" }, { status: 400 });
    }
    const facts = (body.verifiedFacts || []).filter(Boolean);
    const prompt = [
      "You draft concise freelance proposals. Never invent credentials, clients, metrics, tools, dates, or outcomes.",
      "Use only facts explicitly provided below. If a useful claim is unsupported, omit it.",
      `PROJECT BRIEF:\n${body.brief}`,
      `VERIFIED FACTS:\n${facts.length ? facts.map(x => `- ${x}`).join("\n") : "- No verified facts supplied"}`,
      "Return a client-ready proposal with: opening, understanding, approach, deliverables, next step.",
    ].join("\n\n");
    const text = await generateWithOpenAI(prompt);
    if (!text.trim()) throw new Error("AI provider returned an empty proposal");
    const data = await supabase("proposals", {
      method: "POST",
      body: JSON.stringify({ project_id: body.projectId, body: text, model: process.env.OPENAI_MODEL || "gpt-5-mini" }),
    });
    await heartbeat("proposal.generated", { projectId: body.projectId });
    return Response.json({ ok: true, text, data });
  } catch (error) {
    return errorResponse(error);
  }
}
