import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";
import { seal, unseal } from "../../../lib/secret-store";

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();const sql=db();const rows=await sql`SELECT profile_ciphertext AS "profileCiphertext",updated_at AS "updatedAt" FROM private_profiles WHERE owner_email=${user.email} LIMIT 1`;
  if(!rows.length)return Response.json({profile:null});
  try{return Response.json({profile:JSON.parse(await unseal(String((rows[0] as any).profileCiphertext))),updatedAt:(rows[0] as any).updatedAt});}catch{return Response.json({error:"profile_decryption_failed"},{status:500});}
}

export async function PUT(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});
  const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return Response.json({error:"invalid_profile"},{status:400});
  const json=JSON.stringify(body);if(json.length>100000)return Response.json({error:"profile_too_large"},{status:413});
  const ciphertext=await seal(json);const now=Date.now();await ensureDatabase();const sql=db();
  await sql`INSERT INTO private_profiles(owner_email,profile_ciphertext,updated_at) VALUES(${user.email},${ciphertext},${now}) ON CONFLICT(owner_email) DO UPDATE SET profile_ciphertext=EXCLUDED.profile_ciphertext,updated_at=EXCLUDED.updated_at`;
  return Response.json({saved:true,updatedAt:now});
}
