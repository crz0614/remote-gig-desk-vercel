const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com"];

function validHttpUrl(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function unwrap(url: URL) {
  for (const key of ["url", "u", "target", "redirect", "redirect_url"]) {
    const nested = url.searchParams.get(key);
    const parsed = nested && validHttpUrl(nested);
    if (parsed) return parsed;
  }
  return url;
}

function score(url: URL, sourceUrl?: string) {
  if (sourceUrl && url.href === sourceUrl) return -100;
  if (/^(news\.ycombinator\.com|hn\.algolia\.com)$/i.test(url.hostname)) return -80;
  if (/\.(?:png|jpe?g|gif|svg|pdf|zip)$/i.test(url.pathname)) return -50;
  let value = 0;
  if (ATS_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) value += 80;
  if (/(?:apply|application|jobs?|careers?|positions?|openings?)/i.test(url.pathname + url.search)) value += 35;
  if (/^(mailto:|javascript:)/i.test(url.href)) value -= 100;
  return value;
}

/** Select the most likely employer application page, preserving the original listing URL separately. */
export function detectFinalApplicationUrl(values: unknown[], sourceUrl?: string) {
  const candidates: URL[] = [];
  for (const value of values) {
    const text = String(value || "");
    const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const match of matches) {
      const parsed = validHttpUrl(match.replace(/[),.;!?]+$/, ""));
      if (parsed) candidates.push(unwrap(parsed));
    }
  }
  return candidates
    .map((url, index) => ({ url, index, score: score(url, sourceUrl) }))
    .filter(candidate => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.url.href || null;
}

export function platformKeyForUrl(value: string | null | undefined, fallback: string) {
  const url = value && validHttpUrl(value);
  if (!url) return fallback;
  const host = ATS_HOSTS.find(item => url.hostname === item || url.hostname.endsWith(`.${item}`));
  return host?.split(".")[0] || fallback;
}

export function isReusablePlatformSession(session: { status?: string; expiresAt?: string | number | null } | undefined, now = Date.now()) {
  return session?.status === "verified" && (!session.expiresAt || Number(session.expiresAt) > now);
}

export function applicationStateForSession(
  session: { status?: string; expiresAt?: string | number | null } | undefined,
  now = Date.now(),
) {
  return isReusablePlatformSession(session, now)
    ? { status: "queued_for_browser", deliveryState: "session_reused", eventType: "SESSION_REUSED" }
    : { status: "verification_required", deliveryState: "verification_required", eventType: "VERIFICATION_REQUIRED" };
}
