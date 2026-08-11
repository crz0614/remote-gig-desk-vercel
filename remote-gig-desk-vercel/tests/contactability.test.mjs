import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/contactability.ts",import.meta.url),"utf8");
const paid=fs.readFileSync(new URL("../lib/paid-project-sources.ts",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/gigs/route.ts",import.meta.url),"utf8");

test("rejects app-only Proginn opportunities",()=>{
  assert.match(source,/job\\\.proginn/);
  assert.match(source,/reason:"app_only"/);
  assert.doesNotMatch(paid,/getZbjProjects\(\),getProginnProjects\(\),getEpwkProjects/);
});

test("keeps public email and supported web application paths",()=>{
  assert.match(source,/method:"email"/);
  assert.match(source,/supported_web_application/);
  assert.match(source,/external_application_url/);
});

test("filters every collected opportunity before returning it",()=>{
  assert.match(route,/gigs\.filter\(isContactableOpportunity\)/);
});

test("expands web-accessible Reddit project communities",()=>{
  assert.match(paid,/webdevjobs/);
  assert.match(paid,/remotejs/);
  assert.match(paid,/GameDevClassifieds/);
});
