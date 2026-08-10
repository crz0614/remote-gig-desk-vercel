import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/browser-task-state.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const state=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("tracks browser execution through form readiness",()=>{
  assert.equal(state.browserTaskState("task_started").status,"browser_in_progress");
  assert.equal(state.browserTaskState("form_inspected",{filledFields:2}).status,"form_ready");
  assert.equal(state.browserTaskState("verification_required").status,"verification_required");
});

test("never marks an application submitted without evidence",()=>{
  assert.throws(()=>state.browserTaskState("task_submitted"),/submission_evidence_required/);
  assert.deepEqual(state.browserTaskState("task_submitted",{evidenceId:"receipt-42"}),{
    status:"submitted",deliveryState:"platform_accepted",message:"浏览器已提交申请并回传可核验证据",error:"",delivered:true,
  });
});
