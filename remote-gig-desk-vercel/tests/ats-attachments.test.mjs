import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const db=fs.readFileSync(new URL("../db/index.ts",import.meta.url),"utf8");
const applications=fs.readFileSync(new URL("../app/api/applications/route.ts",import.meta.url),"utf8");
const attachmentRoute=fs.readFileSync(new URL("../app/api/attachments/route.ts",import.meta.url),"utf8");
const connections=fs.readFileSync(new URL("../app/api/connections/route.ts",import.meta.url),"utf8");
const agent=fs.readFileSync(new URL("../../browser-agent-extension/background.js",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("builds and stores a private resume attachment when an application has none",()=>{
  assert.match(db,/CREATE TABLE IF NOT EXISTS application_attachments/);
  assert.match(applications,/buildResumeDocx/);
  assert.match(applications,/Ruozhu-Chen-Resume\.docx/);
});

test("only the paired owner agent can download and inject application files",()=>{
  assert.match(attachmentRoute,/token_hash/);
  assert.match(attachmentRoute,/owner_email/);
  assert.match(connections,/materials\?\.attachments/);
  assert.match(agent,/new File/);
  assert.match(agent,/DataTransfer/);
});

test("protected checkpoints have a dedicated human takeover queue",()=>{
  assert.match(page,/需要登录或验证的平台/);
  assert.match(page,/verification_required/);
  assert.match(page,/验证码或 MFA/);
});
