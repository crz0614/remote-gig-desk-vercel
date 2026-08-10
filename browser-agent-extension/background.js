const API="https://remote-gig-desk-vercel.vercel.app/api/connections";

async function report(headers,action,taskId,extra={}){
  const response=await fetch(API,{method:"POST",headers,body:JSON.stringify({action,taskId,...extra})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||action+"_failed");
  return result;
}

function fillApplication(task){
  const visible=element=>Boolean(element.offsetWidth||element.offsetHeight||element.getClientRects().length);
  const inputs=[...document.querySelectorAll("input,textarea")].filter(visible);
  const protectedCheckpoint=Boolean(document.querySelector('iframe[src*="captcha" i], [class*="captcha" i], input[autocomplete="one-time-code"], input[type="password"]'));
  let filledFields=0;
  const profile=task.applicantProfile||{};
  const values=[
    [/first.?name|given.?name/i,profile.firstName],[/last.?name|family.?name|surname/i,profile.lastName],
    [/(^|\b)full.?name|candidate.?name/i,profile.fullName],[/e-?mail/i,profile.email],[/phone|mobile/i,profile.phone],
    [/location|city|address/i,profile.location],[/linkedin/i,profile.linkedin],[/github/i,profile.github],[/portfolio|website/i,profile.portfolio],
    [/cover|letter|message|additional|why|note/i,task.applicationLetter],[/rate|salary|compensation|budget/i,task.proposedRate],
  ];
  for(const input of inputs){
    const hint=[input.name,input.id,input.getAttribute("aria-label"),input.placeholder].filter(Boolean).join(" ");
    const value=values.find(([pattern,candidate])=>candidate&&pattern.test(hint))?.[1]||"";
    if(!value||input.value)continue;
    const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),"value")?.set;
    setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));filledFields++;
  }
  return {filledFields,protectedCheckpoint,url:location.href};
}

function prepareSubmission(){
  const visible=element=>Boolean(element.offsetWidth||element.offsetHeight||element.getClientRects().length);
  const required=[...document.querySelectorAll("input[required],textarea[required],select[required]")].filter(visible);
  const missingRequired=required.filter(input=>input.type!=="checkbox"&&!String(input.value||"").trim()).length;
  const legalCheckpoint=[...document.querySelectorAll('input[type="checkbox"]')].filter(visible).some(input=>input.required&&!input.checked)||/I (?:agree|certify)|terms and conditions|privacy consent/i.test(document.body.innerText);
  const buttons=[...document.querySelectorAll('button,input[type="submit"]')].filter(visible);
  const submit=buttons.find(button=>/submit (?:application)?|send application|apply now|complete application/i.test(String(button.innerText||button.value||"")));
  if(missingRequired)return {outcome:"missing_required",missingRequired,url:location.href};
  if(legalCheckpoint)return {outcome:"protected_checkpoint",reason:"final_legal_confirmation",url:location.href};
  if(!submit)return {outcome:"submit_not_found",url:location.href};
  submit.click();return {outcome:"submitted_click",url:location.href};
}

function detectSubmissionEvidence(){
  const text=document.body.innerText.slice(0,12000);
  const confirmed=/thank you for applying|application (?:has been |was )?(?:received|submitted)|successfully submitted|we have received your application/i.test(text)||/(?:thank-you|confirmation|application-submitted|application-success)/i.test(location.pathname);
  return {confirmed,url:location.href,title:document.title};
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
    const tab=await chrome.tabs.create({url:target,active:false});
    await new Promise(resolve=>setTimeout(resolve,5000));
    const injection=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillApplication,args:[task]});
    const result=injection[0]?.result||{filledFields:0,protectedCheckpoint:false};
    if(result.protectedCheckpoint){await report(headers,"verification_required",task.id,result);return;}
    const prepared=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:prepareSubmission}))[0]?.result;
    if(prepared?.outcome==="protected_checkpoint"){await report(headers,"verification_required",task.id,prepared);return;}
    if(prepared?.outcome!=="submitted_click"){await report(headers,"form_inspected",task.id,{...result,...prepared});return;}
    await new Promise(resolve=>setTimeout(resolve,7000));
    const evidence=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:detectSubmissionEvidence}))[0]?.result;
    if(evidence?.confirmed)await report(headers,"task_submitted",task.id,{evidenceUrl:evidence.url,evidenceId:`browser-confirmation:${Date.now()}`});
    else await report(headers,"form_inspected",task.id,{...result,submissionPending:true,url:evidence?.url||prepared.url});
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
    const heartbeat=await fetch(API,{method:"POST",headers,body:JSON.stringify({action:"heartbeat"})});
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
chrome.alarms.create("gig-desk-heartbeat",{periodInMinutes:1});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==="gig-desk-heartbeat")sync();});
chrome.storage.onChanged.addListener(changes=>{if(changes.agentToken||changes.hnUsername)sync();});
sync();
