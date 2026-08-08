import { getChatGPTUser } from "../../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../../db";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ error: "google_oauth_not_configured" }, { status: 503 });
  await ensureDatabase();
  const state = crypto.randomUUID();
  const sql = db();
  await sql`INSERT INTO oauth_states (state,owner_email,provider,expires_at) VALUES (${state},${user.email},${"gmail"},${Date.now() + 10 * 60_000})`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", "https://remote-gig-desk-vercel.vercel.app/api/oauth/google/callback");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return Response.redirect(url);
}
