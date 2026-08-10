import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { buildApplicationPrompt, hasUsableProfile, validateApplicationPack } from "../../../lib/application-pack";

export const maxDuration = 60;

function extractJson(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { gig?: Record<string, unknown> } | null;
  if (!body?.gig || !body.gig.id || !body.gig.title || !body.gig.sourceUrl) return Response.json({ error: "invalid_gig" }, { status: 400 });

  await ensureDatabase();
  const sql = db();
  const [profileRows, portfolio] = await Promise.all([
    sql`SELECT profile_ciphertext AS "profileCiphertext" FROM private_profiles WHERE owner_email=${user.email} LIMIT 1`,
    sql`SELECT title,summary,link,skills,evidence,github_repo AS "githubRepo",deployment_url AS "deploymentUrl" FROM portfolio_items WHERE owner_email=${user.email} ORDER BY position ASC,updated_at DESC LIMIT 20`,
  ]);
  let profile = null;
  if (profileRows.length) {
    try { profile = JSON.parse(await unseal(String((profileRows[0] as Record<string, unknown>).profileCiphertext))); }
    catch { return Response.json({ error: "profile_decryption_failed" }, { status: 500 }); }
  }
  if (!hasUsableProfile(profile, portfolio)) return Response.json({ error: "profile_required" }, { status: 409 });

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.OPENAI_API_KEY;
  if (!token) return Response.json({ error: "ai_not_configured" }, { status: 503 });
  const directOpenAI = Boolean(process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN);
  const endpoint = directOpenAI ? "https://api.openai.com/v1/chat/completions" : "https://ai-gateway.vercel.sh/v1/chat/completions";
  const model = directOpenAI ? (process.env.APPLICATION_AI_MODEL || "gpt-5-mini") : (process.env.APPLICATION_AI_MODEL || "openai/gpt-5-mini");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: buildApplicationPrompt({ gig: body.gig, profile, portfolio }) }], response_format: { type: "json_object" } }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("application_pack_ai_failed", response.status, detail.slice(0, 300));
    return Response.json({ error: "ai_generation_failed" }, { status: 502 });
  }
  try {
    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    const pack = validateApplicationPack(extractJson(result.choices?.[0]?.message?.content || ""));
    return Response.json({ ...pack, gig: body.gig, generatedByAI: true });
  } catch (error) {
    console.error("application_pack_invalid", error);
    return Response.json({ error: "ai_response_invalid" }, { status: 502 });
  }
}
