const API="https://remote-gig-desk-vercel.vercel.app/api/connections";

async function sync(){
  const {agentToken,hnUsername}=await chrome.storage.local.get(["agentToken","hnUsername"]);
  if(!agentToken)return;
  const headers={"Content-Type":"application/json","Authorization":"Bearer "+agentToken};
  try{
    await fetch(API,{method:"POST",headers,body:JSON.stringify({action:"heartbeat"})});
    const hnCookie=await chrome.cookies.get({url:"https://news.ycombinator.com",name:"user"});
    if(hnCookie&&hnUsername){
      await fetch(API,{method:"POST",headers,body:JSON.stringify({
        action:"record_session",platformKey:"hackernews",accountLabel:hnUsername,
        siteUrl:"https://news.ycombinator.com"
      })});
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
