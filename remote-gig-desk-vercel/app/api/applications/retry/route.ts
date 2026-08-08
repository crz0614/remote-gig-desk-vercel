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
  if (!response.ok) throw new Error("gmail_send_" + response.status);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return Response.json({ error: "invalid_application" }, { status: 400 });
  await ensureDatabase();
  const sql = db();
  const rows = await sql`SELECT id,title,source_url AS "sourceUrl",application_letter AS "applicationLetter",delivery_channel AS "deliveryChannel",destination,status FROM applications WHERE id=${body.id} AND owner_email=${user.email} LIMIT 1`;
  if (!rows.length) return Response.json({ error: "not_found" }, { status: 404 });
  const application = rows[0] as any;
  if (application.status === "submitted") return Response.json({ id: application.id, status: "submitted", duplicate: true });
  let status = "submission_failed";
  let error = "";
  try {
    if (application.deliveryChannel === "gmail" && application.destination) {
      await sendGmail(user.email, application.destination, "Application: " + application.title, application.applicationLetter);
      status = "submitted";
    } else if (application.deliveryChannel === "github") {
      const target = String(application.sourceUrl).match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
      if (!target) throw new Error("github_target_invalid");
      const connections = await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
      const ciphertext = (connections[0] as any)?.tokenCiphertext;
      if (!ciphertext) throw new Error("github_authorization_required");
      const token = await unseal(ciphertext);
      const response = await fetch(`https://api.github.com/repos/${target[1]}/${target[2]}/issues/${target[3]}/comments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" }, body: JSON.stringify({ body: application.applicationLetter }), cache: "no-store" });
      if (!response.ok) throw new Error("github_" + response.status);
      status = "submitted";
    } else {
      status = "verification_required";
      error = "manual_submission_required";
    }
  } catch (cause) { error = cause instanceof Error ? cause.message : "submission_failed"; }
  const now = Date.now();
  await sql`UPDATE applications SET status=${status},last_error=${error},updated_at=${now} WHERE id=${application.id} AND owner_email=${user.email}`;
  await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_retry"},${application.id},${error || status},${now})`;
  return Response.json({ id: application.id, status, error: error || undefined }, { status: status === "submission_failed" ? 502 : 200 });
}
