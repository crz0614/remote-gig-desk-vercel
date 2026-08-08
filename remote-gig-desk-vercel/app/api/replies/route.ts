import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  await ensureDatabase();
  const sql = db();
  const rows = await sql`SELECT r.id,r.company,r.subject,r.sender,r.received_at AS "receivedAt",r.status,r.tone,r.summary,r.translation,r.original,r.next_action AS "next",r.gmail_url AS "gmailUrl",r.application_id AS "applicationId",a.title AS "applicationTitle" FROM email_replies r LEFT JOIN applications a ON a.id=r.application_id AND a.owner_email=r.owner_email WHERE r.owner_email=${user.email} ORDER BY r.received_at DESC LIMIT 100`;
  const replies = rows.map((row: any) => ({ ...row, date: new Date(Number(row.receivedAt)).toISOString().slice(0, 10) }));
  return Response.json({ replies });
}
