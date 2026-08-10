export type Opportunity = {
  id: string; company: string; role: string; source: string; location: string; type: string;
  budget: string; match: number; posted: string; skills: string[]; summary: string; accent: string;
};

export const opportunities: Opportunity[] = [
  { id:"signal", company:"SignalForge", role:"AI Workflow Engineer", source:"YC · Ashby", location:"Remote · Worldwide", type:"Contract", budget:"$75–110/hr", match:94, posted:"18 min ago", skills:["Python","LLM","FastAPI"], summary:"Build reliable agent workflows, retrieval pipelines and evaluation tooling for a growing B2B platform.", accent:"#7c5cff" },
  { id:"northstar", company:"Northstar Labs", role:"Rust Systems Consultant", source:"Company Careers", location:"Remote · APAC", type:"Freelance", budget:"$8k–12k", match:91, posted:"2 hr ago", skills:["Rust","Tokio","PostgreSQL"], summary:"Improve throughput and observability in a high-volume event processing service without disrupting production.", accent:"#20c997" },
  { id:"orbit", company:"Orbit Cloud", role:"Backend Automation Developer", source:"Wellfound", location:"Remote · Asia", type:"Part-time", budget:"$60–85/hr", match:88, posted:"5 hr ago", skills:["Go","Kubernetes","API"], summary:"Automate cloud operations and integrate customer infrastructure with a typed, auditable control plane.", accent:"#ff9f43" },
  { id:"atlas", company:"Atlas Security", role:"C++ Performance Engineer", source:"Hacker News", location:"Remote · UTC+0–8", type:"Contract", budget:"$9k/month", match:86, posted:"Yesterday", skills:["C++","Linux","Networking"], summary:"Profile and optimize a cross-platform network agent while strengthening its memory-safety boundaries.", accent:"#4dabf7" },
  { id:"canvas", company:"Canvas AI", role:"Full-stack AI Prototype", source:"GitHub Bounty", location:"Remote", type:"Fixed scope", budget:"$4,500", match:83, posted:"Yesterday", skills:["TypeScript","Next.js","AI"], summary:"Deliver a production-ready proof of concept with streaming generation, review queues and deployment automation.", accent:"#f06595" }
];

export function filterOpportunities(items: Opportunity[], query: string, source: string) {
  const q = query.trim().toLowerCase();
  return items.filter(item => (source === "All sources" || item.source.includes(source)) && (!q || `${item.role} ${item.company} ${item.skills.join(" ")}`.toLowerCase().includes(q)));
}
