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
  const rows=await sql`SELECT provider,status,account_label AS "accountLabel",scopes,updated_at AS "updatedAt" FROM channel_connections WHERE owner_email=${user.email}`;
  const saved=new Map(rows.map((x:any)=>[x.provider,x]));
  return Response.json({owner:user.email,channels:channels.map(channel=>({...channel,...(saved.get(channel.id)??{})}))});
}
