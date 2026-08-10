import { opportunities } from "@/lib/opportunities";
export async function GET() {
  return Response.json({ opportunities, sources:["GitHub","Hacker News","Y Combinator","Wellfound","Company ATS"], fetchedAt:new Date().toISOString(), mode:"privacy-safe-demo" }, { headers:{ "Cache-Control":"public, max-age=60, stale-while-revalidate=300" } });
}
