import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {inspectPortfolioArchive} from "../lib/portfolio-archive.ts";

test("portfolio ZIP inspection extracts structure, README and relevant stack",async()=>{
  const zip=new JSZip();
  zip.file("sample/README.md","# Sample dashboard\nA React and TypeScript dashboard using PostgreSQL.");
  zip.file("sample/package.json",JSON.stringify({dependencies:{react:"19.0.0",typescript:"5.0.0"}}));
  zip.file("sample/src/app.tsx","export default function App() { return null }");
  const bytes=await zip.generateAsync({type:"arraybuffer"});
  const result=await inspectPortfolioArchive(bytes);
  assert.equal(result.title,"sample");
  assert.match(result.summary,/Sample dashboard/);
  assert.deepEqual(result.skills.slice(0,2),["React","TypeScript"]);
  assert.equal(result.parsedFiles.length,3);
});
