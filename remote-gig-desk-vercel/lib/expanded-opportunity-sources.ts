export type ExpandedGig = {
  id: string; title: string; source: string; sourceUrl: string; publishedAt: string;
  budget: string; skills: string[]; summary: string; fullText: string; remote: string;
  application: string; match: number; competition: "低" | "中";
};

type AtsKind = "greenhouse" | "lever" | "ashby" | "workable";
type AtsSource = { kind: AtsKind; token: string; company: string };
type CareerSource = { company: string; url: string };

const skillAliases: Record<string, string[]> = {
  Python: ["python", "django", "fastapi"], "C++": ["c++", "cpp"], Rust: ["rust", "cargo"],
  Go: ["golang", " go "], Java: ["java", "spring"], "C#": ["c#", ".net"],
  TypeScript: ["typescript", " ts "], LLM: ["llm", "rag", "openai"], AI: [" ai ", "machine learning"],
  React: ["react", "next.js", "nextjs"], "Node.js": ["node.js", "nodejs"], API: [" api", "integration"],
  Automation: ["automat", "script"], Backend: ["backend", "server"], Kubernetes: ["kubernetes", "k8s"],
  Docker: ["docker", "container"], AWS: [" aws ", "lambda", "ec2"], PostgreSQL: ["postgres"],
  Security: ["security", "vulnerability"], "Data Engineering": ["data engineer", "etl", "pipeline"],
};

const defaults: AtsSource[] = [
  { kind: "greenhouse", token: "gitlab", company: "GitLab" },
  { kind: "lever", token: "netlify", company: "Netlify" },
  { kind: "ashby", token: "linear", company: "Linear" },
];

const defaultCareers: CareerSource[] = [
  { company: "GitLab", url: "https://about.gitlab.com/jobs/all-jobs/" },
  { company: "Automattic", url: "https://automattic.com/work-with-us/" },
  { company: "Remote", url: "https://remote.com/openings" },
];

function text(value = "") {
  return value.replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16))).replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function skills(value: string) {
  const normalized = ` ${value.toLowerCase()} `;
  return Object.entries(skillAliases).filter(([, aliases]) => aliases.some(alias => normalized.includes(alias)))
    .map(([name]) => name).slice(0, 4);
}

function budget(value: string) {
  return value.match(/(?:US\$|\$|USD\s?)\d[\d,]*(?:k)?(?:\s?[-–—]\s?(?:US\$|\$|USD\s?)?\d[\d,]*(?:k)?)?(?:\s?(?:\/|per)\s?(?:h|hr|hour|year))?/i)?.[0] || "预算面议";
}

function relevant(value: string) {
  return /(remote|anywhere|distributed|contract|freelance|part.?time)/i.test(value) &&
    /(engineer|developer|software|backend|frontend|full.?stack|data|security|devops|platform|ai|llm|python|rust|golang|c\+\+)/i.test(value);
}

function iso(value?: string | number) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function gig(input: { id: string; title: string; company?: string; source: string; url: string; description?: string; location?: string; date?: string | number; pay?: string }): ExpandedGig {
  const body = text(input.description || "");
  const all = `${input.title} ${input.company || ""} ${input.location || ""} ${body}`;
  const publishedAt=iso(input.date);
  const age = publishedAt ? Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3600000) : Number.POSITIVE_INFINITY;
  const detected = skills(all);
  return {
    id: input.id, title: `${text(input.title)}${input.company ? ` · ${text(input.company)}` : ""}`,
    source: input.source, sourceUrl: input.url, publishedAt, budget: input.pay || budget(all),
    skills: detected, summary: body.slice(0, 210) || "打开原始职位页查看完整职责、要求和申请方式。",
    fullText: body.slice(0, 30000), remote: input.location ? `远程 · ${text(input.location)}` : "明确远程",
    application: "通过原始职位页进入公司的正式申请入口",
    match: Math.min(96, 58 + detected.length * 7 + (age < 72 ? 8 : 3)), competition: "中",
  };
}

function configuredAts(): AtsSource[] {
  try {
    const custom = JSON.parse(process.env.ATS_SOURCES_JSON || "[]");
    return [...defaults, ...(Array.isArray(custom) ? custom : [])].filter(s => s?.kind && s?.token && s?.company);
  } catch { return defaults; }
}

