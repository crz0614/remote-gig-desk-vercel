import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  await ensureDatabase();
  const sql = db();
  const rows = await sql`SELECT id,company,subject,sender,received_at AS "receivedAt",status,tone,summary,translation,original,next_action AS "next",gmail_url AS "gmailUrl" FROM email_replies WHERE owner_email=${user.email} ORDER BY received_at DESC LIMIT 100`;
  const replies = rows.map((row: any) => ({ ...row, date: new Date(Number(row.receivedAt)).toISOString().slice(0, 10) }));
  return Response.json({ replies });
}
