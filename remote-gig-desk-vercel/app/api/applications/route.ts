import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { getGoogleToken } from "../../../lib/google";

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
  const rows=await sql`SELECT id,gig_id AS "gigId",title,source,source_url AS "sourceUrl",status,delivery_channel AS "deliveryChannel",proposed_rate AS "proposedRate",destination,last_error AS "lastError",platform_key AS "platformKey",delivery_state AS "deliveryState",receipt_id AS "receiptId",receipt_url AS "receiptUrl",delivered_at AS "deliveredAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM applications WHERE owner_email=${user.email} ORDER BY updated_at DESC LIMIT 100`;
  const events=await sql`SELECT id,application_id AS "applicationId",event_type AS "eventType",status,message,evidence_id AS "evidenceId",evidence_url AS "evidenceUrl",created_at AS "createdAt" FROM application_events WHERE owner_email=${user.email} ORDER BY created_at ASC`;
  const byApplication=new Map<string,any[]>();
  for(const event of events as any[]){const list=byApplication.get(event.applicationId)||[];list.push(event);byApplication.set(event.applicationId,list);}
  return Response.json({applications:(rows as any[]).map(row=>({...row,events:byApplication.get(row.id)||[]}))});
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

  const existing=await sql`SELECT id,status,delivery_channel AS "deliveryChannel",created_at AS "createdAt" FROM applications WHERE owner_email=${user.email} AND gig_id=${body.gig.id} ORDER BY created_at DESC LIMIT 1`;
  if(existing.length){
    const row=existing[0] as any;
    return Response.json({id:row.id,status:row.status,deliveryChannel:row.deliveryChannel,createdAt:row.createdAt,duplicate:true});
  }

  let status=channel==="github"?"awaiting_github_authorization":channel==="hackernews"?"manual_submission_required":"detecting_destination";
  let deliveryError="";
  let destination="";
  const platform=platformKey(body.gig.source||"");
  let deliveryState="queued";
  let receiptId="";
  let receiptUrl="";
  let deliveredAt:number|null=null;

  if(channel==="github"){
    const target=githubIssue(body.gig.sourceUrl);
    destination=target?body.gig.sourceUrl:"";
    const connections=await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
    const tokenCiphertext=(connections[0] as any)?.tokenCiphertext as string|undefined;
    if(target&&tokenCiphertext){
      try{
        const token=await unseal(tokenCiphertext);
        const response=await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}/issues/${target.issue}/comments`,{
          method:"POST",
          headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},
          body:JSON.stringify({body:body.coverLetter}),
          cache:"no-store",
        });
        const result=await response.json().catch(()=>({})) as {id?:number;html_url?:string};
        if(!response.ok)throw new Error(`github_${response.status}`);
        status="submitted";deliveryState="platform_accepted";receiptId=String(result.id||"");receiptUrl=result.html_url||"";deliveredAt=Date.now();
      }catch(error){
        status="submission_failed";
        deliveryError=error instanceof Error?error.message:"github_failed";
      }
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
    sql`INSERT INTO applications (id,owner_email,gig_id,source,source_url,title,language,proposed_rate,application_letter,status,delivery_channel,destination,last_error,platform_key,delivery_state,receipt_id,receipt_url,delivered_at,created_at,updated_at) VALUES (${id},${user.email},${body.gig.id},${body.gig.source},${body.gig.sourceUrl},${body.gig.title},${body.language},${body.quote},${body.coverLetter},${status},${channel},${destination},${deliveryError},${platform},${deliveryState},${receiptId},${receiptUrl},${deliveredAt},${now},${now})`,
    sql`INSERT INTO application_events (id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES (${crypto.randomUUID()},${user.email},${id},${"delivery_attempt"},${status},${deliveryState==="platform_accepted"?"平台接口已确认接收申请":deliveryError?"投递失败："+deliveryError:"任务已建立，等待下一步"},${receiptId},${receiptUrl},${now})`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_processed"},${id},${deliveryError||status},${now})`,
  ]);
  return Response.json({id,status,deliveryChannel:channel,createdAt:now,error:deliveryError||undefined},{status:201});
}
