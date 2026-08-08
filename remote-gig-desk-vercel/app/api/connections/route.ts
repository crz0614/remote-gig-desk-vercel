import { getChatGPTUser } from "../../chatgpt-auth";
import { db, ensureDatabase } from "../../../db";

const channels=[
  {id:"github",name:"GitHub Issues / Bounties",mode:"direct",capability:"授权后可通过官方 API 发布申请评论",status:"authorization_required"},
  {id:"gmail",name:"Gmail",mode:"direct",capability:"授权后可发送邮件申请并读取回复",status:"authorization_required"},
  {id:"hackernews",name:"Hacker News",mode:"manual",capability:"官方 API 只读，申请必须在原站人工发布",status:"manual_only"},
  {id:"greenhouse",name:"Greenhouse",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"lever",name:"Lever",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"ashby",name:"Ashby",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"workable",name:"Workable",mode:"ats",capability:"按最终招聘表单解析字段后提交",status:"adapter_planned"},
  {id:"custom",name:"公司自建表单",mode:"browser",capability:"逐域名分析；验证码或身份验证需要人工处理",status:"manual_checkpoint"},
];

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"sign_in_required"},{status:401});
  await ensureDatabase();
  const sql=db();
  const [rows,sessions]=await Promise.all([
    sql`SELECT provider,status,account_label AS "accountLabel",scopes,updated_at AS "updatedAt" FROM channel_connections WHERE owner_email=${user.email}`,
    sql`SELECT platform_key AS "platformKey",status,account_label AS "accountLabel",auth_method AS "authMethod",site_url AS "siteUrl",verified_at AS "verifiedAt",last_checked_at AS "lastCheckedAt",expires_at AS "expiresAt",updated_at AS "updatedAt" FROM platform_sessions WHERE owner_email=${user.email} ORDER BY updated_at DESC`
  ]);
  const saved=new Map(rows.map((x:any)=>[x.provider,x]));
  const resolvedChannels=channels.map(channel=>({...channel,...(saved.get(channel.id)??{})}));
  const names=new Map(channels.map(channel=>[channel.id,channel.name]));
  const authenticated=new Map<string,any>();
  for(const channel of resolvedChannels){
    if(channel.status==="connected")authenticated.set(channel.id,{
      platformKey:channel.id,name:channel.name,status:"connected",sessionType:"oauth",
      accountLabel:channel.accountLabel||user.email,lastCheckedAt:channel.updatedAt,updatedAt:channel.updatedAt,
      note:"OAuth 授权可持续复用，除非授权被撤销或令牌失效。"
    });
  }
  for(const session of sessions as any[]){
    const expired=Boolean(session.expiresAt&&Number(session.expiresAt)<=Date.now());
    const item={
      ...session,name:names.get(session.platformKey)||session.platformKey,
      status:expired?"expired":session.status,sessionType:session.authMethod||"browser_session",
      note:expired?"登录会话已到复查时间；下次投递前需要重新验证。":"浏览器登录会被同平台任务复用；网站退出、撤销或 Cookie 过期后需重新登录一次。"
    };
    const existing=authenticated.get(session.platformKey);
    if(!existing||existing.status!=="connected")authenticated.set(session.platformKey,item);
  }
  return Response.json({owner:user.email,channels:resolvedChannels,sessions,authenticatedSites:[...authenticated.values()]});
}
