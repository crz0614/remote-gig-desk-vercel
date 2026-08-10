export type AtsProvider = "greenhouse" | "lever" | "ashby" | "workable" | "custom";

const HOSTS: Array<[AtsProvider, RegExp]> = [
  ["greenhouse", /(^|\.)greenhouse\.io$/i],
  ["lever", /(^|\.)lever\.co$/i],
  ["ashby", /(^|\.)ashbyhq\.com$/i],
  ["workable", /(^|\.)workable\.com$/i],
];

export function atsProviderForUrl(value: string | null | undefined): AtsProvider {
  try {
    const host = new URL(String(value)).hostname;
    return HOSTS.find(([, pattern]) => pattern.test(host))?.[0] || "custom";
  } catch {
    return "custom";
  }
}

export function browserExecutionContract(value: string | null | undefined) {
  const provider = atsProviderForUrl(value);
  return {
    version: 1,
    provider,
    targetUrl: value || null,
    steps: ["open", "inspect_fields", "fill_known_fields", "pause_for_protected_checkpoint", "submit", "capture_receipt"],
    protectedCheckpoints: ["password", "captcha", "mfa", "identity", "terms", "final_legal_confirmation"],
    evidenceRequired: true,
  };
}
