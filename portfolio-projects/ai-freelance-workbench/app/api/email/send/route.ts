import { assertAuthorized, errorResponse, heartbeat, sendEmail, supabase } from "@/lib/production";

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = await request.json() as { to?: string; subject?: string; html?: string; projectId?: string };
    if (!body.to || !body.subject || !body.html) {
      return Response.json({ ok: false, error: "to, subject and html are required" }, { status: 400 });
    }
    const result = await sendEmail({ to: body.to, subject: body.subject, html: body.html });
    await supabase("audit_events", {
      method: "POST",
      body: JSON.stringify({ event_type: "email.sent", entity_type: "project", entity_id: body.projectId || null, payload: { to: body.to, subject: body.subject, provider: "resend" } }),
    });
    await heartbeat("email.sent", { projectId: body.projectId || null });
    return Response.json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
