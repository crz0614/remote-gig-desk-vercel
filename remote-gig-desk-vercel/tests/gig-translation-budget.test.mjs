import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const gigsRoute = fs.readFileSync(new URL("../app/api/gigs/route.ts", import.meta.url), "utf8");

test("translates each opportunity from its own title and original description", () => {
  assert.doesNotMatch(page, /function chineseBrief/);
  assert.match(page, /translate\(gig\.title\)/);
  assert.match(page, /translate\(gig\.fullText\|\|gig\.summary\)/);
  assert.match(page, /gig-zh-v6-complete-/);
  assert.match(page, /本次逐岗位翻译失败，未使用通用模板替代/);
});

test("keeps full source text and completes free translation without billing credentials", () => {
  const translationRoute = fs.readFileSync(new URL("../app/api/translate/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(gigsRoute, /fullText:\s*body\.slice\(0,\s*1400\)/);
  assert.match(gigsRoute, /fullText:\s*body\.slice\(0,\s*30000\)/);
  assert.match(translationRoute, /translate\.googleapis\.com/);
  assert.match(translationRoute, /free-machine-translation/);
  assert.doesNotMatch(translationRoute, /AI_GATEWAY_API_KEY|OPENAI_API_KEY/);
  assert.match(translationRoute, /translated\.length===parts\.length/);
  assert.doesNotMatch(translationRoute, /mymemory\.translated\.net/);
});

test("never presents a fabricated quote when the client did not publish one", () => {
  assert.doesNotMatch(page, /function suggestedQuote/);
  assert.match(page, /甲方未公开/);
  assert.match(page, /待与甲方确认/);
  assert.match(gigsRoute, /budget\|salary\|rate\|pay\|paid\|compensation\|bounty\|reward/);
});
