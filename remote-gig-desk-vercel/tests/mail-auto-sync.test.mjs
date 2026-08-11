import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("refreshes Gmail automatically when the workbench opens or returns to the foreground", () => {
  assert.match(source, /refreshMail\(\);/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.addEventListener\(\'focus\',refreshMail\)/);
  assert.match(source, /syncGmail\(true\)/);
});

test("deduplicates overlapping and rapid automatic Gmail syncs", () => {
  assert.match(source, /mailSyncInFlight\.current/);
  assert.match(source, /60_000/);
  assert.match(source, /now-lastAutomaticMailSync\.current/);
});

test("the global refresh updates every live workbench data source", () => {
  assert.match(source, /const refreshAll=async\(\)=>\{await Promise\.all\(\[load\(\),loadBackend\(\),syncGmail\(true\)\]\)/);
  assert.match(source, /setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'\)void refreshAll\(\);\},5\*60_000\)/);
  assert.match(source, /aria-label="刷新全部数据"/);
});
