import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/application-pack/route.ts", import.meta.url), "utf8");
const prompt = fs.readFileSync(new URL("../lib/application-pack.ts", import.meta.url), "utf8");

test("GitHub application generation loads repository and issue context first", () => {
  assert.match(route, /loadGitHubIssueContext/);
  assert.match(route, /github_context_unavailable/);
  assert.match(prompt, /README, CONTRIBUTING and rootFiles/);
  assert.match(prompt, /Do not decide from title keywords alone/);
});

test("GitHub response style is selected from project needs rather than a fixed template", () => {
  assert.match(prompt, /bounded insight, diagnosis, contribution proposal, clarifying question, or implementation plan/);
  assert.match(prompt, /Do not force every response into the same checklist or template/);
  assert.match(prompt, /successful bounded-contribution pattern/);
});
