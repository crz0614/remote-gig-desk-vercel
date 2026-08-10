# API

## `GET /api/opportunities`

Returns normalized, privacy-safe demo opportunities.

```json
{
  "opportunities": [
    {
      "id": "signal",
      "company": "SignalForge",
      "role": "AI Workflow Engineer",
      "source": "YC · Ashby",
      "location": "Remote · Worldwide",
      "type": "Contract",
      "budget": "$75–110/hr",
      "match": 94,
      "skills": ["Python", "LLM", "FastAPI"]
    }
  ],
  "sources": ["GitHub", "Hacker News", "Y Combinator", "Wellfound", "Company ATS"],
  "fetchedAt": "ISO-8601 timestamp",
  "mode": "privacy-safe-demo"
}
```

Responses can be cached for 60 seconds and served stale for up to five minutes while refreshing.
