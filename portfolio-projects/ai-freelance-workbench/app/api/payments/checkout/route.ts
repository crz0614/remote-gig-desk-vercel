import { assertAuthorized, createStripeCheckout, errorResponse, heartbeat, supabase } from "@/lib/production";

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = await request.json() as { amountCents?: number; currency?: string; description?: string; customerEmail?: string; projectId?: string };
    if (!body.amountCents || body.amountCents < 1 || !body.description) {
      return Response.json({ ok: false, error: "positive amountCents and description are required" }, { status: 400 });
    }
    const currency = (body.currency || "usd").toLowerCase();
    const session = await createStripeCheckout({
      amountCents: body.amountCents,
      currency,
      description: body.description,
      customerEmail: body.customerEmail,
    }) as { id?: string; url?: string };
    await supabase("payments", {
      method: "POST",
      body: JSON.stringify({ project_id: body.projectId || null, stripe_session_id: session.id || null, amount_cents: body.amountCents, currency, status: "created" }),
    });
    await heartbeat("payment.checkout_created", { projectId: body.projectId || null, sessionId: session.id || null });
    return Response.json({ ok: true, id: session.id, url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
