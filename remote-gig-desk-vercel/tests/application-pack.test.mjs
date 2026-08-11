import test from "node:test";
import assert from "node:assert/strict";
import { buildApplicationPrompt, hasUsableProfile, validateApplicationPack } from "../lib/application-pack.ts";

test("requires durable private applicant evidence", () => {
  assert.equal(hasUsableProfile(null, []), false);
  assert.equal(hasUsableProfile({ skills: "React and TypeScript production delivery" }, []), true);
  assert.equal(hasUsableProfile(null, [{ title: "Verified project" }]), true);
});

test("prompt forbids copying, invention and internal placeholders", () => {
  const prompt = buildApplicationPrompt({ gig: { title: "React project",fullText:"Complete posting with deliverables, constraints, required skills, and final application instructions." }, profile: { skills: "React" }, portfolio: [] });
  assert.match(prompt, /do not copy/i);
  assert.match(prompt, /Never invent/i);
  assert.match(prompt, /select a project later/i);
  assert.match(prompt,/FULL EMPLOYER POSTING TEXT/);
  assert.match(prompt,/requirementMatches/);
});

test("keeps the confirmed systems capability library available for matching", async () => {
  const module = await import("../lib/application-pack.ts");
  assert.ok(module.requirementCapabilities.includes("C / C++"));
  assert.ok(module.requirementCapabilities.includes("Rust"));
  assert.ok(module.requirementCapabilities.includes("Go"));
  assert.ok(module.requirementCapabilities.some(value => value.includes("BGP/OSPF")));
});

test("rejects old placeholder letters", () => {
  assert.throws(() => validateApplicationPack({ language: "en", quote: "Negotiable", matchedSkills: ["React"], resume: ["Built UI"], workMode: "Remote", coverLetter: "A verified project example will be selected from the private profile before submission. This is placeholder text." }));
});

test("accepts a complete AI pack", () => {
  const pack = validateApplicationPack({ language: "en", quote: "Negotiable", employerSummary:"The client needs an accessible React dashboard, a clear interaction model, tested components, API integration, and documented delivery constraints. The posting also specifies remote collaboration and a review process.",requirementMatches:[{requirement:"Build an accessible React dashboard",advantage:"Production React and accessibility implementation",evidence:"Built an accessible dashboard with regression coverage"},{requirement:"Integrate the dashboard with APIs",advantage:"API integration and error-state modelling",evidence:"Remote Gig Desk integrates multiple production APIs"}],matchedSkills: ["React","API integration"], resume: ["Built an accessible dashboard"], workMode: "Remote", coverLetter: "I can help deliver the dashboard by starting with the interaction model and accessibility acceptance criteria, then implementing focused React components with regression coverage. My Remote Gig Desk project demonstrates production API integration, explicit error states, and evidence-based delivery rather than placeholder UI. I would apply the same approach to your dashboard and validate the required user flows before handoff." });
  assert.equal(pack.matchedSkills[0], "React");
  assert.equal(pack.requirementMatches.length,2);
});
