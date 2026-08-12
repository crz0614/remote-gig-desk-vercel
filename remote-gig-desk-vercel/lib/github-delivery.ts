export type GitHubDeliveryRequirement = {
  kind: "pull_request" | "issue_comment";
  requiredPaths: string[];
};

/** GitHub bounties are delivery work, not ordinary job applications. */
export function githubDeliveryRequirement(text: string): GitHubDeliveryRequirement {
  const source = String(text || "");
  const requiredPaths = Array.from(
    source.matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.(?:md|txt|json|ya?ml|ts|tsx|js|jsx|py|go|rs|java|css|html))`/gi),
    match => match[1],
  ).slice(0, 20);
  const commentOnly = /(?:reply|respond|answer|comment)\s+(?:only\s+)?(?:on|in|under)\s+(?:this\s+)?issue/i.test(source)
    && !/(?:pull request|\bpr\b|implement|build|fix|add|create|write|submit|ship|commit|file|code|patch)/i.test(source);
  return { kind: commentOnly ? "issue_comment" : "pull_request", requiredPaths };
}
