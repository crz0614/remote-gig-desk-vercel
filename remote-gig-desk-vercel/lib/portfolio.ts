export function normalizePortfolioItem(input: Record<string, unknown>) {
  const title=String(input.title||"").trim().slice(0,160);
  const summary=String(input.summary||"").trim().slice(0,4000);
  if(!title||!summary)throw new Error("title_and_summary_required");
  const link=String(input.link||"").trim();
  if(link){const url=new URL(link);if(url.protocol!=="https:"&&url.protocol!=="http:")throw new Error("invalid_link");}
  return {title,summary,link,skills:Array.isArray(input.skills)?input.skills.map(String).map(x=>x.trim()).filter(Boolean).slice(0,20):[],evidence:String(input.evidence||"").trim().slice(0,2000),position:Math.max(0,Number(input.position)||0)};
}
