import { getChatGPTUser } from "../../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../../db";
import { seal } from "../../../../../lib/secret-store";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return Response.json({ error: "invalid_oauth_callback" }, { status: 400 });
  await ensureDatabase();
  const sql = db();
  const states = await sql`SELECT owner_email AS "ownerEmail",expires_at AS "expiresAt" FROM oauth_states WHERE state=${state} AND provider=${"gmail"} LIMIT 1`;
  const saved = states[0] as { ownerEmail?: string; expiresAt?: number } | undefined;
  await sql`DELETE FROM oauth_states WHERE state=${state}`;
  if (!saved || saved.ownerEmail !== user.email || Number(saved.expiresAt) < Date.now()) return Response.json({ error: "oauth_state_invalid" }, { status: 400 });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: "https://remote-gig-desk-vercel.vercel.app/api/oauth/google/callback",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return Response.json({ error: `google_token_${tokenResponse.status}` }, { status: 502 });
  const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
  if (!profileResponse.ok) return Response.json({ error: "google_profile_failed" }, { status: 502 });
  const profile = await profileResponse.json() as { email?: string; email_verified?: boolean };
  if (!profile.email_verified || profile.email?.toLowerCase() !== user.email.toLowerCase()) return Response.json({ error: "google_account_mismatch" }, { status: 403 });
  const stored = { ...token, expires_at: Date.now() + (token.expires_in || 3600) * 1000 };
  const now = Date.now();
  await sql.transaction([
    sql`INSERT INTO channel_connections (id,owner_email,provider,status,account_label,token_ciphertext,scopes,updated_at) VALUES (${crypto.randomUUID()},${user.email},${"gmail"},${"connected"},${profile.email || user.email},${await seal(JSON.stringify(stored))},${token.scope || ""},${now}) ON CONFLICT (owner_email,provider) DO UPDATE SET status=EXCLUDED.status,account_label=EXCLUDED.account_label,token_ciphertext=EXCLUDED.token_ciphertext,scopes=EXCLUDED.scopes,updated_at=EXCLUDED.updated_at`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"oauth_connected"},${"gmail"},${"connected"},${now})`,
  ]);
  return Response.redirect("https://remote-gig-desk-vercel.vercel.app/?connected=gmail");
}
