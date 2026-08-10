export async function POST(){return Response.json({error:"llm_not_configured",message:"No LLM provider is connected to this public deployment. A reply was not fabricated."},{status:503})}
