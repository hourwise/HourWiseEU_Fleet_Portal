# 24 — Architecture Decision Records

**Document status:** Draft
**Parent system:** HourWise Fleet Portal
**Related documents:**

* `18.3_Evidence_Import_Pipeline.md` — justifies ADR-0002 (Immutability) and ADR-0003 (Parser Versioning).
* `18.7_Compliance_Engine.md` — justifies ADR-0004 (Calculated Outcomes).
* `18.8_Evidence_Engine.md` — justifies ADR-0005 (Evidence Packs).
* `20_Reporting_Platform_Specificati.md` — justifies ADR-0006 (Snapshots) and ADR-0013 (Cautious Language).
* `19_Atlas_Specification.md` — justifies ADR-0007 (Evidence-led) and ADR-0008 (Permission Checks).
* `22_Security_Model_Specification.md` — justifies ADR-0009 (RLS), ADR-0012 (Service Role), ADR-0014 (Secrets), and ADR-0015 (Feature Flags).
* `23_Integration_Architecture.md` — justifies ADR-0010 (Adapters) and ADR-0011 (Supplementary Evidence).

---

## 1. Purpose

This document defines the Architecture Decision Record system for HourWise.

Architecture Decision Records, or ADRs, are short documents that explain important technical and product architecture decisions.

They exist so that future developers, AI agents, contributors, and maintainers can understand:

* what decision was made
* why the decision was made
* what alternatives were considered
* what trade-offs were accepted
* what the consequences are
* when the decision may need to be reviewed

The HourWise Source of Truth has now grown into a full architecture plan. ADRs are needed to protect that plan from accidental drift.

---

## 2. Core Principle

The core principle is:

> Important decisions should be recorded before they are forgotten, challenged, reversed accidentally, or misunderstood by future agents.

HourWise should not rely on memory or chat history for critical architecture decisions.

If a decision affects security, data integrity, evidence handling, compliance outcomes, reporting, Atlas, integrations, tenancy, or long-term maintainability, it should have an ADR.

---

## 3. Why ADRs Matter for HourWise

HourWise is not just a general SaaS dashboard.

It is a compliance and evidence platform that handles:

* driver card data
* vehicle unit data
* imported tachograph files
* compliance calculations
* evidence packs
* reports
* driver and vehicle records
* Atlas explanations
* fleet operational data
* future integrations

Small architecture decisions can have serious long-term consequences.

Examples:

* If raw files are overwritten, evidence trust is weakened.
* If Atlas can query unrestricted data, permissions are weakened.
* If report exports do not snapshot evidence, audit history is weakened.
* If GPS is treated as tachograph truth, compliance interpretation is weakened.
* If frontend checks are treated as security, tenant isolation is weakened.

ADRs make these decisions explicit.

---

## 4. ADR Location

Recommended ADR folder:

```text id="f3k5ou"
docs/Specifications/24_Architecture_Decision_Records/
```

Alternative if using a common architecture convention:

```text id="o3qipp"
docs/adr/
```

Recommended structure:

```text id="x28ict"
docs/Specifications/24_Architecture_Decision_Records/
  README.md
  ADR-0001-record-architecture-decisions.md
  ADR-0002-raw-tachograph-files-are-immutable.md
  ADR-0003-parser-runs-are-versioned.md
  ADR-0004-compliance-outcomes-are-calculated-records.md
  ADR-0005-evidence-packs-are-first-class-records.md
  ADR-0006-reports-snapshot-evidence-at-export.md
  ADR-0007-atlas-is-evidence-led-not-source-of-truth.md
  ADR-0008-atlas-retrieval-is-permission-checked-server-side.md
  ADR-0009-row-level-security-protects-tenant-data.md
  ADR-0010-integrations-use-provider-adapters.md
```

This current document can act as the ADR index and template until separate ADR files are created.

---

## 5. ADR Numbering

ADRs should use stable sequential numbering.

Recommended format:

```text id="h05k4z"
ADR-0001-title-in-kebab-case.md
ADR-0002-title-in-kebab-case.md
ADR-0003-title-in-kebab-case.md
```

Rules:

