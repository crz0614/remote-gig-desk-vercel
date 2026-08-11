import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sources=fs.readFileSync(new URL("../lib/expanded-opportunity-sources.ts",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("YC, Wellfound and Careers hydrate each detail page before application generation",()=>{
  assert.match(sources,/async function hydrateLinks/);
  assert.match(sources,/page\.length>=item\.context\.length/);
  assert.equal((sources.match(/await hydrateLinks\(selected\)/g)||[]).length,3);
});

test("application review exposes employer summary and requirement evidence mapping",()=>{
  assert.match(page,/甲方需求完整总结/);
  assert.match(page,/甲方要求与我的对口证据/);
  assert.match(page,/match\.evidence/);
});
