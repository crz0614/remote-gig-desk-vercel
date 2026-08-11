import { getActiveAts, getCompanyCareers, getWellfound, getYC } from "@/lib/expanded-opportunity-sources";
import { collectPaidProjects } from "@/lib/paid-project-sources";

type LiveGig = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  budget: string;
  skills: string[];
  summary: string;
  fullText: string;
  remote: string;
  application: string;
  match: number;
  competition: "低" | "中";
};

const skillWords = ["Python", "C++", "Rust", "Go", "Java", "C#", "TypeScript", "LLM", "AI", "React", "Node.js", "API", "Automation", "Backend", "Kubernetes", "Docker", "AWS", "PostgreSQL", "Security", "Data Engineering"];

function decodeEntities(value=""){
  return value.replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16)));
}

function clean(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*|__|`{1,3}|~~/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(value=""){
  return decodeEntities(decodeEntities(value)).replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi,"\n").replace(/<li[^>]*>/gi,"• ").replace(/<[^>]+>/g," ").replace(/!\[[^\]]*\]\([^)]*\)/g," ").replace(/\[([^\]]+)\]\(([^)]+)\)/g,"$1 ($2)").replace(/^\s{0,3}#{1,6}\s*/gm,"").replace(/\*\*|__|`{1,3}|~~/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
}

function isAggregatorIssue(item: any) {
  const title = `${item.title ?? ""}`;
  const body = `${item.body ?? ""}`;
  const combined = `${title} ${body}`;
  const issueLinks = (body.match(/github\.com\/[^\s)]+\/issues\/\d+/gi) ?? []).length;
  return /(bounty|reward).{0,20}(scan|report|digest|alert|reminder)|(scan|report|digest).{0,20}(bounty|reward)|new opportunities found|赏金.{0,8}(扫描|报告|提醒|警报)|活动赏金扫描结果/i.test(combined)
    || /BountyScout/i.test(combined)
    || issueLinks >= 3;
}

function skillsFor(text: string) {
  const lower = text.toLowerCase();
  const aliases: Record<string, string[]> = {
    Python: ["python", "django", "fastapi"], "C++": ["c++", "cpp"], Rust: ["rust", "cargo"], Go: ["golang", " go "], Java: ["java", "spring"], "C#": ["c#", ".net"], TypeScript: ["typescript", " ts "],
    LLM: ["llm", "large language", "rag", "openai"], AI: [" ai ", "machine learning", "ml "],
    React: ["react", "next.js", "nextjs"], "Node.js": ["node.js", "nodejs"], API: [" api", "integration"], Automation: ["automat", "script"],
    Backend: ["backend", "server"], Kubernetes: ["kubernetes", " k8s"], Docker: ["docker", "container"], AWS: [" aws ", "lambda", "ec2"], PostgreSQL: ["postgres", "postgresql"], Security: ["security", "secure", "vulnerability"], "Data Engineering": ["data engineer", "etl", "pipeline"],
  };
  return skillWords.filter(skill => aliases[skill].some(word => ` ${lower} `.includes(word))).slice(0, 4);
}

function budgetFor(text: string) {
  const money = /(?:US\$|\$|USD\s?)\d[\d,]*(?:\.\d+)?(?:\s?[-–—]\s?(?:US\$|\$|USD\s?)?\d[\d,]*(?:\.\d+)?)?(?:\s?(?:\/|per)\s?(?:h|hr|hour|day|week|month|year|annum))?/gi;
  for (const match of text.matchAll(money)) {
    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 55), start + match[0].length + 55);
    if (/(budget|salary|rate|pay|paid|compensation|bounty|reward|contract|hourly|annual|per\s+(?:hour|day|week|month|year))/i.test(context)) return match[0];
  }
  return "预算面议";
}

function score(text: string, ageHours: number) {
  const skills = skillsFor(text);
  const skillScore = Math.min(skills.length * 7, 28);
  const freshScore = ageHours < 24 ? 12 : ageHours < 72 ? 8 : 4;
  const budgetScore = /\$|USD|budget|paid|bounty/i.test(text) ? 8 : 0;
  return Math.min(96, 55 + skillScore + freshScore + budgetScore);
}