* Never reuse an ADR number.
* Never renumber existing ADRs.
* If a decision is replaced, mark the old ADR as superseded.
* Link to the new ADR from the old one.
* Keep old ADRs for historical context.

---

## 6. ADR Statuses

Each ADR should have one status.

Recommended statuses:

```text id="u7qlek"
Proposed
Accepted
Superseded
Deprecated
Rejected
```

### 6.1 Proposed

The decision is being considered but is not final.

### 6.2 Accepted

The decision is approved and should guide implementation.

### 6.3 Superseded

The decision has been replaced by a newer ADR.

### 6.4 Deprecated

The decision is no longer recommended but may still exist in older parts of the system.

### 6.5 Rejected

The decision was considered but deliberately not chosen.

---

## 7. ADR Template

Each ADR should follow this template.

```markdown id="r50yk2"
# ADR-0000 — Decision Title

**Status:** Proposed | Accepted | Superseded | Deprecated | Rejected  
**Date:** YYYY-MM-DD  
**Related documents:**  
- `path/to/related/document.md`

---

## Context

Describe the problem, background, constraints, and why a decision is needed.

---

## Decision

State the decision clearly.

---

## Alternatives Considered

List serious alternatives and why they were not chosen.

---

## Consequences

Explain the positive and negative consequences of the decision.

---

## Implementation Notes

Add practical notes for developers or agents.

---

## Review Triggers

List conditions that should cause this ADR to be reviewed.
```

---

## 8. When to Create an ADR

Create an ADR when a decision affects:

* database structure
* evidence integrity
* parser strategy
* compliance calculation model
* report export behaviour
* Atlas safety boundaries
* permissions
* tenancy
* raw file handling
* integrations
* security architecture
* provider selection
* billing architecture
* infrastructure choices
* irreversible migration choices
* major product boundaries

Do not create ADRs for tiny implementation details unless they affect architecture.

---

## 9. ADR Index

The following ADRs should be created as the initial decision set.

```text id="n5zjsl"
ADR-0001 — Record Architecture Decisions
ADR-0002 — Raw Tachograph Files Are Immutable
ADR-0003 — Parser Runs Are Versioned
ADR-0004 — Compliance Outcomes Are Calculated Records
ADR-0005 — Evidence Packs Are First-Class Records
ADR-0006 — Reports Snapshot Evidence At Export
ADR-0007 — Atlas Is Evidence-Led And Not Source Of Truth
ADR-0008 — Atlas Retrieval Is Permission-Checked Server-Side
ADR-0009 — Row Level Security Protects Tenant Data
ADR-0010 — Integrations Use Provider Adapters
ADR-0011 — GPS And Telematics Are Supplementary Evidence
ADR-0012 — Service Role Access Must Be Wrapped By Permission Checks
ADR-0013 — Reports Use Cautious Compliance Language
ADR-0014 — External Provider Secrets Are Server-Side Only
ADR-0015 — Feature Flags Do Not Replace Permissions
```

The sections below provide starter ADR content that can later be split into individual files.

---

# ADR-0001 — Record Architecture Decisions

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `24_Architecture_Decision_Records.md`

---

## Context

HourWise is a growing compliance platform with multiple related systems:

* imports
* parser processing
* timeline reconstruction
* compliance checks
* evidence packs
* reporting
* Atlas
* integrations
* security

Many decisions have long-term consequences. Without ADRs, future implementation work may accidentally reverse or misunderstand key architectural choices.

---

## Decision

HourWise will use Architecture Decision Records for important technical and product architecture decisions.

ADRs will be stored in the documentation repository and numbered sequentially.

---

## Alternatives Considered

### Rely on Source of Truth documents only

Rejected because long documents can explain architecture but do not clearly isolate individual decisions and trade-offs.

### Rely on chat history

Rejected because chat history is not a stable architecture repository.

### Rely on code comments only

Rejected because code comments do not explain wider product, compliance, and security context.

---

## Consequences

Positive:

* decisions are easier to understand
* future agents can work safely
* architecture drift is reduced
* trade-offs are visible
* superseded decisions can be tracked

Negative:

* adds documentation overhead
* ADRs must be maintained when architecture changes

---

## Implementation Notes

