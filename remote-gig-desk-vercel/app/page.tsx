"use client";

import { useEffect, useMemo, useState } from "react";

type Gig = { id:string; title:string; source:string; sourceUrl:string; publishedAt:string; budget:string; match:number; competition:"低"|"中"; skills:string[]; summary:string; fullText:string; remote:string; application:string };
type ApiData = { gigs:Gig[]; sources:{name:string;ok:boolean}[]; fetchedAt:string };
type Reply = { id:string; company:string; subject:string; date:string; status:string; tone:"action"|"info"|"warning"; summary:string; translation:string; original:string; next:string; gmailUrl:string };
type ApplicationPack = { gig:Gig; quote:string; matchedSkills:string[]; resume:string[]; coverLetter:string; language:"en"|"zh"; workMode:string };
type ChannelConnection = { id:string; name:string; mode:string; capability:string; status:string; accountLabel?:string };
type ApplicationRecord = { id:string; gigId:string; title:string; source:string; sourceUrl:string; status:string; deliveryChannel:string; proposedRate:string; createdAt:string; updatedAt:string };

const profileSkills=["C/C++","Rust","Go","Java","C#","Python","JavaScript","并发与无锁编程","操作系统与内存","TCP/IP与Socket","BGP/OSPF","VXLAN/EVPN","SDN","Kubernetes","Docker","Redis/Kafka","Unity/Unreal","HLSL/GLSL/Metal","性能调优与排障"];
const profileExperience=[
  {period:"2025.06–2025.12",title:"软件工程实习生（后端与网络方向）",org:"腾讯科技（香港）有限公司 · Tencent Technology (Hong Kong) Limited",project:"跨国实时对战游戏及跨境金融网关低延迟架构升级",result:"使用 Go、C++、BGP Anycast、TCP BBR 与自定义 QUIC RPC 优化跨境链路及服务端，六个月迭代周期内核心对战平均延迟降低61%。"},
  {period:"2025.01–2025.05",title:"基础设施与云原生工程师（合同制）",org:"Revolut 科技有限公司 · Revolut Ltd. · 英国伦敦",project:"高可用云原生改造与多活网络重构",result:"主导 SRv6/VXLAN 双活网络及 Java、Kubernetes 性能改造；交付后监控显示单节点QPS达到原来的3倍，容器成本下降20%。"},
  {period:"2023.10–2024.08",title:"高级工程项目开发人员",org:"曼彻斯特大学计算机科学系 · University of Manchester — Department of Computer Science",project:"医疗边缘计算应用及本地数据中心升级",result:"使用 Rust 开发医疗数据采集与加密网关，参与万兆 Spine-Leaf 网络升级；交付后首个完整季度影像调阅耗时缩短超过80%。"},
];

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/></>, brief:<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>, mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>, saved:<path d="M6 3h12v18l-6-4-6 4V3Z"/>, user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>, check:<path d="m5 12 4 4L19 6"/>, arrow:<path d="m9 18 6-6-6-6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

function age(iso:string){ const hours=(Date.now()-new Date(iso).getTime())/3600000; return hours<1?`${Math.max(1,Math.round(hours*60))} 分钟前`:hours<24?`${Math.round(hours)} 小时前`:hours<48?"昨天":`${Math.round(hours/24)} 天前`; }

function suggestedQuote(gig:Gig){
  const text=`${gig.title} ${gig.summary} ${gig.fullText} ${gig.skills.join(' ')}`.toLowerCase();
  const high=/(distributed|kubernetes|network|protocol|compiler|render|engine|security|blockchain|rust|c\+\+|架构|并发|协议|渲染|引擎)/i.test(text);
  const medium=high||gig.skills.length>=3||/(backend|api|automation|react|python|java|go|llm|ai)/i.test(text);
  if(/bug|issue|fix|patch|debug|修复|错误/i.test(text))return high?'$800–1,500（固定价）':'$400–900（固定价）';
  if(/contract|part.?time|long.?term|长期|合同/i.test(text))return high?'$60–85/小时':'$45–70/小时';
  return high?'$2,500–5,000（项目价）':medium?'$1,200–2,800（项目价）':'$600–1,500（项目价）';
}

function englishQuote(gig:Gig){
  return (gig.budget==='预算面议'?suggestedQuote(gig):gig.budget)
    .replace('（固定价）',' fixed project').replace('（项目价）',' fixed project').replace('/小时','/hour').replace('预算面议','Rate negotiable');
}

