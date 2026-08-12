export type GitHubDeliveryRequirement = {
  kind: "pull_request" | "proposal_comment";
  requiredPaths: string[];
};

/** GitHub bounties are delivery work, not ordinary job applications. */
export function githubDeliveryRequirement(text: string): GitHubDeliveryRequirement {
  const source = String(text || "");
  const requiredPaths = Array.from(
    source.matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.(?:md|txt|json|ya?ml|ts|tsx|js|jsx|py|go|rs|java|css|html))`/gi),
    match => match[1],
  ).slice(0, 20);
  const hardDelivery = requiredPaths.length > 0
    || /(?:submit|open|create|send)\s+(?:a\s+)?(?:pull request|PR|patch)\b|(?:implement|fix|build|write|add)\b[\s\S]{0,120}\b(?:in a PR|and submit|then submit|ship the (?:code|file|patch))/i.test(source);
  return { kind: hardDelivery ? "pull_request" : "proposal_comment", requiredPaths };
}

export function isTechnicalGitHubComment(value: string) {
  const text = String(value || "").trim();
  if (text.length < 120) return false;
  if (/(?:I am applying for|years of (?:hands-on )?experience|I am based|authori[sz]ed to work|expected rate|best regards|dear hiring)/i.test(text)) return false;
  return /(?:implement|approach|design|milestone|acceptance|test|risk|trade-?off|module|file|API|architecture|方案|实现|验收|测试|风险|取舍|模块)/i.test(text);
}
