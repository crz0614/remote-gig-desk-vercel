import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("trusted device survives top-level navigation from chat and email", () => {
  assert.match(proxy, /sameSite:\s*"lax"/);
  assert.match(proxy, /httpOnly:\s*true/);
  assert.match(proxy, /secure:\s*true/);
  assert.match(proxy, /DEVICE_DAYS\s*=\s*90/);
});