Create ADR files for major decisions before or during implementation.

Do not wait until the project is finished.

---

## Review Triggers

Review this decision if:

* the documentation structure changes
* the project adopts a different architecture governance process
* ADRs become stale or unused

---

# ADR-0002 — Raw Tachograph Files Are Immutable

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `18_Compliance_Intelligence_Platform/18.3_Import_Pipeline.md`
* `21_Data_Model_Specification.md`
* `22_Security_Model_Specification.md`

---

## Context

HourWise imports driver card and vehicle unit files. These files are evidence.

If raw files are overwritten, edited, or replaced silently, the platform cannot reliably prove what data was used to generate timelines, compliance outcomes, evidence packs, or reports.

---

## Decision

Raw tachograph files must be immutable after upload.

If a corrected or replacement file is uploaded, it must create a new file record.

If a file is reprocessed, the system must create a new parser run rather than modifying the raw file.

---

## Alternatives Considered

### Allow overwriting files

Rejected because it weakens evidence integrity.

### Store only parsed data and discard raw files

Rejected because parser outputs may need verification, reprocessing, debugging, or audit support.

### Allow admins to edit raw files

Rejected because raw evidence must not be changed by users.

---

## Consequences

Positive:

* evidence chain remains trustworthy
* reports can reference original imports
* parser bugs can be investigated
* duplicate detection is possible
* audit support improves

Negative:

* storage costs increase
* retention policy must be considered
* users need clear handling for duplicate or replacement files

---

## Implementation Notes

Required records:

* `import_files`
* `file_assets`
* file hash
* upload timestamp
* uploaded by
* storage path
* duplicate reference
* parser runs linked separately

---

## Review Triggers

Review if:

* legal retention requirements change
* storage costs become significant
* anonymised archival strategy is introduced
* file redaction becomes legally required

---

# ADR-0003 — Parser Runs Are Versioned

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `18_Compliance_Intelligence_Platform/18.3_Import_Pipeline.md`
* `21_Data_Model_Specification.md`
* `23_Integration_Architecture.md`

---

## Context

Tachograph parser behaviour may change over time due to:

* bug fixes
* new file support
* new parser libraries
* schema changes
* improved interpretation
* manufacturer-specific edge cases

The same raw file may produce different outputs when parsed by different parser versions.

---

## Decision

Every parser execution must create a `parser_run` record including parser name, parser version, configuration, status, timestamps, and errors.

Parser outputs must link to parser runs.

---

## Alternatives Considered

### Store only latest parser output

Rejected because it loses history and makes report audit difficult.

### Store parser version only in logs

Rejected because logs are not reliable enough for evidence traceability.

### Recalculate silently after parser updates

Rejected because it could change compliance outcomes without audit visibility.

---

## Consequences

Positive:

* parser changes are traceable
* reports can explain which parser version was used
* reprocessing is safer
* debugging improves
* regression testing is easier

Negative:

* more tables and records
* UI must explain reprocessed or superseded results
* storage may increase

---

## Implementation Notes

Required records:

* `parser_runs`
* `parser_outputs`
* `parser_errors`

Parser output should include schema version.

---

## Review Triggers

Review if:

* parser becomes fully external
* parser output is standardised by a third-party library
* multiple parser engines are supported
* parser versioning affects billing or support

---

# ADR-0004 — Compliance Outcomes Are Calculated Records

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `18_Compliance_Intelligence_Platform/18.7_Compliance_Engine.md`
* `21_Data_Model_Specification.md`
* `22_Security_Model_Specification.md`

---

## Context

Compliance outcomes are derived from imported data, timeline events, rule versions, and calculation logic.

If users can directly edit compliance outcomes, the system loses trust. Human interpretation should be recorded separately from calculated results.

---

## Decision

Compliance outcomes will be calculated records.

Users must not directly edit calculated outcome values.

Human review will be stored separately as review notes, review states, or superseding records.

---

## Alternatives Considered

### Allow managers to edit outcomes directly

Rejected because it mixes calculated truth with human interpretation.

### Store outcomes only as report text

Rejected because outcomes need to be queryable, reviewable, and evidence-linked.

