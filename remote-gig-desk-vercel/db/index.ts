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
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS destination TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_error TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS platform_key TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivery_state TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS receipt_id TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS receipt_url TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivered_at BIGINT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_url TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS materials JSONB NOT NULL DEFAULT '{}'::jsonb`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS lease_owner TEXT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS lease_expires_at BIGINT`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0`,
      sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb`,
      sql`UPDATE applications SET platform_key=lower(regexp_replace(source, ${"[^a-zA-Z0-9]+"}, ${""}, ${"g"})) WHERE platform_key IS NULL OR platform_key=${""}`,
      sql`CREATE INDEX IF NOT EXISTS applications_owner_idx ON applications(owner_email, updated_at DESC)`,
      sql`CREATE INDEX IF NOT EXISTS applications_platform_idx ON applications(owner_email, platform_key, updated_at DESC)`,
      sql`CREATE INDEX IF NOT EXISTS applications_lease_idx ON applications(owner_email,status,lease_expires_at,created_at ASC)`,
      sql`CREATE TABLE IF NOT EXISTS application_events (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, application_id TEXT NOT NULL,
        event_type TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL,
        evidence_id TEXT, evidence_url TEXT, created_at BIGINT NOT NULL
      )`,
      sql`CREATE INDEX IF NOT EXISTS application_events_idx ON application_events(owner_email, application_id, created_at ASC)`,
      sql`CREATE TABLE IF NOT EXISTS platform_sessions (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, platform_key TEXT NOT NULL,
        status TEXT NOT NULL, verified_at BIGINT, updated_at BIGINT NOT NULL,
        UNIQUE(owner_email, platform_key)
      )`,
      sql`ALTER TABLE platform_sessions ADD COLUMN IF NOT EXISTS account_label TEXT`,
      sql`ALTER TABLE platform_sessions ADD COLUMN IF NOT EXISTS auth_method TEXT`,
      sql`ALTER TABLE platform_sessions ADD COLUMN IF NOT EXISTS site_url TEXT`,
      sql`ALTER TABLE platform_sessions ADD COLUMN IF NOT EXISTS last_checked_at BIGINT`,
      sql`ALTER TABLE platform_sessions ADD COLUMN IF NOT EXISTS expires_at BIGINT`,
      sql`CREATE INDEX IF NOT EXISTS platform_sessions_owner_idx ON platform_sessions(owner_email, updated_at DESC)`,
      sql`CREATE TABLE IF NOT EXISTS channel_connections (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, provider TEXT NOT NULL,
        status TEXT NOT NULL, account_label TEXT, token_ciphertext TEXT,
        scopes TEXT, updated_at BIGINT NOT NULL,
        UNIQUE(owner_email, provider)
      )`,
      sql`CREATE TABLE IF NOT EXISTS browser_agents (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
        last_seen_at BIGINT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
      )`,
      sql`CREATE INDEX IF NOT EXISTS browser_agents_owner_idx ON browser_agents(owner_email, updated_at DESC)`,
      sql`ALTER TABLE browser_agents ADD COLUMN IF NOT EXISTS version TEXT`,
      sql`CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY, owner_email TEXT NOT NULL, provider TEXT NOT NULL,
        verifier TEXT, expires_at BIGINT NOT NULL
      )`,
      sql`CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, action TEXT NOT NULL,
        target TEXT NOT NULL, result TEXT NOT NULL, created_at BIGINT NOT NULL
      )`,
      sql`CREATE TABLE IF NOT EXISTS email_replies (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, gmail_message_id TEXT NOT NULL,
        thread_id TEXT NOT NULL, company TEXT NOT NULL, subject TEXT NOT NULL,
        sender TEXT NOT NULL, received_at BIGINT NOT NULL, status TEXT NOT NULL,
        tone TEXT NOT NULL, summary TEXT NOT NULL, translation TEXT NOT NULL,
        original TEXT NOT NULL, next_action TEXT NOT NULL, gmail_url TEXT NOT NULL,
        updated_at BIGINT NOT NULL, UNIQUE(owner_email,gmail_message_id)
      )`,
      sql`ALTER TABLE email_replies ADD COLUMN IF NOT EXISTS application_id TEXT`,
      sql`CREATE INDEX IF NOT EXISTS email_replies_application_idx ON email_replies(owner_email, application_id)`,
      sql`CREATE INDEX IF NOT EXISTS email_replies_owner_idx ON email_replies(owner_email, received_at DESC)`,
      sql`CREATE TABLE IF NOT EXISTS portfolio_items (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL,
        summary TEXT NOT NULL, link TEXT NOT NULL, skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
      )`,
      sql`CREATE INDEX IF NOT EXISTS portfolio_items_owner_idx ON portfolio_items(owner_email, position ASC, updated_at DESC)`,
      sql`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS archive_name TEXT`,
      sql`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS parsed_files JSONB NOT NULL DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS github_repo TEXT`,
      sql`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS deployment_url TEXT`,
      sql`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'saved'`,
      sql`CREATE TABLE IF NOT EXISTS private_profiles (
        owner_email TEXT PRIMARY KEY, profile_ciphertext TEXT NOT NULL, updated_at BIGINT NOT NULL
      )`,
    ]);
  })().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}
