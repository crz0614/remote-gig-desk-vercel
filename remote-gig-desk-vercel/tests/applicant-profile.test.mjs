import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../lib/applicant-profile.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const profile=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("maps saved identity and combined career links into ATS fields",()=>{
  const result=profile.applicantProfileForForms({name:"Ruozhu Chen",links:"https://github.com/example https://www.linkedin.com/in/example"},[],"owner@example.com");
  assert.equal(result.fullName,"Ruozhu Chen");
  assert.equal(result.email,"owner@example.com");
  assert.equal(result.github,"https://github.com/example");
  assert.equal(result.linkedin,"https://www.linkedin.com/in/example");
});

test("prefers a verified portfolio item for the portfolio field",()=>{
  const result=profile.applicantProfileForForms({links:"https://github.com/example"},["https://portfolio.example.com"],"owner@example.com");
  assert.equal(result.portfolio,"https://portfolio.example.com");
});