### Let Atlas rewrite outcomes

Rejected because Atlas is not the source of truth.

---

## Consequences

Positive:

* compliance logic remains trustworthy
* human review is preserved separately
* audit trail is clearer
* recalculation can supersede old outcomes
* evidence links remain meaningful

Negative:

* more complex UI
* users may need education on review notes versus outcome status
* recalculation workflow is needed

---

## Implementation Notes

Use:

* `compliance_checks`
* `compliance_outcomes`
* `compliance_outcome_events`
* `compliance_outcome_sources`
* `review_notes`

Possible review actions:

* add note
* mark reviewed
* request recalculation
* supersede after new data
* dismiss with review note

---

## Review Triggers

Review if:

* legal requirements require different treatment
* customers need formal dispute workflows
* rule engine architecture changes
* compliance outcomes become externally certified records

---

# ADR-0005 — Evidence Packs Are First-Class Records

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `18_Compliance_Intelligence_Platform/18.8_Evidence_Engine.md`
* `18_Compliance_Intelligence_Platform/18.9_Evidence_Reporting_Engine.md`
* `20_Reporting_Platform_Specification.md`
* `21_Data_Model_Specification.md`

---

## Context

Compliance outcomes must be explainable. Reports must show what evidence supports each finding.

If evidence is only assembled at report export time, users cannot easily review completeness, identify missing data, or prepare audit material.

---

## Decision

Evidence Packs will be first-class records.

An Evidence Pack links a compliance outcome to supporting records such as imports, timeline events, parser outputs, review notes, and documents.

---

## Alternatives Considered

### Generate evidence only inside reports

Rejected because evidence needs to be reviewed before reporting.

### Store evidence as plain text

Rejected because evidence must link to source records.

### Let Atlas dynamically summarise evidence without records

Rejected because Atlas summaries cannot replace structured evidence links.

---

## Consequences

Positive:

* evidence can be reviewed independently
* missing evidence is visible
* reports become easier to build
* Atlas can explain evidence safely
* audit preparation improves

Negative:

* extra data model complexity
* evidence completeness checks must be maintained
* UI must support evidence review

---

## Implementation Notes

Use:

* `evidence_packs`
* `evidence_items`
* `evidence_completeness_checks`

Evidence Pack statuses should include:

* draft
* needs review
* complete
* included in report
* archived
* superseded

---

## Review Triggers

Review if:

* reports require a different evidence structure
* evidence packs become too heavy for performance
* external audit workflows require formal certification
* manual evidence uploads become a major feature

---

# ADR-0006 — Reports Snapshot Evidence At Export

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `20_Reporting_Platform_Specification.md`
* `21_Data_Model_Specification.md`
* `22_Security_Model_Specification.md`

---

## Context

Live data can change after a report is exported.

Examples:

* a missing VU file is later imported
* a parser bug is fixed
* outcomes are recalculated
* review notes are added
* evidence packs are completed later

A report must preserve what was known at the time of export.

---

## Decision

Report exports must snapshot the evidence state at export time.

Each export must store:

* report configuration
* template version
* included source records
* evidence pack state
* compliance outcome state
* review notes
* warnings and blockers
* exporting user
* export timestamp
* generated file metadata

---

## Alternatives Considered

### Reports always render live data

Rejected because old reports would change over time.

### Store only the PDF file

Rejected because structured audit information would be lost.

### Store only source references

Rejected because referenced live records may change.

---

## Consequences

Positive:

* exported reports remain auditable
* historical exports are stable
* evidence state can be explained later
* report versioning becomes clear

Negative:

* larger storage requirements
* export logic is more complex
* snapshot schema must be maintained

---

## Implementation Notes

Use:

* `reports`
* `report_exports`
* `snapshot_json`
* file hash
* template version
* export audit logs

If a report is regenerated, create a new export record.

---

## Review Triggers

Review if:

* snapshot storage becomes too large
* external signed reports are introduced
* report export formats change significantly
* legal requirements define a different retention model

---

# ADR-0007 — Atlas Is Evidence-Led And Not Source Of Truth

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `18_Compliance_Intelligence_Platform/18.10_Atlas_Interface.md`
* `19_Atlas_Specification.md`
* `21_Data_Model_Specification.md`

