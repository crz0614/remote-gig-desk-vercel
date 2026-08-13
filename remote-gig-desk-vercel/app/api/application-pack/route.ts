import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { buildApplicationPrompt, hasUsableProfile, validateApplicationPack } from "../../../lib/application-pack";
import { loadGitHubIssueContext } from "../../../lib/github-context";
import { generateFreeJson } from "../../../lib/free-ai";
import { assessCompensation } from "../../../lib/compensation";

export const maxDuration = 60;

const applicationPackSchema={type:"object",properties:{language:{type:"string",enum:["en","zh"]},quote:{type:"string"},employerSummary:{type:"string"},requirementMatches:{type:"array",items:{type:"object",properties:{requirement:{type:"string"},advantage:{type:"string"},evidence:{type:"string"}},required:["requirement","advantage","evidence"],additionalProperties:false}},matchedSkills:{type:"array",items:{type:"string"}},resume:{type:"array",items:{type:"string"}},coverLetter:{type:"string"},workMode:{type:"string"},strategy:{type:"string",enum:["github_comment","github_pull_request","email","application_letter"]},decisionReason:{type:"string"}},required:["language","quote","employerSummary","requirementMatches","matchedSkills","resume","coverLetter","workMode","strategy","decisionReason"],additionalProperties:false};

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

  let githubContext = null;
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/i.test(String(body.gig.sourceUrl))) {
    let githubToken: string | undefined;
    const connections = await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
    if ((connections[0] as any)?.tokenCiphertext) {
      try { githubToken = await unseal(String((connections[0] as any).tokenCiphertext)); } catch {}
    }
    githubContext = await loadGitHubIssueContext(body.gig.sourceUrl, githubToken);
    if (!githubContext?.issue) return Response.json({ error: "github_context_unavailable" }, { status: 502 });
  }

  try {
    const pack = validateApplicationPack(await generateFreeJson(buildApplicationPrompt({ gig: { ...body.gig, githubContext }, profile, portfolio }),applicationPackSchema));
    return Response.json({ ...pack, gig: body.gig, compensation: assessCompensation(body.gig), generatedByAI: true });
  } catch (error) {
    console.error("application_pack_invalid", error);
    return Response.json({ error: error instanceof Error&&error.message==="free_ai_not_configured"?"free_ai_not_configured":"ai_generation_failed" }, { status: error instanceof Error&&error.message==="free_ai_not_configured"?503:502 });
  }
}
