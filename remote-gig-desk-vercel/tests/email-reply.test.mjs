import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/email-reply.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const reply=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("separates receipts, interviews, rejections and suspicious replies",()=>{
  assert.equal(reply.classifyReply("Application received","Thank you for applying").kind,"receipt");
  assert.equal(reply.classifyReply("Interview","Please share your availability").kind,"interview");
  assert.equal(reply.classifyReply("Update","Unfortunately we are not moving forward").kind,"rejection");
  assert.equal(reply.classifyReply("Offer","Pay a processing fee via crypto wallet").kind,"suspicious");
});

test("only a receipt becomes platform accepted evidence",()=>{
  assert.equal(reply.classifyReply("Application received","We received your application").deliveryState,"platform_accepted");
  assert.equal(reply.classifyReply("Interview","Schedule a call").deliveryState,"recipient_replied");
});

test("links a reply to the strongest matching application title",()=>{
  assert.equal(reply.matchApplicationByTitle("Senior Rust Engineer interview","",[{id:"a",title:"Frontend Engineer"},{id:"b",title:"Senior Rust Engineer"}]),"b");
});