function isChinesePartner(gig:Gig){
  const original=`${gig.title} ${gig.fullText}`;
  const chinese=(original.match(/[\u4e00-\u9fff]/g)||[]).length;
  return /中国大陆|中国甲方|北京|上海|深圳|杭州|广州|成都|腾讯|阿里|字节|百度/.test(original)||chinese>Math.max(30,original.length*.18);
}

function chineseBrief(gig:Gig){
  const text=`${gig.title} ${gig.fullText} ${gig.summary}`.toLowerCase();
  const work:string[]=[]; const requirements:string[]=[]; const deliverables:string[]=[];
  if(/soroban|stellar|on-chain|contract event/.test(text)){work.push('为 Soroban / Stellar 智能合约增加链上事件历史与订阅数据查看功能。','通过 Stellar RPC 按合约 ID 获取事件，并正确处理创建、续订、取消和到期等生命周期事件。');requirements.push('熟悉 Stellar / Soroban RPC、智能合约事件或同类区块链数据接口。');}
  if(/react|tsx|frontend|ui|viewer|table/.test(text)){work.push('开发清晰的前端事件列表，展示事件类型、时间、订阅者地址和金额等关键字段。');requirements.push('能够使用 React / TypeScript 构建可访问、响应式的 Web 界面。');}
  if(/rust/.test(text))requirements.push('具备 Rust 工程经验，能够理解现有代码结构并安全修改。');
  if(/go|golang/.test(text))requirements.push('具备 Go 后端或高并发服务开发经验。');
  if(/python/.test(text))requirements.push('具备 Python 开发、自动化或数据处理经验。');
  if(/api|backend|rpc/.test(text))requirements.push('能够完成 API / RPC 集成、异常处理和数据结构整理。');
  if(/csv|export/.test(text))deliverables.push('提供事件日志 CSV 导出功能，导出过程不依赖额外服务器往返。');
  if(/aria|keyboard|accessible|responsive/.test(text))deliverables.push('页面需包含 ARIA 标签、键盘导航和响应式布局。');
  if(/test|acceptance|criteria/.test(text))deliverables.push('按原需求中的验收标准补充测试，并确保现有功能不回退。');
  if(!work.length)work.push(`围绕“${gig.title}”完成现有项目中的功能开发、集成和交付。`);
  if(!requirements.length)requirements.push(...(gig.skills.length?gig.skills:['相关软件开发经验']).map(x=>`具备 ${x} 相关工程经验。`).slice(0,4));
  if(!deliverables.length)deliverables.push('提交可运行的代码、必要测试及简洁的实现说明，并配合验收修改。');
  return `项目目标\n${work.map(x=>`• ${x}`).join('\n')}\n\n核心要求\n${requirements.slice(0,5).map(x=>`• ${x}`).join('\n')}\n\n交付与验收\n${deliverables.slice(0,4).map(x=>`• ${x}`).join('\n')}\n\n工作方式：${gig.remote}。${gig.budget==='预算面议'?`甲方未明确预算；建议报价为 ${suggestedQuote(gig)}。`:`甲方标注预算为 ${gig.budget}。`}`;
}