function configuredCareers(): CareerSource[] {
  try {
    const value = JSON.parse(process.env.CAREERS_SOURCES_JSON || "[]");
    const custom = Array.isArray(value) ? value.filter(s => s?.company && /^https:\/\//.test(s?.url)) : [];
    return [...defaultCareers, ...custom];
  } catch { return defaultCareers; }
}

async function json(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "RemoteGigDesk/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<any>;
}

async function collectAts(source: AtsSource): Promise<ExpandedGig[]> {
  let rows: any[] = [];
  if (source.kind === "greenhouse") {
    const data = await json(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.token)}/jobs?content=true`);
    rows = (data.jobs || []).map((j: any) => ({ id:j.id,title:j.title,url:j.absolute_url,description:j.content,location:j.location?.name,date:j.updated_at }));
  } else if (source.kind === "lever") {
    const data = await json(`https://api.lever.co/v0/postings/${encodeURIComponent(source.token)}?mode=json`);
    rows = (data || []).map((j: any) => ({ id:j.id,title:j.text,url:j.hostedUrl,description:`${j.descriptionPlain || ""}\n${j.additionalPlain || ""}`,location:j.categories?.location,date:j.createdAt,pay:j.salaryRange?.min ? `$${j.salaryRange.min}–$${j.salaryRange.max || j.salaryRange.min}` : undefined }));
  } else if (source.kind === "ashby") {
    const data = await json(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.token)}?includeCompensation=true`);
    rows = (data.jobs || []).map((j: any) => ({ id:j.jobUrl,title:j.title,url:j.applyUrl || j.jobUrl,description:j.descriptionPlain,location:j.location,date:j.publishedAt,pay:j.compensation?.compensationTierSummary }));
  } else {
    const data = await json(`https://www.workable.com/api/accounts/${encodeURIComponent(source.token)}?details=true`);
    rows = (data.jobs || []).map((j: any) => ({ id:j.shortcode,title:j.title,url:j.url || j.application_url,description:j.description,location:j.location?.location_str || j.location,date:j.published_on }));
  }
  return rows.filter(row => relevant(`${row.title} ${row.location} ${row.description}`)).slice(0, 12)
    .map(row => gig({ ...row, id:`ats-${source.kind}-${row.id}`, company:source.company, source:`公司 ATS · ${source.company}` }));
}

function extractLinks(html: string, base: string, pattern: RegExp) {
  const links: { url: string; label: string; context: string }[] = [];
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const url = new URL(match[1], base).toString();
    if (!pattern.test(url)) continue;
    const start = match.index || 0;
    links.push({ url, label:text(match[2]), context:text(html.slice(Math.max(0, start - 450), start + match[0].length + 700)) });
  }
  return [...new Map(links.map(item => [item.url, item])).values()];
}

async function html(url: string) {
  const response = await fetch(url, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 RemoteGigDesk/1.0" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function hydrateLinks(items:{url:string;label:string;context:string}[]){
  const results=await Promise.allSettled(items.map(async item=>{
    const page=text(await html(item.url));
    return {...item,description:page.length>=item.context.length?page:item.context};
  }));
  return results.map((result,index)=>result.status==="fulfilled"?result.value:{...items[index],description:items[index].context});
}

export async function getYC(): Promise<ExpandedGig[]> {
  const url = "https://www.ycombinator.com/jobs/role/all/remote";
  const links = extractLinks(await html(url), url, /(?:ycombinator\.com|workatastartup\.com)\/(?:jobs|companies)\//i);
  const selected=links.filter(x => x.label.length > 4 && relevant(`${x.label} ${x.context}`)).slice(0, 12),detailed=await hydrateLinks(selected);
  return detailed.map((x, i) => gig({ id:`yc-${i}-${encodeURIComponent(x.url).slice(-24)}`, title:x.label, source:"Y Combinator · 远程岗位", url:x.url, description:x.description, location:"Remote" }));
}

export async function getWellfound(): Promise<ExpandedGig[]> {
  const url = "https://wellfound.com/jobs";
  const links = extractLinks(await html(url), url, /wellfound\.com\/jobs\/\d+-/i);
  const selected=links.filter(x => x.label.length > 4 && relevant(`${x.label} ${x.context}`)).slice(0, 12),detailed=await hydrateLinks(selected);
  return detailed.map((x, i) => gig({ id:`wellfound-${i}-${x.url.match(/jobs\/(\d+)/)?.[1] || i}`, title:x.label, source:"Wellfound · 远程创业公司", url:x.url, description:x.description, location:"Remote" }));
}

export async function getCompanyCareers(): Promise<ExpandedGig[]> {
  const results = await Promise.allSettled(configuredCareers().map(async source => {
    const links = extractLinks(await html(source.url), source.url, /(?:job|career|position|opening|apply)/i);
    const selected=links.filter(x => x.label.length > 5 && relevant(`${x.label} ${x.context}`)).slice(0, 8),detailed=await hydrateLinks(selected);
    return detailed.map((x, i) => gig({ id:`career-${source.company}-${i}`, title:x.label, company:source.company, source:`公司 Careers · ${source.company}`, url:x.url, description:x.description, location:"Remote" }));
  }));
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}

export async function getActiveAts(): Promise<ExpandedGig[]> {
  const results = await Promise.allSettled(configuredAts().map(collectAts));
  if (results.every(result => result.status === "rejected")) throw new Error("所有 ATS 来源均不可用");
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}
