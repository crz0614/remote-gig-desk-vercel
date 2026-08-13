import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { getGoogleToken } from "../../../lib/google";
import { applicationStateForSession, detectFinalApplicationUrl, platformKeyForUrl } from "../../../lib/application-url";
import { githubDeliveryRequirement, isTechnicalGitHubComment } from "../../../lib/github-delivery";
import { buildResumeDocx } from "../../../lib/resume-docx";
import { after } from "next/server";
import { assessCompensation, requiresPaidDeliveryGate } from "../../../lib/compensation";

export const maxDuration=300;

function platformKey(source:string){return source.toLowerCase().replace(/[^a-z0-9]+/g,"")||"unknown";}

function deliveryFor(source:string){
  if(/GitHub/i.test(source))return "github";
  if(/Hacker News/i.test(source))return "hackernews";
  return "destination_detection";
}

function githubIssue(url:string){
  const match=url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
  return match?{owner:match[1],repo:match[2],issue:match[3]}:null;
}

function applicationEmail(body:any){
  const text=[body?.gig?.application,body?.gig?.fullText,body?.gig?.summary].filter(Boolean).join("\n");
  const emails=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[];
  return emails.find((email:string)=>!/(no-?reply|noreply|example\.com)/i.test(email)&&email.toLowerCase()!==String(body?.ownerEmail||"").toLowerCase())||null;
}

function safeHeader(value:string){return value.replace(/[\r\n]+/g," ").trim();}
function base64Url(value:string){return Buffer.from(value,"utf8").toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}

