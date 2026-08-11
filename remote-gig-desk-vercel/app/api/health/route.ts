export const dynamic="force-dynamic";

export async function GET(){
  const aiProvider=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN?"vercel-ai-gateway":process.env.OPENAI_API_KEY?"openai":"unconfigured";
  return Response.json({
    ok:Boolean(process.env.DATABASE_URL&&process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),
    services:{database:Boolean(process.env.DATABASE_URL),workbenchAuth:Boolean(process.env.WORKBENCH_USER&&process.env.WORKBENCH_PASSWORD),ai:aiProvider!=="unconfigured",aiProvider},
    deployment:process.env.VERCEL_GIT_COMMIT_SHA||"local",
  },{headers:{"Cache-Control":"no-store"}});
}
