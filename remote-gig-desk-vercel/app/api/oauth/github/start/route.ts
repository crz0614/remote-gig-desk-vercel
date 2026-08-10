import { getChatGPTUser } from "../../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../../db";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return Response.json({ error: "github_oauth_not_configured" }, { status: 503 });
  await ensureDatabase();
  const state = crypto.randomUUID();
  const expires = Date.now() + 10 * 60_000;
  const sql = db();
  await sql`INSERT INTO oauth_states (state,owner_email,provider,expires_at) VALUES (${state},${user.email},${"github"},${expires})`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", "https://remote-gig-desk-vercel.vercel.app/api/oauth/github/callback");
  url.searchParams.set("scope", "read:user user:email public_repo");
  url.searchParams.set("state", state);
  return Response.redirect(url);
}
