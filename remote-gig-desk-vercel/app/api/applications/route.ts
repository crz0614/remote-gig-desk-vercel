import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";

function deliveryFor(source:string){
  if(/GitHub/i.test(source))return "github";
  if(/Hacker News/i.test(source))return "hackernews";
  return "destination_detection";
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
  const status=channel==="github"?"awaiting_github_authorization":channel==="hackernews"?"manual_submission_required":"detecting_destination";
  const sql=db();
  await sql.transaction([
    sql`INSERT INTO applications (id,owner_email,gig_id,source,source_url,title,language,proposed_rate,application_letter,status,delivery_channel,created_at,updated_at) VALUES (${id},${user.email},${body.gig.id},${body.gig.source},${body.gig.sourceUrl},${body.gig.title},${body.language},${body.quote},${body.coverLetter},${status},${channel},${now},${now})`,
    sql`INSERT INTO audit_events (id,owner_email,action,target,result,created_at) VALUES (${crypto.randomUUID()},${user.email},${"application_queued"},${id},${status},${now})`,
  ]);
  return Response.json({id,status,deliveryChannel:channel,createdAt:now},{status:201});
}
