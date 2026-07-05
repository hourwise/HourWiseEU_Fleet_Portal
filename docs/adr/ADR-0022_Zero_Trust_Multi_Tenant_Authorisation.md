# ADR-0022 — Zero Trust Multi-Tenant Authorisation

Status: Accepted

## Decision
HourWise adopts a Zero Trust security model. Authentication alone is never sufficient.
Every request must be authorised against:
- Organisation (tenant)
- Site
- Role
- Record ownership
- Operation (Read/Create/Update/Delete/Export)

## Principles
- Enable Row Level Security on all business tables.
- Never trust client-supplied IDs.
- Scope every query by organisation_id.
- Apply site filtering where appropriate.
- Atlas inherits the caller's permissions.
- Exports, reports and background jobs must honour the same permissions.
- Cache keys include tenant context.

## Mandatory Tests
- Cross-tenant access
- Cross-site access
- IDOR/BOLA
- Export authorisation
- Document access
- Atlas authorisation

## Consequences
Database-enforced security dramatically reduces accidental data leakage and makes secure behaviour the default.
