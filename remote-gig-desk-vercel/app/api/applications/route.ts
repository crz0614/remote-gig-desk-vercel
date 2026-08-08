import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";

function deliveryFor(source:string){
  if(/GitHub/i.test(source))return "github";
  if(/Hacker News/i.test(source))return "hackernews";
  return "destination_detection";
}

function githubIssue(url:string){
  const match=url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
  return match?{owner:match[1],repo:match[2],issue:match[3]}:null;
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
  const id=crypto.randomUUID(); const now=Date.now(); const channel=deliveryFor(body.gig.source||"");
  const sql=db();
  let status=channel==="github"?"awaiting_github_authorization":channel==="hackernews"?"manual_submission_required":"detecting_destination";
  let deliveryError="";
  if(channel==="github"){
    const target=githubIssue(body.gig.sourceUrl);
    const connections=await sql`SELECT token_ciphertext AS "tokenCiphertext" FROM channel_connections WHERE owner_email=${user.email} AND provider=${"github"} AND status=${"connected"} LIMIT 1`;
    const tokenCiphertext=(connections[0] as any)?.tokenCiphertext as string|undefined;
    if(target&&tokenCiphertext){
      try{
        const token=await unseal(tokenCiphertext);
        const response=await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}/issues/${target.issue}/comments`,{method:"POST",headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},body:JSON.stringify({body:body.coverLetter}),cache:"no-store"});
        if(!response.ok)throw new Error(`github_${response.status}`);
        status="submitted";
      }catch(error){status="submission_failed";deliveryError=error instanceof Error?error.message:"github_failed";}
    }
  }
  await sql.transaction([
    sql`INSERT INTO applications (id,owner_email,gig_id,source,source_url,title,language,proposed_rate,application_letter,status,delivery_channel,created_at,updated_at) VALUES (${id},${user.email},${body.gig.id},${body.gig.source},${body.gig.sourceUrl},${body.gig.title},${body.language},${body.quote},${body.coverLetter},${status},${channel},${now},${now})`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_processed"},${id},${deliveryError||status},${now})`,
  ]);
  return Response.json({id,status,deliveryChannel:channel,createdAt:now,error:deliveryError||undefined},{status:201});
}
