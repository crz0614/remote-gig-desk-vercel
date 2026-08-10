type UnknownRecord=Record<string,unknown>;

function entries(value:unknown,prefix=""):Array<[string,string]>{
  if(!value||typeof value!=="object")return [];
  return Object.entries(value as UnknownRecord).flatMap(([key,item])=>{
    const path=prefix?`${prefix}.${key}`:key;
    if(typeof item==="string"||typeof item==="number")return [[path,String(item).trim()] as [string,string]];
    return entries(item,path);
  });
}

export function applicantProfileForForms(value:unknown,portfolioUrls:string[]=[]){
  const fields=entries(value).filter(([,item])=>item);
  const find=(pattern:RegExp)=>fields.find(([key])=>pattern.test(key))?.[1]||"";
  const fullName=find(/(^|\.)(full.?name|name|姓名)$/i);
  const nameParts=fullName.split(/\s+/).filter(Boolean);
  return {
    fullName,
    firstName:find(/first.?name|given.?name|名$/i)||nameParts[0]||"",
    lastName:find(/last.?name|family.?name|surname|姓$/i)||nameParts.slice(1).join(" "),
    email:find(/(^|\.)(email|邮箱)$/i),
    phone:find(/phone|mobile|电话|手机/i),
    location:find(/location|city|address|位置|城市|地址/i),
    linkedin:find(/linkedin/i),
    github:find(/github/i),
    portfolio:portfolioUrls[0]||find(/portfolio|website|作品集|个人网站/i),
    resumeUrl:find(/resume.?url|cv.?url|简历链接/i),
  };
}
