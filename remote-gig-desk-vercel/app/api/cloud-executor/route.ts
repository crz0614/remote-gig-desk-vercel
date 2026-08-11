import { createHash,randomUUID } from "crypto";
import { Sandbox } from "@vercel/sandbox";
import { getChatGPTUser } from "../../chatgpt-auth";
import { db,ensureDatabase } from "../../../db";
import { unseal } from "../../../lib/secret-store";
import { applicantProfileForForms } from "../../../lib/applicant-profile";
import { atsProviderForUrl } from "../../../lib/ats-adapter";
import { validateSubmissionEvidence } from "../../../lib/submission-evidence";

export const maxDuration=300;
const runner=String.raw`
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const task=JSON.parse(fs.readFileSync('/vercel/sandbox/task.json','utf8'));const browser=await chromium.launch({headless:true});const page=await browser.newPage();
try{await page.goto(task.url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(2500);const checkpoint=await page.locator('iframe[src*="captcha" i],input[autocomplete="one-time-code"],input[type="password"],[class*="captcha" i]').count();if(checkpoint)throw Object.assign(new Error('protected_checkpoint'),{checkpoint:true});
const values=[['first name',task.profile.firstName],['last name',task.profile.lastName],['full name',task.profile.fullName],['email',task.profile.email],['phone',task.profile.phone],['location',task.profile.location],['linkedin',task.profile.linkedin],['github',task.profile.github],['portfolio',task.profile.portfolio],['cover letter',task.letter],['message',task.letter],['why',task.letter]];
for(const input of await page.locator('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea').all()){const hint=((await input.getAttribute('name'))||'')+' '+((await input.getAttribute('id'))||'')+' '+((await input.getAttribute('placeholder'))||'')+' '+((await input.getAttribute('aria-label'))||'');if(await input.inputValue().catch(()=>''))continue;const found=values.find(([key,value])=>value&&hint.toLowerCase().includes(key));if(found)await input.fill(String(found[1])).catch(()=>{});}
const files=await page.locator('input[type=file]').all();for(let i=0;i<Math.min(files.length,task.attachments.length);i++)await files[i].setInputFiles(task.attachments[i].path).catch(()=>{});
const missing=await page.locator('input[required],textarea[required],select[required]').evaluateAll(nodes=>nodes.filter(n=>{if(n.type==='file')return !n.files?.length;if(n.type==='checkbox'||n.type==='radio')return !n.checked;return !String(n.value||'').trim()}).length);if(missing)throw Object.assign(new Error('missing_required_fields'),{checkpoint:true});
const submit=page.locator('button[type=submit],input[type=submit],#submit_app,[data-ui="submit-application"]').first();if(!await submit.count())throw Object.assign(new Error('submit_not_found'),{checkpoint:true});await submit.click();await page.waitForTimeout(7000);
const text=(await page.locator('body').innerText()).slice(0,12000);const match=text.match(/thank you for applying|application (?:has been |was )?(?:received|submitted)|we received your application|successfully submitted/i);if(!match)throw Object.assign(new Error('official_confirmation_not_detected'),{checkpoint:true});
console.log(JSON.stringify({ok:true,url:page.url().split('#')[0],confirmationText:match[0],title:await page.title()}));}catch(error){console.log(JSON.stringify({ok:false,checkpoint:Boolean(error.checkpoint),error:String(error.message||error),url:page.url()}));}finally{await browser.close();}})();`;
function safeName(value:string,index:number){return `${index}-${value.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"resume.docx"}`;}

