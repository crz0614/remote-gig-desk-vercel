const API="https://remote-gig-desk-vercel.vercel.app/api/connections";

async function sync(){
  const {agentToken,hnUsername}=await chrome.storage.local.get(["agentToken","hnUsername"]);
  if(!agentToken)return;
  const headers={"Content-Type":"application/json","Authorization":"Bearer "+agentToken};
  try{
    const heartbeat=await fetch(API,{method:"POST",headers,body:JSON.stringify({action:"heartbeat"})});
    const heartbeatData=await heartbeat.json();
    if(!heartbeat.ok)throw new Error(heartbeatData.error||"heartbeat_failed");
    const hnCookie=await chrome.cookies.get({url:"https://news.ycombinator.com",name:"user"});
    if(hnCookie&&hnUsername){
      const sessionResponse=await fetch(API,{method:"POST",headers,body:JSON.stringify({
        action:"record_session",platformKey:"hackernews",accountLabel:hnUsername,
        siteUrl:"https://news.ycombinator.com"
      })});
      const sessionData=await sessionResponse.json();
      await chrome.storage.local.set({queuedTasks:sessionData.tasks||heartbeatData.tasks||[]});
    }else{
      await chrome.storage.local.set({queuedTasks:heartbeatData.tasks||[]});
    }
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
