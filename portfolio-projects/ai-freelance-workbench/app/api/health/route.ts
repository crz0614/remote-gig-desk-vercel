import { supabase } from "@/lib/production";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    await supabase("projects?select=id&limit=1");
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, detail: error instanceof Error ? error.message : "database check failed" };
  }

  checks.openai = { ok: Boolean(process.env.OPENAI_API_KEY) };
  checks.email = { ok: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) };
  checks.payments = { ok: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SUCCESS_URL && process.env.STRIPE_CANCEL_URL) };
  checks.ocr = { ok: Boolean(process.env.OCR_SPACE_API_KEY) };
  checks.monitoring = { ok: Boolean(process.env.MONITOR_HEARTBEAT_URL) };
  checks.auth = { ok: Boolean(process.env.WORKBENCH_API_TOKEN) };

  const ok = Object.values(checks).every(x => x.ok);
  return Response.json({ ok, checks, timestamp: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
