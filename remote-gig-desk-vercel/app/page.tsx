"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PortfolioBuilder from "./portfolio-builder";
import { filterAvailableGigs } from "../lib/gig-visibility";

type Gig = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  budget: string;
  match: number;
  competition: "低" | "中";
  skills: string[];
  summary: string;
  fullText: string;
  remote: string;
  application: string;
  opportunityType?: "job" | "project";
  market?: "国内" | "海外";
  projectCategory?: string;
  deliverable?: string;
};
type ApiData = {
  gigs: Gig[];
  sources: { name: string; ok: boolean }[];
  fetchedAt: string;
};
type Reply = {
  id: string;
  company: string;
  subject: string;
  date: string;
  status: string;
  tone: "action" | "info" | "warning";
  summary: string;
  translation: string;
  original: string;
  next: string;
  gmailUrl: string;
  applicationId?: string;
  applicationTitle?: string;
};
type RequirementMatch = {
  requirement: string;
  advantage: string;
  evidence: string;
};
type ApplicationPack = {
  gig: Gig;
  quote: string;
  employerSummary: string;
  requirementMatches: RequirementMatch[];
  matchedSkills: string[];
  resume: string[];
  coverLetter: string;
  language: "en" | "zh";
  workMode: string;
};
type ChannelConnection = {
  id: string;
  name: string;
  mode: string;
  capability: string;
  status: string;
  accountLabel?: string;
};
type AuthenticatedSite = {
  platformKey: string;
  name: string;
  status: string;
  sessionType: string;
  accountLabel?: string;
  siteUrl?: string;
  actualDomain?: string;
  verifiedAt?: string | number;
  lastCheckedAt?: string | number;
  updatedAt?: string | number;
  expiresAt?: string | number;
  queuedCount?: number;
  verificationCount?: number;
  note: string;
};
type BrowserAgent = {
  id: string;
  name: string;
  status: string;
  version?: string;
  updateRequired?: boolean;
  lastSeenAt?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
};
type ApplicationEvent = {
  id: string;
  eventType: string;
  status: string;
  message: string;
  evidenceId?: string;
  evidenceUrl?: string;
  createdAt: string;
};
type ApplicationReply = {
  id: string;
  subject: string;
  status: string;
  tone: string;
  summary: string;
  translation: string;
  next: string;
  gmailUrl: string;
  receivedAt: string;
};
type ApplicationRecord = {
  id: string;
  gigId: string;
  title: string;
  source: string;
  sourceUrl: string;
  applicationUrl?: string;
  status: string;
  deliveryChannel: string;
  proposedRate: string;
  createdAt: string;
  updatedAt: string;
  destination?: string;
  lastError?: string;
  platformKey?: string;
  deliveryState?: string;
  receiptId?: string;
  receiptUrl?: string;
  deliveredAt?: string;
  materials?: {
    language?: string;
    matchedSkills?: string[];
    resumeHighlights?: string[];
    coverLetter?: string;
    workMode?: string;
    portfolioUrls?: string[];
    attachments?: string[];
  };
  events?: ApplicationEvent[];
  replies?: ApplicationReply[];
};

const profileSkills = [
  "C/C++",
  "Rust",
  "Go",
  "Java",
  "C#",
  "Python",
  "JavaScript",
  "React / TypeScript",
  "并发与无锁编程",
  "操作系统与内存",
  "TCP/IP 与 Socket",
  "BGP/OSPF",
  "VXLAN/EVPN",
  "SDN",
  "Kubernetes",
  "Docker",
  "Redis/Kafka",
  "Unity/Unreal",
  "HLSL/GLSL/Metal",
  "API / RPC 集成",
  "性能调优与排障",
];
const unpublishedBudgetPolicy =
  "甲方未公开预算时，报价待与甲方确认，AI 不得编造金额";

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
      </>
    ),
    brief: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    saved: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="m9 18 6-6-6-6" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

