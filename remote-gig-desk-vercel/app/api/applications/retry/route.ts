import { getChatGPTUser } from "../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../db";
import { unseal } from "../../../../lib/secret-store";
import { getGoogleToken } from "../../../../lib/google";

function safeHeader(value: string) { return value.replace(/[\r\n]+/g, " ").trim(); }
function base64Url(value: string) { return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sendGmail(ownerEmail: string, to: string, subject: string, letter: string) {
  const token = await getGoogleToken(ownerEmail);
  const raw = base64Url(["From: " + safeHeader(ownerEmail), "To: " + safeHeader(to), "Subject: " + safeHeader(subject), "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", letter].join("\r\n"));
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ raw }), cache: "no-store" });
  const result = await response.json().catch(() => ({})) as { id?: string; threadId?: string };
  if (!response.ok) throw new Error("gmail_send_" + response.status);
  return result;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; platformKey?: string } | null;
  if (!body?.id && !body?.platformKey) return Response.json({ error: "invalid_application" }, { status: 400 });
  await ensureDatabase();
  const sql = db();
  const rows = body.id
    ? await sql`SELECT id,title,source_url AS "sourceUrl",application_letter AS "applicationLetter",delivery_channel AS "deliveryChannel",destination,status,delivery_state AS "deliveryState",platform_key AS "platformKey" FROM applications WHERE id=${body.id} AND owner_email=${user.email} LIMIT 1`
    : await sql`SELECT id,title,source_url AS "sourceUrl",application_letter AS "applicationLetter",delivery_channel AS "deliveryChannel",destination,status,delivery_state AS "deliveryState",platform_key AS "platformKey" FROM applications WHERE platform_key=${body.platformKey} AND owner_email=${user.email} AND status NOT IN (${"submitted"},${"manual_confirmed"},${"cancelled"}) ORDER BY created_at ASC`;
  if (!rows.length) return Response.json({ error: "not_found" }, { status: 404 });
  const results: any[] = [];
  for (const application of rows as any[]) {
    if (application.deliveryState === "platform_accepted") { results.push({ id: application.id, status: "submitted", duplicate: true }); continue; }
    let status = "submission_failed";
    let error = "";
    let deliveryState = "attempted";
    let receiptId = "";
    let receiptUrl = "";
    let deliveredAt: number | null = null;
    try {
      if (application.deliveryChannel === "gmail" && application.destination) {
        const sent = await sendGmail(user.email, application.destination, "Application: " + application.title, application.applicationLetter);
        status = "submitted"; deliveryState = "platform_accepted"; receiptId = sent.id || ""; receiptUrl = sent.id ? `https://mail.google.com/mail/u/0/#sent/${sent.id}` : ""; deliveredAt = Date.now();
      } else if (application.deliveryChannel === "github") {
        const target = String(application.sourceUrl).match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
        if (!target) throw new Error("github_target_invalid");
        const connections = await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
        const ciphertext = (connections[0] as any)?.tokenCiphertext;
        if (!ciphertext) throw new Error("github_authorization_required");
        const token = await unseal(ciphertext);
        const response = await fetch(`https://api.github.com/repos/${target[1]}/${target[2]}/issues/${target[3]}/comments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" }, body: JSON.stringify({ body: application.applicationLetter }), cache: "no-store" });
        const posted = await response.json().catch(() => ({})) as { id?: number; html_url?: string };
        if (!response.ok) throw new Error("github_" + response.status);
        status = "submitted"; deliveryState = "platform_accepted"; receiptId = String(posted.id || ""); receiptUrl = posted.html_url || ""; deliveredAt = Date.now();
      } else {
        const sessions = await sql`SELECT status FROM platform_sessions WHERE owner_email=${user.email} AND platform_key=${application.platformKey} LIMIT 1`;
        const verified = (sessions[0] as any)?.status === "verified";
        status = verified ? "manual_submission_required" : "verification_required";
        deliveryState = verified ? "platform_session_verified" : "verification_required";
        error = verified ? "manual_form_submission_required" : "platform_verification_required";
      }
    } catch (cause) { error = cause instanceof Error ? cause.message : "submission_failed"; }
    const now = Date.now();
    await sql`UPDATE applications SET status=${status},delivery_state=${deliveryState},receipt_id=${receiptId},receipt_url=${receiptUrl},delivered_at=${deliveredAt},last_error=${error},updated_at=${now} WHERE id=${application.id} AND owner_email=${user.email}`;
    const message = deliveryState === "platform_accepted" ? "平台接口已确认接收申请并返回回执" : status === "verification_required" ? "等待完成一次平台登录或验证码" : error ? "未获得平台接收回执：" + error : "任务状态已更新";
    await sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES (${crypto.randomUUID()},${user.email},${application.id},${"delivery_retry"},${status},${message},${receiptId},${receiptUrl},${now})`;
    await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_retry"},${application.id},${error || status},${now})`;
    results.push({ id: application.id, status, deliveryState, receiptId, receiptUrl, error: error || undefined });
  }
  return Response.json({ results, processed: results.length, accepted: results.filter(item => item.deliveryState === "platform_accepted").length });
}
