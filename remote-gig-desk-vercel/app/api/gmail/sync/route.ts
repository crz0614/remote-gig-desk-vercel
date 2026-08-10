import { getChatGPTUser } from "../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../db";
import { getGoogleToken } from "../../../../lib/google";
import { classifyReply, matchApplicationByTitle } from "../../../../lib/email-reply";

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function decode(data = "") {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function bodyText(part: Part): string {
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  if (part.parts) {
    const plain = part.parts.map(bodyText).filter(Boolean).join("\n");
    if (plain) return plain;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  }
  return part.body?.data ? decode(part.body.data) : "";
}
function header(headers: Header[] = [], name: string) {
  return headers.find(item => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  await ensureDatabase();
  const token = await getGoogleToken(user.email);
  const query = 'newer_than:180d -category:promotions (application OR interview OR recruiter OR hiring OR freelance OR contract OR assessment)';
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!listResponse.ok) return Response.json({ error: `gmail_list_${listResponse.status}` }, { status: 502 });
  const list = await listResponse.json() as { messages?: { id: string; threadId: string }[] };
  const sql = db();
  const applications = await sql`SELECT id,title FROM applications WHERE owner_email=${user.email} ORDER BY updated_at DESC LIMIT 200` as { id: string; title: string }[];
  let synced = 0;
  for (const item of list.messages || []) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) continue;
    const message = await response.json() as any;
    const headers = message.payload?.headers as Header[] || [];
    const subject = header(headers, "Subject") || "(No subject)";
    const sender = header(headers, "From");
    const original = bodyText(message.payload || {}).replace(/\r/g, "").trim().slice(0, 8000);
    if (!original) continue;
    const result = classifyReply(subject, original);
    const company = sender.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || sender;
    const receivedAt = Number(message.internalDate) || Date.now();
    const now = Date.now();
    const applicationId = matchApplicationByTitle(subject, original, applications);
    const chineseSummary=`${result.summary}\n\n建议操作：${result.next}`;
    await sql`INSERT INTO email_replies (id,owner_email,gmail_message_id,thread_id,company,subject,sender,received_at,status,tone,summary,translation,original,next_action,gmail_url,updated_at,application_id) VALUES (${crypto.randomUUID()},${user.email},${item.id},${item.threadId},${company},${subject},${sender},${receivedAt},${result.status},${result.tone},${result.summary},${chineseSummary},${original},${result.next},${`https://mail.google.com/mail/u/0/#all/${item.id}`},${now},${applicationId}) ON CONFLICT (owner_email,gmail_message_id) DO UPDATE SET company=EXCLUDED.company,subject=EXCLUDED.subject,sender=EXCLUDED.sender,received_at=EXCLUDED.received_at,status=EXCLUDED.status,tone=EXCLUDED.tone,summary=EXCLUDED.summary,translation=EXCLUDED.translation,original=EXCLUDED.original,next_action=EXCLUDED.next_action,gmail_url=EXCLUDED.gmail_url,updated_at=EXCLUDED.updated_at,application_id=EXCLUDED.application_id`;
    if(applicationId){
      const gmailUrl=`https://mail.google.com/mail/u/0/#all/${item.id}`;
      await sql`UPDATE applications SET status=${result.applicationStatus},delivery_state=${result.deliveryState},receipt_id=CASE WHEN ${result.kind}=${"receipt"} THEN ${item.id} ELSE receipt_id END,receipt_url=CASE WHEN ${result.kind}=${"receipt"} THEN ${gmailUrl} ELSE receipt_url END,updated_at=${now} WHERE id=${applicationId} AND owner_email=${user.email}`;
      const eventMessage=result.kind==="receipt"?"收到申请收件确认，可证明平台已接收但不代表招聘方已阅读":result.summary;
      await sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES (${`${user.email}:gmail:${item.id}`},${user.email},${applicationId},${`EMAIL_${result.kind.toUpperCase()}`},${result.applicationStatus},${eventMessage},${item.id},${gmailUrl},${receivedAt}) ON CONFLICT (id) DO NOTHING`;
    }
    synced++;
  }
  await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"gmail_sync"},${"inbox"},${`synced_${synced}`},${Date.now()})`;
  return Response.json({ synced });
}