async function getReddit(subreddit: string): Promise<LiveGig[]> {
  const response = await fetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=40&raw_json=1`, {
    headers: { "User-Agent": "RemoteGigDesk/1.0" }, signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Reddit ${response.status}`);
  const json = await response.json() as any;
  return (json?.data?.children ?? []).map((entry: any) => entry.data).filter((p: any) =>
    /^\s*\[?hiring\]?/i.test(p.title ?? "") && !p.over_18 && !p.removed_by_category
  ).slice(0, 10).map((p: any): LiveGig => {
    const text = clean(`${p.title} ${p.selftext ?? ""}`);
    const ageHours = (Date.now() / 1000 - p.created_utc) / 3600;
    const body=cleanDescription(p.selftext ?? "");
    return { id: `reddit-${p.id}`, title: clean(p.title).replace(/^\s*\[?hiring\]?\s*[-:]?\s*/i, ""), source: `Reddit · r/${subreddit}`, sourceUrl: `https://www.reddit.com${p.permalink}`, publishedAt: new Date(p.created_utc * 1000).toISOString(), budget: budgetFor(text), skills: skillsFor(text), summary: body.slice(0, 210) || "打开原始需求查看项目说明与联系方式。", fullText:body.slice(0,30000), remote:/remote/i.test(text)?"明确远程":"需向甲方确认", application:"按照帖子中的邮箱、私信或申请链接联系甲方", match: score(text, ageHours), competition: p.num_comments < 8 ? "低" : "中" };
  });
}

