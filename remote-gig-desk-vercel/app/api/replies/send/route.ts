import {getChatGPTUser} from "../../../chatgpt-auth";
import {db,ensureDatabase} from "../../../../db";
import {getGoogleToken} from "../../../../lib/google";

function encode(value:string){return Buffer.from(value).toString("base64url");}
function emailFrom(value:string){return value.match(/<([^>]+)>/)?.[1]||value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||"";}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const body=await request.json().catch(()=>null) as {replyId?:string;message?:string}|null;
  const message=String(body?.message||"").trim();if(!body?.replyId||!message||message.length>20_000)return Response.json({error:"invalid_reply"},{status:400});
  await ensureDatabase();const sql=db();
  const rows=await sql`SELECT r.id,r.thread_id AS "threadId",r.sender,r.subject,r.application_id AS "applicationId" FROM email_replies r WHERE r.id=${body.replyId} AND r.owner_email=${user.email} AND r.application_id IS NOT NULL LIMIT 1`;
  const reply=rows[0] as any;if(!reply)return Response.json({error:"reply_not_found"},{status:404});
  const to=emailFrom(String(reply.sender||""));if(!to)return Response.json({error:"recipient_not_found"},{status:409});
  let token="";try{token=await getGoogleToken(user.email);}catch(cause){return Response.json({error:cause instanceof Error?cause.message:"gmail_not_connected"},{status:409});}
  const subject=/^re:/i.test(reply.subject)?reply.subject:`Re: ${reply.subject}`;
  const raw=encode([`To: ${to}`,`Subject: ${subject}`,"Content-Type: text/plain; charset=UTF-8","",message].join("\r\n"));
  const sent=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({raw,threadId:reply.threadId}),cache:"no-store"});
  const result=await sent.json().catch(()=>({})) as {id?:string};if(!sent.ok)return Response.json({error:`gmail_send_${sent.status}`},{status:502});
  const now=Date.now();
  await sql.transaction([
    sql`INSERT INTO application_events(id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES(${crypto.randomUUID()},${user.email},${reply.applicationId},${"REPLY_SENT"},${"response_sent"},${"已通过原 Gmail 线程发送回复"},${result.id||""},${result.id?`https://mail.google.com/mail/u/0/#sent/${result.id}`:""},${now})`,
    sql`UPDATE applications SET updated_at=${now} WHERE id=${reply.applicationId} AND owner_email=${user.email}`
  ]);
  return Response.json({sent:true,messageId:result.id});
}
