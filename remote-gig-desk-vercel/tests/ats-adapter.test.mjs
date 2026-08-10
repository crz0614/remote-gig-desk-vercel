import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/ats-adapter.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const adapter=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

for(const [provider,url] of [
  ["greenhouse","https://boards.greenhouse.io/acme/jobs/42"],
  ["lever","https://jobs.lever.co/acme/42"],
  ["ashby","https://jobs.ashbyhq.com/acme/42"],
  ["workable","https://apply.workable.com/acme/j/42"],
]) test(`identifies ${provider} application tasks`,()=>assert.equal(adapter.atsProviderForUrl(url),provider));

test("creates an evidence-gated browser execution contract",()=>{
  const contract=adapter.browserExecutionContract("https://jobs.lever.co/acme/42");
  assert.equal(contract.provider,"lever");
  assert.equal(contract.evidenceRequired,true);
  assert.ok(contract.steps.includes("capture_receipt"));
  assert.ok(contract.protectedCheckpoints.includes("captcha"));
});
