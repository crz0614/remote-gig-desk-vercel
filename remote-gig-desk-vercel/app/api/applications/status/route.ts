import { getChatGPTUser } from "../../../chatgpt-auth";
import { db, ensureDatabase } from "../../../../db";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: string; action?: string } | null;
  if (!body?.id || !body.action) return Response.json({ error: "任务编号或操作无效" }, { status: 400 });
  await ensureDatabase();
  const sql = db();
  const current = await sql`SELECT id,platform_key AS "platformKey",status FROM applications WHERE id=${body.id} AND owner_email=${user.email} LIMIT 1`;
  if (!current.length) return Response.json({ error: "未找到该申请任务" }, { status: 404 });
  const platformKey = String((current[0] as any).platformKey || "unknown");
  const now = Date.now();
  let status = String((current[0] as any).status);
  let message = "";
  let affectedIds: string[] = [body.id];

  if (body.action === "needs_verification") {
    status = "verification_required";
    await sql`INSERT INTO platform_sessions (id,owner_email,platform_key,status,updated_at) VALUES (${crypto.randomUUID()},${user.email},${platformKey},${status},${now}) ON CONFLICT (owner_email,platform_key) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`;
    const affected = await sql`UPDATE applications SET status=${status},delivery_state=${"verification_required"},updated_at=${now} WHERE owner_email=${user.email} AND platform_key=${platformKey} AND status IN (${"detecting_destination"},${"queued_for_browser"},${"submission_failed"},${"verification_required"}) RETURNING id`;
    affectedIds = (affected as any[]).map(row => String(row.id));
    message = "该平台队列已统一暂停，只需完成一次登录或验证码";
  } else if (body.action === "verify_platform") {
    return Response.json(
      { error: "verification_must_be_confirmed_by_browser_session", message: "只有浏览器执行器检测到真实登录会话后才能完成验证" },
      { status: 409 },
    );
  } else if (body.action === "cancel") {
    status = "cancelled";
    message = "申请任务已取消";
    await sql`UPDATE applications SET status=${status},updated_at=${now} WHERE id=${body.id} AND owner_email=${user.email}`;
  } else {
    return Response.json({ error: "不支持的操作" }, { status: 400 });
  }

  for (const applicationId of affectedIds) {
    await sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,created_at) VALUES (${crypto.randomUUID()},${user.email},${applicationId},${"status_changed"},${status},${message},${now})`;
  }
  await sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_status_changed"},${body.id},${status},${now})`;
  return Response.json({ application: { id: body.id, status, platformKey }, affectedCount: affectedIds.length });
}
