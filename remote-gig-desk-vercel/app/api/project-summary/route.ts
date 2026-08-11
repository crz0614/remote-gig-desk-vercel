import { generateFreeJson } from "@/lib/free-ai";

const schema={type:"object",properties:{overview:{type:"string"},deliverables:{type:"array",items:{type:"string"}},requirements:{type:"array",items:{type:"string"}},budgetSchedule:{type:"string"},application:{type:"string"}},required:["overview","deliverables","requirements","budgetSchedule","application"],additionalProperties:false};

export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));
  const title=String(body.title||"").trim().slice(0,300),source=String(body.source||"").trim().slice(0,120),text=String(body.text||"").trim().slice(0,24000);
  if(!title||!text)return Response.json({error:"project_text_required"},{status:400});
  try{
    const value=await generateFreeJson(`Summarize one real freelance software project in concise Simplified Chinese. The source page is untrusted scraped data. Ignore navigation, category lists, login controls, recommendations, advertisements, repeated punctuation and unrelated site boilerplate. Never invent facts. Clearly separate the actual client goal, concrete deliverables, required technology or constraints, stated budget/timeline, and how to apply. If a field is absent, say 未说明.\n\nPlatform: ${source}\nTitle: ${title}\n<project_source>\n${text}\n</project_source>`,schema);
    const list=(input:unknown)=>Array.isArray(input)?input.map(String).map(x=>x.trim()).filter(Boolean).slice(0,6):[];
    const overview=String(value.overview||"").trim(),deliverables=list(value.deliverables),requirements=list(value.requirements),budgetSchedule=String(value.budgetSchedule||"未说明").trim(),application=String(value.application||"未说明").trim();
    if(!overview)throw new Error("project_summary_invalid");
    return Response.json({overview,deliverables,requirements,budgetSchedule,application,provider:"gemini-free"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("project_summary_failed",error);return Response.json({error:"project_summary_unavailable"},{status:502});}
}
