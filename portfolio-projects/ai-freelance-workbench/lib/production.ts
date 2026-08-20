type Json = Record<string, unknown> | unknown[];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function assertAuthorized(request: Request) {
  const expected = required("WORKBENCH_API_TOKEN");
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    const error = new Error("Unauthorized");
    Object.assign(error, { status: 401 });
    throw error;
  }
}

export async function supabase(path: string, init: RequestInit = {}) {
  const base = required("SUPABASE_URL").replace(/\/$/, "");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function generateWithOpenAI(input: string) {
  const apiKey = required("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data = await response.json() as { output_text?: string; output?: Array<{content?: Array<{text?: string}>}> };
  return data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || "").join("\n") || "";
}

export async function sendEmail(args: { to: string; subject: string; html: string }) {
  const key = required("RESEND_API_KEY");
  const from = required("RESEND_FROM_EMAIL");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, ...args }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function createStripeCheckout(args: { amountCents: number; currency: string; description: string; customerEmail?: string }) {
  const key = required("STRIPE_SECRET_KEY");
  const successUrl = required("STRIPE_SUCCESS_URL");
  const cancelUrl = required("STRIPE_CANCEL_URL");
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", args.currency.toLowerCase());
  form.set("line_items[0][price_data][unit_amount]", String(args.amountCents));
  form.set("line_items[0][price_data][product_data][name]", args.description);
  if (args.customerEmail) form.set("customer_email", args.customerEmail);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function ocrImage(base64Image: string) {
  const key = required("OCR_SPACE_API_KEY");
  const form = new FormData();
  form.set("apikey", key);
  form.set("language", process.env.OCR_LANGUAGE || "eng");
  form.set("isOverlayRequired", "false");
  form.set("base64Image", base64Image);
  const response = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
  if (!response.ok) throw new Error(`OCR ${response.status}: ${await response.text()}`);
  return response.json() as Promise<Json>;
}

export async function heartbeat(event: string, payload: Json = {}) {
  const url = process.env.MONITOR_HEARTBEAT_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, payload, at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => undefined);
}

export function errorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as {status?: number}).status) : 500;
  return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status });
}
