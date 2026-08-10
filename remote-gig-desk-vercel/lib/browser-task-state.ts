export function browserTaskState(action: string, payload: Record<string, unknown> = {}) {
  if (action === "task_started") return { status: "browser_in_progress", deliveryState: "browser_in_progress", message: "浏览器执行器已领取任务", error: "", delivered: false };
  if (action === "form_inspected") return { status: "form_ready", deliveryState: "form_ready", message: `浏览器已识别并填写 ${Number(payload.filledFields || 0)} 个字段`, error: "", delivered: false };
  if (action === "verification_required") return { status: "verification_required", deliveryState: "verification_required", message: "浏览器检测到受保护验证，需要完成一次平台验证", error: "", delivered: false };
  if (action === "task_submitted") {
    if (!payload.evidenceUrl && !payload.evidenceId) throw new Error("submission_evidence_required");
    return { status: "submitted", deliveryState: "platform_accepted", message: "浏览器已提交申请并回传可核验证据", error: "", delivered: true };
  }
  if (action === "task_failed") {
    const error = String(payload.error || "browser_task_failed");
    return { status: "submission_failed", deliveryState: "failed", message: "浏览器执行失败：" + error, error, delivered: false };
  }
  throw new Error("unsupported_task_action");
}
