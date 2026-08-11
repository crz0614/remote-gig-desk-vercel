import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const statusRoute=fs.readFileSync(new URL("../app/api/applications/status/route.ts",import.meta.url),"utf8");
const applicationRoute=fs.readFileSync(new URL("../app/api/applications/route.ts",import.meta.url),"utf8");

test("provides a dedicated verification center without forced navigation",()=>{
  assert.match(page,/登录与验证中心/);
  assert.match(page,/\["验证", "check"\]/);
  assert.match(page,/window\.open\(target, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(page,/verification-opened-/);
  assert.doesNotMatch(page,/window\.location\.assign\(verificationUrlFor\(pending\)\)/);
});

test("manual confirmation cannot create a verified session",()=>{
  assert.match(statusRoute,/verification_must_be_confirmed_by_browser_session/);
  assert.doesNotMatch(statusRoute,/body\.action === "verify_platform"[\s\S]*INSERT INTO platform_sessions[\s\S]*"verified"/);
  assert.doesNotMatch(page,/本平台验证完成，继续全部任务/);
});

test("platform is resolved from the final application or source URL",()=>{
  assert.match(applicationRoute,/platformKeyForUrl\(finalApplicationUrl\|\|body\.gig\.sourceUrl/);
});
