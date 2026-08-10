import test from "node:test";
import assert from "node:assert/strict";
import { buildApplicationPrompt, hasUsableProfile, validateApplicationPack } from "../lib/application-pack.ts";

test("requires durable private applicant evidence", () => {
  assert.equal(hasUsableProfile(null, []), false);
  assert.equal(hasUsableProfile({ skills: "React and TypeScript production delivery" }, []), true);
  assert.equal(hasUsableProfile(null, [{ title: "Verified project" }]), true);
});

test("prompt forbids copying, invention and internal placeholders", () => {
  const prompt = buildApplicationPrompt({ gig: { title: "React project" }, profile: { skills: "React" }, portfolio: [] });
  assert.match(prompt, /do not copy/i);
  assert.match(prompt, /Never invent/i);
  assert.match(prompt, /select a project later/i);
});

test("rejects old placeholder letters", () => {
  assert.throws(() => validateApplicationPack({ language: "en", quote: "Negotiable", matchedSkills: ["React"], resume: ["Built UI"], workMode: "Remote", coverLetter: "A verified project example will be selected from the private profile before submission. This is placeholder text." }));
});

test("accepts a complete AI pack", () => {
  const pack = validateApplicationPack({ language: "en", quote: "Negotiable", matchedSkills: ["React"], resume: ["Built an accessible dashboard"], workMode: "Remote", coverLetter: "I can help deliver the dashboard by starting with the interaction model and accessibility acceptance criteria, then implementing focused React components with regression coverage. My portfolio includes a relevant interface project with evidence of my contribution." });
  assert.equal(pack.matchedSkills[0], "React");
});
