import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { getGoogleToken } from "../../../lib/google";

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
  if(!response.ok)throw new Error("gmail_send_"+response.status);
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();
  const sql=db();
  const rows=await sql`SELECT id,gig_id AS "gigId",title,source,source_url AS "sourceUrl",status,delivery_channel AS "deliveryChannel",proposed_rate AS "proposedRate",created_at AS "createdAt",updated_at AS "updatedAt" FROM applications WHERE owner_email=${user.email} ORDER BY updated_at DESC LIMIT 100`;
  return Response.json({applications:rows});
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

  if(channel==="github"){
    const target=githubIssue(body.gig.sourceUrl);
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
        if(!response.ok)throw new Error(`github_${response.status}`);
        status="submitted";
      }catch(error){
        status="submission_failed";
        deliveryError=error instanceof Error?error.message:"github_failed";
      }
    }
  }else if(channel==="destination_detection"){
    const email=applicationEmail({...body,ownerEmail:user.email});
    if(email){
      channel="gmail";
      try{
        await sendGmail(user.email,email,"Application: "+body.gig.title,body.coverLetter);
        status="submitted";
      }catch(error){
        status="submission_failed";
        deliveryError=error instanceof Error?error.message:"gmail_failed";
      }
    }
  }

  await sql.transaction([
    sql`INSERT INTO applications (id,owner_email,gig_id,source,source_url,title,language,proposed_rate,application_letter,status,delivery_channel,created_at,updated_at) VALUES (${id},${user.email},${body.gig.id},${body.gig.source},${body.gig.sourceUrl},${body.gig.title},${body.language},${body.quote},${body.coverLetter},${status},${channel},${now},${now})`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_processed"},${id},${deliveryError||status},${now})`,
  ]);
  return Response.json({id,status,deliveryChannel:channel,createdAt:now,error:deliveryError||undefined},{status:201});
}
