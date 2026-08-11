import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const proxy=fs.readFileSync(new URL("../proxy.ts",import.meta.url),"utf8");
const health=fs.readFileSync(new URL("../app/api/health/route.ts",import.meta.url),"utf8");

test("public health check exposes configuration state but never secrets",()=>{
  assert.match(proxy,/pathname === "\/api\/health"/);
  assert.match(health,/aiProvider/);
  assert.doesNotMatch(health,/AI_GATEWAY_API_KEY\s*[,}]/);
  assert.doesNotMatch(health,/OPENAI_API_KEY\s*[,}]/);
});
