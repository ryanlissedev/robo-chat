# ADR: Guest BYOK via Per-Request Headers

- Status: Accepted
- Date: 2025-08-25

## Context
Guest users need access to all models. We must avoid server-side persistence of guest credentials and provide a secure, usable flow.

## Decision
Use per-request ephemeral headers to transmit guest BYOK to the chat API. The server never persists keys and redacts sensitive headers from logs. The existing provider factory supports per-call apiKey overrides.

## Rationale
- Minimal changes; leverages existing provider override.
- Keeps keys client-side except transient request transit.
- Easy to audit and sanitize; fast to implement.

## Alternatives Considered
- Edge Worker pattern (keys never leave client): more infra/complexity; consider as future enhancement.

## Consequences
- Keys traverse backend transiently: mitigated by HTTPS and redaction.
- Clear UI for credential sources and Guest BYOK modal.

## Follow-ups
- Optionally add Edge runtime path for ultra-secure mode later.