async function sendGmail(ownerEmail:string,to:string,subject:string,letter:string){
  const token=await getGoogleToken(ownerEmail);
  const raw=base64Url([
    "From: "+safeHeader(ownerEmail),
    "To: "+safeHeader(to),
    "Subject: "+safeHeader(subject),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    letter,
  ].join("\r\n"));
  const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({raw}),
    cache:"no-store",
  });
  const result=await response.json().catch(()=>({})) as {id?:string;threadId?:string};
  if(!response.ok)throw new Error("gmail_send_"+response.status);
  return result;
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();
  const sql=db();

  // Repair legacy tasks that were incorrectly marked reusable by the old manual-confirmation flow.
  await sql`UPDATE applications SET platform_key=CASE
    WHEN source_url ILIKE ${"%reddit.com%"} THEN ${"reddit"}
    WHEN source_url ILIKE ${"%news.ycombinator.com%"} THEN ${"hackernews"}
    WHEN source_url ILIKE ${"%x.com%"} OR source_url ILIKE ${"%twitter.com%"} THEN ${"x"}
    WHEN source_url ILIKE ${"%threads.net%"} THEN ${"threads"}
    WHEN source_url ILIKE ${"%proginn.com%"} THEN ${"proginn"}
    ELSE platform_key END
    WHERE owner_email=${user.email} AND platform_key=${"unknown"}`;
  await sql`UPDATE applications SET status=${"verification_required"},delivery_state=${"verification_required"},last_error=${"需要在真实平台完成登录或验证"},updated_at=${Date.now()}
    WHERE owner_email=${user.email} AND delivery_state=${"session_reused"} AND COALESCE(receipt_id,${""})=${""}
      AND platform_key IN (${"unknown"},${"reddit"},${"hackernews"},${"x"},${"threads"},${"proginn"})`;
  await sql`UPDATE platform_sessions SET status=${"verification_required"},verified_at=NULL,updated_at=${Date.now()}
    WHERE owner_email=${user.email} AND platform_key=${"unknown"} AND status=${"verified"}`;

  const rows=await sql`SELECT id,gig_id AS "gigId",title,source,source_url AS "sourceUrl",application_url AS "applicationUrl",status,delivery_channel AS "deliveryChannel",proposed_rate AS "proposedRate",destination,last_error AS "lastError",platform_key AS "platformKey",delivery_state AS "deliveryState",receipt_id AS "receiptId",receipt_url AS "receiptUrl",delivered_at AS "deliveredAt",materials,created_at AS "createdAt",updated_at AS "updatedAt" FROM applications WHERE owner_email=${user.email} ORDER BY updated_at DESC LIMIT 100`;
  const events=await sql`SELECT id,application_id AS "applicationId",event_type AS "eventType",status,message,evidence_id AS "evidenceId",evidence_url AS "evidenceUrl",created_at AS "createdAt" FROM application_events WHERE owner_email=${user.email} ORDER BY created_at ASC`;
  const replies=await sql`SELECT id,application_id AS "applicationId",subject,status,tone,summary,translation,next_action AS "next",gmail_url AS "gmailUrl",received_at AS "receivedAt" FROM email_replies WHERE owner_email=${user.email} AND application_id IS NOT NULL ORDER BY received_at DESC`;
  const byApplication=new Map<string,any[]>();
  for(const event of events as any[]){const list=byApplication.get(event.applicationId)||[];list.push(event);byApplication.set(event.applicationId,list);}
  const repliesByApplication=new Map<string,any[]>();
  for(const reply of replies as any[]){const list=repliesByApplication.get(reply.applicationId)||[];list.push(reply);repliesByApplication.set(reply.applicationId,list);}
  return Response.json({applications:(rows as any[]).map(row=>({...row,events:byApplication.get(row.id)||[],replies:repliesByApplication.get(row.id)||[]}))});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const body=await request.json().catch(()=>null) as any;
  if(!body?.gig?.id||!body?.gig?.sourceUrl||!body?.coverLetter)return Response.json({error:"invalid_application"},{status:400});
  await ensureDatabase();
  const id=crypto.randomUUID();
  const now=Date.now();
  let channel=deliveryFor(body.gig.source||"");
  const sql=db();

  const existing=await sql`SELECT id,status,delivery_channel AS "deliveryChannel",receipt_id AS "receiptId",receipt_url AS "receiptUrl",created_at AS "createdAt" FROM applications WHERE owner_email=${user.email} AND gig_id=${body.gig.id} ORDER BY created_at DESC LIMIT 1`;
  if(existing.length){
    const row=existing[0] as any;
    return Response.json({id:row.id,status:row.status,deliveryChannel:row.deliveryChannel,receiptId:row.receiptId||undefined,receiptUrl:row.receiptUrl||undefined,createdAt:row.createdAt,duplicate:true});
  }

  const requestedAttachmentIds=Array.isArray(body.attachmentIds)?body.attachmentIds.map(String).slice(0,5):[];
  if(!requestedAttachmentIds.length){
    const profiles=await sql`SELECT profile_ciphertext AS "profileCiphertext" FROM private_profiles WHERE owner_email=${user.email} LIMIT 1`;
    if((profiles[0] as any)?.profileCiphertext){
      try{
        const profile=JSON.parse(await unseal(String((profiles[0] as any).profileCiphertext))) as Record<string,unknown>;
        const content=await buildResumeDocx(profile),attachmentId=crypto.randomUUID();
        await sql`INSERT INTO application_attachments(id,owner_email,filename,content_type,content,size,created_at) VALUES(${attachmentId},${user.email},${"Ruozhu-Chen-Resume.docx"},${"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},${content},${content.length},${now})`;
        requestedAttachmentIds.push(attachmentId);
      }catch(error){console.error("automatic_resume_generation_failed",error);}
    }
  }
  const attachmentRows=requestedAttachmentIds.length?await sql`SELECT id,filename AS name,content_type AS type,size FROM application_attachments WHERE owner_email=${user.email} AND id=ANY(${requestedAttachmentIds})`:[];
  if(attachmentRows.length!==requestedAttachmentIds.length)return Response.json({error:"attachment_not_found"},{status:400});

  const finalApplicationUrl=detectFinalApplicationUrl([body.gig.applicationUrl,body.gig.application,body.gig.fullText,body.gig.summary],body.gig.sourceUrl);
  let status=channel==="github"?"awaiting_github_authorization":"detecting_destination";
  let deliveryError="";
  let destination=finalApplicationUrl||"";
  const platform=platformKeyForUrl(finalApplicationUrl||body.gig.sourceUrl,platformKey(body.gig.source||""));
  let deliveryState="queued";
  let receiptId="";
  let receiptUrl="";
  let deliveredAt:number|null=null;
  const githubTarget=channel==="github"?githubIssue(body.gig.sourceUrl):null;
  const githubRequirement=channel==="github"
    ? githubDeliveryRequirement([body.gig.title,body.gig.application,body.gig.fullText,body.gig.summary].filter(Boolean).join("\n"))
    : null;
  const compensation=assessCompensation(body.gig);
  const materials=JSON.stringify({
    version:1,
    language:String(body.language||""),
    proposedRate:String(body.quote||""),
    matchedSkills:Array.isArray(body.matchedSkills)?body.matchedSkills.map(String).slice(0,20):[],
    resumeHighlights:Array.isArray(body.resume)?body.resume.map(String).slice(0,20):[],
    coverLetter:String(body.coverLetter||""),
    workMode:String(body.workMode||""),
    portfolioUrls:Array.isArray(body.portfolioUrls)?body.portfolioUrls.map(String).filter((value:string)=>/^https?:\/\//.test(value)).slice(0,10):[],
    attachments:(attachmentRows as any[]).map(item=>({id:item.id,name:item.name,type:item.type,size:item.size})),
    githubDelivery:githubRequirement?{
      strategy:String(body.strategy||""),
      requirement:githubRequirement.kind,
      requiredPaths:githubRequirement.requiredPaths,
      repository:githubTarget?`${githubTarget.owner}/${githubTarget.repo}`:"",
      issueNumber:githubTarget?Number(githubTarget.issue):null,
      issueUrl:String(body.gig.sourceUrl||""),
    }:undefined,
    compensation,
    generatedAt:now,
  });

  if(channel!=="github"){
    const sessions=await sql`SELECT status,expires_at AS "expiresAt" FROM platform_sessions WHERE owner_email=${user.email} AND platform_key=${platform} LIMIT 1`;
    const session=sessions[0] as any;
    const next=applicationStateForSession(session,now);
    status=next.status;
    deliveryState=next.deliveryState;
  }

  if(channel==="github"){
    const target=githubTarget;
    destination=target?body.gig.sourceUrl:destination;
    const requirement=githubRequirement!;
    if(requiresPaidDeliveryGate(body.strategy,compensation)){
      status="compensation_confirmation_required";
      deliveryState="payment_unconfirmed";
      deliveryError=compensation.state==="unpaid"?"原文明确为无偿贡献；系统不会自动投入交付":"付款金额或承诺尚未确认；确认付费后才能开始真实 PR 交付";
    }else if(requirement.kind==="proposal_comment"&&body.strategy==="github_comment"&&isTechnicalGitHubComment(body.coverLetter)){
      const connections=await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
      const tokenCiphertext=(connections[0] as any)?.tokenCiphertext as string|undefined;
      if(target&&tokenCiphertext){
        try{
          const token=await unseal(tokenCiphertext);
          const response=await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}/issues/${target.issue}/comments`,{method:"POST",headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},body:JSON.stringify({body:body.coverLetter}),cache:"no-store"});
          const result=await response.json().catch(()=>({})) as {id?:number;html_url?:string};
          if(!response.ok)throw new Error(`github_${response.status}`);
          status="proposal_sent";deliveryState="github_proposal_sent";receiptId=String(result.id||"");receiptUrl=result.html_url||"";deliveredAt=Date.now();
        }catch(error){status="submission_failed";deliveryError=error instanceof Error?error.message:"github_failed";}
      }else{status="awaiting_github_authorization";deliveryState="github_proposal_ready";deliveryError="github_authorization_required";}
    }else{
      status="deliverable_required";
      deliveryState="github_pr_required";
      deliveryError=requirement.requiredPaths.length?`必须先完成 ${requirement.requiredPaths.join(", ")} 并创建 Pull Request；禁止发送通用求职信`:"必须先按 Issue 要求完成代码或文档并创建 Pull Request；禁止发送通用求职信";
    }
  }else if(channel==="destination_detection"){
    const email=applicationEmail({...body,ownerEmail:user.email});
    if(email){
      channel="gmail";
      destination=email;
      try{
        const result=await sendGmail(user.email,email,"Application: "+body.gig.title,body.coverLetter);
        status="submitted";deliveryState="platform_accepted";receiptId=result.id||"";receiptUrl=result.id?`https://mail.google.com/mail/u/0/#sent/${result.id}`:"";deliveredAt=Date.now();
      }catch(error){
        status="submission_failed";
        deliveryError=error instanceof Error?error.message:"gmail_failed";
      }
    }
  }

  await sql.transaction([
    sql`INSERT INTO applications (id,owner_email,gig_id,source,source_url,application_url,title,language,proposed_rate,application_letter,status,delivery_channel,destination,last_error,platform_key,delivery_state,receipt_id,receipt_url,delivered_at,materials,created_at,updated_at) VALUES (${id},${user.email},${body.gig.id},${body.gig.source},${body.gig.sourceUrl},${finalApplicationUrl},${body.gig.title},${body.language},${body.quote},${body.coverLetter},${status},${channel},${destination},${deliveryError},${platform},${deliveryState},${receiptId},${receiptUrl},${deliveredAt},${materials}::jsonb,${now},${now})`,
    sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES (${crypto.randomUUID()},${user.email},${id},${deliveryState==="payment_unconfirmed"?"COMPENSATION_CONFIRMATION_REQUIRED":deliveryState==="github_pr_required"?"GITHUB_DELIVERABLE_REQUIRED":deliveryState==="github_proposal_sent"?"GITHUB_PROPOSAL_SENT":deliveryState==="session_reused"?"SESSION_REUSED":deliveryState==="verification_required"?"VERIFICATION_REQUIRED":"QUEUED"},${status},${deliveryState==="payment_unconfirmed"?deliveryError:deliveryState==="github_pr_required"?deliveryError:deliveryState==="github_proposal_sent"?"GitHub 已返回评论回执":deliveryState==="platform_accepted"?"平台接口已确认接收申请":deliveryState==="session_reused"?"已复用平台会话，任务进入浏览器执行队列":deliveryState==="verification_required"?"平台队列等待一次登录或验证":deliveryError?"投递失败："+deliveryError:"任务已建立，等待下一步"},${receiptId},${receiptUrl},${now})`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_processed"},${id},${deliveryError||status},${now})`,
  ]);
  if(status==="queued_for_browser"&&["greenhouse","lever","ashby","workable"].includes(platform)){
    const authorization=request.headers.get("authorization")||"";
    const executorUrl=new URL("/api/cloud-executor",request.url);
    after(async()=>{
      try{
        const response=await fetch(executorUrl,{method:"POST",headers:authorization?{authorization}:undefined,cache:"no-store"});
        if(!response.ok)console.error("cloud_executor_autostart_failed",response.status);
      }catch(error){console.error("cloud_executor_autostart_failed",error);}
    });
  }
  return Response.json({id,status,deliveryChannel:channel,destination:destination||undefined,platformKey:platform,deliveryState,receiptId:receiptId||undefined,receiptUrl:receiptUrl||undefined,createdAt:now,error:deliveryError||undefined},{status:201});
}
