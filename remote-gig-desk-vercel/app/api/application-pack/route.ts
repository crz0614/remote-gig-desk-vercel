import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { buildApplicationPrompt, hasUsableProfile, validateApplicationPack } from "../../../lib/application-pack";
import { generateFreeJson } from "../../../lib/free-ai";

export const maxDuration = 60;

const applicationPackSchema={type:"object",properties:{language:{type:"string",enum:["en","zh"]},quote:{type:"string"},employerSummary:{type:"string"},requirementMatches:{type:"array",items:{type:"object",properties:{requirement:{type:"string"},advantage:{type:"string"},evidence:{type:"string"}},required:["requirement","advantage","evidence"],additionalProperties:false}},matchedSkills:{type:"array",items:{type:"string"}},resume:{type:"array",items:{type:"string"}},coverLetter:{type:"string"},workMode:{type:"string"},strategy:{type:"string",enum:["github_comment","email","application_letter"]}},required:["language","quote","employerSummary","requirementMatches","matchedSkills","resume","coverLetter","workMode","strategy"],additionalProperties:false};

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

  try {
    const pack = validateApplicationPack(await generateFreeJson(buildApplicationPrompt({ gig: body.gig, profile, portfolio }),applicationPackSchema));
    return Response.json({ ...pack, gig: body.gig, generatedByAI: true });
  } catch (error) {
    console.error("application_pack_invalid", error);
    return Response.json({ error: error instanceof Error&&error.message==="free_ai_not_configured"?"free_ai_not_configured":"ai_generation_failed" }, { status: error instanceof Error&&error.message==="free_ai_not_configured"?503:502 });
  }
}
