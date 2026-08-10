import JSZip from "jszip";

const TEXT_FILES=/(^|\/)(readme(?:\.[^/]*)?|package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|pom\.xml|build\.gradle|composer\.json)$/i;
const IGNORED=/(^|\/)(node_modules|\.git|dist|build|\.next|coverage)(\/|$)/i;

export async function inspectPortfolioArchive(bytes:ArrayBuffer){
  const zip=await JSZip.loadAsync(bytes);
  const names=Object.keys(zip.files).filter(name=>!zip.files[name].dir&&!IGNORED.test(name)).slice(0,2000);
  if(!names.length)throw new Error("archive_empty");
  const candidates=names.filter(name=>TEXT_FILES.test(name)).slice(0,12);
  const texts=await Promise.all(candidates.map(async name=>({name,text:(await zip.files[name].async("string")).slice(0,30_000)})));
  const combined=texts.map(item=>`${item.name}\n${item.text}`).join("\n").toLowerCase();
  const rules:Array<[string,RegExp]>=[
    ["React",/\breact\b|next\.js|nextjs/],["TypeScript",/typescript|\.tsx?\b/],["JavaScript",/javascript|\.jsx?\b/],
    ["Python",/python|fastapi|django|flask|pyproject|requirements\.txt/],["Go",/golang|go\.mod/],["Rust",/\brust\b|cargo\.toml/],
    ["Java",/\bjava\b|spring|pom\.xml|gradle/],["Docker",/dockerfile|docker-compose/],["PostgreSQL",/postgres|postgresql/],
    ["AI / LLM",/openai|anthropic|\bllm\b|machine learning|embedding|rag/],
  ];
  const skills=rules.filter(([,pattern])=>pattern.test(`${combined}\n${names.join("\n").toLowerCase()}`)).map(([skill])=>skill);
  const readme=texts.find(item=>/(^|\/)readme/i.test(item.name))?.text.replace(/[#*_`>]/g," ").replace(/\s+/g," ").trim()||"";
  const root=names[0]?.split("/")[0]||"Imported project";
  return {
    title:(root.replace(/[-_]+/g," ").trim()||"Imported project").slice(0,160),
    summary:(readme||`已解析 ${names.length} 个项目文件；请补充本人贡献和可核验证据。`).slice(0,4000),
    skills:skills.slice(0,20),
    parsedFiles:names.slice(0,120),
    evidence:`ZIP 解析完成：${names.length} 个有效文件，读取 ${texts.length} 个项目说明/依赖文件。`,
  };
}
