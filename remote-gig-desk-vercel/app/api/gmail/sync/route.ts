import { getChatGPTUser } from "../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../db";
import { getGoogleToken } from "../../../../lib/google";

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
async function translate(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  if (!clean) return "";
  const pieces = clean.match(/.{1,500}(?:\s|$)/g) || [clean];
  const translated: string[] = [];
  for (const piece of pieces.slice(0, 6)) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(piece)}&langpair=en|zh-CN`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      const json = await response.json() as any;
      if (response.ok && json.responseStatus === 200) translated.push(json.responseData.translatedText);
    } catch {}
  }
  return translated.join("\n");
}
function matchApplication(subject: string, text: string, applications: { id: string; title: string }[]) {
  const haystack = (subject + " " + text).toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const application of applications) {
    const tokens = application.title.toLowerCase().match(/[a-z0-9]{4,}|[\u4e00-\u9fff]{2,}/g) || [];
    const score = [...new Set(tokens)].filter(token => haystack.includes(token)).length;
    if (score > 0 && (!best || score > best.score)) best = { id: application.id, score };
  }
  return best?.id || null;
}
function classify(subject: string, text: string) {
  const haystack = `${subject} ${text}`.toLowerCase();
  if (/whatsapp|telegram|payment|fee|deposit|crypto wallet/.test(haystack)) return { tone: "warning", status: "需要核验", summary: "该回复要求转到外部渠道或涉及敏感事项，继续前应先核验对方身份。", next: "先确认公司、合同、预算和发件人身份；不要发送验证码、证件或付款。" };
  if (/interview|schedule|availability|assessment|test|next step|please reply|confirm|question|offer/.test(haystack)) return { tone: "action", status: "需要回复", summary: "招聘方已回复并要求安排面试、确认信息或完成下一步。", next: "查看中文译文与英文原文，确认事实后准备英文回复。" };
  return { tone: "info", status: "已收到回复", summary: "这是与申请相关的新邮件，尚未识别到必须立即操作的要求。", next: "核对邮件内容；如果只是收件确认，可记录后继续等待。" };
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
    const result = classify(subject, original);
    const translated = await translate(original);
    const company = sender.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || sender;
    const receivedAt = Number(message.internalDate) || Date.now();
    const now = Date.now();
    const applicationId = matchApplication(subject, original, applications);
    await sql`INSERT INTO email_replies (id,owner_email,gmail_message_id,thread_id,company,subject,sender,received_at,status,tone,summary,translation,original,next_action,gmail_url,updated_at,application_id) VALUES (${crypto.randomUUID()},${user.email},${item.id},${item.threadId},${company},${subject},${sender},${receivedAt},${result.status},${result.tone},${result.summary},${translated || "翻译暂时不可用，请查看英文原文。"},${original},${result.next},${`https://mail.google.com/mail/u/0/#all/${item.id}`},${now},${applicationId}) ON CONFLICT (owner_email,gmail_message_id) DO UPDATE SET company=EXCLUDED.company,subject=EXCLUDED.subject,sender=EXCLUDED.sender,received_at=EXCLUDED.received_at,status=EXCLUDED.status,tone=EXCLUDED.tone,summary=EXCLUDED.summary,translation=EXCLUDED.translation,original=EXCLUDED.original,next_action=EXCLUDED.next_action,gmail_url=EXCLUDED.gmail_url,updated_at=EXCLUDED.updated_at,application_id=EXCLUDED.application_id`;
    if(applicationId){
      const gmailUrl=`https://mail.google.com/mail/u/0/#all/${item.id}`;
      await sql`UPDATE applications SET status=${"response_received"},delivery_state=${"recipient_replied"},updated_at=${now} WHERE id=${applicationId} AND owner_email=${user.email}`;
      await sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES (${`${user.email}:gmail:${item.id}`},${user.email},${applicationId},${"reply_received"},${"response_received"},${"已收到对方邮件回复，证明申请已进入对方沟通流程"},${item.id},${gmailUrl},${receivedAt}) ON CONFLICT (id) DO NOTHING`;
    }
    synced++;
  }
  await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"gmail_sync"},${"inbox"},${`synced_${synced}`},${Date.now()})`;
  return Response.json({ synced });
}
