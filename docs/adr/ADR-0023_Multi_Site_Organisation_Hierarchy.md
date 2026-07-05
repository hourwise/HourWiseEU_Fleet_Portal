# ADR-0023 — Multi-Site Organisation Hierarchy

Status: Accepted

## Decision
Model organisations as:

Platform
└── Organisation
    ├── Site A
    ├── Site B
    └── Site N

Drivers and vehicles belong to an Organisation and are assigned to Sites.

## Benefits
- Unlimited sites
- Central billing/payroll/compliance
- Site autonomy
- Organisation reporting
- Simple cross-site transfers

## Roles
Platform Admin
Organisation Owner
Operations Director
Regional Manager
Site Manager
Planner
Workshop Manager
Fleet Administrator
Driver

## Atlas
Atlas inherits organisation/site permissions and may compare sites only when authorised.

## Data Model
Most operational tables include:
- organisation_id
- site_id
