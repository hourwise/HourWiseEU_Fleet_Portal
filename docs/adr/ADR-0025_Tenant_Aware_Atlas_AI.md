# ADR-0025 — Tenant-Aware Atlas AI

Status: Accepted

Atlas always executes in the current security context.

Rules:
- Never query another tenant.
- Respect organisation/site/role filters.
- Never bypass RLS.
- Include permission context in every generated SQL query.
- Audit AI requests and responses.
