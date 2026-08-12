import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { githubDeliveryRequirement } from "../lib/github-delivery.ts";

test("GitHub implementation and document bounties require a pull request", () => {
  assert.equal(githubDeliveryRequirement("Add one file: manifestos/<handle>.md and ship it").kind, "pull_request");
  assert.deepEqual(githubDeliveryRequirement("Write `docs/security-model.md` and submit a PR").requiredPaths, ["docs/security-model.md"]);
});

test("application endpoints never post a generic letter as GitHub bounty delivery", () => {
  const createRoute = fs.readFileSync(new URL("../app/api/applications/route.ts", import.meta.url), "utf8");
  const retryRoute = fs.readFileSync(new URL("../app/api/applications/retry/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(createRoute, /issues\/\$\{target\.issue\}\/comments/);
  assert.doesNotMatch(retryRoute, /issues\/\$\{target\[3\]\}\/comments/);
  assert.match(createRoute, /github_pr_required/);
  assert.match(retryRoute, /github_pull_request_required/);
});
