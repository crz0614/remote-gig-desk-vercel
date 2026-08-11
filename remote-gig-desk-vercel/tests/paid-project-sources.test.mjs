import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sources=fs.readFileSync(new URL("../lib/paid-project-sources.ts",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/gigs/route.ts",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("collects paid deliverable projects from domestic and international sources",()=>{
  for(const source of ["GitHub 付费 Issue","Reddit 项目委托","V2EX 项目需求","电鸭项目外包","猪八戒需求大厅"])assert.match(sources,new RegExp(source));
  assert.match(sources,/market:\"国内\"\|\"海外\"/);
  assert.match(sources,/opportunityType:\"project\"/);
});

test("rejects listings without both delivery and payment intent",()=>{
  assert.match(sources,/projectIntent\.test\(text\).*paidIntent\.test\(text\)/);
  assert.match(sources,/closedIntent\.test\(text\)/);
  assert.doesNotMatch(sources,/mock|fixture|placeholder project/i);
  assert.match(sources,/validGitHubBounty/);
  assert.match(sources,/conversationalSuggestion/);
  assert.doesNotMatch(sources,/in:title paid/);
});

test("shows paid projects in a dedicated workbench area",()=>{
  assert.match(route,/collectPaidProjects/);
  assert.match(page,/[\"']项目单[\"']/);
  assert.match(page,/availableProjects/);
  assert.match(page,/预期交付物/);
  assert.match(page,/国内 \+ 海外 · 按项目付费/);
  assert.match(page,/国内外包/);
  assert.match(page,/projectMarket/);
});