---

## Context

Atlas is a major product feature, but uncontrolled AI output could damage user trust if it invents findings, gives legal advice, or contradicts system records.

HourWise needs Atlas to explain evidence, not create unsupported truth.

---

## Decision

Atlas is an evidence-led assistant.

Atlas may explain, summarise, draft, and guide users, but it is not the source of truth.

Atlas must base compliance-related responses on retrieved HourWise records.

---

## Alternatives Considered

### General-purpose chatbot

Rejected because it would be unsafe for compliance workflows.

### Allow Atlas to make final compliance decisions

Rejected because deterministic engines and evidence records must remain authoritative.

### Disable AI entirely

Rejected because Atlas provides strong product value when constrained properly.

---

## Consequences

Positive:

* Atlas can be useful while remaining safe
* users can trust source-linked answers
* legal risk is reduced
* reporting and evidence integrity remain intact

Negative:

* Atlas implementation is more complex
* some user questions must be refused or limited
* retrieval and source mapping are required

---

## Implementation Notes

Atlas responses should include:

* response category
* confidence state
* source records
* missing data
* suggested next action
* permission-safe wording

---

## Review Triggers

Review if:

* Atlas becomes driver-facing
* external AI provider changes
* legal review requires stricter wording
* autonomous workflow features are added

---

# ADR-0008 — Atlas Retrieval Is Permission-Checked Server-Side

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `19_Atlas_Specification.md`
* `22_Security_Model_Specification.md`
* `23_Integration_Architecture.md`

---

## Context

Atlas could accidentally become a permission bypass if it retrieves or summarises data outside the user’s authorised scope.

Frontend-only restrictions are not enough.

---

## Decision

Atlas retrieval must happen server-side after authentication, fleet membership checks, role checks, and record scope checks.

The frontend must not send unrestricted database context directly to Atlas or an AI provider.

---

## Alternatives Considered

### Frontend sends all visible page data to AI

Rejected because it increases leakage risk and exposes implementation details.

### AI queries database directly

Rejected because it risks permission bypass and uncontrolled data exposure.

### Use broad fleet context for every prompt

Rejected because it exposes unnecessary data and increases cost.

---

## Consequences

Positive:

* Atlas respects permissions
* less data is exposed to AI providers
* audit logs are meaningful
* tenant isolation is preserved
* cost is easier to control

Negative:

* backend implementation is more complex
* context resolver and retriever are required
* responses may be limited when context is missing

---

## Implementation Notes

Atlas request flow:

```text id="6zzi2n"
Prompt
  ↓
Authenticate
  ↓
Resolve fleet/user/role
  ↓
Classify intent
  ↓
Check permissions
  ↓
Retrieve permitted records
  ↓
Generate response
  ↓
Log sources
```

---

## Review Triggers

Review if:

* Atlas provider supports secure tool calling
* internal permission model changes
* external partner APIs provide Atlas context
* driver-facing Atlas expands

---

# ADR-0009 — Row Level Security Protects Tenant Data

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `21_Data_Model_Specification.md`
* `22_Security_Model_Specification.md`

---

## Context

HourWise is multi-tenant. Fleet data must be isolated.

Application-only checks are not enough, especially when using Supabase/Postgres and when future agents may add new queries.

---

## Decision

Tenant-owned tables should use Row Level Security where practical.

RLS policies should enforce fleet membership and role-based access at the database layer.

---

## Alternatives Considered

### Application-only permissions

Rejected because mistakes in API code could expose tenant data.

### Separate database per fleet

Rejected for MVP because it adds operational complexity.

### Separate schema per fleet

Rejected for MVP because it complicates migrations and reporting.

---

## Consequences

Positive:

* stronger tenant isolation
* safer future development
* reduced risk from accidental broad queries
* better alignment with Supabase architecture

Negative:

* RLS policies require careful testing
* service-role operations must be handled cautiously
* debugging access issues can be harder

---

## Implementation Notes

Apply RLS to tenant-owned tables such as:

* drivers
* vehicles
* imports
* parser outputs
* timeline events
* compliance outcomes
* evidence packs
* reports
* Atlas messages
* audit logs

