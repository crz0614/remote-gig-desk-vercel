import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ai=fs.readFileSync(new URL("../lib/email-ai.ts",import.meta.url),"utf8");
const sync=fs.readFileSync(new URL("../app/api/gmail/sync/route.ts",import.meta.url),"utf8");
const applicationPack=fs.readFileSync(new URL("../app/api/application-pack/route.ts",import.meta.url),"utf8");
const freeAi=fs.readFileSync(new URL("../lib/free-ai.ts",import.meta.url),"utf8");

test("AI email analysis requires classification, full translation, summary and next action",()=>{
  assert.match(ai,/faithful complete Simplified Chinese translation/);
  assert.match(ai,/Never invent facts/);
  assert.match(sync,/analyzeApplicationEmail/);
});

test("private AI features use Gemini free tier structured output without billing providers",()=>{
  assert.match(ai,/generateFreeJson/);assert.match(applicationPack,/generateFreeJson/);
  assert.match(freeAi,/gemini-3\.1-flash-lite/);
  assert.match(freeAi,/response\.status!==404/);
  assert.match(freeAi,/responseJsonSchema/);
  for(const source of [ai,applicationPack,freeAi])assert.doesNotMatch(source,/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|OPENAI_API_KEY|ai-gateway\.vercel/);
});

test("Gmail sync never spends AI calls again for immutable messages",()=>{
  assert.match(sync,/const existing=new Set/);
  assert.match(sync,/if\(existing\.has\(item\.id\)\)continue/);
  assert.ok(sync.indexOf("if(!applicationId)continue")<sync.indexOf("analyzeApplicationEmail({subject"));
});
