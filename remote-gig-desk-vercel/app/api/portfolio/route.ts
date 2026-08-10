import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { normalizePortfolioItem } from "../../../lib/portfolio";

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();const sql=db();
  const items=await sql`SELECT id,title,summary,link,skills,evidence,position,created_at AS "createdAt",updated_at AS "updatedAt" FROM portfolio_items WHERE owner_email=${user.email} ORDER BY position ASC,updated_at DESC`;
  return Response.json({items});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return Response.json({error:"invalid_item"},{status:400});
  let item;try{item=normalizePortfolioItem(body);}catch(cause){return Response.json({error:cause instanceof Error?cause.message:"invalid_item"},{status:400});}
  await ensureDatabase();const sql=db();const id=String(body.id||crypto.randomUUID());const now=Date.now();const skills=JSON.stringify(item.skills);
  await sql`INSERT INTO portfolio_items(id,owner_email,title,summary,link,skills,evidence,position,created_at,updated_at) VALUES(${id},${user.email},${item.title},${item.summary},${item.link},${skills}::jsonb,${item.evidence},${item.position},${now},${now}) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,link=EXCLUDED.link,skills=EXCLUDED.skills,evidence=EXCLUDED.evidence,position=EXCLUDED.position,updated_at=EXCLUDED.updated_at WHERE portfolio_items.owner_email=${user.email}`;
  return Response.json({item:{id,...item,updatedAt:now}},{status:201});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const id=new URL(request.url).searchParams.get("id");if(!id)return Response.json({error:"id_required"},{status:400});
  await ensureDatabase();const sql=db();const removed=await sql`DELETE FROM portfolio_items WHERE id=${id} AND owner_email=${user.email} RETURNING id`;
  return removed.length?Response.json({deleted:id}):Response.json({error:"not_found"},{status:404});
}