function createApplicationPack(gig:Gig):ApplicationPack{
  const text=`${gig.title} ${gig.summary} ${gig.fullText} ${gig.skills.join(' ')}`.toLowerCase();
  const chinese=isChinesePartner(gig);
  const candidates=chinese?[
    [/c\+\+|cpp|game|engine|render|unreal|unity|游戏|渲染/i,"C/C++ · 高并发服务端与游戏网络"],[/rust|memory safe|edge|边缘/i,"Rust · 内存安全与边缘计算"],[/go|golang|microservice|微服务/i,"Go · 微服务与高并发网关"],[/java|spring|jvm/i,"Java · 云原生后端与 JVM 调优"],[/python|automation|llm|ai/i,"Python · 自动化与 AI 应用"],[/kubernetes|k8s|docker|cloud|云原生/i,"Kubernetes / Docker · 云原生交付"],[/network|tcp|quic|bgp|vxlan|sdn|网络|协议/i,"网络协议与架构 · TCP/IP、QUIC、BGP、VXLAN"],[/performance|latency|debug|性能|延迟|排障/i,"性能调优 · 延迟、吞吐与全链路排障"]
  ]:[
    [/c\+\+|cpp|game|engine|render|unreal|unity/i,"C/C++ · high-concurrency servers and game networking"],[/rust|memory safe|edge/i,"Rust · memory-safe systems and edge computing"],[/go|golang|microservice/i,"Go · microservices and high-throughput gateways"],[/java|spring|jvm/i,"Java · cloud-native backends and JVM optimisation"],[/python|automation|llm|ai/i,"Python · automation and AI applications"],[/kubernetes|k8s|docker|cloud/i,"Kubernetes / Docker · cloud-native delivery"],[/network|tcp|quic|bgp|vxlan|sdn/i,"Network architecture · TCP/IP, QUIC, BGP and VXLAN"],[/performance|latency|debug/i,"Performance engineering · latency, throughput and debugging"]
  ];
  const matched=candidates.filter(([re])=>(re as RegExp).test(text)).map(([,label])=>label as string).slice(0,5);
  if(!matched.length) matched.push(...gig.skills.slice(0,4));
  const bullets:string[]=[];
  if(chinese){
    if(/network|tcp|quic|latency|bgp|vxlan|网络|协议|延迟/i.test(text))bullets.push("在腾讯科技（香港）项目中使用 Go、C++、BGP Anycast、TCP BBR 与 QUIC RPC 优化跨境链路，核心对战平均延迟降低 61%。");
    if(/cloud|kubernetes|java|backend|distributed|云原生|后端|分布式/i.test(text))bullets.push("在 Revolut 合同项目中完成 SRv6/VXLAN 双活网络及 Java、Kubernetes 性能改造，单节点 QPS 提升至 3 倍，容器成本下降 20%。");
    if(/rust|edge|iot|medical|data|边缘|物联网/i.test(text))bullets.push("在曼彻斯特大学工程项目中使用 Rust 开发边缘数据采集与加密网关，影像调阅耗时缩短超过 80%。");
    if(!bullets.length)bullets.push("具备四年软件与基础设施工程经验，能够完成从底层网络、系统性能到后端业务的端到端交付与故障定位。");
  }else{
    if(/network|tcp|quic|latency|bgp|vxlan/i.test(text))bullets.push("Optimised cross-border networking and game-server transport at Tencent Technology (Hong Kong) using Go, C++, BGP Anycast, TCP BBR and QUIC RPC, reducing average match latency by 61%.");
    if(/cloud|kubernetes|java|backend|distributed/i.test(text))bullets.push("Delivered SRv6/VXLAN active-active networking and Java/Kubernetes performance improvements for Revolut, increasing per-node QPS by 3× while reducing container costs by 20%.");
    if(/rust|edge|iot|medical|data|soroban|stellar/i.test(text))bullets.push("Built a Rust-based edge data collection and encryption gateway in a University of Manchester engineering project, reducing medical-image retrieval time by more than 80%.");
    if(!bullets.length)bullets.push("Four years of software and infrastructure engineering experience spanning systems, performance, backend delivery and end-to-end troubleshooting.");
  }
  const quote=chinese?(gig.budget==='预算面议'?suggestedQuote(gig):gig.budget):englishQuote(gig);
  const coverLetter=chinese?`您好，\n\n我希望申请“${gig.title}”项目。我具备四年软件与基础设施工程经验，与该需求最相关的能力包括：${matched.slice(0,3).join('、')}。${bullets[0]}\n\n我目前往返于中国香港与英国曼彻斯特，可接受远程合同合作。期望报价为 ${quote}，最终价格可根据确认后的范围与交付物协商。\n\n此致\nVesper Chen`:`Hello,\n\nI am applying for ${gig.title}. I have four years of hands-on software and infrastructure engineering experience, with the strongest fit in ${matched.slice(0,3).join(', ')}. ${bullets[0]}\n\nI am based between Hong Kong and Manchester, authorised to work in Hong Kong, the United Kingdom and Mainland China without employer sponsorship, and available for remote contract work. My expected rate is ${quote}; the final quote can be refined once the scope and deliverables are confirmed.\n\nBest regards,\nVesper Chen`;
  return {gig,quote,matchedSkills:matched,resume:bullets.slice(0,3),coverLetter,language:chinese?"zh":"en",workMode:chinese?gig.remote:"Remote contract / open-source project"};
}

