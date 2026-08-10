import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/application-url.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("detects the final ATS application URL in a Hacker News post",()=>{
  assert.equal(helpers.detectFinalApplicationUrl([
    'Acme | Remote | apply at <a href="https://jobs.lever.co/acme/123">our application</a>',
  ],"https://news.ycombinator.com/item?id=1"),"https://jobs.lever.co/acme/123");
});

test("unwraps redirect links and ignores the source listing",()=>{
  assert.equal(helpers.detectFinalApplicationUrl([
    "https://news.ycombinator.com/item?id=1 https://example.com/go?url=https%3A%2F%2Fboards.greenhouse.io%2Facme%2Fjobs%2F42",
  ],"https://news.ycombinator.com/item?id=1"),"https://boards.greenhouse.io/acme/jobs/42");
});

test("maps known application hosts to a reusable platform session",()=>{
  assert.equal(helpers.platformKeyForUrl("https://jobs.ashbyhq.com/acme/42","hackernews"),"ashbyhq");
  assert.equal(helpers.platformKeyForUrl(null,"hackernews"),"hackernews");
});

test("reuses a verified Hacker News session only while it is valid",()=>{
  assert.equal(helpers.isReusablePlatformSession({status:"verified",expiresAt:2_000},1_000),true);
  assert.equal(helpers.isReusablePlatformSession({status:"verified",expiresAt:500},1_000),false);
  assert.equal(helpers.isReusablePlatformSession({status:"verification_required"},1_000),false);
});
