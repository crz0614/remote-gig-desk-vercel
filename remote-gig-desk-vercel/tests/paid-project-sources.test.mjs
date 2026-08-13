import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessGitHubBounty } from "../lib/paid-project-sources.ts";

const sources=fs.readFileSync(new URL("../lib/paid-project-sources.ts",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../app/api/gigs/route.ts",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("collects paid deliverable projects from domestic and international sources",()=>{
  for(const source of ["GitHub 付费 Issue","Reddit 项目委托","V2EX 项目需求","电鸭项目外包","猪八戒需求大厅"])assert.match(sources,new RegExp(source));
  assert.match(sources,/market:\"国内\"\|\"海外\"/);
  assert.match(sources,/opportunityType:\"project\"/);
});

test("rejects listings without both delivery and payment intent",()=>{
  assert.match(sources,/projectIntent\.test\(text\).*paidIntent\.test\(text\)/);
  assert.match(sources,/closedIntent\.test\(text\)/);
  assert.match(sources,/sandboxRepositoryIntent/);
  assert.match(sources,/assessGitHubBounty/);
  assert.match(sources,/conversationalSuggestion/);
  assert.match(sources,/getProginnProjects/);
  assert.match(sources,/getEpwkProjects/);
  assert.match(sources,/程序员客栈 · 项目研发/);
  assert.match(sources,/一品威客 · 任务大厅/);
  assert.match(sources,/DoneDirtCheap/);
  assert.match(sources,/Programmers_forhire/);
  assert.match(sources,/getThreadsProjects/);
  assert.match(sources,/getXProjects/);
  assert.match(sources,/workerAdvertisement/);
  assert.match(sources,/clientRequestIntent/);
  assert.match(sources,/verifiedIds=\["1v1gve4"\]/);
  assert.match(sources,/reddit\.com\/comments\/\$\{id\}\.json/);
  assert.doesNotMatch(sources,/in:title paid/);
});

test("requires verified funding and rejects failed or stale GitHub bounties",()=>{
  const base={title:"Fix PostgreSQL migration",body:"/bounty $10 paid issue",state:"open",labels:[{name:"bounty"}]};
  assert.equal(assessGitHubBounty({item:base,repository:{description:"real database project"},comments:[{user:{login:"opirebot[bot]"},body:"you cannot create a reward of $10. It needs to be at least $20"}]}).reason,"reward_creation_failed");
  assert.equal(assessGitHubBounty({item:{...base,state:"closed"},repository:{description:"real database project"},comments:[]}).reason,"github_issue_closed");
  assert.equal(assessGitHubBounty({item:base,repository:{description:"Sandbox fixture for testing an automated OSS bounty-solving workflow"},comments:[{user:{login:"algora-pbc[bot]"},body:"$50 bounty is live"}]}).reason,"sandbox_or_test_repository");
});

test("admits a live cash bounty only after a trusted platform confirms funding",()=>{
  const item={title:"Develop a configuration editor",body:"/bounty $500 paid task",state:"open",labels:[{name:"bounty"}]};
  const result=assessGitHubBounty({item,repository:{name:"product",description:"Production developer tool"},comments:[{user:{login:"algora-pbc[bot]"},body:"$500 bounty is live and funded"}]});
  assert.deepEqual(result,{eligible:true,reason:"verified",competingPullRequests:0});
});

test("rejects crypto promotions and heavily duplicated solutions",()=>{
  const item={title:"Add a RustChain badge",body:"Bounty reward 2 RTC tokens",state:"open",labels:[{name:"bounty"}]};
  assert.equal(assessGitHubBounty({item,repository:{description:"Earn crypto"},comments:[]}).reason,"non_cash_reward");
  const cash={title:"Fix parser",body:"/bounty $50 paid issue",state:"open",labels:[{name:"bounty"}]};
  const comments=[1,2,3].map(n=>({user:{login:n===1?"algora-pbc[bot]":"solver"},body:n===1?`$50 bounty is live https://github.com/o/r/pull/${n}`:`https://github.com/o/r/pull/${n}`}));
  assert.equal(assessGitHubBounty({item:cash,repository:{description:"Production parser"},comments}).reason,"high_duplicate_pr_competition");
});

test("shows paid projects in a dedicated workbench area",()=>{
  assert.match(route,/collectPaidProjects/);
  assert.match(page,/[\"']项目单[\"']/);
  assert.match(page,/availableProjects/);
  assert.match(page,/预期交付物/);
  assert.match(page,/国内 \+ 海外 · 按项目付费/);
  assert.match(page,/国内外包/);
  assert.match(page,/projectMarket/);
});
