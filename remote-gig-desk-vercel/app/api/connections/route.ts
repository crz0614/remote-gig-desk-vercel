import { createHash, randomBytes, randomUUID } from "crypto";
import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { browserExecutionContract } from "../../../lib/ats-adapter";
import { browserTaskState } from "../../../lib/browser-task-state";
import { applicantProfileForForms } from "../../../lib/applicant-profile";
import { unseal } from "../../../lib/secret-store";
import { validateSubmissionEvidence } from "../../../lib/submission-evidence";

const channels=[
  {id:"github",name:"GitHub Issues / Bounties",mode:"direct",capability:"授权后可通过官方 API 发布申请评论",status:"authorization_required"},
  {id:"gmail",name:"Gmail",mode:"direct",capability:"授权后可发送邮件申请并读取回复",status:"authorization_required"},
  {id:"hackernews",name:"Hacker News",mode:"browser",capability:"复用浏览器会话，并把最终申请入口交给浏览器执行器",status:"browser_agent_required"},
  {id:"greenhouse",name:"Greenhouse",mode:"ats",capability:"浏览器适配器可识别、填写并核验 Greenhouse 正式回执",status:"browser_agent_required"},
  {id:"lever",name:"Lever",mode:"ats",capability:"浏览器适配器可识别、填写并核验 Lever 正式回执",status:"browser_agent_required"},
  {id:"ashby",name:"Ashby",mode:"ats",capability:"浏览器适配器可识别、填写并核验 Ashby 正式回执",status:"browser_agent_required"},
  {id:"workable",name:"Workable",mode:"ats",capability:"浏览器适配器可识别、填写并核验 Workable 正式回执",status:"browser_agent_required"},
  {id:"proginn",name:"程序员客栈",mode:"browser",capability:"复用已登录会话，填写申请并保存平台提交回执",status:"browser_agent_required"},
  {id:"custom",name:"公司自建表单",mode:"browser",capability:"逐域名分析；验证码或身份验证需要人工处理",status:"manual_checkpoint"},
];
const currentBrowserAgentVersion="0.6.0";

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();
  const sql=db();
  const [rows,sessions,queues]=await Promise.all([
    sql`SELECT provider,status,account_label AS "accountLabel",scopes,updated_at AS "updatedAt" FROM channel_connections WHERE owner_email=${user.email}`,
    sql`SELECT platform_key AS "platformKey",status,account_label AS "accountLabel",auth_method AS "authMethod",site_url AS "siteUrl",verified_at AS "verifiedAt",last_checked_at AS "lastCheckedAt",expires_at AS "expiresAt",updated_at AS "updatedAt" FROM platform_sessions WHERE owner_email=${user.email} ORDER BY updated_at DESC`,
    sql`SELECT platform_key AS "platformKey",count(*)::int AS "queuedCount",count(*) FILTER (WHERE status=${"verification_required"})::int AS "verificationCount" FROM applications WHERE owner_email=${user.email} AND status IN (${"queued_for_browser"},${"browser_in_progress"},${"verification_required"},${"form_ready"}) GROUP BY platform_key`
  ]);
  const queueByPlatform=new Map((queues as any[]).map(queue=>[queue.platformKey,queue]));
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
    const queue=queueByPlatform.get(session.platformKey)||{queuedCount:0,verificationCount:0};
    const item={
      ...session,name:names.get(session.platformKey)||session.platformKey,
      status:expired?"expired":session.status,sessionType:session.authMethod||"browser_session",
      actualDomain:(()=>{try{return new URL(session.siteUrl).hostname}catch{return ""}})(),
      queuedCount:queue.queuedCount,verificationCount:queue.verificationCount,
      note:expired?"登录会话已到复查时间；下次投递前需要重新验证。":"浏览器登录会被同平台任务复用；网站退出、撤销或 Cookie 过期后需重新登录一次。"
    };
    const existing=authenticated.get(session.platformKey);
    if(!existing||existing.status!=="connected")authenticated.set(session.platformKey,item);
  }
  const agents=await sql`SELECT id,name,status,version,last_seen_at AS "lastSeenAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM browser_agents WHERE owner_email=${user.email} ORDER BY updated_at DESC`;
  const browserAgents=(agents as any[]).map(agent=>({...agent,status:agent.lastSeenAt&&Date.now()-Number(agent.lastSeenAt)<120000?"online":"offline",updateRequired:agent.version!==currentBrowserAgentVersion}));
  return Response.json({owner:user.email,channels:resolvedChannels,sessions,authenticatedSites:[...authenticated.values()],browserAgents,currentBrowserAgentVersion});
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
    console.info("browser_agent_event",{action:String(body.action||""),agentVersion:String(body.agentVersion||""),hasTask:Boolean(body.taskId),error:String(body.error||body.reason||"").slice(0,160)});
    await sql`UPDATE browser_agents SET status=${"online"},version=${String(body.agentVersion||"").slice(0,32)},last_seen_at=${now},updated_at=${now} WHERE id=${agent.id}`;
    if(["task_started","form_inspected","verification_required","task_submitted","task_failed"].includes(String(body.action))){
      const taskId=String(body.taskId||"");
      const applications=await sql`SELECT id,status,platform_key AS "platformKey",application_url AS "applicationUrl",lease_owner AS "leaseOwner" FROM applications WHERE id=${taskId} AND owner_email=${agent.ownerEmail} LIMIT 1`;
      const application=applications[0] as any;
      if(!application)return Response.json({error:"task_not_found"},{status:404,headers:agentCors});
      if(application.leaseOwner&&application.leaseOwner!==agent.id)return Response.json({error:"task_lease_mismatch"},{status:409,headers:agentCors});
      const action=String(body.action);
      let evidenceUrl=String(body.evidenceUrl||"");
      let evidenceId=String(body.evidenceId||"");
      let verifiedEvidence:ReturnType<typeof validateSubmissionEvidence>|null=null;
      if(action==="task_submitted"){
        try{verifiedEvidence=validateSubmissionEvidence(body,application.applicationUrl);evidenceUrl=verifiedEvidence.evidenceUrl;evidenceId=verifiedEvidence.evidenceId;}
        catch(cause){return Response.json({error:cause instanceof Error?cause.message:"invalid_submission_evidence"},{status:400,headers:agentCors});}
      }
      let next;
      try{next=browserTaskState(action,body);}catch(cause){return Response.json({error:cause instanceof Error?cause.message:"invalid_task_state"},{status:400,headers:agentCors});}
      const {status,deliveryState,message,error}=next;
      const deliveredAt:null|number=next.delivered?now:null;
      if(action==="verification_required"){
        await sql`INSERT INTO platform_sessions(id,owner_email,platform_key,status,updated_at) VALUES(${randomUUID()},${agent.ownerEmail},${application.platformKey},${"verification_required"},${now}) ON CONFLICT(owner_email,platform_key) DO UPDATE SET status=${"verification_required"},updated_at=${now}`;
      }
      const terminal=["form_inspected","verification_required","task_submitted","task_failed"].includes(action);
      await sql`UPDATE applications SET status=${status},delivery_state=${deliveryState},last_error=${error},receipt_id=${evidenceId},receipt_url=${evidenceUrl},delivered_at=${deliveredAt},lease_owner=${terminal?null:agent.id},lease_expires_at=${terminal?null:now+120000},evidence=${JSON.stringify(verifiedEvidence?{...verifiedEvidence,reportedBy:agent.id,reportedAt:now}:{url:evidenceUrl||null,id:evidenceId||null,reportedBy:agent.id,reportedAt:now})}::jsonb,updated_at=${now} WHERE id=${taskId} AND owner_email=${agent.ownerEmail}`;
      await sql`INSERT INTO application_events(id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES(${randomUUID()},${agent.ownerEmail},${taskId},${action.toUpperCase()},${status},${message},${evidenceId},${evidenceUrl},${now})`;
      return Response.json({ok:true,taskId,status,deliveryState},{headers:agentCors});
    }
    if(body.action==="record_session"){
      const platformKey=String(body.platformKey||"").toLowerCase().replace(/[^a-z0-9_-]/g,"");
      if(!platformKey)return Response.json({error:"platform_required"},{status:400});
      await sql`INSERT INTO platform_sessions(id,owner_email,platform_key,status,verified_at,updated_at,account_label,auth_method,site_url,last_checked_at)
        VALUES(${randomUUID()},${agent.ownerEmail},${platformKey},${"verified"},${now},${now},${String(body.accountLabel||"")},${"browser_extension"},${String(body.siteUrl||"")},${now})
        ON CONFLICT(owner_email,platform_key) DO UPDATE SET status=${"verified"},verified_at=${now},updated_at=${now},account_label=${String(body.accountLabel||"")},auth_method=${"browser_extension"},site_url=${String(body.siteUrl||"")},last_checked_at=${now}`;
      await sql`UPDATE applications SET status=${"queued_for_browser"},delivery_state=${"session_reused"},last_error=${""},updated_at=${now} WHERE owner_email=${agent.ownerEmail} AND platform_key=${platformKey} AND status=${"verification_required"}`;
      if(body.suppressTaskLease)return Response.json({ok:true,platformKey,status:"verified"},{headers:agentCors});
    }
    const leaseUntil=now+120000;
    const taskRows=await sql`UPDATE applications SET lease_owner=${agent.id},lease_expires_at=${leaseUntil},attempt_count=attempt_count+1,updated_at=${now} WHERE id=(SELECT id FROM applications WHERE owner_email=${agent.ownerEmail} AND (status=${"queued_for_browser"} OR (status IN (${"verification_required"},${"submission_failed"}) AND platform_key=${"proginn"} AND attempt_count<5)) AND (lease_owner IS NULL OR lease_expires_at<${now}) ORDER BY created_at ASC LIMIT 1) RETURNING id,title,source_url AS "sourceUrl",application_url AS "applicationUrl",destination,platform_key AS "platformKey",status,application_letter AS "applicationLetter",proposed_rate AS "proposedRate",attempt_count AS "attemptCount",materials`;
    const [profiles,portfolio]=await Promise.all([
      sql`SELECT profile_ciphertext AS "profileCiphertext" FROM private_profiles WHERE owner_email=${agent.ownerEmail} LIMIT 1`,
      sql`SELECT link FROM portfolio_items WHERE owner_email=${agent.ownerEmail} AND link<>${""} ORDER BY position ASC,updated_at DESC LIMIT 10`
    ]);
    let privateProfile:unknown={};
    try{if((profiles[0] as any)?.profileCiphertext)privateProfile=JSON.parse(await unseal(String((profiles[0] as any).profileCiphertext)));}catch{}
    const applicantProfile=applicantProfileForForms(privateProfile,(portfolio as any[]).map(item=>String(item.link)),agent.ownerEmail);
    const tasks=(taskRows as any[]).map(task=>({...task,attachments:Array.isArray(task.materials?.attachments)?task.materials.attachments.map((item:any)=>({...item,url:`https://remote-gig-desk-vercel.vercel.app/api/attachments?id=${encodeURIComponent(item.id)}`})):[],applicantProfile,execution:browserExecutionContract(task.applicationUrl||task.destination)}));
    console.info("browser_agent_queue",{taskCount:tasks.length,platforms:tasks.map(task=>task.platformKey)});
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
