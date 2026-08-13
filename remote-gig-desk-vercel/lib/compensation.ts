export type CompensationState = "confirmed_paid" | "payment_unconfirmed" | "unpaid";

export type CompensationAssessment = {
  state: CompensationState;
  evidence: string;
};

const unpaidIntent = /\b(?:unpaid|volunteer|voluntary|no\s+(?:bounty|payment|compensation)|recognition[- ]only|without\s+(?:pay|payment|compensation))\b|(?:无偿|志愿贡献|没有奖金|不提供报酬|无报酬)/i;
const paidIntent = /\b(?:bounty|cash reward|paid (?:task|issue|project|work)|compensation|salary|hourly rate|fixed[- ]price|contract rate|budget)\b|(?:赏金|有偿|付费任务|项目预算|薪资|报酬|时薪)/i;
const money = /(?:US\$|USD\s?|\$|€|£|¥|￥)\s?\d[\d,.]*(?:\s?[-–—]\s?(?:US\$|USD\s?|\$|€|£|¥|￥)?\s?\d[\d,.]*)?|\d[\d,.]*\s?(?:USD|EUR|GBP|CNY|RMB|美元|元|人民币)(?:\s?[-–—]\s?\d[\d,.]*\s?(?:USD|EUR|GBP|CNY|RMB|美元|元|人民币)?)?/i;

export function assessCompensation(gig: Record<string, unknown>): CompensationAssessment {
  const budget = String(gig.budget || "").trim();
  const text = [gig.source, gig.title, gig.application, gig.summary, gig.fullText, budget].filter(Boolean).join("\n");
  if (unpaidIntent.test(text)) return { state: "unpaid", evidence: "原文明确说明这是无偿或不提供报酬的贡献。" };
  if ((paidIntent.test(text) && money.test(text)) || (/付费|bounty|reward/i.test(String(gig.source || "")) && budget && !/预算面议|未公开|negotiable|tbd/i.test(budget))) {
    return { state: "confirmed_paid", evidence: money.test(text) ? `原文存在明确报酬证据：${text.match(money)?.[0]}` : `付费来源标注金额：${budget}` };
  }
  if (paidIntent.test(text)) return { state: "payment_unconfirmed", evidence: "原文提到报酬或预算，但金额、资格或付款承诺尚未确认。" };
  return { state: "payment_unconfirmed", evidence: "未找到可核验的付款金额或付款承诺；不能把回复、PR 合并或认可视为付款。" };
}

export function requiresPaidDeliveryGate(strategy: unknown, assessment: CompensationAssessment) {
  return strategy === "github_pull_request" && assessment.state !== "confirmed_paid";
}
