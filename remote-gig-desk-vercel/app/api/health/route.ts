import { db, ensureDatabase } from "../../../db";

export const dynamic="force-dynamic";

export async function GET(){
  const aiProvider=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN?"vercel-ai-gateway":process.env.OPENAI_API_KEY?"openai":"unconfigured";
  let browserAgent={online:0,current:0,outdated:0};
  try{
    await ensureDatabase();const sql=db();const cutoff=Date.now()-120_000;
    const rows=await sql`SELECT count(*) FILTER (WHERE last_seen_at>=${cutoff})::int AS online,count(*) FILTER (WHERE last_seen_at>=${cutoff} AND version=${"0.5.0"})::int AS current,count(*) FILTER (WHERE last_seen_at>=${cutoff} AND (version IS NULL OR version<>${"0.5.0"}))::int AS outdated FROM browser_agents`;
    browserAgent={online:Number((rows[0] as any)?.online||0),current:Number((rows[0] as any)?.current||0),outdated:Number((rows[0] as any)?.outdated||0)};
  }catch{}
  return Response.json({
    ok:Boolean(process.env.DATABASE_URL&&process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),
    services:{database:Boolean(process.env.DATABASE_URL),workbenchAuth:Boolean(process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),ai:aiProvider!=="unconfigured",aiProvider},
    browserAgent,deployment:process.env.VERCEL_GIT_COMMIT_SHA||"local",
  },{headers:{"Cache-Control":"no-store"}});
}
