import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/project-summary/route.ts",import.meta.url),"utf8");
const sources=fs.readFileSync(new URL("../lib/paid-project-sources.ts",import.meta.url),"utf8");

test("paid projects use an AI structure instead of treating Chinese scraped HTML as a summary",()=>{
  assert.match(page,/\/api\/project-summary/);
  assert.match(page,/AI 项目需求总结/);
  assert.match(page,/项目目标\\n/);
  assert.match(page,/技术要求与限制/);
  assert.match(route,/Ignore navigation, category lists/);
  assert.match(route,/Never invent facts/);
  assert.match(route,/generateFreeJson/);
});

test("detail hydration removes common page chrome before project validation",()=>{
  assert.match(sources,/function detailText/);
  assert.match(sources,/header\|nav\|footer\|aside/);
  assert.match(sources,/body:detailText\(html\)/);
});
