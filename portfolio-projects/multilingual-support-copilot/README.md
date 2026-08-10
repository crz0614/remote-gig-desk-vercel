# Multilingual Support Copilot

Privacy-safe AI customer support and email automation portfolio project built with Next.js and TypeScript.

The demo includes multilingual intent detection, Chinese translations, priority routing, knowledge-grounded drafts, citations and explicit human approval. Public demos use fictional messages only.

## Run

```bash
npm ci
npm run dev
```

## API

- `GET /api/inbox` returns the fictional normalized inbox.
- `POST /api/draft` with `{ "ticketId": "m-1042" }` returns a grounded draft and approval requirement.

## 中文

这是一个多语言 AI 客服与邮件自动化作品集，展示意图识别、中文翻译、优先级分流、知识库引用、回复草稿和人工确认流程。公开版不连接真实邮箱，也不包含真实客户数据。
