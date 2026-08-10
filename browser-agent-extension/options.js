const token=document.querySelector("#token");const hn=document.querySelector("#hn");const status=document.querySelector("#status");
chrome.storage.local.get(["agentToken","hnUsername","lastSync"],v=>{token.value=v.agentToken||"";hn.value=v.hnUsername||"";if(v.lastSync)status.textContent="最近同步："+new Date(v.lastSync).toLocaleString();});
document.querySelector("#save").addEventListener("click",async()=>{await chrome.storage.local.set({agentToken:token.value.trim(),hnUsername:hn.value.trim()});status.textContent="已保存，正在连接工作台…";});
