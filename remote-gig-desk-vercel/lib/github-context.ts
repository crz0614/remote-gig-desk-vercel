type GitHubHeaders = Record<string, string>;

function issueTarget(value: unknown) {
  const match = String(value || "").match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
  return match ? { owner: match[1], repo: match[2], issue: match[3] } : null;
}

async function githubJson(url: string, headers: GitHubHeaders) {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function loadGitHubIssueContext(sourceUrl: unknown, token?: string) {
  const target = issueTarget(sourceUrl);
  if (!target) return null;
  const headers: GitHubHeaders = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "RemoteGigDesk" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = `https://api.github.com/repos/${target.owner}/${target.repo}`;
  const [issue, repo, readme, contributing, contents] = await Promise.all([
    githubJson(`${base}/issues/${target.issue}`, headers),
    githubJson(base, headers),
    githubJson(`${base}/readme`, headers),
    githubJson(`${base}/contents/CONTRIBUTING.md`, headers),
    githubJson(`${base}/contents`, headers),
  ]);
  const decode = (entry: any) => entry?.content ? Buffer.from(String(entry.content).replace(/\s/g, ""), "base64").toString("utf8").slice(0, 18000) : "";
  return {
    repository: repo ? { fullName: repo.full_name, description: repo.description, language: repo.language, defaultBranch: repo.default_branch, topics: repo.topics } : null,
    issue: issue ? { title: issue.title, body: String(issue.body || "").slice(0, 30000), labels: (issue.labels || []).map((label: any) => label.name || label), state: issue.state, comments: issue.comments } : null,
    readme: decode(readme),
    contributing: decode(contributing),
    rootFiles: Array.isArray(contents) ? contents.slice(0, 100).map((entry: any) => ({ name: entry.name, type: entry.type, path: entry.path })) : [],
  };
}
