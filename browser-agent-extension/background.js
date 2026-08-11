const API="https://remote-gig-desk-vercel.vercel.app/api/connections";

async function report(headers,action,taskId,extra={}){
  const response=await fetch(API,{method:"POST",headers,body:JSON.stringify({action,taskId,...extra})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||action+"_failed");
  return result;
}

async function fillApplication(task,agentToken){
  const visible=element=>Boolean(element.offsetWidth||element.offsetHeight||element.getClientRects().length);
  const provider=/greenhouse\.io$/i.test(location.hostname)?"greenhouse":/lever\.co$/i.test(location.hostname)?"lever":/ashbyhq\.com$/i.test(location.hostname)?"ashby":/workable\.com$/i.test(location.hostname)?"workable":/(^|\.)proginn\.com$/i.test(location.hostname)?"proginn":"custom";
  const providerRoots={greenhouse:"#application_form,form",lever:"form.application-form,form",ashby:'form,[data-testid*="application"]',workable:'form,[data-ui="application-form"]',proginn:"form,.apply-form,.signup-form",custom:"form"};
  const root=document.querySelector(providerRoots[provider])||document;
  const inputs=[...root.querySelectorAll("input,textarea,select")].filter(visible);
  const protectedCheckpoint=Boolean(document.querySelector('iframe[src*="captcha" i], [class*="captcha" i], input[autocomplete="one-time-code"], input[type="password"]'));
  let filledFields=0;
  const profile=task.applicantProfile||{};
  const values=[
    [/first.?name|given.?name/i,profile.firstName],[/last.?name|family.?name|surname/i,profile.lastName],
    [/(^|\b)full.?name|candidate.?name/i,profile.fullName],[/e-?mail/i,profile.email],[/phone|mobile/i,profile.phone],
    [/location|city|address/i,profile.location],[/linkedin/i,profile.linkedin],[/github/i,profile.github],[/portfolio|website/i,profile.portfolio],
    [/resume.?url|cv.?url|resume.?link/i,profile.resumeUrl],
    [/cover|letter|message|additional|why|note/i,task.applicationLetter],[/rate|salary|compensation|budget/i,task.proposedRate],
  ];
  for(const input of inputs){
    const hint=[input.name,input.id,input.getAttribute("aria-label"),input.placeholder].filter(Boolean).join(" ");
    const value=values.find(([pattern,candidate])=>candidate&&pattern.test(hint))?.[1]||"";
    if(!value||input.value||input.tagName==="SELECT"||input.type==="file"||input.type==="checkbox"||input.type==="radio")continue;
    const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),"value")?.set;
    setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));filledFields++;
  }
  let uploadedAttachments=0;
  const fileInputs=[...root.querySelectorAll('input[type="file"]')];
  for(const attachment of task.attachments||[]){
    const target=fileInputs.find(input=>{
      const hint=[input.name,input.id,input.getAttribute("aria-label"),input.accept].filter(Boolean).join(" ");
      return /resume|cv|attachment|upload/i.test(hint)&&(!input.files||input.files.length===0);
    })||fileInputs.find(input=>!input.files||input.files.length===0);
    if(!target)break;
    const response=await fetch(attachment.url,{headers:{Authorization:"Bearer "+agentToken}});
    if(!response.ok)continue;
    const file=new File([await response.arrayBuffer()],attachment.name,{type:attachment.type});
    const transfer=new DataTransfer();transfer.items.add(file);target.files=transfer.files;
    target.dispatchEvent(new Event("input",{bubbles:true}));target.dispatchEvent(new Event("change",{bubbles:true}));uploadedAttachments++;
  }
  const pageText=document.body.innerText.slice(0,5000);const authenticated=provider!=="proginn"||(!/登录|注册/.test(pageText)||/我的|消息|退出|UID/.test(pageText));
  return {filledFields,uploadedAttachments,protectedCheckpoint,url:location.href,provider,authenticated};
}