---

## Review Triggers

Review if:

* enterprise customers require separate databases
* performance issues arise from RLS
* permission model becomes highly customised
* Supabase architecture changes

---

# ADR-0010 — Integrations Use Provider Adapters

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `23_Integration_Architecture.md`

---

## Context

HourWise may integrate with many external providers over time:

* telematics
* GPS tracking
* email
* billing
* calendar
* payroll
* accounting
* AI providers
* partner APIs

Hardcoding provider-specific logic throughout the app would make the platform fragile.

---

## Decision

External integrations should use provider adapters.

Provider adapters translate provider-specific payloads into HourWise internal contracts.

---

## Alternatives Considered

### Hardcode each provider directly into domain logic

Rejected because it creates vendor lock-in and messy code.

### Build a full marketplace immediately

Rejected because it is too large for MVP.

### Avoid integrations entirely

Rejected because integrations are a long-term strategic need.

---

## Consequences

Positive:

* providers can be replaced more easily
* domain services stay cleaner
* payload validation is clearer
* testing is easier
* future partner APIs are easier to support

Negative:

* adapter layer adds initial complexity
* internal data contracts must be designed carefully

---

## Implementation Notes

Pattern:

```text id="tya25q"
External Provider
  ↓
Provider Adapter
  ↓
Payload Validator
  ↓
HourWise Contract
  ↓
Domain Service
```

---

## Review Triggers

Review if:

* only one provider is ever supported
* provider marketplace becomes a core product
* data contracts change significantly
* integrations become performance-critical

---

# ADR-0011 — GPS And Telematics Are Supplementary Evidence

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `23_Integration_Architecture.md`
* `18_Compliance_Intelligence_Platform/18.11_Future_Roadmap.md`

---

## Context

GPS and telematics data may provide useful operational context, such as vehicle movement, route history, location, mileage, geofence events, and ignition state.

However, tachograph data remains the primary compliance source for drivers’ hours.

---

## Decision

GPS and telematics data will be treated as supplementary evidence.

It may support review, identify gaps, or provide operational context, but it must not automatically replace tachograph-derived evidence.

---

## Alternatives Considered

### Treat GPS as equivalent to tachograph data

Rejected because GPS does not replace tachograph legal evidence.

### Ignore GPS entirely

Rejected because GPS may be valuable for operational review and anomaly detection.

### Use GPS to automatically confirm infringements

Rejected because this could create unsupported compliance conclusions.

---

## Consequences

Positive:

* preserves tachograph evidence hierarchy
* allows useful future integrations
* reduces legal risk
* supports investigation without overclaiming

Negative:

* users may need explanation
* reports must label GPS data carefully
* Atlas must use cautious wording

---

## Implementation Notes

Good wording:

```text id="bju951"
The tracking integration shows vehicle movement during this period, but no matching VU file has been imported. This may support review, but it does not replace tachograph evidence.
```

Avoid:

```text id="jrgcr0"
GPS proves the infringement.
```

---

## Review Triggers

Review if:

* legal framework changes
* certified telematics evidence becomes available
* a specific provider offers regulator-approved evidence
* customer requirements demand deeper GPS workflows

---

# ADR-0012 — Service Role Access Must Be Wrapped By Permission Checks

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `22_Security_Model_Specification.md`
* `21_Data_Model_Specification.md`

---

## Context

Some backend processes may require elevated access, especially when using Supabase service-role credentials for jobs, imports, reports, or Atlas retrieval.

Elevated access can bypass RLS if used carelessly.

---

## Decision

All service-role operations must be wrapped by explicit permission and tenant-scope checks unless they are system-only background jobs operating on already-scoped records.

Service-role credentials must never be exposed to the frontend.

---

## Alternatives Considered

### Use service role freely in backend

Rejected because it increases cross-tenant risk.

### Avoid service role entirely

Rejected because some backend jobs may require elevated access.

### Trust frontend-provided fleet IDs

Rejected because users can tamper with request payloads.

---

## Consequences

Positive:

* safer backend operations
* clearer permission model
* reduced tenant leakage risk
* better auditability

Negative:

* more backend code
* permission resolver must be robust
* tests are required for service functions

---

## Implementation Notes

Every service-role endpoint should:

* authenticate user
* resolve fleet membership
* check permission
* validate target record belongs to fleet
* return only permitted data
* audit sensitive actions

---

## Review Triggers

Review if:

* backend architecture changes
* separate worker services are introduced
* enterprise tenancy model changes
* external API access expands

---

# ADR-0013 — Reports Use Cautious Compliance Language

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `20_Reporting_Platform_Specification.md`
* `19_Atlas_Specification.md`

---

## Context

HourWise reports may be used for internal review, audit preparation, and management decision-making.

Overconfident or legalistic wording could create risk if the report presents possible findings as proven legal conclusions.

---

## Decision

Reports must use cautious, evidence-based language.

Reports should clearly distinguish:

* confirmed outcomes
* possible outcomes
* uncertain outcomes
* insufficient data
* missing evidence
* manager-reviewed notes

---

## Alternatives Considered

### Use enforcement-style language

Rejected because HourWise is not an enforcement authority.

### Avoid all compliance wording

Rejected because reports need to be useful.

### Let Atlas decide wording freely

Rejected because report language must be controlled.

---

## Consequences

Positive:

* reduces legal risk
* improves clarity
* supports human review
* aligns with evidence-first design

Negative:

* wording may feel less dramatic
* users may need education on statuses

---

## Implementation Notes

Preferred phrases:

* “flagged for review”
* “available evidence suggests”
* “calculated outcome”
* “requires manager review”
* “missing evidence”
* “insufficient data”

Avoid:

* “guilty”
* “illegal”
* “guaranteed compliant”
* “driver broke the law”
* “official infringement notice”

---

## Review Triggers

Review if:

* legal advice is obtained
* reports are used in formal enforcement workflows
* customer contracts require different wording
* driver-facing reports are introduced

---

# ADR-0014 — External Provider Secrets Are Server-Side Only

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `22_Security_Model_Specification.md`
* `23_Integration_Architecture.md`

---

## Context

HourWise may use external providers for:

* AI
* email
* billing
* telematics
* storage
* webhooks
* calendar
* payroll
* accounting

Provider secrets are sensitive and could allow unauthorised access or financial cost if exposed.

---

## Decision

External provider secrets must be stored and used server-side only.

They must not be exposed in frontend code, public environment variables, Markdown files, logs, or client-side bundles.

---

## Alternatives Considered

### Store provider keys in frontend environment variables

Rejected because frontend variables can be exposed to users.

### Store secrets in ordinary database JSON

Rejected because this increases exposure risk.

### Commit placeholder secrets to docs

Rejected because real secrets may accidentally be copied into source control.

---

## Consequences

Positive:

* protects provider accounts
* reduces data breach risk
* supports secret rotation
* keeps frontend safer

Negative:

* requires backend proxy endpoints
* local development setup needs care
* secret management process is required

---

## Implementation Notes

Secrets include:

* Supabase service-role key
* AI provider API key
* billing secret
* webhook signing secret
* email provider key
* OAuth refresh tokens
* integration credentials

---

## Review Triggers

Review if:

* secret manager is adopted
* enterprise deployment changes
* provider authentication changes
* key rotation procedures change

---

# ADR-0015 — Feature Flags Do Not Replace Permissions

**Status:** Accepted
**Date:** 2026-07-01
**Related documents:**

* `21_Data_Model_Specification.md`
* `22_Security_Model_Specification.md`

---

## Context

HourWise may use feature flags and billing plans to control access to product features such as Atlas, advanced reports, integrations, multi-depot support, or API access.

However, feature access is not the same as user permission.

---

## Decision

Feature flags and subscription plans control whether a fleet has access to a feature.

User permissions control which users within that fleet may use the feature.

Both checks are required.

---

## Alternatives Considered

### Use billing plan as permission model

Rejected because it cannot distinguish users inside the same fleet.

### Use permissions only and ignore billing features

Rejected because commercial feature access still needs to be controlled.

### Let frontend hide unavailable features only

Rejected because backend enforcement is required.

---

## Consequences

Positive:

