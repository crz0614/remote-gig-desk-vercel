# Remote Gig Desk

A production-oriented application workbench that discovers actionable remote work, creates evidence-grounded application materials, submits through supported web/API channels, and tracks replies without claiming success before a real receipt exists.

[Live workbench](https://remote-gig-desk-vercel.vercel.app/) · [Public portfolio](https://crz0614.github.io/ruozhu-portfolio/) · [Application source](./remote-gig-desk-vercel)

> The live workbench is owner-authenticated because it contains private résumé, profile, email, and application data. This public repository contains code and tests only.

## What is implemented

- Collects remote jobs and paid project work from GitHub, Hacker News, Reddit, RemoteOK, Remotive, Jobicy, Arbeitnow, YC, company career pages, and supported ATS providers.
- Removes App-only and non-actionable listings; keeps opportunities with a usable web application path, public email, or supported contact route.
- Reads the full source description and produces Chinese translation or structured project summaries.
- Generates a tailored application letter from saved, verified profile facts and relevant project evidence.
- Builds and uploads a DOCX résumé when an attachment is required.
- Auto-fills identity, contact, education, experience, project, skills, portfolio, work authorization, rate, and application fields.
- Supports Greenhouse, Lever, Ashby, and Workable browser execution.
- Pauses for CAPTCHA, MFA, login, identity, or legal confirmation, then resumes the original task.
- Requires an official provider confirmation page, API receipt, or email delivery receipt before marking an application submitted.
- Synchronizes relevant Gmail replies and records classification, translation, summary, and next action.

## Trust boundaries

- No fictional jobs, budgets, client results, revenue, or user metrics.
- No passwords, cookies, OAuth tokens, private résumé data, or email content are committed to GitHub.
- CAPTCHA and MFA are never bypassed.
- A button click is not a submission receipt.
- App-only opportunities are excluded from the actionable feed.

## Architecture

| Area | Implementation |
|---|---|
| Web application | Next.js 16, React 19, TypeScript |
| Persistence | Neon serverless PostgreSQL |
| AI workflows | Structured generation and translation with a free-tier provider path |
| Browser automation | Playwright, Vercel Sandbox, paired Chrome extension |
| Integrations | Gmail OAuth/API, GitHub OAuth/API, ATS web forms |
| Deployment | Vercel, GitHub Pages |
| Verification | Node test suite plus production Next.js build |

## Repository layout

- [remote-gig-desk-vercel/](./remote-gig-desk-vercel) — Next.js application, APIs, database and tests
- [browser-agent-extension/](./browser-agent-extension) — paired Chrome executor source
- [browser-agent-extension-0.7.0.zip](./browser-agent-extension-0.7.0.zip) — current flat installation package

## Run locally

```bash
cd remote-gig-desk-vercel
npm install
npm test
npm run dev
```

Node.js 20+ is required. External integrations need your own environment variables; production secrets are not included.

## Current operational boundary

Email and GitHub API submissions can complete directly. Supported ATS and ordinary web forms are auto-filled; login, CAPTCHA, MFA, identity, and final legal confirmation may require one human checkpoint. After that checkpoint, the paired executor resumes the saved task. Only verified acceptance evidence changes a task to `submitted`.

## License

All rights reserved. The source is public for portfolio review; no open-source license is granted.
