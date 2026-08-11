import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../lib/submission-evidence.ts",import.meta.url),"utf8")
  .replace('import { atsProviderForUrl, type AtsProvider } from "./ats-adapter";', 'type AtsProvider = "greenhouse"|"lever"|"ashby"|"workable"|"custom"; const atsProviderForUrl=(value:string|null|undefined):AtsProvider=>{const h=new URL(String(value)).hostname;return h.includes("greenhouse.io")?"greenhouse":h.includes("lever.co")?"lever":h.includes("ashbyhq.com")?"ashby":h.includes("workable.com")?"workable":"custom";}');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function("module","exports",js)(module,module.exports);const {validateSubmissionEvidence}=module.exports;
test("accepts a fresh official ATS confirmation",()=>{const item=validateSubmissionEvidence({evidenceUrl:"https://jobs.lever.co/acme/thank-you",evidenceId:"lever:acme:receipt-42",evidenceKind:"official_confirmation_page",confirmationText:"Thank you for applying. We received your application.",provider:"lever",capturedAt:Date.now()},"https://jobs.lever.co/acme/job");assert.equal(item.provider,"lever")});
test("rejects browser-generated pseudo receipt IDs",()=>{assert.throws(()=>validateSubmissionEvidence({evidenceUrl:"https://jobs.lever.co/acme/thank-you",evidenceId:"browser-confirmation:123",evidenceKind:"official_confirmation_page",confirmationText:"Thank you for applying",provider:"lever",capturedAt:Date.now()},"https://jobs.lever.co/acme/job"),/stable_evidence_id_required/)});
test("rejects provider mismatch and generic pages",()=>{assert.throws(()=>validateSubmissionEvidence({evidenceUrl:"https://example.com/thanks",evidenceId:"x:1",evidenceKind:"official_confirmation_page",confirmationText:"Thank you for applying",provider:"custom",capturedAt:Date.now()},"https://jobs.ashbyhq.com/acme/job"),/evidence_provider_mismatch/);assert.throws(()=>validateSubmissionEvidence({evidenceUrl:"https://jobs.ashbyhq.com/acme/job",evidenceId:"ashby:1",evidenceKind:"official_confirmation_page",confirmationText:"Job description",provider:"ashby",capturedAt:Date.now()},"https://jobs.ashbyhq.com/acme/job"),/official_confirmation_text_required/)});
