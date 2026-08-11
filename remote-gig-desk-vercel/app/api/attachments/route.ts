import { createHash } from "crypto";
import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const allowed=new Set(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword","text/plain"]);
function tokenHash(value:string){return createHash("sha256").update(value).digest("hex");}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const form=await request.formData();
  const file=form.get("file");
  if(!(file instanceof File)||!allowed.has(file.type)||file.size<1||file.size>5*1024*1024)return Response.json({error:"unsupported_attachment"},{status:400});
  await ensureDatabase();const sql=db();const id=crypto.randomUUID(),now=Date.now();
  const bytes=Buffer.from(await file.arrayBuffer());
  await sql`INSERT INTO application_attachments(id,owner_email,filename,content_type,content,size,created_at) VALUES(${id},${user.email},${file.name.slice(0,180)},${file.type},${bytes},${file.size},${now})`;
  return Response.json({id,name:file.name,type:file.type,size:file.size},{status:201});
}

export async function GET(request:Request){
  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return Response.json({error:"agent_authorization_required"},{status:401,headers:cors});
  await ensureDatabase();const sql=db();
  const agents=await sql`SELECT owner_email AS "ownerEmail" FROM browser_agents WHERE token_hash=${tokenHash(auth.slice(7).trim())} LIMIT 1`;
  if(!agents.length)return Response.json({error:"invalid_agent_token"},{status:401,headers:cors});
  const id=new URL(request.url).searchParams.get("id")||"";
  const rows=await sql`SELECT filename,content_type AS "contentType",content FROM application_attachments WHERE id=${id} AND owner_email=${String((agents[0] as any).ownerEmail)} LIMIT 1`;
  if(!rows.length)return Response.json({error:"attachment_not_found"},{status:404,headers:cors});
  const row=rows[0] as any;
  return new Response(row.content,{headers:{...cors,"Content-Type":row.contentType,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,"Cache-Control":"private, no-store"}});
}
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
