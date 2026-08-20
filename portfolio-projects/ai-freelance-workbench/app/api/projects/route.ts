import { assertAuthorized, errorResponse, heartbeat, supabase } from "@/lib/production";

export async function GET(request: Request) {
  try {
    assertAuthorized(request);
    const data = await supabase("projects?select=*&order=created_at.desc");
    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = await request.json() as Record<string, unknown>;
    if (!body.title || typeof body.title !== "string") {
      return Response.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    const row = {
      title: body.title,
      description: typeof body.description === "string" ? body.description : "",
      status: typeof body.status === "string" ? body.status : "lead",
      budget_cents: typeof body.budget_cents === "number" ? body.budget_cents : null,
      currency: typeof body.currency === "string" ? body.currency : "usd",
      source_url: typeof body.source_url === "string" ? body.source_url : null,
      client_id: typeof body.client_id === "string" ? body.client_id : null,
    };
    const data = await supabase("projects", { method: "POST", body: JSON.stringify(row) });
    await heartbeat("project.created", data || row);
    return Response.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
