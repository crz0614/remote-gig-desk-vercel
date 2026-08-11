import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ai=fs.readFileSync(new URL("../lib/email-ai.ts",import.meta.url),"utf8");
const sync=fs.readFileSync(new URL("../app/api/gmail/sync/route.ts",import.meta.url),"utf8");
const applicationPack=fs.readFileSync(new URL("../app/api/application-pack/route.ts",import.meta.url),"utf8");

test("AI email analysis requires classification, full translation, summary and next action",()=>{
  assert.match(ai,/faithful complete Simplified Chinese translation/);
  assert.match(ai,/Never invent facts/);
  assert.match(sync,/analyzeApplicationEmail/);
});

test("AI Gateway requests use supported strict JSON schemas and a current low-cost model",()=>{
  for(const source of [ai,applicationPack]){
    assert.match(source,/type:\s*"json_schema"/);
    assert.doesNotMatch(source,/type:\s*"json_object"/);
    assert.match(source,/openai\/gpt-5\.6-luna/);
  }
});

test("Gmail sync never spends AI calls again for immutable messages",()=>{
  assert.match(sync,/const existing=new Set/);
  assert.match(sync,/if\(existing\.has\(item\.id\)\)continue/);
  assert.ok(sync.indexOf("if(!applicationId)continue")<sync.indexOf("analyzeApplicationEmail({subject"));
});
