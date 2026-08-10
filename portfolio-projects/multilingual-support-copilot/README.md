# Public Issue Triage

Privacy-safe public issue triage portfolio project built with Next.js and TypeScript.

The deployment reads current public issues from the official GitHub API and preserves an original-source link for every record. It does not pretend to be connected to Gmail or an LLM: translation and reply generation remain explicitly unavailable until real providers are configured.

## Run

```bash
npm ci
npm run dev
```

## API

- `GET /api/inbox` returns normalized live public GitHub issues plus per-source health.
- `POST /api/draft` returns `503 llm_not_configured`; it never fabricates a reply.

## 中文

这是一个真实公开 Issue 分流作品集。数据来自 GitHub 官方 API，每条记录保留原始链接。公开版没有 Gmail 和 LLM 授权，因此会明确显示未连接，不会虚构邮件、中文翻译、知识库引用或回复结果。
