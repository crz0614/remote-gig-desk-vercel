type UnknownRecord=Record<string,unknown>;

function entries(value:unknown,prefix=""):Array<[string,string]>{
  if(value===null||value===undefined)return[];
  if(Array.isArray(value))return value.flatMap((item,index)=>entries(item,`${prefix}.${index}`));
  if(typeof value!=="object")return typeof value==="string"||typeof value==="number"||typeof value==="boolean"?[[prefix,String(value).trim()]]:[];
  return Object.entries(value as UnknownRecord).flatMap(([key,item])=>entries(item,prefix?`${prefix}.${key}`:key));
}

export function applicantProfileForForms(value:unknown,portfolioUrls:string[]=[],ownerEmail=""){
  const fields=entries(value).filter(([,item])=>item);
  const find=(pattern:RegExp)=>fields.find(([key])=>pattern.test(key))?.[1]||"";
  const collect=(pattern:RegExp)=>[...new Set(fields.filter(([key])=>pattern.test(key)).map(([,item])=>item))].join("\n");
  const fullName=find(/(^|\.)(full.?name|name|姓名)$/i);
  const nameParts=fullName.split(/\s+/).filter(Boolean);
  const links=collect(/(^|\.)(links|职业链接|链接)$/i);
  const urls=links.match(/https:\/\/[^\s,，;；]+/gi)||[];
  const linkFor=(pattern:RegExp)=>urls.find(url=>pattern.test(url))||"";
  const skills=collect(/skill|技能|技术栈|能力/i);
  const experienceSummary=collect(/experience|work.?history|career|工作经历|职业经历|任职/i);
  const projectSummary=collect(/project|portfolio.?description|项目经历|项目经验|作品经历/i);
  const educationSummary=collect(/education|学历|教育经历|院校|学校|专业|学位/i);
  return {
    fullName,
    firstName:find(/first.?name|given.?name|名$/i)||nameParts[0]||"",
    lastName:find(/last.?name|family.?name|surname|姓$/i)||nameParts.slice(1).join(" "),
    email:find(/(^|\.)(email|邮箱)$/i)||ownerEmail,
    phone:find(/phone|mobile|电话|手机/i),
    location:find(/location|city|address|位置|城市|地址/i),
    country:find(/country|国家/i),
    postalCode:find(/postal|zip|邮编/i),
    timezone:find(/timezone|时区/i),
    linkedin:find(/linkedin/i)||linkFor(/linkedin\.com/i),
    github:find(/github/i)||linkFor(/github\.com/i),
    portfolio:portfolioUrls[0]||find(/portfolio|website|作品集|个人网站/i)||linkFor(/./),
    resumeUrl:find(/resume.?url|cv.?url|简历链接/i),
    headline:find(/headline|title|职业标题|求职标题/i),
    currentCompany:find(/current.?company|employer|当前公司|现公司/i),
    yearsExperience:find(/years?.?experience|工作年限|经验年限/i),
    school:find(/school|university|college|学校|院校/i),
    degree:find(/degree|学位|学历/i),
    major:find(/major|field.?of.?study|专业/i),
    graduationYear:find(/graduation|毕业年份|毕业时间/i),
    educationSummary,
    experienceSummary,
    projectSummary,
    skills,
    bio:find(/(^|\.)(bio|summary|profile|自我介绍|个人简介|职业概述)$/i),
    availability:find(/availability|start.?date|到岗|可用时间/i),
    desiredRate:find(/desired.?rate|hourly.?rate|期望报价|时薪/i),
    workAuthorization:find(/work.?authorization|authorized.?to.?work|工作许可/i),
    sponsorship:find(/sponsorship|visa.?sponsor|签证担保/i),
  };
}
