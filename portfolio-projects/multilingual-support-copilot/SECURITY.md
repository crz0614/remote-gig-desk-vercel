# Security boundary

- No real mailbox content, addresses, OAuth tokens or customer records in source control.
- Provider credentials remain server-side.
- Generated replies require explicit human approval.
- Every outbound action receives an idempotency key and audit event.
