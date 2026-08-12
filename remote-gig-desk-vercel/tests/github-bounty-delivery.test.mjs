import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { githubDeliveryRequirement, isTechnicalGitHubComment } from "../lib/github-delivery.ts";

test("GitHub implementation and document bounties require a pull request", () => {
  assert.equal(githubDeliveryRequirement("Add one file: manifestos/<handle>.md and ship it").kind, "pull_request");
  assert.deepEqual(githubDeliveryRequirement("Write `docs/security-model.md` and submit a PR").requiredPaths, ["docs/security-model.md"]);
});

test("keeps technical proposal comments but rejects generic applications", () => {
  assert.equal(githubDeliveryRequirement("Please propose an approach and discuss the design first").kind, "proposal_comment");
  assert.equal(isTechnicalGitHubComment("I am applying for this bounty. I have four years of experience and my expected rate is negotiable. Best regards. Here is some extra padding to make this long."), false);
  assert.equal(isTechnicalGitHubComment("I would approach this by separating collection from validation, then add acceptance tests around duplicate events and failure recovery. The main trade-off is latency versus deterministic ordering; I would keep ordering per repository and document the retry boundary."), true);
});

test("application endpoints gate GitHub comments and never retry them as generic delivery", () => {
  const createRoute = fs.readFileSync(new URL("../app/api/applications/route.ts", import.meta.url), "utf8");
  const retryRoute = fs.readFileSync(new URL("../app/api/applications/retry/route.ts", import.meta.url), "utf8");
  assert.match(createRoute, /isTechnicalGitHubComment/);
  assert.match(createRoute, /requirement\.kind==="proposal_comment"/);
  assert.doesNotMatch(retryRoute, /issues\/\$\{target\[3\]\}\/comments/);
  assert.match(createRoute, /github_pr_required/);
  assert.match(retryRoute, /github_pull_request_required/);
});
