import { assertAuthorized, errorResponse, heartbeat, ocrImage, supabase } from "@/lib/production";

function extractText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const parsed = (result as { ParsedResults?: Array<{ ParsedText?: string }> }).ParsedResults;
  return (parsed || []).map(x => x.ParsedText || "").join("\n").trim();
}

export async function POST(request: Request) {
  try {
    assertAuthorized(request);
    const body = await request.json() as { base64Image?: string; projectId?: string; sourceName?: string };
    if (!body.base64Image) {
      return Response.json({ ok: false, error: "base64Image is required" }, { status: 400 });
    }
    const result = await ocrImage(body.base64Image);
    const text = extractText(result);
    const data = await supabase("documents", {
      method: "POST",
      body: JSON.stringify({ project_id: body.projectId || null, kind: "ocr", source_name: body.sourceName || null, extracted_text: text, metadata: { provider: "ocr.space" } }),
    });
    await heartbeat("ocr.completed", { projectId: body.projectId || null, chars: text.length });
    return Response.json({ ok: true, text, data });
  } catch (error) {
    return errorResponse(error);
  }
}
