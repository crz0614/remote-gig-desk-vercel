import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const gigsRoute = fs.readFileSync(new URL("../app/api/gigs/route.ts", import.meta.url), "utf8");

test("translates each opportunity from its own title and original description", () => {
  assert.doesNotMatch(page, /function chineseBrief/);
  assert.match(page, /translate\(gig\.title\)/);
  assert.match(page, /translate\(gig\.fullText\|\|gig\.summary\)/);
  assert.match(page, /gig-zh-v5-/);
  assert.match(page, /本次逐岗位翻译失败，未使用通用模板替代/);
});

test("never presents a fabricated quote when the client did not publish one", () => {
  assert.doesNotMatch(page, /function suggestedQuote/);
  assert.match(page, /甲方未公开/);
  assert.match(page, /待与甲方确认/);
  assert.match(gigsRoute, /budget\|salary\|rate\|pay\|paid\|compensation\|bounty\|reward/);
});
