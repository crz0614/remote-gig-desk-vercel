# Architecture

## Boundaries

The browser receives normalized opportunity objects, never provider credentials. Source adapters, scoring and optional model calls belong on the server. Personal portfolio facts, when enabled in a private deployment, must be encrypted at rest and separated from public demo data.

## Pipeline

1. Source adapters fetch public job or bounty data with deadlines and rate limits.
2. A normalizer maps different payloads to the `Opportunity` contract.
3. Filters remove stale, duplicate and non-remote listings.
4. Ranking combines verified skill overlap, recency and work-mode compatibility.
5. The UI explains the score instead of presenting an opaque number.
6. Proposal generation may cite only verified portfolio facts.
7. External submission always requires an auditable approval step.

## Production evolution

- PostgreSQL for opportunities, profiles and application events
- Queue-backed collectors with per-source circuit breakers
- Encrypted secret storage and OAuth token rotation
- Structured LLM outputs with factual-claim validation
- OpenTelemetry traces, source health metrics and retry dashboards

## Privacy model

The public deployment is intentionally stateless. Fictional company names and descriptions prevent accidental disclosure of a real user's search history. Production identity and email integrations are outside this repository's public demo boundary.