async function getGitHub(): Promise<LiveGig[]> {
  const queries = ["is:issue is:open no:assignee in:title bounty", "is:issue is:open no:assignee label:bounty", "is:issue is:open no:assignee in:title reward"];
  const results = await Promise.all(queries.map(async query => {
    const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=12`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "RemoteGigDesk" }, signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return ((await response.json()) as any).items ?? [];
  }));
  const items = [...new Map(results.flat().map((item: any) => [item.html_url, item])).values()] as any[];
  return items.filter((i: any) => !i.pull_request && !isAggregatorIssue(i) && clean(i.body ?? "").length >= 40).slice(0, 12).map((i: any): LiveGig => {
    const text = clean(`${i.title} ${i.body ?? ""}`);
    const ageHours = (Date.now() - new Date(i.created_at).getTime()) / 3600000;
    const body=cleanDescription(i.body ?? "");
    return { id: `github-${i.id}`, title: clean(i.title), source: "GitHub · 开放 Issue", sourceUrl: i.html_url, publishedAt: i.created_at, budget: budgetFor(text), skills: skillsFor(text), summary: body.slice(0, 210) || "打开原始 Issue 查看任务说明与悬赏条件。", fullText:body.slice(0,30000), remote:"远程开源任务", application:"在 Issue 下确认领取方式，按仓库要求提交代码或方案", match: score(text, ageHours), competition: (i.comments ?? 0) < 6 ? "低" : "中" };
  });
}

async function getRemoteOK(): Promise<LiveGig[]> {
  const response = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "RemoteGigDesk/1.0" }, signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`RemoteOK ${response.status}`);
  const json = await response.json() as any[];
  return (Array.isArray(json) ? json : []).filter((j: any) => {
    const text = `${j.position ?? ""} ${(j.tags ?? []).join(" ")} ${j.description ?? ""}`;
    return j.id && /(contract|freelance|part.?time|temporary)/i.test(text);
  }).slice(0, 12).map((j: any): LiveGig => {
    const body = cleanDescription(j.description ?? "");
    const text = `${j.position} ${body} ${(j.tags ?? []).join(" ")}`;
    const publishedAt = j.date || j.epoch ? new Date(j.date || j.epoch * 1000).toISOString() : "";
    const ageHours = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 3600000 : Number.POSITIVE_INFINITY;
    const salary = j.salary_min ? `$${Number(j.salary_min).toLocaleString()}–$${Number(j.salary_max || j.salary_min).toLocaleString()}/年` : budgetFor(text);
    return { id: `remoteok-${j.id}`, title: `${clean(j.position)} · ${clean(j.company ?? "甲方")}`, source: "Remote OK · 合同岗位", sourceUrl: j.url || j.apply_url, publishedAt, budget: salary, skills: skillsFor(text), summary: body.slice(0, 210), fullText: body.slice(0,30000), remote: j.location ? `远程 · ${clean(j.location)}` : "明确远程", application: "通过 Remote OK 原始职位页进入甲方申请入口", match: score(text, ageHours), competition: "中" };
  });
}

async function getArbeitnow(): Promise<LiveGig[]> {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`Arbeitnow ${response.status}`);
  const json = await response.json() as any;
  return (json.data ?? []).filter((j: any) => {
    const text = `${j.title ?? ""} ${(j.job_types ?? []).join(" ")} ${(j.tags ?? []).join(" ")} ${j.description ?? ""}`;
    return j.remote === true && /(contract|freelance|part.?time|temporary)/i.test(text);
  }).slice(0, 12).map((j: any): LiveGig => {
    const body = cleanDescription(j.description ?? "");
    const text = `${j.title} ${body} ${(j.tags ?? []).join(" ")}`;
    const publishedAt = typeof j.created_at === "number" ? new Date(j.created_at * 1000).toISOString() : j.created_at ? new Date(j.created_at).toISOString() : "";
    const ageHours = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 3600000 : Number.POSITIVE_INFINITY;
    return { id: `arbeitnow-${j.slug}`, title: `${clean(j.title)} · ${clean(j.company_name ?? "甲方")}`, source: "Arbeitnow · 远程合同", sourceUrl: j.url, publishedAt, budget: budgetFor(text), skills: skillsFor(text), summary: body.slice(0, 210), fullText: body.slice(0,30000), remote: "明确远程", application: "通过 Arbeitnow 原始职位页进入甲方申请入口", match: score(text, ageHours), competition: "中" };
  });
}

async function getHackerNews(): Promise<LiveGig[]> {
  const threadResponse = await fetch("https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN%3A%20Who%20is%20hiring%3F&tags=story&hitsPerPage=12", { signal: AbortSignal.timeout(7000) });
  if (!threadResponse.ok) throw new Error(`HN thread ${threadResponse.status}`);
  const threadJson = await threadResponse.json() as any;
  const thread = (threadJson.hits ?? []).find((hit: any) =>
    /^Ask HN: Who is hiring\? \([A-Za-z]+ \d{4}\)$/i.test(clean(hit.title ?? "")) &&
    !/wants to be hired/i.test(hit.title ?? "")
  );
  if (!thread?.objectID) return [];

  const commentsResponse = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${thread.objectID}&hitsPerPage=500`, { signal: AbortSignal.timeout(7000) });
  if (!commentsResponse.ok) throw new Error(`HN comments ${commentsResponse.status}`);
  const commentsJson = await commentsResponse.json() as any;
  return (commentsJson.hits ?? []).filter((h: any) => {
    const text = clean(h.comment_text ?? "");
    return h.parent_id === Number(thread.objectID) &&
      /(remote|contract|freelance)/i.test(text) &&
      /(developer|engineer|python|java|c\+\+|ai|llm|software|backend|frontend)/i.test(text) &&
      !/(seeking work|looking for work|résumé|resume:|cv:)/i.test(text);
  }).slice(0, 12).map((h: any): LiveGig => {
    const text = clean(h.comment_text ?? "");
    const ageHours = (Date.now() / 1000 - h.created_at_i) / 3600;
    const company = text.split(/[|\n]/)[0].trim().slice(0, 70);
    return { id: `hn-${h.objectID}`, title: company || "Hacker News 远程技术需求", source: "Hacker News · Who is hiring", sourceUrl: `https://news.ycombinator.com/item?id=${h.objectID}`, publishedAt: h.created_at, budget: budgetFor(text), skills: skillsFor(text), summary: text.slice(0, 210), fullText:text.slice(0,30000), remote:"明确远程", application:"使用评论中提供的邮箱或申请链接联系招聘方", match: score(text, ageHours), competition: "低" };
  });
}

async function getJobicy():Promise<LiveGig[]>{
  const response=await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering",{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error(`Jobicy ${response.status}`); const json=await response.json() as any;
  return (json.jobs??[]).filter((j:any)=>/(contract|freelance|part.?time)/i.test((j.jobType??[]).join(" "))).slice(0,12).map((j:any):LiveGig=>{const body=cleanDescription(j.jobDescription??j.jobExcerpt??"");const text=`${j.jobTitle} ${body}`;const ageHours=(Date.now()-new Date(j.pubDate).getTime())/3600000;return{id:`jobicy-${j.id}`,title:`${j.jobTitle} · ${j.companyName}`,source:"Jobicy · 远程合同",sourceUrl:j.url,publishedAt:j.pubDate,budget:j.annualSalaryMin?`$${j.annualSalaryMin.toLocaleString()}–${j.annualSalaryMax?.toLocaleString()??""}/年`:budgetFor(text),skills:skillsFor(text),summary:body.slice(0,210),fullText:body.slice(0,30000),remote:j.jobGeo?`远程 · ${j.jobGeo}`:"远程",application:"通过 Jobicy 原始职位页提交简历和申请信息",match:score(text,ageHours),competition:"中"};});
}

async function getRemotive():Promise<LiveGig[]>{
  const response=await fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=60",{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error(`Remotive ${response.status}`);const json=await response.json() as any;
  return (json.jobs??[]).filter((j:any)=>/(contract|freelance|part.?time)/i.test(j.job_type??"")).slice(0,12).map((j:any):LiveGig=>{const body=cleanDescription(j.description??"");const text=`${j.title} ${body}`;const ageHours=(Date.now()-new Date(j.publication_date).getTime())/3600000;return{id:`remotive-${j.id}`,title:`${j.title} · ${j.company_name}`,source:"Remotive · 远程合同",sourceUrl:j.url,publishedAt:j.publication_date,budget:j.salary||budgetFor(text),skills:skillsFor(text),summary:body.slice(0,210),fullText:body.slice(0,30000),remote:j.candidate_required_location?`远程 · ${j.candidate_required_location}`:"远程",application:"通过 Remotive 原始职位页进入甲方申请入口",match:score(text,ageHours),competition:"中"};});
}

export async function GET() {
  const [jobs,paidProjects] = await Promise.all([
    Promise.allSettled([getGitHub(),getHackerNews(),getJobicy(),getRemotive(),getRemoteOK(),getArbeitnow(),getReddit("forhire"),getReddit("jobbit"),getYC(),getWellfound(),getCompanyCareers(),getActiveAts()]),
    collectPaidProjects().catch(()=>({projects:[],sources:[]})),
  ]);
  const names = ["GitHub","Hacker News","Jobicy","Remotive","Remote OK","Arbeitnow","Reddit r/forhire","Reddit r/jobbit","Y Combinator","Wellfound","公司 Careers","公司 ATS"];
  const sources = jobs.map((result, index) => {
    const count = result.status === "fulfilled" ? result.value.length : 0;
    return { name: names[index], ok: result.status === "fulfilled" && count > 0, count };
  });
  const gigs = [
    ...jobs.flatMap(result => result.status === "fulfilled" ? result.value.map(gig=>({...gig,opportunityType:"job" as const,market:/V2EX|电鸭|猪八戒/.test(gig.source)?"国内" as const:"海外" as const})) : []),
    ...paidProjects.projects,
  ];
  const unique = [...new Map(gigs.map(gig => [gig.sourceUrl, gig])).values()]
    .sort((a, b) => b.match - a.match || (Date.parse(b.publishedAt)||0) - (Date.parse(a.publishedAt)||0));
  return Response.json({ gigs: unique, sources:[...sources,...paidProjects.sources], fetchedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "CDN-Cache-Control": "no-store" },
  });
}