function age(iso: string) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "发布时间未知";
  const hours = (Date.now() - timestamp) / 3600000;
  return hours < 1
    ? `${Math.max(1, Math.round(hours * 60))} 分钟前`
    : hours < 24
      ? `${Math.round(hours)} 小时前`
      : hours < 48
        ? "昨天"
        : `${Math.round(hours / 24)} 天前`;
}

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("机会");
  const [filter, setFilter] = useState("推荐");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [selected, setSelected] = useState<Gig | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [applicationPack, setApplicationPack] =
    useState<ApplicationPack | null>(null);
  const [batchPacks, setBatchPacks] = useState<ApplicationPack[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [authenticatedSites, setAuthenticatedSites] = useState<
    AuthenticatedSite[]
  >([]);
  const [browserAgents, setBrowserAgents] = useState<BrowserAgent[]>([]);
  const [pairingToken, setPairingToken] = useState("");
  const [pairing, setPairing] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queueNotice, setQueueNotice] = useState<{
    id: string;
    status: string;
    channel: string;
    receiptUrl?: string;
    receiptId?: string;
    duplicate?: boolean;
  } | null>(null);
  const [batchResult, setBatchResult] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [syncingMail, setSyncingMail] = useState(false);
  const [mailNotice, setMailNotice] = useState("");
  const [translation, setTranslation] = useState("");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translationStatus, setTranslationStatus] = useState<{
    sourceLength: number;
    parts: number;
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const mailSyncInFlight = useRef(false);
  const lastAutomaticMailSync = useRef(0);
  const cloudSyncInFlight = useRef(false);
  const lastCloudSync = useRef(0);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/gigs?v=12&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setError("暂时无法获取项目，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  const loadBackend = async () => {
    try {
      const [c, a, r] = await Promise.all([
        fetch("/api/connections", { cache: "no-store" }),
        fetch("/api/applications", { cache: "no-store" }),
        fetch("/api/replies", { cache: "no-store" }),
      ]);
      if (c.ok) {
        const connectionData = await c.json();
        setConnections(connectionData.channels || []);
        setAuthenticatedSites(connectionData.authenticatedSites || []);
        setBrowserAgents(connectionData.browserAgents || []);
      }
      if (a.ok) {
        const apps = (await a.json()).applications || [];
        setApplications(apps);
        setApplied(apps.map((x: ApplicationRecord) => x.gigId));
      }
      if (r.ok) setReplies((await r.json()).replies || []);
    } catch {}
  };
  const createBrowserAgent = async () => {
    setPairing(true);
    try {
      const r = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_browser_agent",
          name: "我的 Chrome",
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "pairing_failed");
      setPairingToken(result.token || "");
      await loadBackend();
    } catch (error) {
      setMailNotice(
        `浏览器配对失败：${error instanceof Error ? error.message : "请重试"}`,
      );
    } finally {
      setPairing(false);
    }
  };
  const syncGmail = async (silent = false) => {
    if (mailSyncInFlight.current) return;
    mailSyncInFlight.current = true;
    if (!silent) {
      setSyncingMail(true);
      setMailNotice("");
    }
    try {
      const r = await fetch("/api/gmail/sync", {
        method: "POST",
        cache: "no-store",
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "sync_failed");
      if (!silent) setMailNotice(`已同步 ${result.synced || 0} 封申请相关邮件`);
      await loadBackend();
    } catch (error) {
      if (!silent)
        setMailNotice(
          `同步失败：${error instanceof Error ? error.message : "请重试"}`,
        );
    } finally {
      mailSyncInFlight.current = false;
      if (!silent) setSyncingMail(false);
    }
  };
  const refreshAll = async () => {
    await Promise.all([load(), loadBackend(), syncGmail(true)]);
  };
  const runCloudExecutor = async () => {
    const now = Date.now();
    if (cloudSyncInFlight.current || now - lastCloudSync.current < 5 * 60_000)
      return;
    cloudSyncInFlight.current = true;
    lastCloudSync.current = now;
    try {
      const r = await fetch("/api/cloud-executor", {
        method: "POST",
        cache: "no-store",
      });
      if (r.ok) {
        const result = await r.json();
        if (result.processed) await loadBackend();
      }
    } catch {
    } finally {
      cloudSyncInFlight.current = false;
    }
  };
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("gig-saved") || "[]"));
    } catch {}
    load();
    loadBackend();
    void runCloudExecutor();
    const refreshMail = () => {
      const now = Date.now();
      if (
        document.visibilityState !== "visible" ||
        now - lastAutomaticMailSync.current < 60_000
      )
        return;
      lastAutomaticMailSync.current = now;
      void syncGmail(true);
    };
    refreshMail();
    const automaticRefresh = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshAll();
        void runCloudExecutor();
      }
    }, 5 * 60_000);
    document.addEventListener("visibilitychange", refreshMail);
    window.addEventListener("focus", refreshMail);
    return () => {
      window.clearInterval(automaticRefresh);
      document.removeEventListener("visibilitychange", refreshMail);
      window.removeEventListener("focus", refreshMail);
    };
  }, []);
  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const encoded = fragment.get("profileImport");
    if (!encoded) return;
    history.replaceState(null, "", location.pathname + location.search);
    void (async () => {
      try {
        const decoded = decodeURIComponent(
          escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))),
        );
        const recovered = JSON.parse(decoded);
        const currentResponse = await fetch("/api/profile", {
          cache: "no-store",
        });
        const current = currentResponse.ok
          ? (await currentResponse.json()).profile || {}
          : {};
        const saveResponse = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...current, ...recovered }),
        });
        if (!saveResponse.ok) throw new Error();
        setMailNotice(
          "已将确认属实的旧工作台能力与三段项目经历恢复到加密个人资料库。",
        );
      } catch {
        setMailNotice("旧工作台资料恢复失败，未修改现有个人资料。");
      }
    })();
  }, []);
  const toggleSave = (id: string) =>
    setSaved((v) => {
      const n = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
      localStorage.setItem("gig-saved", JSON.stringify(n));
      return n;
    });
  const markApplied = (id: string) =>
    setApplied((v) => {
      const n = v.includes(id) ? v : [...v, id];
      localStorage.setItem("gig-applied", JSON.stringify(n));
      return n;
    });
  const toggleChecked = (id: string) =>
    setChecked((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const generateApplicationPack = async (gig: Gig) => {
    const r = await fetch("/api/application-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gig }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "ai_generation_failed");
    return result as ApplicationPack;
  };
  const startApplication = async (gig: Gig) => {
    setGeneratingPack(true);
    setMailNotice("");
    setApplicationError("");
    try {
      setApplicationPack(await generateApplicationPack(gig));
      setSelected(null);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const message =
        code === "profile_required"
          ? "请先在“我的”中保存真实简历、经历或作品集，再生成申请信。"
          : code === "free_ai_not_configured"
            ? "免费 AI 尚未配置。"
            : "AI 未能生成满足“完整需求总结 + 至少两条对口证据”的申请信，请稍后重试。";
      setApplicationError(message);
      setMailNotice(message);
    } finally {
      setGeneratingPack(false);
    }
  };
  const prepareBatch = async () => {
    if (queueing || !checked.length) return;
    setQueueing(true);
    setBatchResult(null);
    setQueueNotice(null);
    let packs: ApplicationPack[] = [];
    try {
      packs = await Promise.all(
        gigs.filter((g) => checked.includes(g.id)).map(generateApplicationPack),
      );
    } catch {
      setMailNotice(
        "批量 AI 生成失败，未创建任何申请任务。请检查个人资料和 AI 服务。",
      );
      setQueueing(false);
      return;
    }
    const results = await Promise.all(
      packs.map(async (pack) => {
        try {
          const r = await fetch("/api/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pack),
          });
          if (!r.ok) throw new Error();
          const result = await r.json();
          return { ok: true, gigId: pack.gig.id, id: result.id };
        } catch {
          return { ok: false, gigId: pack.gig.id, id: "" };
        }
      }),
    );
    const successful = results.filter((x) => x.ok).map((x) => x.gigId);
    if (successful.length) {
      setApplied((v) => {
        const n = [...new Set([...v, ...successful])];
        localStorage.setItem("gig-applied", JSON.stringify(n));
        return n;
      });
      setChecked((v) => v.filter((id) => !successful.includes(id)));
    }
    setBatchPacks([]);
    setApplicationPack(null);
    setBatchResult({
      total: packs.length,
      success: successful.length,
      failed: packs.length - successful.length,
    });
    setQueueing(false);
  };
  const confirmPack = async (pack: ApplicationPack) => {
    setQueueing(true);
    setQueueNotice(null);
    try {
      const r = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pack),
      });
      if (!r.ok) throw new Error();
      const result = await r.json();
      markApplied(pack.gig.id);
      setQueueNotice({
        id: result.id,
        status: result.status,
        channel: result.deliveryChannel,
        receiptUrl: result.receiptUrl,
        receiptId: result.receiptId,
        duplicate: result.duplicate === true,
      });
      setBatchPacks((v) => v.filter((x) => x.gig.id !== pack.gig.id));
      setChecked((v) => v.filter((id) => id !== pack.gig.id));
      await loadBackend();
    } catch {
      setQueueNotice({ id: "", status: "queue_failed", channel: "none" });
    } finally {
      setQueueing(false);
    }
  };
  const updateApplicationStatus = async (
    id: string,
    action: "needs_verification" | "verify_platform" | "cancel",
  ) => {
    setQueueing(true);
    try {
      const r = await fetch("/api/applications/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!r.ok) throw new Error();
      await loadBackend();
    } catch {
      setMailNotice("状态更新失败，请重试");
    } finally {
      setQueueing(false);
    }
  };
  const retryApplication = async (id: string) => {
    setQueueing(true);
    try {
      const r = await fetch("/api/applications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await r.json();
      if (!r.ok && result.status !== "verification_required") throw new Error();
      await loadBackend();
    } catch {
      setMailNotice("重新投递失败，请在进度中查看失败原因");
    } finally {
      setQueueing(false);
    }
  };
  const verifyPlatformAndContinue = async (app: ApplicationRecord) => {
    setQueueing(true);
    setMailNotice("");
    try {
      const verified = await fetch("/api/applications/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, action: "verify_platform" }),
      });
      if (!verified.ok) throw new Error("平台验证状态保存失败");
      const retried = await fetch("/api/applications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformKey: app.platformKey }),
      });
      const result = await retried.json();
      if (!retried.ok) throw new Error(result.error || "同平台任务继续失败");
      setMailNotice(
        `已继续处理同平台 ${result.processed || 0} 个任务；平台接口确认接收 ${result.accepted || 0} 个`,
      );
      await loadBackend();
    } catch (error) {
      setMailNotice(
        error instanceof Error ? error.message : "同平台任务继续失败",
      );
    } finally {
      setQueueing(false);
    }
  };
  const gigs = data?.gigs ?? [];
  const allAvailableGigs = useMemo(
    () => filterAvailableGigs(gigs, applied),
    [gigs, applied],
  );
  const availableGigs = useMemo(
    () => allAvailableGigs.filter((gig) => gig.opportunityType !== "project"),
    [allAvailableGigs],
  );
  const availableProjects = useMemo(
    () => allAvailableGigs.filter((gig) => gig.opportunityType === "project"),
    [allAvailableGigs],
  );
  const visible = useMemo(() => {
    let v =
      activeTab === "收藏"
        ? gigs.filter((g) => saved.includes(g.id))
        : activeTab === "进度"
          ? gigs.filter((g) => applied.includes(g.id))
          : activeTab === "机会"
            ? availableGigs
            : activeTab === "项目单"
              ? availableProjects
            : gigs;
    if (query)
      v = v.filter((g) =>
        `${g.title} ${g.summary} ${g.skills.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
    if (filter === "最新")
      v = [...v].sort(
        (a, b) =>
          (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
      );
    if (filter === "低竞争") v = v.filter((g) => g.competition === "低");
    if (filter === "高预算") v = v.filter((g) => g.budget !== "预算面议");
    return v;
  }, [gigs, availableGigs, availableProjects, activeTab, saved, applied, query, filter]);
  const okSources = data?.sources.filter((s) => s.ok).length ?? 0;
  const decode = (value: string) => {
    const box = document.createElement("textarea");
    box.innerHTML = value;
    return box.value;
  };
  const translateGig = async (gig: Gig) => {
    setTranslating(true);
    setTranslation("");
    setTranslatedTitle("");
    setTranslationStatus(null);
    const source = (gig.fullText || gig.summary).trim();
    const cacheKey = `gig-zh-v8-complete-${gig.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed.complete === true &&
          parsed.sourceLength === source.length &&
          parsed.text
        ) {
          setTranslation(parsed.text);
          setTranslatedTitle(parsed.title || "");
          setTranslationStatus({
            sourceLength: parsed.sourceLength,
            parts: parsed.parts || 1,
          });
          return;
        }
        localStorage.removeItem(cacheKey);
      }
      const translate = async (text: string) => {
        if (!text.trim()) return { text: "", sourceLength: 0, parts: 0 };
        const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        if (chinese > Math.max(12, text.length * 0.15))
          return { text, sourceLength: text.length, parts: 1 };
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error("translation_failed");
        const result = await response.json();
        if (
          result.complete !== true ||
          Number(result.sourceLength) !== text.length
        )
          throw new Error("translation_incomplete");
        return {
          text: String(result.translated || "").trim(),
          sourceLength: Number(result.sourceLength),
          parts: Number(result.parts) || 1,
        };
      };
      const [titleResult, textResult] = await Promise.all([
        translate(gig.title),
        translate(source),
      ]);
      if (!textResult.text) throw new Error("translation_empty");
      const title =
        titleResult.text && titleResult.text !== gig.title
          ? titleResult.text
          : "";
      setTranslatedTitle(title);
      setTranslation(textResult.text);
      setTranslationStatus({
        sourceLength: textResult.sourceLength,
        parts: textResult.parts,
      });
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          title,
          text: textResult.text,
          complete: true,
          sourceLength: textResult.sourceLength,
          parts: textResult.parts,
        }),
      );
    } catch {
      setTranslation("");
      setTranslatedTitle("");
      setTranslationStatus(null);
    } finally {
      setTranslating(false);
    }
  };
  const openGig = async (gig: Gig) => {
    setSelected(gig);
    setShowOriginal(false);
    setApplicationError("");
    await translateGig(gig);
  };
  const copyApplication = (gig: Gig) => {
    const pricing =
      gig.budget === "预算面议"
        ? "甲方未公开预算，申请前必须确认报价，不得自行编造金额。"
        : `甲方原文标注金额：${gig.budget}；提交前仍需核对金额含义、币种和计价周期。`;
    navigator.clipboard?.writeText(
      `请帮我申请这个项目：${translatedTitle || gig.title}\n来源：${gig.source}\n原始链接：${gig.sourceUrl}\n${pricing}\n远程：${gig.remote}`,
    );
  };
  const sendReply = async () => {
    if (!selectedReply || !replyDraft.trim()) return;
    setReplySending(true);
    const r = await fetch("/api/replies/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyId: selectedReply.id, message: replyDraft }),
    });
    if (r.ok) {
      setReplyDraft("");
      setSelectedReply(null);
      setMailNotice("回复已通过原 Gmail 线程发送并写入申请时间线");
      await loadBackend();
    } else {
      const result = await r.json().catch(() => ({}));
      setMailNotice(`回复发送失败：${result.error || "请重试"}`);
    }
    setReplySending(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">实时远程外包</p>
          <h1>
            {activeTab === "机会"
              ? "找到可以直接申请的岗位"
              : activeTab === "项目单"
                ? "按交付付费的真实项目单"
              : activeTab === "收藏"
                ? "已收藏的机会"
                : activeTab === "进度"
                  ? "接单进度"
                  : activeTab === "连接"
                    ? "渠道连接中心"
                    : activeTab === "回复"
                      ? "申请回复中心"
                      : "个人工作台"}
          </h1>
        </div>
        <button
          className="icon-button"
          aria-label="刷新全部数据"
          onClick={() => void refreshAll()}
        >
          <Icon name="bell" />
          <span className="notification-dot" />
        </button>
      </header>
      {mailNotice && activeTab !== "连接" && (
        <p className="application-note">{mailNotice}</p>
      )}
      {(activeTab === "机会" || activeTab === "项目单") && (
        <>
          <div className="live-source-bar">
            <b>
              <i className={okSources ? "online" : ""} />
              {loading
                ? "正在连接真实来源"
                : `已连接 ${okSources}/${data?.sources.length ?? 0} 个真实来源`}
            </b>
            <span>
              {data?.sources.map((s) => (
                <em className={s.ok ? "ok" : "down"} key={s.name}>
                  {s.name}
                </em>
              ))}
            </span>
          </div>
          <section className="hero-card">
            <div className="hero-copy">
              <span className="live-pill">
                <i />
                {activeTab === "项目单" ? "国内 + 海外 · 按项目付费" : "真实岗位 · 原始链接"}
              </span>
              <h2>
                当前找到 <strong>{activeTab === "项目单" ? availableProjects.length : availableGigs.length}</strong> 个<br />
                {activeTab === "项目单" ? "可交付项目" : "未申请岗位"}
              </h2>
              <p>{activeTab === "项目单" ? "建站、部署、修复、接口和自动化需求" : "已建立申请任务的岗位会自动移至“进度”"}</p>
            </div>
            <div className="score-ring">
              <span>最高</span>
              <b>{(activeTab === "项目单" ? availableProjects[0] : availableGigs[0])?.match ?? "—"}</b>
              <small>匹配度</small>
            </div>
          </section>
          <section className="quick-stats" aria-label="项目概览">
            <div>
              <b>{activeTab === "项目单" ? availableProjects.length : availableGigs.length}</b>
              <span>{activeTab === "项目单" ? "项目单" : "未申请"}</span>
            </div>
            <div>
              <b>
                {(activeTab === "项目单" ? availableProjects : availableGigs).filter((g) => g.competition === "低").length}
              </b>
              <span>低竞争</span>
            </div>
            <div>
              <b>{applications.length}</b>
              <span>申请任务</span>
            </div>
          </section>
          <div className="search-row">
            <div className="searchbox">
              <Icon name="search" />
              <input
                aria-label="搜索项目"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={activeTab === "项目单" ? "搜索建站、部署、Bug、API…" : "搜索 Python、LLM、Java…"}
              />
            </div>
            <button className="tune" aria-label="刷新" onClick={load}>
              <span />
              <span />
              <span />
            </button>
          </div>
          <div className="filters" role="tablist">
            {["推荐", "最新", "低竞争", "高预算"].map((x) => (
              <button
                key={x}
                className={filter === x ? "active" : ""}
                onClick={() => setFilter(x)}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="batch-bar">
            <span>
              已选择 <b>{checked.length}</b> / {visible.length}
            </span>
            <button
              onClick={() =>
                setChecked(
                  checked.length === visible.length
                    ? []
                    : visible.map((gig) => gig.id),
                )
              }
            >
              {checked.length === visible.length
                ? "取消全选"
                : `全选 ${visible.length}`}
            </button>
            <button
              disabled={queueing || !checked.length}
              onClick={prepareBatch}
            >
              {queueing ? "批量处理中…" : "申请全部已选"}
            </button>
          </div>
          {batchResult && (
            <div
              className={`queue-result ${batchResult.failed ? "failed" : "saved"}`}
            >
              批量处理完成：已为 {batchResult.success}/{batchResult.total}{" "}
              个岗位分别生成定制材料并建立申请任务
              {batchResult.failed
                ? `，${batchResult.failed} 个失败，可保留选择后重试。`
                : "。"}
              <small>不会再跳转到第一个岗位；任务状态请在“进度”中查看。</small>
            </div>
          )}
        </>
      )}
      <section className="section-head">
        <div>
          <h2>
            {activeTab === "机会"
              ? "真实机会"
              : activeTab === "项目单"
                ? `${visible.length} 个付费项目单`
              : activeTab === "收藏"
                ? `${visible.length} 个已收藏项目`
                : activeTab === "进度"
                  ? `${applications.length} 个申请任务`
                  : activeTab === "连接"
                    ? "逐个平台接入"
                    : activeTab === "回复"
                      ? `${replies.length} 条申请邮件`
                      : "工作台设置"}
          </h2>
          <p>
            {activeTab === "机会"
              ? "每条均可打开原始发布页"
              : activeTab === "项目单"
                ? "只收录包含明确交付意图和付费意图的真实需求"
              : activeTab === "连接"
                ? "仅显示经过后端验证的真实状态"
                : activeTab === "回复"
                  ? "已排除职位提醒和营销邮件"
                  : "申请记录已保存到服务器"}
          </p>
        </div>
        {(activeTab === "机会" || activeTab === "项目单") && (
          <button onClick={load}>
            刷新 <Icon name="arrow" />
          </button>
        )}
      </section>
      {activeTab === "进度" &&
        applications.some((app) => app.status === "verification_required") && (
          <section className="checkpoint-queue">
            <b>需要你接管的验证</b>
            <p>
              只有验证码、MFA、身份确认、条款勾选或最终法律确认会暂停。完成同一平台的一次验证后，该平台全部任务自动继续。
            </p>
            {applications
              .filter((app) => app.status === "verification_required")
              .map((app) => (
                <button
                  key={app.id}
                  onClick={() =>
                    app.applicationUrl &&
                    window.open(
                      app.applicationUrl,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <span>{app.platformKey || app.source}</span>
                  <strong>{app.title}</strong>
                  <small>{app.lastError || "打开当前申请页面完成验证"}</small>
                </button>
              ))}
          </section>
        )}
      <section className="gig-list">
        {activeTab === "进度" ? (
          <div className="application-list">
            {applications.length ? (
              applications.map((app) => {
                const labels: Record<string, string> = {
                  submitted: "平台已接收",
                  response_received: "已收到对方回复",
                  queued_for_browser: "浏览器执行队列中",
                  browser_in_progress: "浏览器正在处理",
                  form_ready: "表单已填写",
                  detecting_destination: "正在识别投递入口",
                  awaiting_github_authorization: "等待 GitHub 授权",
                  submission_failed: "投递失败",
                  verification_required: "同平台等待一次验证",
                  cancelled: "已取消",
                };
                const label = labels[app.status] || app.status;
                const proof =
                  app.deliveryState === "recipient_replied"
                    ? {
                        title: "对方已回复",
                        text: "已收到对方邮件回复，申请已进入沟通流程。",
                        tone: "received",
                      }
                    : app.deliveryState === "platform_accepted"
                      ? {
                          title: "平台接口已确认接收",
                          text: "平台返回了可核验的提交回执；这不等同于对方已阅读。",
                          tone: "accepted",
                        }
                      : app.deliveryState === "session_reused"
                        ? {
                            title: "平台会话已复用",
                            text: "任务已进入浏览器执行队列；同平台后续任务无需重复登录。",
                            tone: "session",
                          }
                        : app.deliveryState === "form_ready"
                          ? {
                              title: "申请表单已填写",
                              text: "浏览器已完成已知字段填写，等待受保护确认或提交回执。",
                              tone: "session",
                            }
                          : null;
                return (
                  <article className="gig-card application-record" key={app.id}>
                    <div className="card-top">
                      <div className="source-icon">
                        {app.source?.[0] || "申"}
                      </div>
                      <div className="source">
                        <b>{app.source}</b>
                        <span>
                          {new Date(
                            Number(app.updatedAt) || app.updatedAt,
                          ).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <span
                        className={
                          "reply-status " +
                          (app.status === "submitted" ||
                          app.status === "response_received"
                            ? "info"
                            : app.status === "submission_failed"
                              ? "warning"
                              : "action")
                        }
                      >
                        {label}
                      </span>
                    </div>
                    <h3>{app.title}</h3>
                    <div className="facts">
                      <div>
                        <small>申请报价</small>
                        <b>{app.proposedRate || "待确认"}</b>
                      </div>
                      <div>
                        <small>投递渠道</small>
                        <b>{app.deliveryChannel}</b>
                      </div>
                    </div>
                    <p className="application-note">任务编号：{app.id}</p>
                    {app.materials?.matchedSkills?.length && (
                      <>
                        <h4 className="timeline-title">实际采用的匹配能力</h4>
                        <div className="profile-skills">
                          {app.materials.matchedSkills.map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {app.materials?.resumeHighlights?.length && (
                      <>
                        <h4 className="timeline-title">当时使用的简历要点</h4>
                        <ul className="resume-points">
                          {app.materials.resumeHighlights.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {app.materials?.coverLetter && (
                      <>
                        <h4 className="timeline-title">当时发送的申请内容</h4>
                        <div className="original-mail">
                          {app.materials.coverLetter}
                        </div>
                      </>
                    )}
                    {app.materials?.portfolioUrls?.length && (
                      <>
                        <h4 className="timeline-title">随申请使用的作品集</h4>
                        {app.materials.portfolioUrls.map((url) => (
                          <a
                            className="secondary-link"
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {url} ↗
                          </a>
                        ))}
                      </>
                    )}
                    {app.platformKey && (
                      <p className="platform-session">
                        平台队列：{app.platformKey} · 同平台只验证一次
                      </p>
                    )}
                    {app.lastError && (
                      <p className="application-error">
                        失败原因：{app.lastError}
                      </p>
                    )}
                    {proof && (
                      <div className={"task-proof " + proof.tone}>
                        <b>{proof.title}</b>
                        <p>{proof.text}</p>
                        {app.receiptUrl ? (
                          <a
                            href={app.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            查看平台回执 ↗
                          </a>
                        ) : app.receiptId ? (
                          <small>回执编号：{app.receiptId}</small>
                        ) : null}
                      </div>
                    )}
                    {app.replies?.length ? (
                      <>
                        <h4 className="timeline-title">关联回复</h4>
                        {app.replies.map((reply) => (
                          <div className="task-proof received" key={reply.id}>
                            <b>
                              {reply.status} · {reply.subject}
                            </b>
                            <p>{reply.translation || reply.summary}</p>
                            <small>{reply.next}</small>
                            <a
                              href={reply.gmailUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              立即回复 ↗
                            </a>
                          </div>
                        ))}
                      </>
                    ) : null}
                    <h4 className="timeline-title">任务时间线</h4>
                    <ol className="task-timeline">
                      {(app.events || []).length ? (
                        (app.events || []).map((event) => (
                          <li key={event.id}>
                            <i />
                            <div>
                              <time>
                                {new Date(
                                  Number(event.createdAt) || event.createdAt,
                                ).toLocaleString("zh-CN")}
                              </time>
                              <b>{event.message}</b>
                              <small>
                                {labels[event.status] || event.status}
                              </small>
                              {event.evidenceUrl ? (
                                <a
                                  href={event.evidenceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  查看证据 ↗
                                </a>
                              ) : event.evidenceId ? (
                                <span>证据编号：{event.evidenceId}</span>
                              ) : null}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li>
                          <i />
                          <div>
                            <b>任务已建立，等待下一步记录</b>
                          </div>
                        </li>
                      )}
                    </ol>
                    <a
                      className="secondary-link"
                      href={app.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看甲方原始页面 ↗
                    </a>
                    {app.applicationUrl &&
                      app.applicationUrl !== app.sourceUrl && (
                        <a
                          className="secondary-link"
                          href={app.applicationUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          查看最终申请入口 ↗
                        </a>
                      )}
                    <div className="progress-actions">
                      {app.status === "detecting_destination" && (
                        <button
                          disabled={queueing}
                          onClick={() =>
                            updateApplicationStatus(
                              app.id,
                              "needs_verification",
                            )
                          }
                        >
                          此平台需要登录或验证码
                        </button>
                      )}
                      {app.status === "submission_failed" && (
                        <button
                          disabled={queueing}
                          onClick={() => retryApplication(app.id)}
                        >
                          重新处理此任务
                        </button>
                      )}
                      {app.status === "verification_required" && (
                        <button
                          disabled={queueing}
                          onClick={() => verifyPlatformAndContinue(app)}
                        >
                          本平台验证完成，继续全部任务
                        </button>
                      )}
                      {![
                        "submitted",
                        "response_received",
                        "cancelled",
                      ].includes(app.status) && (
                        <button
                          className="danger-action"
                          disabled={queueing}
                          onClick={() =>
                            updateApplicationStatus(app.id, "cancel")
                          }
                        >
                          取消任务
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-card">
                <h3>还没有申请任务</h3>
                <p>在机会页多选岗位后，点击“申请全部已选”。</p>
              </div>
            )}
          </div>
        ) : activeTab === "回复" ? (
          <div className="reply-list">
            {replies.map((reply) => (
              <button
                className="reply-card"
                key={reply.id}
                onClick={() => setSelectedReply(reply)}
              >
                <div className="reply-card-top">
                  <span className={`reply-status ${reply.tone}`}>
                    {reply.status}
                  </span>
                  <time>{reply.date}</time>
                </div>
                <h3>{reply.subject}</h3>
                <b>{reply.company}</b>
                {reply.applicationTitle && (
                  <p className="reply-linked">
                    对应申请：{reply.applicationTitle}
                  </p>
                )}
                <p>{reply.summary}</p>
                <span className="reply-open">
                  查看中文与原文 <Icon name="arrow" />
                </span>
              </button>
            ))}
          </div>
        ) : activeTab === "连接" ? (
          <div className="connection-list">
            <section className="browser-agent-panel">
              <div className="auth-overview-head">
                <div>
                  <small>本机 Chrome 执行器</small>
                  <h3>
                    {
                      browserAgents.filter((agent) => agent.status === "online")
                        .length
                    }{" "}
                    个在线
                  </h3>
                </div>
                <span>
                  {browserAgents.some((agent) => agent.status === "online")
                    ? "可复用本机登录"
                    : "等待配对"}
                </span>
              </div>
              <p>
                任务在你已经登录的平台页面中执行。Cookie、密码和验证码不会上传到工作台；服务器只保存执行器在线状态和平台认证结果。
              </p>
              <div className="agent-list">
                {browserAgents.map((agent) => (
                  <article className="agent-row" key={agent.id}>
                    <div>
                      <b>
                        {agent.name} · v{agent.version || "未知"}
                      </b>
                      <span
                        className={
                          agent.status === "online"
                            ? "agent-online"
                            : "agent-offline"
                        }
                      >
                        {agent.status === "online" ? "在线" : "离线"}
                      </span>
                    </div>
                    {agent.updateRequired && (
                      <small className="application-error">
                        执行器版本过旧，请下载最新版并在 Chrome 扩展页重新加载。
                      </small>
                    )}
                    {agent.lastSeenAt && (
                      <small>
                        最近心跳：
                        {new Date(Number(agent.lastSeenAt)).toLocaleString(
                          "zh-CN",
                        )}
                      </small>
                    )}
                  </article>
                ))}
              </div>
              <button
                className="oauth-connect"
                disabled={pairing}
                onClick={createBrowserAgent}
              >
                {pairing ? "正在生成…" : "生成 Chrome 配对令牌"}
              </button>
              {pairingToken && (
                <div className="pairing-token">
                  <b>一次性配对令牌</b>
                  <code>{pairingToken}</code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(pairingToken)}
                  >
                    复制令牌
                  </button>
                  <p>
                    安装浏览器执行器后粘贴此令牌，并在本机填写你的 Hacker News
                    用户名。令牌仅显示这一次。
                  </p>
                </div>
              )}
              <div className="agent-install">
                <a
                  href="https://github.com/crz0614/remote-gig-desk-vercel/raw/refs/heads/main/browser-agent-extension.zip"
                  target="_blank"
                  rel="noreferrer"
                >
                  直接下载最新版浏览器执行器 ZIP ↗
                </a>
                <span>
                  解压后在 Chrome
                  扩展程序页面点击“加载已解压的扩展程序”，选择解压后的文件夹。
                </span>
              </div>
            </section>
            <section className="auth-overview">
              <div className="auth-overview-head">
                <div>
                  <small>平台级认证状态</small>
                  <h3>
                    {
                      authenticatedSites.filter((site) =>
                        ["connected", "verified"].includes(site.status),
                      ).length
                    }{" "}
                    个网站可复用
                  </h3>
                </div>
                <span>
                  {authenticatedSites.length ? "已由后端核验" : "尚无认证记录"}
                </span>
              </div>
              <p>
                同一平台的岗位共用一次登录或 OAuth 授权。只要网站 Cookie /
                令牌仍有效，后续申请不必重复登录；过期、退出或撤销后才会要求重新验证一次。
              </p>
              <div className="auth-site-list">
                {authenticatedSites.length ? (
                  authenticatedSites.map((site) => {
                    const active = ["connected", "verified"].includes(
                      site.status,
                    );
                    const checked =
                      site.lastCheckedAt || site.updatedAt || site.verifiedAt;
                    return (
                      <article className="auth-site" key={site.platformKey}>
                        <div className="auth-site-title">
                          <span
                            className={
                              active
                                ? "auth-state active"
                                : "auth-state needs-check"
                            }
                          >
                            {active ? "✓" : "!"}
                          </span>
                          <div>
                            <h4>{site.name}</h4>
                            <b>{site.accountLabel || "已保存平台认证记录"}</b>
                          </div>
                          <em>
                            {site.sessionType === "oauth"
                              ? "OAuth"
                              : "浏览器会话"}
                          </em>
                        </div>
                        {site.actualDomain && (
                          <small>实际域名：{site.actualDomain}</small>
                        )}
                        <p>{site.note}</p>
                        <footer>
                          <span>
                            {active ? "可供同平台任务复用" : "下次申请前需验证"}{" "}
                            · 排队 {site.queuedCount || 0} · 待验证{" "}
                            {site.verificationCount || 0}
                          </span>
                          {checked && (
                            <time>
                              最近核验：
                              {new Date(Number(checked)).toLocaleString(
                                "zh-CN",
                                {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                          )}
                        </footer>
                      </article>
                    );
                  })
                ) : (
                  <div className="auth-empty">
                    完成一次 OAuth
                    授权或平台登录后，这里会显示账号、认证方式和最近核验时间。
                  </div>
                )}
              </div>
            </section>
            <a className="oauth-connect" href="/api/oauth/github/start">
              授权 GitHub 自动投递
            </a>
            <a className="oauth-connect" href="/api/oauth/google/start">
              授权 Gmail 读取回复与发送申请
            </a>
            <button
              className="oauth-connect"
              disabled={syncingMail}
              onClick={() => void syncGmail()}
            >
              {syncingMail ? "正在同步 Gmail…" : "立即同步 Gmail 申请回复"}
            </button>
            {mailNotice && <p className="application-note">{mailNotice}</p>}
            {connections.length ? (
              connections.map((channel) => (
                <article className="connection-card" key={channel.id}>
                  <div>
                    <span className={`connection-dot ${channel.status}`} />
                    <h3>{channel.name}</h3>
                  </div>
                  <p>{channel.capability}</p>
                  <b>
                    {channel.status === "connected"
                      ? `已连接${channel.accountLabel ? ` · ${channel.accountLabel}` : ""}`
                      : channel.status === "manual_only"
                        ? "该来源没有统一申请账号"
                        : channel.status === "browser_agent_required"
                          ? "由已配对的 Chrome 执行器处理"
                          : channel.status === "manual_checkpoint"
                            ? "遇到验证码或身份确认时由你接手"
                            : "等待 OAuth 授权"}
                  </b>
                </article>
              ))
            ) : (
              <div className="loading-card">
                <i />
                <b>正在读取渠道状态</b>
                <span>连接状态必须由后端验证</span>
              </div>
            )}
          </div>
        ) : activeTab === "我的" ? (
          <PortfolioBuilder />
        ) : loading ? (
          <div className="loading-card">
            <i />
            <b>正在获取真实项目</b>
            <span>检查来源与原始链接…</span>
          </div>
        ) : error ? (
          <div className="empty-card">
            <h3>获取失败</h3>
            <p>{error}</p>
            <button className="retry" onClick={load}>
              重新获取
            </button>
          </div>
        ) : visible.length ? (
          visible.map((gig, index) => (
            <article
              className={`gig-card ${index === 0 && (activeTab === "机会" || activeTab === "项目单") ? "featured" : ""}`}
              key={gig.id}
            >
              <div className="card-top">
                <button
                  className={`select-gig ${checked.includes(gig.id) ? "selected" : ""}`}
                  onClick={() => toggleChecked(gig.id)}
                  aria-label={
                    checked.includes(gig.id) ? "取消选择" : "选择申请"
                  }
                >
                  {checked.includes(gig.id) ? "✓" : ""}
                </button>
                <div className="source-icon">{gig.source[0]}</div>
                <div className="source">
                  <b>{gig.source}</b>
                  <span>{age(gig.publishedAt)}</span>
                </div>
                <button
                  className={`bookmark ${saved.includes(gig.id) ? "saved" : ""}`}
                  onClick={() => toggleSave(gig.id)}
                  aria-label="收藏项目"
                >
                  <Icon name="saved" />
                </button>
              </div>
              <h3>{gig.title}</h3>
              {gig.opportunityType === "project" && (
                <div className="project-meta">
                  <b>{gig.market}</b><span>{gig.projectCategory}</span>
                </div>
              )}
              <p className="summary">{gig.summary}</p>
              <div className="tags">
                {(gig.skills.length ? gig.skills : ["其他开发"]).map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <div className="facts">
                <div>
                  <small>
                    {gig.budget === "预算面议" ? "预算状态" : "原文金额"}
                  </small>
                  <b>{gig.budget === "预算面议" ? "甲方未公开" : gig.budget}</b>
                </div>
                <div>
                  <small>竞争</small>
                  <b className="low">
                    <i />
                    {gig.competition}
                  </b>
                </div>
                <div className="match">
                  <small>匹配度</small>
                  <b>{gig.match}%</b>
                </div>
              </div>
              <div className="card-action">
                <button className="detail-link" onClick={() => openGig(gig)}>
                  中文详情
                  <Icon name="arrow" />
                </button>
                <button
                  className="one-click"
                  disabled={generatingPack}
                  onClick={() => void startApplication(gig)}
                >
                  {generatingPack ? "AI 正在生成…" : "AI 定制申请"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-card">
            <h3>没有符合条件的项目</h3>
            <p>换一个筛选条件，或点击刷新获取最新需求。</p>
          </div>
        )}
      </section>
      <nav className="bottom-nav" aria-label="主导航">
        {[
          ["机会", "home"],
          ["项目单", "brief"],
          ["进度", "brief"],
          ["连接", "check"],
          ["回复", "mail"],
          ["我的", "user"],
        ].map(([label, icon]) => (
          <button
            key={label}
            className={activeTab === label ? "active" : ""}
            onClick={() => setActiveTab(label)}
          >
            <Icon name={icon} />
            <span>{label}</span>
            {label === "进度" && applications.length > 0 && (
              <i className="badge">{applications.length}</i>
            )}
            {label === "回复" &&
              replies.filter((r) => r.tone === "action").length > 0 && (
                <i className="badge">
                  {replies.filter((r) => r.tone === "action").length}
                </i>
              )}
          </button>
        ))}
      </nav>
      {selectedReply && (
        <div className="modal-backdrop" onClick={() => setSelectedReply(null)}>
          <section
            className="detail-sheet reply-detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grabber" />
            <button className="close" onClick={() => setSelectedReply(null)}>
              ×
            </button>
            <span className={`reply-status ${selectedReply.tone}`}>
              {selectedReply.status}
            </span>
            <h2>{selectedReply.subject}</h2>
            <p className="reply-company">
              {selectedReply.company} · {selectedReply.date}
            </p>
            {selectedReply.applicationTitle && (
              <p className="application-note">
                对应申请：{selectedReply.applicationTitle}
              </p>
            )}
            <h3>中文整理</h3>
            <div className="translation-box">
              <p>{selectedReply.translation}</p>
            </div>
            <h3>你需要做什么</h3>
            <p className="application-note">{selectedReply.next}</p>
            <h3>邮件原文</h3>
            <div className="original-mail">{selectedReply.original}</div>
            <h3>直接回复原邮件线程</h3>
            <textarea
              className="original-mail"
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="核对事实后输入回复内容；发送后会写入申请时间线。"
            />
            <button
              className="apply-button"
              disabled={replySending || !replyDraft.trim()}
              onClick={sendReply}
            >
              {replySending ? "正在发送…" : "确认并发送回复"}
            </button>
            <a
              className="secondary-link"
              href={selectedReply.gmailUrl}
              target="_blank"
              rel="noreferrer"
            >
              在 Gmail 中核对原文 ↗
            </a>
          </section>
        </div>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="detail-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grabber" />
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <span className="detail-source">
              {selected.source} · {age(selected.publishedAt)}
            </span>
            <h2>{translatedTitle || selected.title}</h2>
            {translatedTitle && (
              <p className="original-title">英文标题：{selected.title}</p>
            )}
            <div className="detail-grid">
              <div>
                <small>
                  {selected.budget === "预算面议" ? "预算状态" : "原文金额"}
                </small>
                <b>
                  {selected.budget === "预算面议"
                    ? "甲方未公开"
                    : selected.budget}
                </b>
              </div>
              <div>
                <small>工作方式</small>
                <b>{selected.remote}</b>
              </div>
            </div>
            {selected.opportunityType === "project" && selected.deliverable && (
              <>
                <h3>预期交付物</h3>
                <p className="application-note">{selected.deliverable}</p>
              </>
            )}
            <h3>甲方需求（完整逐条中文翻译）</h3>
            {translationStatus && (
              <p className="translation-complete">
                ✓ 已完整翻译当前抓取原文{" "}
                {translationStatus.sourceLength.toLocaleString()} 字符 ·{" "}
                {translationStatus.parts} 段
              </p>
            )}
            <div className="translation-box">
              {translating ? (
                <span className="translate-loading">
                  正在逐段翻译完整岗位原文…
                </span>
              ) : translation ? (
                <p>{translation}</p>
              ) : (
                <div className="translate-failed">
                  <p>本次完整翻译失败，未展示残缺内容或通用模板。</p>
                  <button onClick={() => translateGig(selected)}>
                    重新翻译
                  </button>
                </div>
              )}
            </div>
            <button
              className="original-toggle"
              onClick={() => setShowOriginal((v) => !v)}
            >
              {showOriginal ? "收起英文原文" : "查看英文原文"}
            </button>
            {showOriginal && (
              <p className="original-text">
                {selected.fullText || selected.summary}
              </p>
            )}
            <h3>原文识别技能</h3>
            <div className="tags">
              {(selected.skills.length
                ? selected.skills
                : ["原文未识别出明确技能"]
              ).map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <h3>申请方式</h3>
            <p className="application-note">{selected.application}</p>
            {applicationError && (
              <p className="application-error">{applicationError}</p>
            )}
            <button
              className="apply-button"
              disabled={generatingPack}
              onClick={() => void startApplication(selected)}
            >
              {generatingPack
                ? "AI 正在读取个人资料并生成…"
                : "AI 定制申请此岗位"}
            </button>
            <a
              className="secondary-link"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              查看原始需求 ↗
            </a>
          </section>
        </div>
      )}
      {applicationPack && (
        <div
          className="modal-backdrop"
          onClick={() => setApplicationPack(null)}
        >
          <section
            className="detail-sheet application-pack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grabber" />
            <button className="close" onClick={() => setApplicationPack(null)}>
              ×
            </button>
            <span className="detail-source">
              {applicationPack.language === "en"
                ? "TAILORED APPLICATION PACKAGE"
                : "已自动生成定制申请包"}
              {batchPacks.length > 1
                ? ` · ${applicationPack.language === "en" ? "QUEUE" : "队列剩余"} ${batchPacks.length}`
                : ""}
            </span>
            <h2>{applicationPack.gig.title}</h2>
            <h3>
              {applicationPack.language === "en"
                ? "Employer requirements understood"
                : "甲方需求完整总结"}
            </h3>
            <div className="original-mail">
              {applicationPack.employerSummary}
            </div>
            <h3>
              {applicationPack.language === "en"
                ? "Requirement-to-evidence fit"
                : "甲方要求与我的对口证据"}
            </h3>
            {applicationPack.requirementMatches.map((match, index) => (
              <article className="task-proof received" key={index}>
                <b>{match.requirement}</b>
                <p>{match.advantage}</p>
                <small>
                  {applicationPack.language === "en" ? "Evidence: " : "证据："}
                  {match.evidence}
                </small>
              </article>
            ))}
            <div className="detail-grid">
              <div>
                <small>
                  {applicationPack.language === "en"
                    ? "PROPOSED RATE"
                    : "申请报价"}
                </small>
                <b>{applicationPack.quote}</b>
              </div>
              <div>
                <small>
                  {applicationPack.language === "en"
                    ? "WORK ARRANGEMENT"
                    : "工作方式"}
                </small>
                <b>{applicationPack.workMode}</b>
              </div>
            </div>
            <h3>
              {applicationPack.language === "en"
                ? "Relevant skills"
                : "精准匹配技能"}
            </h3>
            <div className="tags">
              {applicationPack.matchedSkills.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <h3>
              {applicationPack.language === "en"
                ? "Tailored résumé highlights"
                : "定制简历要点"}
            </h3>
            <ul className="resume-points">
              {applicationPack.resume.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>
              {applicationPack.language === "en"
                ? "Application letter"
                : "申请信"}
            </h3>
            <div className="original-mail">{applicationPack.coverLetter}</div>
            <p className="submission-note">
              {applicationPack.language === "en"
                ? "Verify that the role is still open and review the proposed rate and factual details before submission."
                : "提交前请核对岗位仍开放、报价和事实信息。"}
            </p>
            {queueNotice && (
              <div
                className={`queue-result ${queueNotice.status === "queue_failed" ? "failed" : "saved"}`}
              >
                {queueNotice.status === "queue_failed"
                  ? "保存失败，请重试"
                  : queueNotice.status === "submitted"
                    ? queueNotice.duplicate
                      ? `该岗位此前已经投递成功 · ${queueNotice.channel}`
                      : `平台已确认接收申请 · ${queueNotice.channel}`
                    : `申请任务已创建 · ${queueNotice.channel} · ${queueNotice.status}`}
                {queueNotice.id && <small>任务编号：{queueNotice.id}</small>}
                {queueNotice.receiptUrl ? (
                  <a href={queueNotice.receiptUrl} target="_blank" rel="noreferrer">
                    查看平台接收凭证 ↗
                  </a>
                ) : queueNotice.receiptId ? (
                  <small>平台凭证编号：{queueNotice.receiptId}</small>
                ) : null}
              </div>
            )}
            {queueNotice?.status !== "submitted" && (
              <button
                className="apply-button"
                disabled={queueing}
                onClick={() => confirmPack(applicationPack)}
              >
                {queueing
                  ? "正在写入服务器…"
                  : applicationPack.language === "en"
                    ? "Approve and create application task"
                    : "确认并创建申请任务"}
              </button>
            )}
            <a
              className="secondary-link"
              href={applicationPack.gig.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {applicationPack.language === "en"
                ? "Open original client page ↗"
                : "打开甲方原始页面 ↗"}
            </a>
          </section>
        </div>
      )}
    </main>
  );
}
