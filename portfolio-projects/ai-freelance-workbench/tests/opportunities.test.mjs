import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/opportunities.ts",import.meta.url),"utf8");
test("demo opportunities use fictional companies and original links are not embedded",()=>{
  for(const company of ["SignalForge","Northstar Labs","Orbit Cloud","Atlas Security","Canvas AI"]) assert.match(source,new RegExp(company));
  assert.doesNotMatch(source,/mailto:|linkedin\.com\/in|@gmail\.com/i);
});
test("every demo opportunity has an explicit budget and match score",()=>{
  const records=[...source.matchAll(/\{ id:/g)].length;
  assert.equal(records,5);
  assert.equal([...source.matchAll(/budget:"/g)].length,5);
  assert.equal([...source.matchAll(/match:\d/g)].length,5);
});
