import { createHash, randomBytes, randomUUID } from "crypto";
import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { browserExecutionContract } from "../../../lib/ats-adapter";

const channels=[
  {id:"github",name:"GitHub Issues / Bounties",mode:"direct",capability:"授权后可通过官方 API 发布申请评论",status:"authorization_required"},
  {id:"gmail",name:"Gmail",mode:"direct",capability:"授权后可发送邮件申请并读取回复",status:"authorization_required"},
  {id:"hackernews",name:"Hacker News",mode:"browser",capability:"复用浏览器会话，并把最终申请入口交给浏览器执行器",status:"browser_agent_required"},
  {id:"greenhouse",name:"Greenhouse",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"lever",name:"Lever",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"ashby",name:"Ashby",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"workable",name:"Workable",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"custom",name:"公司自建表单",mode:"browser",capability:"逐域名分析；验证码或身份验证需要人工处理",status:"manual_checkpoint"},
];

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();
  const sql=db();
  const [rows,sessions]=await Promise.all([
    sql`SELECT provider,status,account_label AS "accountLabel",scopes,updated_at AS "updatedAt" FROM channel_connections WHERE owner_email=${user.email}`,
    sql`SELECT platform_key AS "platformKey",status,account_label AS "accountLabel",auth_method AS "authMethod",site_url AS "siteUrl",verified_at AS "verifiedAt",last_checked_at AS "lastCheckedAt",expires_at AS "expiresAt",updated_at AS "updatedAt" FROM platform_sessions WHERE owner_email=${user.email} ORDER BY updated_at DESC`
  ]);
  const saved=new Map(rows.map((x:any)=>[x.provider,x]));
  const resolvedChannels=channels.map(channel=>({...channel,...(saved.get(channel.id)??{})}));
  const names=new Map(channels.map(channel=>[channel.id,channel.name]));
  const authenticated=new Map<string,any>();
  for(const channel of resolvedChannels){
    if(channel.status==="connected")authenticated.set(channel.id,{
      platformKey:channel.id,name:channel.name,status:"connected",sessionType:"oauth",
      accountLabel:channel.accountLabel||user.email,lastCheckedAt:channel.updatedAt,updatedAt:channel.updatedAt,
      note:"OAuth 授权可持续复用，除非授权被撤销或令牌失效。"
    });
  }
  for(const session of sessions as any[]){
    const expired=Boolean(session.expiresAt&&Number(session.expiresAt)<=Date.now());
    const item={
      ...session,name:names.get(session.platformKey)||session.platformKey,
      status:expired?"expired":session.status,sessionType:session.authMethod||"browser_session",
      note:expired?"登录会话已到复查时间；下次投递前需要重新验证。":"浏览器登录会被同平台任务复用；网站退出、撤销或 Cookie 过期后需重新登录一次。"
    };
    const existing=authenticated.get(session.platformKey);
    if(!existing||existing.status!=="connected")authenticated.set(session.platformKey,item);
  }
  const agents=await sql`SELECT id,name,status,last_seen_at AS "lastSeenAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM browser_agents WHERE owner_email=${user.email} ORDER BY updated_at DESC`;
  const browserAgents=(agents as any[]).map(agent=>({...agent,status:agent.lastSeenAt&&Date.now()-Number(agent.lastSeenAt)<120000?"online":"offline"}));
  return Response.json({owner:user.email,channels:resolvedChannels,sessions,authenticatedSites:[...authenticated.values()],browserAgents});
}


const agentCors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
function tokenHash(token:string){return createHash("sha256").update(token).digest("hex");}

export async function POST(request:Request){
  await ensureDatabase();
  const sql=db();
  const body=await request.json().catch(()=>({}));
  const auth=request.headers.get("authorization")||"";
  if(auth.startsWith("Bearer ")){
    const token=auth.slice(7).trim();
    const rows=await sql`SELECT id,owner_email AS "ownerEmail" FROM browser_agents WHERE token_hash=${tokenHash(token)} LIMIT 1`;
    const agent=rows[0] as any;
    if(!agent)return Response.json({error:"invalid_agent_token"},{status:401,headers:agentCors});
    const now=Date.now();
    await sql`UPDATE browser_agents SET status=${"online"},last_seen_at=${now},updated_at=${now} WHERE id=${agent.id}`;
    if(body.action==="record_session"){
      const platformKey=String(body.platformKey||"").toLowerCase().replace(/[^a-z0-9_-]/g,"");
      if(!platformKey)return Response.json({error:"platform_required"},{status:400});
      await sql`INSERT INTO platform_sessions(id,owner_email,platform_key,status,verified_at,updated_at,account_label,auth_method,site_url,last_checked_at)
        VALUES(${randomUUID()},${agent.ownerEmail},${platformKey},${"verified"},${now},${now},${String(body.accountLabel||"")},${"browser_extension"},${String(body.siteUrl||"")},${now})
        ON CONFLICT(owner_email,platform_key) DO UPDATE SET status=${"verified"},verified_at=${now},updated_at=${now},account_label=${String(body.accountLabel||"")},auth_method=${"browser_extension"},site_url=${String(body.siteUrl||"")},last_checked_at=${now}`;
      await sql`UPDATE applications SET status=${"queued_for_browser"},delivery_state=${"session_reused"},last_error=${""},updated_at=${now} WHERE owner_email=${agent.ownerEmail} AND platform_key=${platformKey} AND status=${"verification_required"}`;
    }
    const taskRows=await sql`SELECT id,title,source_url AS "sourceUrl",application_url AS "applicationUrl",destination,platform_key AS "platformKey",status,application_letter AS "applicationLetter",proposed_rate AS "proposedRate" FROM applications WHERE owner_email=${agent.ownerEmail} AND status=${"queued_for_browser"} ORDER BY created_at ASC LIMIT 20`;
    const tasks=(taskRows as any[]).map(task=>({...task,execution:browserExecutionContract(task.applicationUrl||task.destination)}));
    return Response.json({ok:true,agentId:agent.id,heartbeatAt:now,tasks},{headers:agentCors});
  }
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  if(body.action!=="create_browser_agent")return Response.json({error:"unsupported_action"},{status:400});
  const token=randomBytes(32).toString("base64url");
  const id=randomUUID(); const now=Date.now();
  await sql`INSERT INTO browser_agents(id,owner_email,name,token_hash,status,created_at,updated_at)
    VALUES(${id},${user.email},${String(body.name||"我的 Chrome")},${tokenHash(token)},${"waiting"},${now},${now})`;
  return Response.json({id,token,name:String(body.name||"我的 Chrome"),status:"waiting"});
}

export async function OPTIONS(){
  return new Response(null,{status:204,headers:agentCors});
}
