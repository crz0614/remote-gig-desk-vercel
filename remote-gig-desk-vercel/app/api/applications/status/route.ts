import { getChatGPTUser } from "../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../db";

const transitions: Record<string, string> = {
  mark_submitted: "submitted",
  needs_verification: "verification_required",
  reopen: "detecting_destination",
  cancel: "cancelled",
};

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; action?: string } | null;
  const nextStatus = body?.action ? transitions[body.action] : undefined;
  if (!body?.id || !nextStatus) return Response.json({ error: "任务编号或操作无效" }, { status: 400 });

  await ensureDatabase();
  const sql = db();
  const now = Date.now();
  const rows = await sql`
    UPDATE applications
    SET status = ${nextStatus}, updated_at = ${now}
    WHERE id = ${body.id} AND owner_email = ${user.email}
    RETURNING id, status, delivery_channel AS "deliveryChannel", updated_at AS "updatedAt"
  `;
  if (!rows.length) return Response.json({ error: "未找到该申请任务" }, { status: 404 });

  await sql`
    INSERT INTO audit_events (id, owner_email, action, target, result, created_at)
    VALUES (${crypto.randomUUID()}, ${user.email}, ${"application_status_changed"}, ${body.id}, ${nextStatus}, ${now})
  `;
  return Response.json({ application: rows[0] });
}