export async function POST(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"sign_in_required"},{status:401});await ensureDatabase();const sql=db();
  const rows=await sql`UPDATE applications SET status=${"browser_in_progress"},delivery_state=${"cloud_browser_running"},updated_at=${Date.now()} WHERE id=(SELECT id FROM applications WHERE owner_email=${user.email} AND status=${"queued_for_browser"} AND platform_key IN (${"greenhouse"},${"lever"},${"ashby"},${"workable"}) ORDER BY created_at ASC LIMIT 1) RETURNING id,title,application_url AS "applicationUrl",destination,platform_key AS "platformKey",application_letter AS "applicationLetter",materials`;
  if(!rows.length)return Response.json({processed:0,status:"idle"});const task=rows[0] as any,url=String(task.applicationUrl||task.destination||"");
  const [profiles,portfolio,attachments]=await Promise.all([
    sql`SELECT profile_ciphertext AS "profileCiphertext" FROM private_profiles WHERE owner_email=${user.email} LIMIT 1`,
    sql`SELECT link FROM portfolio_items WHERE owner_email=${user.email} AND link<>${""} ORDER BY position ASC LIMIT 10`,
    sql`SELECT id,filename,content_type AS "contentType",content FROM application_attachments WHERE owner_email=${user.email} AND id=ANY(${(task.materials?.attachments||[]).map((item:any)=>String(item.id))})`,
  ]);
  let privateProfile:unknown={};try{if((profiles[0] as any)?.profileCiphertext)privateProfile=JSON.parse(await unseal(String((profiles[0] as any).profileCiphertext)));}catch{}
  const profile=applicantProfileForForms(privateProfile,(portfolio as any[]).map(item=>String(item.link)),user.email),sandboxName=`remote-gig-${createHash("sha256").update(user.email).digest("hex").slice(0,12)}`;
  try{
    const sandbox=await Sandbox.getOrCreate({name:sandboxName,persistent:true,timeout:15*60_000,onCreate:async box=>{let command=await box.runCommand("npm",["install","playwright@1.55.0"],{timeoutMs:120000});if(command.exitCode!==0)throw new Error("playwright_install_failed");command=await box.runCommand("npx",["playwright","install","--with-deps","chromium"],{timeoutMs:180000});if(command.exitCode!==0)throw new Error("chromium_install_failed");}});
    const files=(attachments as any[]).map((item,index)=>({path:`/vercel/sandbox/${safeName(item.filename,index)}`,content:Buffer.from(item.content)}));
    await sandbox.writeFiles([{path:"/vercel/sandbox/runner.cjs",content:Buffer.from(runner)},{path:"/vercel/sandbox/task.json",content:Buffer.from(JSON.stringify({url,profile,letter:task.applicationLetter,attachments:(attachments as any[]).map((item,index)=>({path:`/vercel/sandbox/${safeName(item.filename,index)}`}))}))},...files]);
    const command=await sandbox.runCommand("node",["/vercel/sandbox/runner.cjs"],{timeoutMs:90000});const output=(await command.stdout()).trim().split("\n").pop()||"{}";const result=JSON.parse(output);const now=Date.now();
    if(result.ok){const provider=atsProviderForUrl(url);const stable=createHash("sha256").update(String(result.url)).digest("hex").slice(0,32);const evidence=validateSubmissionEvidence({evidenceUrl:result.url,evidenceId:`${provider}:cloud:${stable}`,evidenceKind:"official_confirmation_page",confirmationText:result.confirmationText,provider,capturedAt:now},url);await sql`UPDATE applications SET status=${"submitted"},delivery_state=${"platform_accepted"},receipt_id=${evidence.evidenceId},receipt_url=${evidence.evidenceUrl},delivered_at=${now},evidence=${JSON.stringify({...evidence,reportedBy:"vercel_sandbox",reportedAt:now})}::jsonb,last_error=${""},updated_at=${now} WHERE id=${task.id} AND owner_email=${user.email}`;await sql`INSERT INTO application_events(id,owner_email,application_id,event_type,status,message,evidence_id,evidence_url,created_at) VALUES(${randomUUID()},${user.email},${task.id},${"CLOUD_TASK_SUBMITTED"},${"submitted"},${"云端浏览器识别到 ATS 正式确认页"},${evidence.evidenceId},${evidence.evidenceUrl},${now})`;return Response.json({processed:1,status:"submitted",taskId:task.id});}
    await sql`UPDATE applications SET status=${"verification_required"},delivery_state=${"verification_required"},last_error=${String(result.error||"cloud_checkpoint")},updated_at=${now} WHERE id=${task.id} AND owner_email=${user.email}`;await sql`INSERT INTO application_events(id,owner_email,application_id,event_type,status,message,created_at) VALUES(${randomUUID()},${user.email},${task.id},${"CLOUD_CHECKPOINT"},${"verification_required"},${"云端执行遇到受保护步骤，已转入人工接管队列"},${now})`;return Response.json({processed:1,status:"verification_required",taskId:task.id});
  }catch(error){const now=Date.now(),message=error instanceof Error?error.message:"cloud_executor_failed";await sql`UPDATE applications SET status=${"queued_for_browser"},delivery_state=${"cloud_unavailable"},last_error=${message},updated_at=${now} WHERE id=${task.id} AND owner_email=${user.email}`;console.error("cloud_executor_failed",error);return Response.json({processed:0,status:"unavailable",error:message},{status:503});}
}