* safer feature gating
* clearer commercial model
* prevents drivers using fleet-owner features
* supports tiered subscriptions

Negative:

* more checks are required
* UI must explain whether access is blocked by plan or role

---

## Implementation Notes

Example:

A fleet may have Atlas enabled, but:

* fleet owner can ask fleet-wide questions
* transport manager can ask operational questions
* driver can only ask about their own records
* viewer may have read-only or no Atlas access

---

## Review Triggers

Review if:

* custom roles are introduced
* enterprise permissions are added
* billing provider changes
* self-serve plan upgrades become complex

---

## 10. Future ADR Candidates

The following decisions should likely become ADRs later.

```text id="g0m74u"
ADR-0016 — Use Supabase/Postgres As Initial Backend
ADR-0017 — Use Vite React For Fleet Portal Frontend
ADR-0018 — Use Private Storage Buckets For Evidence Files
ADR-0019 — Use JSONB For Parser Output With Normalised Relational Records
ADR-0020 — Use Rule Versioning For Compliance Logic
ADR-0021 — Use Soft Deletion For Operational Records
ADR-0022 — Use Append-Only Audit Logs
ADR-0023 — Use Domain Services Rather Than Direct Cross-Module Mutation
ADR-0024 — Use Background Jobs For Import And Report Processing
ADR-0025 — Use Deterministic Logic Before LLM For Atlas Where Possible
ADR-0026 — Store Atlas Source Links For Responses
ADR-0027 — Separate Payroll Truth From Compliance Truth
ADR-0028 — Driver App Data Is Supplementary To Tachograph Evidence
ADR-0029 — Passenger Transport Support Reuses Core Compliance Architecture
ADR-0030 — External Partner APIs Are Versioned
```

---

## 11. ADR Maintenance Rules

### 11.1 Do Not Edit History Casually

Accepted ADRs should not be rewritten to hide previous reasoning.

Minor typo fixes are acceptable.

Major changes should create a new ADR that supersedes the old one.

### 11.2 Link Superseded Decisions

If ADR-0005 is superseded by ADR-0020, both files should say so.

### 11.3 Keep ADRs Short

An ADR should be focused on one decision.

If a decision becomes too broad, split it into multiple ADRs.

### 11.4 Update Related Specs

When an ADR changes a decision, update affected Source of Truth documents.

### 11.5 Use ADRs During Build Reviews

Before implementing major functionality, agents should check whether related ADRs exist.

---

## 12. Implementation Checklist

* [ ] Create ADR folder
* [ ] Add ADR README/index
* [ ] Split starter ADRs into individual files if desired
* [ ] Add ADR template file
* [ ] Add ADR links from relevant specifications
* [ ] Add ADR references to future Phase 2 review
* [ ] Create ADRs for security-sensitive decisions
* [ ] Create ADRs for evidence/reporting decisions
* [ ] Create ADRs for Atlas safety decisions
* [ ] Create ADRs for integration boundaries
* [ ] Add superseded status process
* [ ] Keep ADRs under version control

---

## 13. Acceptance Criteria

The ADR system is acceptable when:

* major architecture decisions have stable records
* future agents can understand why decisions were made
* evidence, reporting, Atlas, security, and integration decisions are documented
* superseded decisions remain visible
* ADRs link back to relevant specifications
* new major decisions are recorded before implementation drifts
* the documentation set becomes easier to maintain over time

---

## 14. Summary

Architecture Decision Records protect the HourWise Source of Truth from accidental drift.

They explain the decisions behind the architecture, not just the architecture itself.

The most important early decisions are:

* raw tachograph files are immutable
* parser runs are versioned
* compliance outcomes are calculated records
* evidence packs are first-class records
* reports snapshot evidence at export
* Atlas is evidence-led and not source of truth
* Atlas retrieval is server-side and permission-checked
* RLS protects tenant data
* integrations use provider adapters
* GPS is supplementary evidence
* service-role access requires permission checks
* reports use cautious compliance language
* secrets stay server-side
* feature flags do not replace permissions

The guiding rule is:

> If a decision protects evidence, security, trust, compliance interpretation, or future maintainability, record it as an ADR.
