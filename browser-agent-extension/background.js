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
  for(const input of inputs){
    const hint=[input.name,input.id,input.getAttribute("aria-label"),input.placeholder].filter(Boolean).join(" ");
    let value="";
    if(/cover|letter|message|additional|why|note/i.test(hint))value=task.applicationLetter||"";
    if(/rate|salary|compensation|budget/i.test(hint))value=task.proposedRate||"";
    if(!value||input.value)continue;
    const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),"value")?.set;
    setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));filledFields++;
  }
  return {filledFields,protectedCheckpoint,url:location.href};
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
    await report(headers,result.protectedCheckpoint?"verification_required":"form_inspected",task.id,result);
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
