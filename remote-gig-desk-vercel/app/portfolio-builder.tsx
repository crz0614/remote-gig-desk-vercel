"use client";
import { ChangeEvent,FormEvent,useEffect,useState } from "react";

type Item={id:string;title:string;summary:string;link:string;skills:string[];evidence:string;position:number;archiveName?:string;parsedFiles?:string[];githubRepo?:string;deploymentUrl?:string;status?:string};
type Profile={name:string;headline:string;summary:string;location:string;availability:string;languages:string;skills:string;experience:string;education:string;achievements:string;links:string;rateGuidance:string};
const empty={title:"",summary:"",link:"",skills:"",evidence:""};
const emptyProfile:Profile={name:"",headline:"",summary:"",location:"",availability:"",languages:"",skills:"",experience:"",education:"",achievements:"",links:"",rateGuidance:""};

function Lines({value}:{value:string}){return <>{value.split(/\n+/).filter(Boolean).map((line,index)=><p key={index}>{line}</p>)}</>}

export default function PortfolioBuilder(){
  const [items,setItems]=useState<Item[]>([]);
  const [form,setForm]=useState(empty);
  const [profile,setProfile]=useState<Profile>(emptyProfile);
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState(false);

  const load=async()=>{
    const [portfolioResponse,profileResponse]=await Promise.all([fetch("/api/portfolio",{cache:"no-store"}),fetch("/api/profile",{cache:"no-store"})]);
    if(portfolioResponse.ok)setItems((await portfolioResponse.json()).items||[]);
    if(profileResponse.ok){
      const saved=(await profileResponse.json()).profile;
      if(saved){
        const merged={...emptyProfile,...saved};setProfile(merged);
        if(/腾讯科技（香港）/.test(merged.experience)&&/Revolut Ltd\./.test(merged.experience)&&/曼彻斯特大学计算机科学系/.test(merged.experience))setNotice("✓ 旧工作台资料已恢复：完整技能库和三段项目经历均已加密保存，AI 会按岗位选择调用。");
      }
    }
  };
  useEffect(()=>{void load();},[]);

  const saveProfile=async(e:FormEvent)=>{e.preventDefault();setNotice("正在保存个人资料…");const r=await fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(profile)});if(r.ok){setNotice("个人资料已保存，之后每封申请都会调用");setEditing(false);}else setNotice("个人资料保存失败，请重试");};
  const save=async(e:FormEvent)=>{e.preventDefault();setNotice("正在保存…");const r=await fetch("/api/portfolio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,skills:form.skills.split(",").map(x=>x.trim()).filter(Boolean),position:items.length})});if(r.ok){setForm(empty);setNotice("已保存到个人工作台");await load();}else setNotice("保存失败，请检查标题、说明和链接");};
  const remove=async(id:string)=>{const r=await fetch(`/api/portfolio?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(r.ok)await load();};
  const importZip=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setNotice("正在解析 ZIP…");const body=new FormData();body.append("archive",file);const r=await fetch("/api/portfolio/import",{method:"POST",body});const result=await r.json();setNotice(r.ok?"ZIP 已解析并保存，可继续核对项目说明和证据":`ZIP 解析失败：${result.error||"请重试"}`);if(r.ok)await load();e.target.value="";};
  const skills=profile.skills.split(/[、,，\n]+/).map(x=>x.trim()).filter(Boolean);

  return <div className="profile-page">
    <section className="profile-hero"><div className="avatar">{profile.name?profile.name.slice(0,1):"我"}</div><div><h2>{profile.name||"我的申请档案"}</h2><p>{profile.headline||"软件、系统、网络与后端工程"}</p><span>{profile.location||"远程合作"}</span></div></section>
    {notice&&<p className="application-note">{notice}</p>}
    {!editing?<>
      <section className="profile-card"><div className="section-head"><div><h3>个人资料</h3><p>AI 生成申请时自动读取，无需重复填写</p></div><button onClick={()=>setEditing(true)}>修改</button></div>{profile.summary&&<Lines value={profile.summary}/>}<div className="profile-row"><span>语言</span><b>{profile.languages||"未记录"}</b></div><div className="profile-row"><span>可工作时间</span><b>{profile.availability||"未记录"}</b></div><div className="profile-row"><span>报价原则</span><b>{profile.rateGuidance||"根据甲方公开预算和项目范围协商"}</b></div>{profile.links&&<div className="profile-row"><span>职业链接</span><b>{profile.links}</b></div>}</section>
      <section className="profile-card"><h3>技能库</h3><p className="profile-hint">申请时只选择与岗位最相关的能力，不会整库堆叠。</p><div className="profile-skills">{skills.map(skill=><span key={skill}>{skill}</span>)}</div></section>
      <section className="profile-card"><h3>经历与项目</h3><div className="timeline"><Lines value={profile.experience}/></div>{profile.achievements&&<><h4>量化成果</h4><Lines value={profile.achievements}/></>}</section>
      <section className="profile-card"><h3>教育经历</h3><Lines value={profile.education||"尚未同步教育经历"}/></section>
    </>:<section className="profile-card"><h3>修改个人经历与能力库</h3><p className="profile-hint">资料已经预填；这里只用于修改，不需要重新录入。</p><form onSubmit={saveProfile} className="portfolio-form"><input placeholder="申请中使用的姓名" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/><input placeholder="职业定位" value={profile.headline} onChange={e=>setProfile({...profile,headline:e.target.value})}/><textarea placeholder="个人简介" value={profile.summary} onChange={e=>setProfile({...profile,summary:e.target.value})}/><textarea placeholder="工作、实习与项目经历" value={profile.experience} onChange={e=>setProfile({...profile,experience:e.target.value})}/><textarea placeholder="技能与工具" value={profile.skills} onChange={e=>setProfile({...profile,skills:e.target.value})}/><textarea placeholder="可核验成果" value={profile.achievements} onChange={e=>setProfile({...profile,achievements:e.target.value})}/><textarea placeholder="教育经历" value={profile.education} onChange={e=>setProfile({...profile,education:e.target.value})}/><input placeholder="所在地 / 可工作时区" value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})}/><input placeholder="语言能力" value={profile.languages} onChange={e=>setProfile({...profile,languages:e.target.value})}/><input placeholder="可开始时间 / 每周可投入时间" value={profile.availability} onChange={e=>setProfile({...profile,availability:e.target.value})}/><input placeholder="GitHub、LinkedIn、个人网站" value={profile.links} onChange={e=>setProfile({...profile,links:e.target.value})}/><input placeholder="报价原则或期望范围" value={profile.rateGuidance} onChange={e=>setProfile({...profile,rateGuidance:e.target.value})}/><button className="oauth-connect" type="submit">保存修改</button><button type="button" className="secondary-link" onClick={()=>setEditing(false)}>取消</button></form></section>}
    <section className="profile-card"><h3>Portfolio Builder</h3><p className="profile-hint">项目 ZIP、README、技术栈与证据会成为 AI 可选择的申请素材。</p><label className="oauth-connect">上传项目 ZIP<input hidden type="file" accept=".zip,application/zip" onChange={importZip}/></label><form onSubmit={save} className="portfolio-form"><input required placeholder="项目标题" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><textarea required placeholder="项目说明与本人贡献" value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/><input placeholder="作品或仓库链接（HTTPS）" value={form.link} onChange={e=>setForm({...form,link:e.target.value})}/><input placeholder="技能，以逗号分隔" value={form.skills} onChange={e=>setForm({...form,skills:e.target.value})}/><textarea placeholder="可核验证据或验收结果" value={form.evidence} onChange={e=>setForm({...form,evidence:e.target.value})}/><button className="oauth-connect" type="submit">保存项目</button></form></section>
    <section className="profile-card"><h3>已保存项目</h3>{items.length?items.map(item=><article className="portfolio-item" key={item.id}><h4>{item.title}</h4>{item.archiveName&&<small>来源 ZIP：{item.archiveName} · 已解析 {item.parsedFiles?.length||0} 个展示文件</small>}<p>{item.summary}</p><div className="profile-skills">{item.skills.map(skill=><span key={skill}>{skill}</span>)}</div>{item.evidence&&<p className="application-note">证据：{item.evidence}</p>}{item.link&&<a href={item.link} target="_blank" rel="noreferrer">查看证据链接 ↗</a>}{item.githubRepo&&<a href={item.githubRepo} target="_blank" rel="noreferrer">查看 GitHub 仓库 ↗</a>}{item.deploymentUrl&&<a href={item.deploymentUrl} target="_blank" rel="noreferrer">查看在线作品 ↗</a>}<button className="danger-action" onClick={()=>remove(item.id)}>删除</button></article>):<p className="profile-hint">尚未保存项目。</p>}</section>
  </div>;
}
