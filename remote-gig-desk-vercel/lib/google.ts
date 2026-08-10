import { db, ensureDatabase } from "../db";
import { seal, unseal } from "./secret-store";

type GoogleToken = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
  token_type?: string;
};

export async function getGoogleToken(ownerEmail: string) {
  await ensureDatabase();
  const sql = db();
  const rows = await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${ownerEmail} AND provider=${"gmail"} AND status=${"connected"} LIMIT 1`;
  const ciphertext = (rows[0] as { tokenCiphertext?: string } | undefined)?.tokenCiphertext;
  if (!ciphertext) throw new Error("gmail_not_connected");
  const token = JSON.parse(await unseal(ciphertext)) as GoogleToken;
  if (token.expires_at && token.expires_at > Date.now() + 60_000) return token.access_token;
  if (!token.refresh_token) throw new Error("gmail_reauthorization_required");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`google_refresh_${response.status}`);
  const refreshed = await response.json() as { access_token: string; expires_in?: number; scope?: string; token_type?: string };
  const next: GoogleToken = {
    ...token,
    ...refreshed,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in || 3600) * 1000,
  };
  await sql`UPDATE channel_connections SET token_ciphertext=${await seal(JSON.stringify(next))}, scopes=${next.scope || token.scope || ""}, updated_at=${Date.now()} WHERE owner_email=${ownerEmail} AND provider=${"gmail"}`;
  return next.access_token;
}
