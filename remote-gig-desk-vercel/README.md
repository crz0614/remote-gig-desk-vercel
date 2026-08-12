# Remote Gig Desk

A production-oriented workbench for finding verified remote opportunities, preparing individualized applications, tracking replies, and executing supported ATS submissions without claiming success before an official receipt exists.

## Live system

- [Production workbench](https://remote-gig-desk-vercel.vercel.app/)
- [Public engineering portfolio](https://crz0614.github.io/ruozhu-portfolio/)

The workbench is owner-authenticated because it contains private profile, résumé, application, and email data. This repository contains application code only—not those private records or deployment secrets.

## What it does

- Aggregates actionable opportunities from GitHub, Hacker News, RemoteOK, Remotive, Jobicy, Arbeitnow, Reddit, YC/company career pages, and supported ATS sources; App-only and contactless listings are excluded.
- Keeps original job text and provides complete per-job Chinese translation through a free translation path.
- Generates job-specific application packs from a private profile and verified portfolio evidence using the Gemini free tier.
- Creates a DOCX résumé attachment when no explicit attachment was selected.
- Sends supported email and GitHub applications through official APIs.
- Queues Greenhouse, Lever, Ashby, Workable, and supported web forms for cloud or paired-browser execution.
- Uploads real attachments and records submission only after validating an official confirmation page or API receipt.
- Auto-fills saved identity, contact, education, experience, projects, skills, portfolio, rate and attachments; only CAPTCHA, MFA, login, identity, or legal-consent checkpoints require takeover.
- Reuses verified, unexpired platform sessions without storing credentials in this public repository.
- Refreshes Gmail application replies, classifies them, translates them, and records next actions.
- Publishes only explicitly verified portfolio items to a separate GitHub Pages repository.

## Safety model

`queued → browser_in_progress → verification_required | submitted`

The system never equates a button click with a successful application. `submitted` requires provider-matched evidence such as an official confirmation page, receipt ID, or accepted API response. CAPTCHA and legal confirmations are not bypassed.

## Architecture

- Next.js 16 / React 19 / TypeScript
- Neon serverless PostgreSQL
- Vercel Functions and Vercel Sandbox
- Playwright Chromium execution
- Gmail and GitHub OAuth integrations
- Gemini free-tier structured output
- Owner-paired Chrome extension for session-bound forms

Private profile fields and OAuth tokens are encrypted before database storage. Secrets remain in deployment environment variables and are excluded from Git.

## Verification

```bash
npm install
npm test
```

`npm test` runs the Node test suite and a production Next.js build. Tests cover URL/ATS detection, session reuse, application evidence, attachment handling, cloud execution checkpoints, email analysis, translation completeness, opportunity state, portfolio import/publish behavior, and privacy-sensitive health output.

## Local development

```bash
npm install
npm run dev
```

Node.js 20 or newer is required. External integrations require locally supplied environment variables; no production credentials are committed.

## Evidence and limitations

- Source and production deployment are public and independently inspectable.
- The browser executor and ATS adapters are implemented and evidence-gated.
- A real external submission is reported only when a real queued opportunity returns official acceptance evidence.
- The public portfolio intentionally excludes private résumé, email, and application records.

## Repository layout

- `app/` — workbench UI and API routes
- `lib/` — application, AI, ATS, evidence, portfolio, and security logic
- `../browser-agent-extension/` — paired Chrome extension source
- `tests/` — behavior and regression coverage

## License

No open-source license has been granted. Source is public for portfolio review; all rights are reserved unless a license is added later.
