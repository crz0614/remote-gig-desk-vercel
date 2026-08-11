import { atsProviderForUrl, type AtsProvider } from "./ats-adapter";

export type SubmissionEvidence = {
  evidenceUrl?: unknown;
  evidenceId?: unknown;
  evidenceKind?: unknown;
  confirmationText?: unknown;
  provider?: unknown;
  capturedAt?: unknown;
};

const confirmationPatterns: Record<AtsProvider, RegExp> = {
  greenhouse: /thank you for applying|application has been submitted|application received/i,
  lever: /thank you for applying|application submitted|we received your application/i,
  ashby: /application submitted|thank you for applying|application received/i,
  workable: /application (?:has been )?submitted|thank you for applying|application received/i,
  proginn: /申请成功|报名成功|已申请|已报名|等待甲方|申请已提交/i,
  custom: /thank you for applying|application (?:has been |was )?(?:received|submitted)|successfully submitted/i,
};

export function validateSubmissionEvidence(payload: SubmissionEvidence, expectedUrl: string | null | undefined) {
  const evidenceUrl = String(payload.evidenceUrl || "");
  const confirmationText = String(payload.confirmationText || "").slice(0, 2_000);
  const evidenceKind = String(payload.evidenceKind || "");
  const evidenceId = String(payload.evidenceId || "");
  const expectedProvider = atsProviderForUrl(expectedUrl);
  const reportedProvider = String(payload.provider || expectedProvider);
  let parsed: URL;
  try { parsed = new URL(evidenceUrl); } catch { throw new Error("official_confirmation_url_required"); }
  if (parsed.protocol !== "https:") throw new Error("official_confirmation_url_required");
  if (reportedProvider !== expectedProvider) throw new Error("evidence_provider_mismatch");
  if (expectedProvider !== "custom" && atsProviderForUrl(evidenceUrl) !== expectedProvider) throw new Error("evidence_provider_mismatch");
  if (evidenceKind !== "official_confirmation_page") throw new Error("official_confirmation_kind_required");
  if (!confirmationPatterns[expectedProvider].test(confirmationText)) throw new Error("official_confirmation_text_required");
  if (!evidenceId || evidenceId.startsWith("browser-confirmation:")) throw new Error("stable_evidence_id_required");
  const capturedAt = Number(payload.capturedAt);
  if (!Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > 10 * 60_000) throw new Error("fresh_evidence_timestamp_required");
  return { evidenceUrl, evidenceId, evidenceKind, confirmationText, provider: expectedProvider, capturedAt };
}
