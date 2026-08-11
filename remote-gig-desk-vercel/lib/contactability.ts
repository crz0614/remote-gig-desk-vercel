export type ContactableOpportunity={
  source:string;
  sourceUrl:string;
  application?:string;
  fullText?:string;
  summary?:string;
};

const emailPattern=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const appOnly=/(^|\.)job\.proginn\.com$|(^|\.)m\.proginn\.com$/i;
const directWebSource=/(公司 ATS|公司 Careers|Greenhouse|Lever|Ashby|Workable|Jobicy|Remotive|Remote OK|Arbeitnow|Y Combinator|Wellfound|GitHub|猪八戒|一品威客)/i;
const webContactSource=/(Reddit|Hacker News|V2EX|电鸭|Threads|X ·)/i;

function urls(value:string){
  return [...value.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map(match=>match[0].replace(/[.,;:!?]+$/,""));
}

export function contactabilityFor(item:ContactableOpportunity){
  let source:URL;
  try{source=new URL(item.sourceUrl);}catch{return{eligible:false,method:"none" as const,reason:"invalid_source_url"};}
  if(!["http:","https:"].includes(source.protocol))return{eligible:false,method:"none" as const,reason:"invalid_source_url"};
  if(appOnly.test(source.hostname)||/程序员客栈/i.test(item.source))return{eligible:false,method:"none" as const,reason:"app_only"};
  const combined=[item.application,item.fullText,item.summary].filter(Boolean).join("\n");
  const email=combined.match(emailPattern)?.[0];
  if(email)return{eligible:true,method:"email" as const,reason:"public_email",email};
  const external=urls(combined).find(value=>{
    try{
      const url=new URL(value);
      return url.hostname!==source.hostname&&!/\.(?:png|jpe?g|gif|svg|css|js|pdf|zip)$/i.test(url.pathname);
    }catch{return false;}
  });
  if(external)return{eligible:true,method:"external_web" as const,reason:"external_application_url",url:external};
  if(directWebSource.test(item.source))return{eligible:true,method:"web" as const,reason:"supported_web_application",url:item.sourceUrl};
  if(webContactSource.test(item.source)&&/(私信|站内信|联系|contact|dm\b|message|apply|申请|报名|投标|回复|comment)/i.test(combined))
    return{eligible:true,method:"platform_web" as const,reason:"web_platform_contact",url:item.sourceUrl};
  return{eligible:false,method:"none" as const,reason:"no_actionable_contact"};
}

export function isContactableOpportunity(item:ContactableOpportunity){
  return contactabilityFor(item).eligible;
}