export default function Home(){
  const [data,setData]=useState<ApiData|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [activeTab,setActiveTab]=useState("机会"); const [filter,setFilter]=useState("推荐"); const [query,setQuery]=useState("");
  const [saved,setSaved]=useState<string[]>([]); const [applied,setApplied]=useState<string[]>([]); const [selected,setSelected]=useState<Gig|null>(null);
  const [checked,setChecked]=useState<string[]>([]); const [applicationPack,setApplicationPack]=useState<ApplicationPack|null>(null); const [batchPacks,setBatchPacks]=useState<ApplicationPack[]>([]);
  const [connections,setConnections]=useState<ChannelConnection[]>([]); const [queueing,setQueueing]=useState(false); const [queueNotice,setQueueNotice]=useState<{id:string;status:string;channel:string}|null>(null);
  const [batchResult,setBatchResult]=useState<{total:number;success:number;failed:number}|null>(null);
  const [applications,setApplications]=useState<ApplicationRecord[]>([]);
  const [replies,setReplies]=useState<Reply[]>([]); const [selectedReply,setSelectedReply]=useState<Reply|null>(null);
  const [syncingMail,setSyncingMail]=useState(false); const [mailNotice,setMailNotice]=useState("");
  const [translation,setTranslation]=useState(""); const [translatedTitle,setTranslatedTitle]=useState(""); const [translating,setTranslating]=useState(false); const [showOriginal,setShowOriginal]=useState(false);

  const load=async()=>{ setLoading(true);setError("");try{const r=await fetch(`/api/gigs?v=12&t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error();setData(await r.json());}catch{setError("暂时无法获取项目，请稍后重试");}finally{setLoading(false);} };
  const loadBackend=async()=>{try{const [c,a,r]=await Promise.all([fetch('/api/connections',{cache:'no-store'}),fetch('/api/applications',{cache:'no-store'}),fetch('/api/replies',{cache:'no-store'})]);if(c.ok)setConnections((await c.json()).channels||[]);if(a.ok){const apps=(await a.json()).applications||[];setApplications(apps);setApplied(apps.map((x:ApplicationRecord)=>x.gigId));}if(r.ok)setReplies((await r.json()).replies||[]);}catch{}};
  const syncGmail=async()=>{setSyncingMail(true);setMailNotice('');try{const r=await fetch('/api/gmail/sync',{method:'POST'});const result=await r.json();if(!r.ok)throw new Error(result.error||'sync_failed');setMailNotice(`已同步 ${result.synced||0} 封申请相关邮件`);await loadBackend();}catch(error){setMailNotice(`同步失败：${error instanceof Error?error.message:'请重试'}`);}finally{setSyncingMail(false);}};
  useEffect(()=>{ try{setSaved(JSON.parse(localStorage.getItem('gig-saved')||'[]'));}catch{} load();loadBackend(); },[]);
  const toggleSave=(id:string)=>setSaved(v=>{const n=v.includes(id)?v.filter(x=>x!==id):[...v,id];localStorage.setItem('gig-saved',JSON.stringify(n));return n;});
  const markApplied=(id:string)=>setApplied(v=>{const n=v.includes(id)?v:[...v,id];localStorage.setItem('gig-applied',JSON.stringify(n));return n;});
  const toggleChecked=(id:string)=>setChecked(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const startApplication=(gig:Gig)=>{setApplicationPack(createApplicationPack(gig));setSelected(null);};
  const prepareBatch=async()=>{
    if(queueing||!checked.length)return;
    const packs=gigs.filter(g=>checked.includes(g.id)).map(createApplicationPack);
    setQueueing(true);setBatchResult(null);setQueueNotice(null);
    const results=await Promise.all(packs.map(async pack=>{
      try{
        const r=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pack)});
        if(!r.ok)throw new Error();
        const result=await r.json();
        return {ok:true,gigId:pack.gig.id,id:result.id};
      }catch{return {ok:false,gigId:pack.gig.id,id:''};}
    }));
    const successful=results.filter(x=>x.ok).map(x=>x.gigId);
    if(successful.length){
      setApplied(v=>{const n=[...new Set([...v,...successful])];localStorage.setItem('gig-applied',JSON.stringify(n));return n;});
      setChecked(v=>v.filter(id=>!successful.includes(id)));
    }
    setBatchPacks([]);setApplicationPack(null);
    setBatchResult({total:packs.length,success:successful.length,failed:packs.length-successful.length});
    setQueueing(false);
  };
  const confirmPack=async(pack:ApplicationPack)=>{setQueueing(true);setQueueNotice(null);try{const r=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pack)});if(!r.ok)throw new Error();const result=await r.json();markApplied(pack.gig.id);setQueueNotice({id:result.id,status:result.status,channel:result.deliveryChannel});setBatchPacks(v=>v.filter(x=>x.gig.id!==pack.gig.id));setChecked(v=>v.filter(id=>id!==pack.gig.id));}catch{setQueueNotice({id:'',status:'queue_failed',channel:'none'});}finally{setQueueing(false);}};
  const updateApplicationStatus=async(id:string,action:"mark_submitted"|"needs_verification"|"reopen"|"cancel")=>{setQueueing(true);try{const r=await fetch('/api/applications/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});if(!r.ok)throw new Error();await loadBackend();}catch{setMailNotice('状态更新失败，请重试');}finally{setQueueing(false);}};
  const gigs=data?.gigs??[];
  const visible=useMemo(()=>{let v=activeTab==='收藏'?gigs.filter(g=>saved.includes(g.id)):activeTab==='进度'?gigs.filter(g=>applied.includes(g.id)):gigs;if(query)v=v.filter(g=>`${g.title} ${g.summary} ${g.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()));if(filter==='最新')v=[...v].sort((a,b)=>+new Date(b.publishedAt)-+new Date(a.publishedAt));if(filter==='低竞争')v=v.filter(g=>g.competition==='低');if(filter==='高预算')v=v.filter(g=>g.budget!=='预算面议');return v;},[gigs,activeTab,saved,applied,query,filter]);
  const okSources=data?.sources.filter(s=>s.ok).length??0;
  const decode=(value:string)=>{const box=document.createElement('textarea');box.innerHTML=value;return box.value;};
  const translateGig=async(gig:Gig)=>{setTranslating(true);setTranslation('');setTranslatedTitle('');const cacheKey=`gig-zh-v4-${gig.id}`;try{const cached=localStorage.getItem(cacheKey);if(cached){const parsed=JSON.parse(cached);setTranslation(parsed.text||'');return;}const text=chineseBrief(gig);setTranslation(text);localStorage.setItem(cacheKey,JSON.stringify({text}));}catch{setTranslation('');}finally{setTranslating(false);}};
  const openGig=async(gig:Gig)=>{setSelected(gig);setShowOriginal(false);await translateGig(gig);};
  const copyApplication=(gig:Gig)=>{const pricing=gig.budget==='预算面议'?`甲方未说明预算。请在英文申请中加入期望报价：${suggestedQuote(gig)}，并说明最终价格可根据明确范围协商。`:`甲方预算：${gig.budget}，请在该范围内协商。`;navigator.clipboard?.writeText(`请帮我申请这个项目：${translatedTitle||gig.title}\n来源：${gig.source}\n原始链接：${gig.sourceUrl}\n${pricing}\n远程：${gig.remote}`);};

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">实时远程外包</p><h1>{activeTab==='机会'?'找到可以直接联系的项目':activeTab==='收藏'?'已收藏的机会':activeTab==='进度'?'接单进度':activeTab==='连接'?'渠道连接中心':activeTab==='回复'?'申请回复中心':'个人工作台'}</h1></div><button className="icon-button" aria-label="刷新项目" onClick={()=>{load();loadBackend()}}><Icon name="bell"/><span className="notification-dot"/></button></header>
    {activeTab==='机会'&&<>
      <div className="live-source-bar"><b><i className={okSources?'online':''}/>{loading?'正在连接真实来源':`已连接 ${okSources}/${data?.sources.length??0} 个真实来源`}</b><span>{data?.sources.map(s=><em className={s.ok?'ok':'down'} key={s.name}>{s.name}</em>)}</span></div>
      <section className="hero-card"><div className="hero-copy"><span className="live-pill"><i/>真实项目 · 原始链接</span><h2>当前找到 <strong>{gigs.length}</strong> 个<br/>可查看机会</h2><p>来自公开需求源；投递前仍请在原页面确认状态与预算</p></div><div className="score-ring"><span>最高</span><b>{gigs[0]?.match??'—'}</b><small>匹配度</small></div></section>
      <section className="quick-stats" aria-label="项目概览"><div><b>{gigs.length}</b><span>实时结果</span></div><div><b>{gigs.filter(g=>g.competition==='低').length}</b><span>低竞争</span></div><div><b>{applications.length}</b><span>申请任务</span></div></section>
      <div className="search-row"><div className="searchbox"><Icon name="search"/><input aria-label="搜索项目" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索 Python、LLM、Java…"/></div><button className="tune" aria-label="刷新" onClick={load}><span/><span/><span/></button></div>
      <div className="filters" role="tablist">{['推荐','最新','低竞争','高预算'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x}</button>)}</div>
      <div className="batch-bar"><span>已选择 <b>{checked.length}</b> / {visible.length}</span><button onClick={()=>setChecked(checked.length===visible.length?[]:visible.map(gig=>gig.id))}>{checked.length===visible.length?'取消全选':`全选 ${visible.length}`}</button><button disabled={queueing||!checked.length} onClick={prepareBatch}>{queueing?'批量处理中…':'申请全部已选'}</button></div>
      {batchResult&&<div className={`queue-result ${batchResult.failed?'failed':'saved'}`}>批量处理完成：已为 {batchResult.success}/{batchResult.total} 个岗位分别生成定制材料并建立申请任务{batchResult.failed?`，${batchResult.failed} 个失败，可保留选择后重试。`:'。'}<small>不会再跳转到第一个岗位；任务状态请在“进度”中查看。</small></div>}
    </>}
    <section className="section-head"><div><h2>{activeTab==='机会'?'真实机会':activeTab==='收藏'?`${visible.length} 个已收藏项目`:activeTab==='进度'?`${applications.length} 个申请任务`:activeTab==='连接'?'逐个平台接入':activeTab==='回复'?`${replies.length} 条申请邮件`:'工作台设置'}</h2><p>{activeTab==='机会'?'每条均可打开原始发布页':activeTab==='连接'?'仅显示经过后端验证的真实状态':activeTab==='回复'?'已排除职位提醒和营销邮件':'申请记录已保存到服务器'}</p></div>{activeTab==='机会'&&<button onClick={load}>刷新 <Icon name="arrow"/></button>}</section>
    <section className="gig-list">
      {activeTab==='进度'?<div className="application-list">{applications.length?applications.map(app=>{
        const labels:Record<string,string>={submitted:'已投递',manual_submission_required:'等待人工确认',detecting_destination:'正在识别投递入口',awaiting_github_authorization:'等待 GitHub 授权',submission_failed:'投递失败',verification_required:'等待登录或验证码',cancelled:'已取消'};
        const label=labels[app.status]||app.status;
        return <article className="gig-card application-record" key={app.id}><div className="card-top"><div className="source-icon">{app.source?.[0]||'申'}</div><div className="source"><b>{app.source}</b><span>{new Date(Number(app.updatedAt)||app.updatedAt).toLocaleString('zh-CN')}</span></div><span className={'reply-status '+(app.status==='submitted'?'info':app.status==='submission_failed'?'warning':'action')}>{label}</span></div><h3>{app.title}</h3><div className="facts"><div><small>申请报价</small><b>{app.proposedRate||'待确认'}</b></div><div><small>投递渠道</small><b>{app.deliveryChannel}</b></div></div><p className="application-note">任务编号：{app.id}</p><a className="secondary-link" href={app.sourceUrl} target="_blank" rel="noreferrer">查看甲方原始页面 ↗</a><div className="progress-actions">{app.status!=='submitted'&&app.status!=='cancelled'&&<button disabled={queueing} onClick={()=>updateApplicationStatus(app.id,'mark_submitted')}>我已在原平台提交</button>}{['detecting_destination','manual_submission_required','submission_failed'].includes(app.status)&&<button disabled={queueing} onClick={()=>updateApplicationStatus(app.id,'needs_verification')}>需要登录或验证码</button>}{app.status==='verification_required'&&<button disabled={queueing} onClick={()=>updateApplicationStatus(app.id,'reopen')}>验证完成，继续处理</button>}{app.status!=='submitted'&&app.status!=='cancelled'&&<button className="danger-action" disabled={queueing} onClick={()=>updateApplicationStatus(app.id,'cancel')}>取消任务</button>}</div></article>;
      }):<div className="empty-card"><h3>还没有申请任务</h3><p>在机会页多选岗位后，点击“申请全部已选”。</p></div>}</div>:activeTab==='回复'?<div className="reply-list">{replies.map(reply=><button className="reply-card" key={reply.id} onClick={()=>setSelectedReply(reply)}><div className="reply-card-top"><span className={`reply-status ${reply.tone}`}>{reply.status}</span><time>{reply.date}</time></div><h3>{reply.subject}</h3><b>{reply.company}</b><p>{reply.summary}</p><span className="reply-open">查看中文与原文 <Icon name="arrow"/></span></button>)}</div>:activeTab==='连接'?<div className="connection-list"><a className="oauth-connect" href="/api/oauth/github/start">授权 GitHub 自动投递</a><a className="oauth-connect" href="/api/oauth/google/start">授权 Gmail 读取回复与发送申请</a><button className="oauth-connect" disabled={syncingMail} onClick={syncGmail}>{syncingMail?"正在同步 Gmail…":"立即同步 Gmail 申请回复"}</button>{mailNotice&&<p className="application-note">{mailNotice}</p>}{connections.length?connections.map(channel=><article className="connection-card" key={channel.id}><div><span className={`connection-dot ${channel.status}`}/><h3>{channel.name}</h3></div><p>{channel.capability}</p><b>{channel.status==='connected'?`已连接${channel.accountLabel?` · ${channel.accountLabel}`:''}`:channel.status==='manual_only'?'仅支持人工提交':channel.status==='adapter_planned'?'等待建立适配器':channel.status==='manual_checkpoint'?'需要人工检查点':'等待 OAuth 授权'}</b></article>):<div className="loading-card"><i/><b>正在读取渠道状态</b><span>连接状态必须由后端验证</span></div>}</div>:activeTab==='我的'?<div className="profile-page"><section className="profile-hero"><div className="avatar">VC</div><div><h2>Vesper Chen</h2><p>Systems · Network · Backend · Game Technology</p><span>中国香港 / 英国曼彻斯特</span></div></section><section className="profile-card"><h3>联系方式与工作偏好</h3><div className="profile-row"><span>求职邮箱</span><b>chenruozhu0614@gmail.com</b></div><div className="profile-row"><span>英语能力</span><b>可作为工作语言</b></div><div className="profile-row"><span>工作形式</span><b>远程外包 / 长期远程合同</b></div><div className="profile-row"><span>沟通偏好</span><b>优先文字沟通</b></div></section><section className="profile-card"><h3>教育经历</h3><div className="education-item"><b>University of Manchester</b><span>Computer Science · 2023–Present</span></div></section><section className="profile-card"><h3>主技能库</h3><p className="profile-hint">申请时只选择与项目匹配的技能，不整库堆叠。</p><div className="profile-skills">{profileSkills.map(skill=><span key={skill}>{skill}</span>)}</div></section><section className="profile-card"><h3>经历与项目</h3><div className="timeline">{profileExperience.map(item=><article key={item.period}><time>{item.period}</time><h4>{item.title}</h4><b>{item.org}</b><strong>{item.project}</strong><p>{item.result}</p></article>)}</div></section><section className="profile-rule"><b>定制简历规则</b><p>按具体需求精准匹配，保持专业深度，不冗余、不虚构、不使用无关技能。</p></section></div>:
      loading?<div className="loading-card"><i/><b>正在获取真实项目</b><span>检查来源与原始链接…</span></div>:
      error?<div className="empty-card"><h3>获取失败</h3><p>{error}</p><button className="retry" onClick={load}>重新获取</button></div>:
      visible.length?visible.map((gig,index)=><article className={`gig-card ${index===0&&activeTab==='机会'?'featured':''}`} key={gig.id}>
        <div className="card-top"><button className={`select-gig ${checked.includes(gig.id)?'selected':''}`} onClick={()=>toggleChecked(gig.id)} aria-label={checked.includes(gig.id)?'取消选择':'选择申请'}>{checked.includes(gig.id)?'✓':''}</button><div className="source-icon">{gig.source[0]}</div><div className="source"><b>{gig.source}</b><span>{age(gig.publishedAt)}</span></div><button className={`bookmark ${saved.includes(gig.id)?'saved':''}`} onClick={()=>toggleSave(gig.id)} aria-label="收藏项目"><Icon name="saved"/></button></div>
        <h3>{gig.title}</h3><p className="summary">{gig.summary}</p><div className="tags">{(gig.skills.length?gig.skills:['其他开发']).map(s=><span key={s}>{s}</span>)}</div>
        <div className="facts"><div><small>{gig.budget==='预算面议'?'建议报价':'甲方预算'}</small><b>{gig.budget==='预算面议'?suggestedQuote(gig):gig.budget}</b></div><div><small>竞争</small><b className="low"><i/>{gig.competition}</b></div><div className="match"><small>匹配度</small><b>{gig.match}%</b></div></div>
        <div className="card-action"><button className="detail-link" onClick={()=>openGig(gig)}>中文详情<Icon name="arrow"/></button><button className="one-click" onClick={()=>startApplication(gig)}>一键申请</button></div>
      </article>):<div className="empty-card"><h3>没有符合条件的项目</h3><p>换一个筛选条件，或点击刷新获取最新需求。</p></div>}
    </section>
    <nav className="bottom-nav" aria-label="主导航">{[['机会','home'],['进度','brief'],['连接','check'],['回复','mail'],['我的','user']].map(([label,icon])=><button key={label} className={activeTab===label?'active':''} onClick={()=>setActiveTab(label)}><Icon name={icon}/><span>{label}</span>{label==='进度'&&applications.length>0&&<i className="badge">{applications.length}</i>}{label==='回复'&&replies.filter(r=>r.tone==='action').length>0&&<i className="badge">{replies.filter(r=>r.tone==='action').length}</i>}</button>)}</nav>
    {selectedReply&&<div className="modal-backdrop" onClick={()=>setSelectedReply(null)}><section className="detail-sheet reply-detail" onClick={e=>e.stopPropagation()}><div className="grabber"/><button className="close" onClick={()=>setSelectedReply(null)}>×</button><span className={`reply-status ${selectedReply.tone}`}>{selectedReply.status}</span><h2>{selectedReply.subject}</h2><p className="reply-company">{selectedReply.company} · {selectedReply.date}</p><h3>中文整理</h3><div className="translation-box"><p>{selectedReply.translation}</p></div><h3>你需要做什么</h3><p className="application-note">{selectedReply.next}</p><h3>邮件原文</h3><div className="original-mail">{selectedReply.original}</div><a className="apply-button" href={selectedReply.gmailUrl} target="_blank" rel="noreferrer">在 Gmail 中打开 ↗</a></section></div>}
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><section className="detail-sheet" onClick={e=>e.stopPropagation()}><div className="grabber"/><button className="close" onClick={()=>setSelected(null)}>×</button><span className="detail-source">{selected.source} · {age(selected.publishedAt)}</span><h2>{translatedTitle||selected.title}</h2>{translatedTitle&&<p className="original-title">英文标题：{selected.title}</p>}<div className="detail-grid"><div><small>{selected.budget==='预算面议'?'甲方预算':'薪资 / 预算'}</small><b>{selected.budget==='预算面议'?'未说明':selected.budget}</b></div><div><small>工作方式</small><b>{selected.remote}</b></div>{selected.budget==='预算面议'&&<div><small>我的建议报价</small><b>{suggestedQuote(selected)}</b></div>}</div><h3>甲方需求（中文翻译）</h3><div className="translation-box">{translating?<span className="translate-loading">正在翻译和整理…</span>:translation?<p>{translation}</p>:<div className="translate-failed"><p>本次翻译请求失败。</p><button onClick={()=>translateGig(selected)}>重新翻译</button></div>}</div><button className="original-toggle" onClick={()=>setShowOriginal(v=>!v)}>{showOriginal?'收起英文原文':'查看英文原文'}</button>{showOriginal&&<p className="original-text">{selected.fullText||selected.summary}</p>}<h3>你需要具备</h3><div className="tags">{(selected.skills.length?selected.skills:['查看完整要求']).map(s=><span key={s}>{s}</span>)}</div><h3>申请方式</h3><p className="application-note">{selected.application}</p><button className="apply-button" onClick={()=>startApplication(selected)}>一键申请此岗位</button><a className="secondary-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">查看原始需求 ↗</a></section></div>}
    {applicationPack&&<div className="modal-backdrop" onClick={()=>setApplicationPack(null)}><section className="detail-sheet application-pack" onClick={e=>e.stopPropagation()}><div className="grabber"/><button className="close" onClick={()=>setApplicationPack(null)}>×</button><span className="detail-source">{applicationPack.language==='en'?'TAILORED APPLICATION PACKAGE':'已自动生成定制申请包'}{batchPacks.length>1?` · ${applicationPack.language==='en'?'QUEUE':'队列剩余'} ${batchPacks.length}`:''}</span><h2>{applicationPack.gig.title}</h2><div className="detail-grid"><div><small>{applicationPack.language==='en'?'PROPOSED RATE':'申请报价'}</small><b>{applicationPack.quote}</b></div><div><small>{applicationPack.language==='en'?'WORK ARRANGEMENT':'工作方式'}</small><b>{applicationPack.workMode}</b></div></div><h3>{applicationPack.language==='en'?'Relevant skills':'精准匹配技能'}</h3><div className="tags">{applicationPack.matchedSkills.map(x=><span key={x}>{x}</span>)}</div><h3>{applicationPack.language==='en'?'Tailored résumé highlights':'定制简历要点'}</h3><ul className="resume-points">{applicationPack.resume.map(x=><li key={x}>{x}</li>)}</ul><h3>{applicationPack.language==='en'?'Application letter':'申请信'}</h3><div className="original-mail">{applicationPack.coverLetter}</div><p className="submission-note">{applicationPack.language==='en'?'Verify that the role is still open and review the proposed rate and factual details before submission.':'提交前请核对岗位仍开放、报价和事实信息。'}</p>{queueNotice&&<div className={`queue-result ${queueNotice.status==='queue_failed'?'failed':'saved'}`}>{queueNotice.status==='queue_failed'?'保存失败，请重试':`任务已写入服务器 · ${queueNotice.channel} · ${queueNotice.status}`}{queueNotice.id&&<small>任务编号：{queueNotice.id}</small>}</div>}<button className="apply-button" disabled={queueing} onClick={()=>confirmPack(applicationPack)}>{queueing?'正在写入服务器…':applicationPack.language==='en'?'Approve and create application task':'确认并创建申请任务'}</button><a className="secondary-link" href={applicationPack.gig.sourceUrl} target="_blank" rel="noreferrer">{applicationPack.language==='en'?'Open original client page ↗':'打开甲方原始页面 ↗'}</a></section></div>}
  </main>;
}
