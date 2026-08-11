import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const extension=fs.readFileSync(new URL("../../browser-agent-extension/background.js",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/connections/route.ts",import.meta.url),"utf8");

test("browser heartbeat reports its installed version",()=>{
  assert.match(extension,/agentVersion:chrome\.runtime\.getManifest\(\)\.version/);
  assert.match(route,/updateRequired:agent\.version!==currentBrowserAgentVersion/);
});
