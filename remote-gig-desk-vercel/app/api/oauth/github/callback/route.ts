import { db, ensureDatabase } from "../../../../../db";
import { seal } from "../../../../../lib/secret-store";

export async function GET(request: Request) {
  const current = new URL(request.url);
  const code = current.searchParams.get("code");
  const state = current.searchParams.get("state");
  if (!code || !state) return Response.redirect(new URL("/?oauth=github_invalid", current.origin));
  await ensureDatabase();
  const sql = db();
  const states = await sql`SELECT owner_email AS "ownerEmail",expires_at AS "expiresAt" FROM oauth_states WHERE state=${state} AND provider=${"github"} LIMIT 1`;
  const saved = states[0] as { ownerEmail: string; expiresAt: number } | undefined;
  await sql`DELETE FROM oauth_states WHERE state=${state}`;
  if (!saved || Number(saved.expiresAt) < Date.now()) return Response.redirect(new URL("/?oauth=github_expired", current.origin));
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return Response.redirect(new URL("/?oauth=github_not_configured", current.origin));
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: "https://remote-gig-desk-vercel.vercel.app/api/oauth/github/callback" }), cache: "no-store" });
  const tokenData = await tokenResponse.json() as { access_token?: string; scope?: string };
  if (!tokenData.access_token) return Response.redirect(new URL("/?oauth=github_token_failed", current.origin));
  const profileResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
  const profile = await profileResponse.json() as { login?: string };
  if (!profile.login) return Response.redirect(new URL("/?oauth=github_profile_failed", current.origin));
  const ciphertext = await seal(tokenData.access_token);
  const now = Date.now();
  await sql`INSERT INTO channel_connections (id,owner_email,provider,status,account_label,token_ciphertext,scopes,updated_at) VALUES (${crypto.randomUUID()},${saved.ownerEmail},${"github"},${"connected"},${profile.login},${ciphertext},${tokenData.scope || ""},${now}) ON CONFLICT (owner_email,provider) DO UPDATE SET status=${"connected"},account_label=${profile.login},token_ciphertext=${ciphertext},scopes=${tokenData.scope || ""},updated_at=${now}`;
  await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${saved.ownerEmail},${"oauth_connected"},${"github"},${profile.login},${now})`;
  return Response.redirect(new URL("/?oauth=github_connected", current.origin));
}
