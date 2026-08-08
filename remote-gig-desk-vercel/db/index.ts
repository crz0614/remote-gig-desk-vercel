import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

let initialized: Promise<void> | null = null;

export function ensureDatabase() {
  if (initialized) return initialized;
  initialized = (async () => {
    const sql = db();
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(741852963)`,
      sql`CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, gig_id TEXT NOT NULL,
        source TEXT NOT NULL, source_url TEXT NOT NULL, title TEXT NOT NULL,
        language TEXT NOT NULL, proposed_rate TEXT NOT NULL,
        application_letter TEXT NOT NULL, status TEXT NOT NULL,
        delivery_channel TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
      )`,
      sql`CREATE INDEX IF NOT EXISTS applications_owner_idx ON applications(owner_email, updated_at DESC)`,
      sql`CREATE TABLE IF NOT EXISTS channel_connections (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, provider TEXT NOT NULL,
        status TEXT NOT NULL, account_label TEXT, token_ciphertext TEXT,
        scopes TEXT, updated_at BIGINT NOT NULL,
        UNIQUE(owner_email, provider)
      )`,
      sql`CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY, owner_email TEXT NOT NULL, provider TEXT NOT NULL,
        verifier TEXT, expires_at BIGINT NOT NULL
      )`,
      sql`CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, action TEXT NOT NULL,
        target TEXT NOT NULL, result TEXT NOT NULL, created_at BIGINT NOT NULL
      )`,
    ]);
  })().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}
