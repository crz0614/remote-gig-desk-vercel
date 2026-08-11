import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("refreshes Gmail automatically when the workbench opens or returns to the foreground", () => {
  assert.match(source, /refreshMail\(\);/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.addEventListener\(["']focus["'],\s*refreshMail\)/);
  assert.match(source, /syncGmail\(true\)/);
});

test("deduplicates overlapping and rapid automatic Gmail syncs", () => {
  assert.match(source, /mailSyncInFlight\.current/);
  assert.match(source, /60_000/);
  assert.match(source, /now\s*-\s*lastAutomaticMailSync\.current/);
});

test("the global refresh updates every live workbench data source", () => {
  assert.match(source, /const refreshAll\s*=\s*async\s*\(\)\s*=>[^]*Promise\.all\(\[load\(\),\s*loadBackend\(\),\s*syncGmail\(true\)\]\)/);
  assert.match(source, /setInterval\([^]*document\.visibilityState\s*===\s*["']visible["'][^]*refreshAll\(\)[^]*runCloudExecutor\(\)[^]*5\s*\*\s*60_000/);
  assert.match(source, /aria-label="刷新全部数据"/);
});
