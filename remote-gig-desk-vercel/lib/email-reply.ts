export type ReplyClassification = {
  kind: "suspicious" | "offer" | "interview" | "assessment" | "rejection" | "receipt" | "contact" | "portfolio" | "action" | "info";
  tone: "warning" | "action" | "info";
  status: string;
  summary: string;
  next: string;
  applicationStatus: "response_received" | "submitted";
  deliveryState: "recipient_replied" | "platform_accepted";
};

export function classifyReply(subject: string, text: string): ReplyClassification {
  const value = `${subject} ${text}`.toLowerCase();
  if (/whatsapp|telegram|payment|processing fee|deposit|crypto wallet|gift card/.test(value)) return {kind:"suspicious",tone:"warning",status:"需要核验",summary:"邮件要求转到外部渠道或涉及付款、钱包等敏感事项。",next:"先核验公司域名、合同与发件人身份；不要付款或发送验证码、证件。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/offer letter|pleased to offer|job offer|contract offer/.test(value)) return {kind:"offer",tone:"action",status:"收到 Offer",summary:"对方发送了录用或合同意向。",next:"核对公司、职责、报酬、合同主体与签署期限后再确认。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/unfortunately|not moving forward|other candidates|position has been filled|regret to inform/.test(value)) return {kind:"rejection",tone:"info",status:"未通过",summary:"对方通知本次申请未进入后续阶段。",next:"记录结果并继续其他申请；如邮件邀请，可礼貌保持联系。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/interview|schedule|availability|calendar|meet with/.test(value)) return {kind:"interview",tone:"action",status:"需要安排面试",summary:"对方希望安排面试或确认可用时间。",next:"核对时区与可用时间，准备简洁英文回复。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/assessment|coding test|take.home|technical test|complete the test/.test(value)) return {kind:"assessment",tone:"action",status:"需要完成测评",summary:"对方要求完成技术测评或作业。",next:"确认截止时间、范围和提交方式后安排完成。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/portfolio|work sample|code sample|github profile|project example/.test(value)) return {kind:"portfolio",tone:"action",status:"请求作品集",summary:"对方希望查看作品集、代码样例或相关项目证据。",next:"只发送与该岗位直接相关且已经核验的项目链接。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/phone number|whatsapp number|contact details|best number|how can we reach/.test(value)) return {kind:"contact",tone:"action",status:"请求联系方式",summary:"对方希望补充联系方式以继续沟通。",next:"先核验发件人和公司身份，再通过原邮件线程回复必要联系方式。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  if (/application (?:was |has been )?received|thank you for applying|we received your application|application confirmation/.test(value)) return {kind:"receipt",tone:"info",status:"平台已收件",summary:"这是申请收件确认，可作为平台接收证据；不代表招聘方已阅读。",next:"保存收件记录并等待后续回复。",applicationStatus:"submitted",deliveryState:"platform_accepted"};
  if (/next step|please reply|confirm|question|additional information/.test(value)) return {kind:"action",tone:"action",status:"需要回复",summary:"对方要求确认信息或完成下一步。",next:"核对邮件原文和事实后准备英文回复。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
  return {kind:"info",tone:"info",status:"已收到回复",summary:"这是与申请相关的新邮件，暂未识别到必须立即操作的要求。",next:"核对邮件内容；如只是通知，可记录后继续等待。",applicationStatus:"response_received",deliveryState:"recipient_replied"};
}

export function matchApplicationByTitle(subject: string, text: string, applications: { id: string; title: string; source?: string; destination?: string; applicationUrl?: string }[], sender="") {
  const haystack = (subject + " " + text).toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const application of applications) {
    const tokens = application.title.toLowerCase().match(/[a-z0-9]{4,}|[\u4e00-\u9fff]{2,}/g) || [];
    let score = [...new Set(tokens)].filter(token => haystack.includes(token)).length * 2;
    const sourceTokens=String(application.source||"").toLowerCase().match(/[a-z0-9]{4,}/g)||[];
    score += [...new Set(sourceTokens)].filter(token=>haystack.includes(token)).length;
    for(const value of [application.destination,application.applicationUrl]){
      const raw=String(value||"");
      try{const domain=new URL(raw).hostname.replace(/^www\./,"");if(domain&&sender.toLowerCase().includes(domain))score+=4;}catch{
        const domain=raw.match(/@([^\s>]+)/)?.[1]?.toLowerCase();if(domain&&sender.toLowerCase().includes(domain))score+=4;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: application.id, score };
  }
  return best&&best.score>=2?best.id:null;
}
