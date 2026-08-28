import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("health and task leasing share the browser agent protocol version", async () => {
  const [health, connections, version, manifest] = await Promise.all([
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/connections/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/browser-agent-version.ts", import.meta.url), "utf8"),
    readFile(new URL("../../browser-agent-extension/manifest.json", import.meta.url), "utf8"),
  ]);
  const expected = JSON.parse(manifest).version;
  assert.match(version, new RegExp(`CURRENT_BROWSER_AGENT_VERSION = ["']${expected.replaceAll(".", "\\.")}["']`));
  assert.match(health, /CURRENT_BROWSER_AGENT_VERSION/);
  assert.match(connections, /CURRENT_BROWSER_AGENT_VERSION/);
  assert.doesNotMatch(health, /0\.5\.0/);
});

test("public health reports Google OAuth configuration without exposing secrets", async () => {
  const health = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /googleOauth:Boolean\(process\.env\.GOOGLE_CLIENT_ID&&process\.env\.GOOGLE_CLIENT_SECRET\)/);
  assert.doesNotMatch(health, /GOOGLE_CLIENT_SECRET\s*[,}]/);
});
