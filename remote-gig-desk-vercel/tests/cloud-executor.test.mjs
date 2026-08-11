import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route=fs.readFileSync(new URL("../app/api/cloud-executor/route.ts",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("cloud browser handles only known public ATS tasks and preserves evidence gating",()=>{
  assert.match(route,/platform_key IN/);
  for(const provider of ["greenhouse","lever","ashby","workable"])assert.match(route,new RegExp(provider));
  assert.match(route,/validateSubmissionEvidence/);
  assert.match(route,/official_confirmation_page/);
  assert.doesNotMatch(route,/status=\$\{"submitted"\}[^]*submit\.click/);
});

test("cloud browser sends protected steps to the human checkpoint queue",()=>{
  assert.match(route,/protected_checkpoint/);
  assert.match(route,/verification_required/);
  assert.match(route,/captcha/);
});

test("workbench starts at most one cloud task per five minute window",()=>{
  assert.match(page,/lastCloudSync/);
  assert.match(page,/5\*60_000/);
  assert.match(page,/cloudSyncInFlight/);
});
