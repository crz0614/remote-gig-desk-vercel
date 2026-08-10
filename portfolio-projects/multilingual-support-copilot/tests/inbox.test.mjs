import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";const source=fs.readFileSync(new URL("../lib/inbox.ts",import.meta.url),"utf8");
test("public demo contains four fictional multilingual messages",()=>{assert.equal([...source.matchAll(/id:"m-/g)].length,4);for(const language of ["French","Japanese","English","Spanish"])assert.match(source,new RegExp(language));});
test("outbound drafts retain human approval and knowledge citations",()=>{assert.match(source,/requiresApproval:true/);assert.match(source,/citations:/);assert.match(source,/verified|secure account flow/i);});
test("source contains no real mailbox credentials",()=>{assert.doesNotMatch(source,/@gmail\.com|refresh_token|access_token|client_secret/i);});
