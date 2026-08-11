import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("automatically navigates to the verification page once per task",()=>{
  assert.match(page,/function verificationUrlFor/);
  assert.match(page,/app\.applicationUrl \|\| app\.destination \|\| app\.sourceUrl/);
  assert.match(page,/applications\.find\([\s\S]*verification_required/);
  assert.match(page,/verification-opened-/);
  assert.match(page,/window\.location\.assign\(verificationUrlFor\(pending\)\)/);
});

test("manual verification entry uses the same safe fallback URL",()=>{
  assert.match(page,/const target = verificationUrlFor\(app\)/);
  assert.match(page,/window\.location\.assign\(target\)/);
});
