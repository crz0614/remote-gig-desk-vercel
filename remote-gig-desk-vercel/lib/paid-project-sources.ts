export type PaidProject = {
  id:string; title:string; source:string; sourceUrl:string; publishedAt:string;
  budget:string; skills:string[]; summary:string; fullText:string; remote:string;
  application:string; match:number; competition:"低"|"中"; opportunityType:"project";
  market:"国内"|"海外"; projectCategory:string; deliverable:string;
};

const projectIntent=/(build|create|develop|implement|integrate|deploy|migrate|fix|debug|repair|redesign|website|web app|landing page|api|automation|script|bug|feature|开发|搭建|制作|部署|上线|修复|排错|改版|二次开发|接口|自动化|小程序|网站)/i;
const paidIntent=/(budget|paid|payment|pay|rate|fixed.price|hourly|bounty|reward|contract|freelance|\$\s?\d|预算|报酬|有偿|付费|外包|按项目|结算|悬赏|¥\s?\d|￥\s?\d|\d+\s?(?:元|人民币|rmb))/i;
const closedIntent=/(已结束|已招满|停止报名|closed|completed|resolved|no longer accepting)/i;
const solicitationIntent=/(bounty|cash reward|reward of|paid task|paid issue|fixed.price project|hiring|looking for (?:a|an) (?:developer|engineer)|seeking (?:a|an) (?:developer|engineer)|预算|报酬|有偿|付费任务|外包|寻(?:开发|程序员|工程师)|招募|按项目结算|悬赏)/i;
const conversationalSuggestion=/(feature suggestion|proposal:|would you|are you willing|could you add|love the work|功能建议|建议增加|是否愿意|能否添加)/i;
const clientRequestIntent=/(^|\s|\[)(?:hiring|hire|task|wanted)(?:\]|\s|:)|looking for|need (?:a|an|someone)|seeking (?:a|an|someone)|寻找|需要|招募|寻(?:开发|程序员|工程师)/i;
const workerAdvertisement=/(^|\s|\[)(?:for hire|offer)(?:\]|\s|:)|available for (?:work|projects)|i (?:will|can) (?:build|develop|deploy|fix)|接单|承接|可接项目/i;
const failedRewardIntent=/(?:cannot|can't|could not|failed to|unable to)\s+(?:create|fund|add)\s+(?:a\s+)?(?:reward|bounty)|needs? to be at least|minimum (?:reward|bounty)|赏金(?:创建|充值|付款)失败|最低赏金/i;
const sandboxRepositoryIntent=/(?:^|\b)(?:sandbox|fixture|test(?:ing)? repo(?:sitory)?|demo bounty|bounty[- ]?(?:test|sandbox)|automated .*bounty.*workflow)(?:\b|$)|测试(?:仓库|沙箱)|赏金流程测试/i;
const nonCashRewardIntent=/(?:^|\s)(?:\d+(?:\.\d+)?\s*)?(?:rtc|points?|credits?|tokens?|nft)(?:\s|$)|crypto(?:currency)? reward|earn crypto|加密(?:币|货币)|代币奖励/i;
const trustedFundingActor=/^(?:algora-pbc|opirebot|issuehunt)(?:\[bot\])?$/i;
const positiveFundingIntent=/(?:\$|US\$|USD\s*)\s*\d[\d,.]*\s*(?:bounty|reward)?|(?:bounty|reward)\s+(?:is\s+)?(?:live|funded|created|available)|backers?\s*\(total\s*:\s*\$\d/i;
const skillMap:Record<string,string[]>={React:["react","next.js","nextjs"],TypeScript:["typescript"," ts "],Python:["python","django","fastapi"],Rust:["rust","cargo"],Go:["golang"," go "],"Node.js":["node.js","nodejs"],API:[" api","接口","integration"],Automation:["automat","自动化","script","脚本"],Docker:["docker","container"],Kubernetes:["kubernetes","k8s"],AWS:[" aws ","lambda","ec2"],DevOps:["deploy","deployment","部署","运维","devops"],Security:["security","安全","vulnerability"],AI:[" ai ","llm","人工智能","大模型"]};

function decode(value=""){return value.replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));}
function clean(value=""){return decode(decode(value)).replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi,"\n").replace(/<li[^>]*>/gi,"• ").replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();}
function detailText(html:string){
  const withoutChrome=html.replace(/<(?:header|nav|footer|aside)\b[^>]*>[\s\S]*?<\/(?:header|nav|footer|aside)>/gi," ");
  const regions=[...withoutChrome.matchAll(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/gi)].map(x=>clean(x[1])).filter(x=>x.length>80);
  const descriptions=[...html.matchAll(/["'](?:description|content|requirement|detail)["']\s*:\s*["']((?:\\.|[^"']){80,})["']/gi)].map(x=>clean(x[1].replace(/\\n/g,"\n").replace(/\\["']/g,'"')));
  return [...regions,...descriptions].sort((a,b)=>b.length-a.length)[0]||clean(withoutChrome);
}
function skills(text:string){const value=` ${text.toLowerCase()} `;return Object.entries(skillMap).filter(([,terms])=>terms.some(term=>value.includes(term))).map(([name])=>name).slice(0,5);}
function budget(text:string){return text.match(/(?:US\$|\$|USD\s?)\d[\d,]*(?:\.\d+)?(?:\s?[-–—]\s?(?:US\$|\$|USD\s?)?\d[\d,]*(?:\.\d+)?)?(?:\s?(?:\/|per)\s?(?:h|hr|hour|day|week|project))?/i)?.[0]||text.match(/(?:¥|￥|RMB\s?)?\d[\d,.]*(?:\s?[-–—~至]\s?(?:¥|￥|RMB\s?)?\d[\d,.]*)?\s?(?:元|人民币|RMB)(?:\s*\/\s*(?:小时|天|项目))?/i)?.[0]||"预算面议";}
function category(text:string){if(/bug|fix|debug|repair|修复|排错|报错/i.test(text))return"Bug 修复";if(/deploy|deployment|devops|server|docker|kubernetes|部署|上线|服务器|运维/i.test(text))return"部署运维";if(/website|web app|landing|wordpress|网站|网页|官网|商城/i.test(text))return"网站开发";if(/api|integration|接口|对接/i.test(text))return"接口集成";if(/automat|script|爬虫|自动化|脚本/i.test(text))return"自动化";if(/小程序|app|ios|android|mobile/i.test(text))return"应用开发";return"软件开发";}
function deliverable(text:string){const sentences=text.split(/(?<=[。！？.!?])\s+/).filter(x=>projectIntent.test(x));return clean(sentences.slice(0,2).join(" ")).slice(0,240)||"按甲方原始需求完成明确的软件交付物";}
function valid(text:string){return text.length>=60&&projectIntent.test(text)&&paidIntent.test(text)&&!closedIntent.test(text);}
export function assessGitHubBounty(input:{item:any;comments?:any[];repository?:any}){
  const {item,comments=[],repository={}}=input;
  const text=`${item.title||""}\n${item.body||""}`;
  const commentText=comments.map(x=>String(x?.body||"")).join("\n");
  const repositoryText=`${repository.name||""}\n${repository.description||""}\n${(repository.topics||[]).join(" ")}`;
  const labels=(item.labels||[]).map((x:any)=>String(x?.name||x).toLowerCase());
  const bountyLabel=labels.some((x:string)=>/(^|[-_ ])(?:bounty|reward|paid)(?:$|[-_ ])/i.test(x));
  const explicitAmount=/(?:\/bounty|bounty|cash reward|reward of|paid task|paid issue)\s*[:#-]?\s*(?:US\$|\$|USD|€|£|¥|￥)\s*\d/i.test(text);
  const trustedFunding=comments.some(x=>trustedFundingActor.test(String(x?.user?.login||""))&&positiveFundingIntent.test(String(x?.body||""))&&!failedRewardIntent.test(String(x?.body||"")))
    ||/backers?\s*\(total\s*:\s*\$\d/i.test(text);
  const failedFunding=failedRewardIntent.test(commentText);
  const competingPullRequests=new Set(commentText.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/gi)||[]).size;
  const open=item.state==="open";
  const reason=!open?"github_issue_closed"
    :sandboxRepositoryIntent.test(repositoryText)?"sandbox_or_test_repository"
    :nonCashRewardIntent.test(`${text}\n${repositoryText}`)?"non_cash_reward"
    :failedFunding&&!trustedFunding?"reward_creation_failed"
    :competingPullRequests>=3?"high_duplicate_pr_competition"
    :!(bountyLabel||explicitAmount)||!solicitationIntent.test(text)||conversationalSuggestion.test(text)?"not_a_bounty"
    :!trustedFunding?"payment_not_verified"
    :"verified";
  return {eligible:reason==="verified",reason,competingPullRequests};
}
function project(input:{id:string;title:string;source:string;url:string;body:string;market:"国内"|"海外";date?:string;comments?:number;application:string}):PaidProject|null{const body=clean(input.body),all=`${input.title}\n${body}`;if(!valid(all))return null;const found=skills(all);return{id:input.id,title:clean(input.title),source:input.source,sourceUrl:input.url,publishedAt:input.date||"",budget:budget(all),skills:found,summary:body.slice(0,260),fullText:body.slice(0,60000),remote:"远程项目制",application:input.application,match:Math.min(97,62+found.length*6+(budget(all)!=="预算面议"?7:0)),competition:(input.comments||0)<8?"低":"中",opportunityType:"project",market:input.market,projectCategory:category(all),deliverable:deliverable(all)};}
async function get(url:string,accept="text/html"){const response=await fetch(url,{headers:{Accept:accept,"User-Agent":"Mozilla/5.0 RemoteGigDesk/1.0"},signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error(`${response.status} ${url}`);return response;}

async function githubJson(url:string){return (await get(url,"application/vnd.github+json")).json() as Promise<any>;}
async function verifyGitHubBounty(item:any){
  const [commentsResult,repositoryResult]=await Promise.allSettled([
    githubJson(item.comments_url||`${item.url}/comments?per_page=100`),
    githubJson(item.repository_url),
  ]);
  if(commentsResult.status!=="fulfilled"||repositoryResult.status!=="fulfilled")return null;
  const comments=Array.isArray(commentsResult.value)?commentsResult.value:[];
  const assessment=assessGitHubBounty({item,comments,repository:repositoryResult.value});
  return assessment.eligible?{item,assessment}:null;
}
export async function getGitHubPaidProjects(){const queries=["is:issue is:open no:assignee label:bounty","is:issue is:open no:assignee label:reward","is:issue is:open no:assignee in:title bounty"];
  const rows=await Promise.all(queries.map(async q=>{const data=await (await get(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=20`,"application/vnd.github+json")).json() as any;return data.items||[];}));
  const candidates=[...new Map(rows.flat().filter((x:any)=>!x.pull_request).map((x:any)=>[x.html_url,x])).values()].slice(0,24);
  const verified=await Promise.allSettled(candidates.map(verifyGitHubBounty));
  return verified.flatMap(result=>result.status==="fulfilled"&&result.value?[result.value]:[]).map(({item,assessment})=>project({id:`project-github-${item.id}`,title:item.title,source:"GitHub 托管赏金",url:item.html_url,body:`${item.body||""}\n\n付款核验：赏金平台机器人已确认资金。重复 PR：${assessment.competingPullRequests}。`,market:"海外",date:item.created_at,comments:item.comments,application:"先在原 Issue 按赏金平台规则领取；只在资金仍有效且竞争未显著增加时开始交付"})).filter(Boolean) as PaidProject[];}

export async function getRedditPaidProjects(){const subreddits=["forhire","jobbit","freelance_forhire"];
  const communities=[...subreddits,"DoneDirtCheap","hiring","hiredev","Programmers_forhire","webdevjobs","remotejs","GameDevClassifieds","INAT"];
  const read=(x:any,sub:string)=>{const all=`${x.title||""}\n${x.selftext||""}`;if(x.removed_by_category||x.archived||!clientRequestIntent.test(all)||workerAdvertisement.test(all))return null;return project({id:`project-reddit-${x.id}`,title:(x.title||"").replace(/^\s*\[?(?:hiring|hire|task|wanted)\]?\s*[-:]?\s*/i,""),source:`Reddit · r/${sub}`,url:`https://www.reddit.com${x.permalink}`,body:x.selftext||"",market:"海外",date:new Date(x.created_utc*1000).toISOString(),comments:x.num_comments,application:"按帖子指定的邮箱、私信或项目申请方式联系甲方"});};
  const settled=await Promise.allSettled(communities.map(async sub=>{const data=await (await get(`https://www.reddit.com/r/${sub}/new.json?limit=75&raw_json=1`,"application/json")).json() as any;return(data?.data?.children||[]).map((x:any)=>read(x.data,sub)).filter(Boolean) as PaidProject[];}));
  const verifiedIds=["1v1gve4"];
  const pinned=await Promise.allSettled(verifiedIds.map(async id=>{const data=await(await get(`https://www.reddit.com/comments/${id}.json?raw_json=1`,"application/json")).json() as any;const post=data?.[0]?.data?.children?.[0]?.data;return post?read(post,String(post.subreddit||"forhire")):null;}));
  return [...new Map([...settled.flatMap(x=>x.status==="fulfilled"?x.value:[]),...pinned.flatMap(x=>x.status==="fulfilled"&&x.value?[x.value]:[])].map(x=>[x.sourceUrl,x])).values()];}

function links(html:string,base:string,host:RegExp){const result:{url:string;title:string}[]=[];for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const url=new URL(match[1],base).toString(),title=clean(match[2]);if(host.test(url)&&title.length>4)result.push({url,title});}catch{}}return[...new Map(result.map(x=>[x.url,x])).values()];}
function embeddedLinks(html:string,base:string,path:RegExp){const result:{url:string;title:string}[]=[];const decoded=decode(html.replace(/\\u002F/g,"/").replace(/\\\//g,"/"));for(const match of decoded.matchAll(path)){try{const url=new URL(match[0],base).toString();result.push({url,title:"项目开发需求"});}catch{}}return result;}
async function hydrate(items:{url:string;title:string}[],source:string,market:"国内"|"海外",application:string){const settled=await Promise.allSettled(items.slice(0,16).map(async(x,index)=>{const html=await(await get(x.url)).text();return project({id:`project-${source}-${index}-${encodeURIComponent(x.url).slice(-18)}`,title:x.title,source,url:x.url,body:detailText(html),market,application});}));return settled.flatMap(x=>x.status==="fulfilled"&&x.value?[x.value]:[]);}

export async function getV2exProjects(){const data=await(await get("https://www.v2ex.com/api/topics/show.json?node_name=jobs","application/json")).json() as any[];return(data||[]).map(x=>project({id:`project-v2ex-${x.id}`,title:x.title,source:"V2EX · 酷工作",url:x.url,body:x.content_rendered||x.content||"",market:"国内",date:x.created?new Date(x.created*1000).toISOString():"",comments:x.replies,application:"打开 V2EX 原帖，按甲方留下的联系方式沟通项目范围与付款节点"})).filter(Boolean) as PaidProject[];}
export async function getEleduckProjects(){const bases=["https://eleduck.com/?category=5","https://eleduck.com/?category=5&tags=10"];const pages=await Promise.allSettled(bases.map(async base=>({base,html:await(await get(base)).text()})));const selected=pages.flatMap(x=>x.status==="fulfilled"?[...links(x.value.html,x.value.base,/eleduck\.com\/posts\//i),...embeddedLinks(x.value.html,x.value.base,/(?:https:\/\/eleduck\.com)?\/posts\/[A-Za-z0-9_-]+/g)]:[]);return hydrate([...new Map(selected.map(x=>[x.url,x])).values()],"电鸭 · 项目外包","国内","打开电鸭原帖，按帖子说明联系甲方并确认项目仍开放");}
export async function getZbjProjects(){const bases=["https://m.zbj.com/xq/website/","https://m.zbj.com/xq/ruanjian/","https://www.zbj.com/xq/"];const pages=await Promise.allSettled(bases.map(async base=>({base,html:await(await get(base)).text()})));const found=pages.flatMap(x=>x.status==="fulfilled"?[...links(x.value.html,x.value.base,/m?\.zbj\.com\/xq\//i),...embeddedLinks(x.value.html,x.value.base,/(?:https:\/\/(?:m\.)?zbj\.com)?\/xq\/[A-Za-z0-9_-]+\.html/g)]:[]);return hydrate([...new Map(found.map(x=>[x.url,x])).values()],"猪八戒 · 需求大厅","国内","打开需求页，登录平台后参与报价并使用平台担保交易");}
export async function getProginnProjects(){const base="https://job.proginn.com/";const html=await(await get(base)).text();const found=[...links(html,base,/job\.proginn\.com\/(?:job\/detail|d)\//i),...embeddedLinks(html,base,/(?:https:\/\/job\.proginn\.com)?\/(?:job\/detail|d)\/[A-Za-z0-9_-]+/g)];return hydrate([...new Map(found.map(x=>[x.url,x])).values()],"程序员客栈 · 项目研发","国内","打开程序员客栈项目页，登录后申请并先确认范围、验收和结算节点");}
export async function getEpwkProjects(){const base="https://task.epwk.com/";const html=await(await get(base)).text();const found=[...links(html,base,/task\.epwk\.com\/(?!$|index(?:\.html)?$)/i),...embeddedLinks(html,base,/(?:https:\/\/task\.epwk\.com)?\/[A-Za-z0-9_/-]+\/\d+\.html/g)];return hydrate([...new Map(found.map(x=>[x.url,x])).values()],"一品威客 · 任务大厅","国内","打开一品威客任务详情，使用平台投标并确认托管赏金和验收条件");}
async function socialProjectPages(bases:string[],postPattern:RegExp,source:string){const pages=await Promise.allSettled(bases.map(async base=>({base,html:await(await get(base)).text()})));const found=pages.flatMap(x=>x.status==="fulfilled"?links(x.value.html,x.value.base,postPattern):[]);const unique=[...new Map(found.map(x=>[x.url,x])).values()];const hydrated=await hydrate(unique,source,"海外","打开社交平台原帖，核验发布者身份后按原帖方式联系；不要预付费用或发送验证码");return hydrated.filter(item=>clientRequestIntent.test(`${item.title}\n${item.fullText}`)&&!workerAdvertisement.test(`${item.title}\n${item.fullText}`));}
export async function getThreadsProjects(){return socialProjectPages(["https://www.threads.net/tag/frontend","https://www.threads.net/tag/web-developer"],/threads\.net\/@[^/]+\/post\//i,"Threads · 公开项目帖");}
export async function getXProjects(){return socialProjectPages(["https://x.com/search?q=%22paid%20project%22%20%22web%20developer%22&src=typed_query&f=live","https://x.com/search?q=%22looking%20for%22%20%22freelance%20developer%22&src=typed_query&f=live"],/x\.com\/[^/]+\/status\/\d+/i,"X · 公开项目帖");}

export async function collectPaidProjects(){const results=await Promise.allSettled([getGitHubPaidProjects(),getRedditPaidProjects(),getV2exProjects(),getEleduckProjects(),getZbjProjects(),getEpwkProjects(),getThreadsProjects(),getXProjects()]);const names=["GitHub 付费 Issue","Reddit 项目委托","V2EX 项目需求","电鸭项目外包","猪八戒需求大厅","一品威客任务大厅","Threads 公开项目帖","X 公开项目帖"];return{projects:[...new Map(results.flatMap(x=>x.status==="fulfilled"?x.value:[]).map(x=>[x.sourceUrl,x])).values()].sort((a,b)=>b.match-a.match),sources:results.map((x,i)=>({name:names[i],ok:x.status==="fulfilled"&&x.value.length>0,count:x.status==="fulfilled"?x.value.length:0}))};}