function prepareSubmission(){
  const visible=element=>Boolean(element.offsetWidth||element.offsetHeight||element.getClientRects().length);
  const required=[...document.querySelectorAll("input[required],textarea[required],select[required]")].filter(visible);
  const missing=required.filter(input=>input.type!=="checkbox"&&!String(input.value||"").trim());
  const missingRequired=missing.length;
  const missingKinds=[...new Set(missing.map(input=>input.type==="file"?"attachment":input.tagName.toLowerCase()))];
  const legalCheckpoint=[...document.querySelectorAll('input[type="checkbox"]')].filter(visible).some(input=>input.required&&!input.checked);
  const provider=/greenhouse\.io$/i.test(location.hostname)?"greenhouse":/lever\.co$/i.test(location.hostname)?"lever":/ashbyhq\.com$/i.test(location.hostname)?"ashby":/workable\.com$/i.test(location.hostname)?"workable":/(^|\.)proginn\.com$/i.test(location.hostname)?"proginn":"custom";
  const providerSubmit={greenhouse:'#submit_app,button[type="submit"],input[type="submit"]',lever:'button[type="submit"],.postings-btn',ashby:'button[type="submit"]',workable:'button[type="submit"],[data-ui="submit-application"]',proginn:'button[type="submit"],a[class*="apply"],button[class*="apply"]',custom:'button[type="submit"],input[type="submit"]'};
  const buttons=[...document.querySelectorAll(providerSubmit[provider])].filter(visible);
  const submit=buttons.find(button=>/submit (?:application)?|send application|apply now|complete application|立即申请|申请项目|报名|抢单|确认申请/i.test(String(button.innerText||button.value||"")))||buttons[0];
  if(missingRequired)return {outcome:"missing_required",missingRequired,missingKinds,url:location.href};
  if(legalCheckpoint)return {outcome:"protected_checkpoint",reason:"final_legal_confirmation",url:location.href};
  if(!submit)return {outcome:"submit_not_found",url:location.href};
  submit.click();return {outcome:"submitted_click",url:location.href,provider};
}

function detectSubmissionEvidence(){
  const text=document.body.innerText.slice(0,12000);
  const provider=/greenhouse\.io$/i.test(location.hostname)?"greenhouse":/lever\.co$/i.test(location.hostname)?"lever":/ashbyhq\.com$/i.test(location.hostname)?"ashby":/workable\.com$/i.test(location.hostname)?"workable":/(^|\.)proginn\.com$/i.test(location.hostname)?"proginn":"custom";
  const patterns={greenhouse:/thank you for applying|application has been submitted|application received/i,lever:/thank you for applying|application submitted|we received your application/i,ashby:/application submitted|thank you for applying|application received/i,workable:/application (?:has been )?submitted|thank you for applying|application received/i,proginn:/申请成功|报名成功|已申请|已报名|等待甲方|申请已提交/i,custom:/thank you for applying|application (?:has been |was )?(?:received|submitted)|successfully submitted/i};
  const match=text.match(patterns[provider]);
  const confirmed=Boolean(match);
  const stableUrl=location.href.split("#")[0];
  const stablePart=btoa(unescape(encodeURIComponent(stableUrl))).replace(/[^a-z0-9]/gi,"").slice(-48);
  return {confirmed,url:stableUrl,title:document.title,provider,confirmationText:match?.[0]||"",evidenceKind:"official_confirmation_page",evidenceId:confirmed?`${provider}:url:${stablePart}`:"",capturedAt:Date.now()};
}

