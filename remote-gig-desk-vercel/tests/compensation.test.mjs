import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessCompensation, requiresPaidDeliveryGate } from "../lib/compensation.ts";

test("distinguishes confirmed payment, unknown payment and unpaid work", () => {
  assert.equal(assessCompensation({ source:"GitHub 付费 Issue",budget:"$500",fullText:"Paid bounty for a patch" }).state,"confirmed_paid");
  assert.equal(assessCompensation({ source:"GitHub",budget:"预算面议",fullText:"Please draft a security programme; bounty details are TBD" }).state,"payment_unconfirmed");
  assert.equal(assessCompensation({ source:"GitHub",fullText:"This is an unpaid volunteer contribution" }).state,"unpaid");
});

test("blocks real GitHub delivery until payment is explicit", () => {
  assert.equal(requiresPaidDeliveryGate("github_pull_request",{state:"payment_unconfirmed",evidence:""}),true);
  assert.equal(requiresPaidDeliveryGate("github_pull_request",{state:"confirmed_paid",evidence:"$500"}),false);
  assert.equal(requiresPaidDeliveryGate("github_comment",{state:"payment_unconfirmed",evidence:""}),false);
});

test("server and UI preserve payment evidence and never equate merge with payment", () => {
  const route=fs.readFileSync(new URL("../app/api/applications/route.ts",import.meta.url),"utf8");
  const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(route,/COMPENSATION_CONFIRMATION_REQUIRED/);
  assert.match(route,/compensation_confirmation_required/);
  assert.match(page,/回复、认可、PR 批准和合并都不等于付款/);
  assert.match(page,/确认付费后才能开始 PR 交付/);
});
