import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const expanded=fs.readFileSync(new URL("../lib/expanded-opportunity-sources.ts",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/gigs/route.ts",import.meta.url),"utf8");

test("does not invent publication timestamps for undated sources",()=>{
  assert.match(expanded,/if \(!value\) return ""/);
  assert.doesNotMatch(expanded,/value \? new Date\(value\) : new Date\(\)/);
  assert.doesNotMatch(route,/j\.created_at \|\| Date\.now\(\)/);
});