async function runNextTask(headers,tasks){
  const {activeTaskId}=await chrome.storage.local.get("activeTaskId");
  if(activeTaskId||!tasks.length)return;
  const task=tasks[0];
  const target=task.applicationUrl||task.destination;
  if(!target)return report(headers,"task_failed",task.id,{error:"application_url_missing"});
  await chrome.storage.local.set({activeTaskId:task.id});
  try{
    await report(headers,"task_started",task.id);
    const stored=await chrome.storage.local.get("taskTabs");
    const taskTabs=stored.taskTabs||{};
    let tab=null;
    if(taskTabs[task.id])tab=await chrome.tabs.get(taskTabs[task.id]).catch(()=>null);
    if(!tab){tab=await chrome.tabs.create({url:target,active:false});taskTabs[task.id]=tab.id;await chrome.storage.local.set({taskTabs});}
    await new Promise(resolve=>setTimeout(resolve,5000));
    const injection=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillApplication,args:[task,headers.Authorization.slice(7)]});
    const result=injection[0]?.result||{filledFields:0,protectedCheckpoint:false};
    if(result.protectedCheckpoint){await chrome.tabs.update(tab.id,{active:true});await report(headers,"verification_required",task.id,result);return;}
    if(result.provider&&result.provider!=="custom"&&result.authenticated!==false){
      await report(headers,"record_session",task.id,{platformKey:result.provider,accountLabel:"已验证浏览器会话",siteUrl:result.url,suppressTaskLease:true});
    }
    const prepared=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:prepareSubmission}))[0]?.result;
    if(prepared?.outcome==="protected_checkpoint"){await chrome.tabs.update(tab.id,{active:true});await report(headers,"verification_required",task.id,prepared);return;}
    if(prepared?.outcome!=="submitted_click"){
      await chrome.tabs.update(tab.id,{active:true});await report(headers,"verification_required",task.id,{...result,...prepared,reason:prepared?.outcome||"manual_form_completion_required"});return;
    }
    await new Promise(resolve=>setTimeout(resolve,7000));
    const evidence=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:detectSubmissionEvidence}))[0]?.result;
    if(evidence?.confirmed){await report(headers,"task_submitted",task.id,{evidenceUrl:evidence.url,evidenceId:evidence.evidenceId,evidenceKind:evidence.evidenceKind,confirmationText:evidence.confirmationText,provider:evidence.provider,capturedAt:evidence.capturedAt});delete taskTabs[task.id];await chrome.storage.local.set({taskTabs});}
    else {await chrome.tabs.update(tab.id,{active:true});await report(headers,"verification_required",task.id,{...result,submissionPending:true,url:evidence?.url||prepared.url,reason:"official_confirmation_not_detected"});}
  }catch(error){
    await report(headers,"task_failed",task.id,{error:String(error)}).catch(()=>{});
  }finally{
    await chrome.storage.local.remove("activeTaskId");
  }
}

async function sync(){
  const {agentToken,hnUsername}=await chrome.storage.local.get(["agentToken","hnUsername"]);
  if(!agentToken)return;
  const headers={"Content-Type":"application/json","Authorization":"Bearer "+agentToken};
  try{
    const heartbeat=await fetch(API,{method:"POST",headers,body:JSON.stringify({action:"heartbeat",agentVersion:chrome.runtime.getManifest().version})});
    const heartbeatData=await heartbeat.json();
    if(!heartbeat.ok)throw new Error(heartbeatData.error||"heartbeat_failed");
    let currentTasks=heartbeatData.tasks||[];
    const hnCookie=await chrome.cookies.get({url:"https://news.ycombinator.com",name:"user"});
    if(hnCookie&&hnUsername){
      const sessionResponse=await fetch(API,{method:"POST",headers,body:JSON.stringify({
        action:"record_session",platformKey:"hackernews",accountLabel:hnUsername,
        siteUrl:"https://news.ycombinator.com"
      })});
      const sessionData=await sessionResponse.json();
      currentTasks=sessionData.tasks||currentTasks;
      await chrome.storage.local.set({queuedTasks:currentTasks});
    }else{
      await chrome.storage.local.set({queuedTasks:heartbeatData.tasks||[]});
    }
    await runNextTask(headers,currentTasks);
    await chrome.storage.local.set({lastSync:Date.now(),lastError:""});
  }catch(error){
    await chrome.storage.local.set({lastError:String(error),lastSync:Date.now()});
  }
}
chrome.runtime.onInstalled.addListener(()=>{chrome.runtime.openOptionsPage();sync();});
chrome.runtime.onStartup.addListener(sync);
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
chrome.alarms.create("gig-desk-heartbeat",{periodInMinutes:1});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==="gig-desk-heartbeat")sync();});
chrome.storage.onChanged.addListener(changes=>{if(changes.agentToken||changes.hnUsername)sync();});
sync();
