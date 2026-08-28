import { db, ensureDatabase } from "../../../db";
import { CURRENT_BROWSER_AGENT_VERSION } from "../../../lib/browser-agent-version";

export const dynamic="force-dynamic";

export async function GET(){
  const aiProvider=process.env.GEMINI_API_KEY?.trim()?"gemini-free-tier":"unconfigured";
  let browserAgent={online:0,current:0,outdated:0};
  try{
    await ensureDatabase();const sql=db();const cutoff=Date.now()-120_000;
    const rows=await sql`SELECT count(*) FILTER (WHERE last_seen_at>=${cutoff})::int AS online,count(*) FILTER (WHERE last_seen_at>=${cutoff} AND version=${CURRENT_BROWSER_AGENT_VERSION})::int AS current,count(*) FILTER (WHERE last_seen_at>=${cutoff} AND (version IS NULL OR version<>${CURRENT_BROWSER_AGENT_VERSION}))::int AS outdated FROM browser_agents`;
    browserAgent={online:Number((rows[0] as any)?.online||0),current:Number((rows[0] as any)?.current||0),outdated:Number((rows[0] as any)?.outdated||0)};
  }catch{}
  return Response.json({
    ok:Boolean(process.env.DATABASE_URL&&process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),
    services:{
      database:Boolean(process.env.DATABASE_URL),
      workbenchAuth:Boolean(process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),
      ai:aiProvider!=="unconfigured",
      aiProvider,
      googleOauth:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),
    },
    browserAgent:{...browserAgent,requiredVersion:CURRENT_BROWSER_AGENT_VERSION},deployment:process.env.VERCEL_GIT_COMMIT_SHA||"local",
  },{headers:{"Cache-Control":"no-store"}});
}
