import { getChatGPTUser } from "../../../chatgpt-auth";
import { db,ensureDatabase } from "../../../../db";
import { inspectPortfolioArchive } from "../../../../lib/portfolio-archive";

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const form=await request.formData();const file=form.get("archive");
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".zip"))return Response.json({error:"zip_required"},{status:400});
  if(file.size>15*1024*1024)return Response.json({error:"archive_too_large"},{status:413});
  let parsed;try{parsed=await inspectPortfolioArchive(await file.arrayBuffer());}catch(cause){return Response.json({error:cause instanceof Error?cause.message:"archive_invalid"},{status:400});}
  await ensureDatabase();const sql=db();const id=crypto.randomUUID(),now=Date.now();
  await sql`INSERT INTO portfolio_items(id,owner_email,title,summary,link,skills,evidence,position,archive_name,parsed_files,status,created_at,updated_at) VALUES(${id},${user.email},${parsed.title},${parsed.summary},${""},${JSON.stringify(parsed.skills)}::jsonb,${parsed.evidence},${0},${file.name},${JSON.stringify(parsed.parsedFiles)}::jsonb,${"parsed"},${now},${now})`;
  return Response.json({item:{id,...parsed,archiveName:file.name,status:"parsed",createdAt:now}},{status:201});
}
