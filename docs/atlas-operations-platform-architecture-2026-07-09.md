# Atlas Operations Platform Architecture

Date: 2026-07-09
Status: proposed architecture expansion

## Purpose

This document clarifies the product and architecture direction for Atlas.

Atlas is not just an AI chatbot. Atlas is the primary operational interface for HourWise: a safe layer that reads trusted fleet data, explains risk, triggers approved workflows, and eventually coordinates specialist operational assistants.

## Core Principle

Build the systems first, then let Atlas explain and coordinate them.

Atlas must sit above deterministic business rules, permission checks, audit logs, and structured APIs. The LLM must not be the source of compliance truth.

Preferred architecture:

```text
User or system event
  -> Atlas Operations API
  -> permissions and audit
  -> business rules and data services
  -> structured result
  -> Atlas explanation or approved action
```

Rejected architecture:

```text
User prompt
  -> LLM
  -> direct SQL/database access
```

## Three-Layer Atlas Model

### Layer 1: Atlas Operations API

The MVP layer is not AI. It is a structured API over HourWise operational data.

Examples:

- `getDriversNearWeeklyLimit()`
- `getVehiclesDueMaintenance()`
- `getOpenDefects()`
- `getUpcomingDocumentExpiries()`
- `getTodayRouteRisks()`
- `startIncidentWorkflow()`
- `searchApprovedKnowledgeBase()`

Each function must return structured JSON, enforce permissions, and be auditable.

### Layer 2: Operations Assistant

The assistant layer maps natural language or UI actions onto approved operations.

Example:

```text
Manager: Which vehicles need attention this week?
  -> intent: maintenance_due_summary
  -> tool: getVehiclesDueMaintenance()
  -> response: prioritised summary
```

This layer can remain mostly deterministic at first.

### Layer 3: AI Harness

The AI layer can later use tools for multi-step reasoning and cross-module summaries.

Example tools:

- driver risk summary
- route risk summary
- maintenance due-state query
- document search
- message template creation
- report draft generation
- knowledge-base retrieval

Frameworks such as Strands, LangGraph, LangChain, or provider-native agents may become useful here, but they should sit above the Atlas Operations API rather than replace it.

## Capability Roadmap

### Phase 1: MVP Operations API

- predefined SQL/API queries
- daily operational briefing
- rule-based recommendations
- workflow triggers
- audit logs
- permission checks

### Phase 2: Natural Language And Knowledge

- natural language intent recognition
- company knowledge base
- document search
- site procedure lookup
- voice input for constrained use cases

### Phase 3: LLM-Assisted Operations

- multi-step reasoning
- planning assistance
- cross-module explanations
- document extraction summaries
- route/compliance/maintenance risk narratives

### Phase 4: Multi-Agent Orchestration

Possible specialist agents:

- Compliance Agent
- Planning Agent
- Workshop Agent
- Document Agent
- Finance Agent
- HR/Training Agent
- Reporting Agent

This is where an orchestration framework may become useful.

## Company Knowledge Base

Atlas should eventually understand approved company knowledge:

- company handbook
- accident procedures
- HR policy
- FORS documents
- customer instructions
- site rules
- risk assessments
- ADR instructions
- loading/unloading procedures
- workshop procedures

Atlas must know document status, ownership, version, expiry, approval state, and visibility scope.

## Workflow Automation

Atlas should eventually help coordinate approved workflows:

```text
Vehicle defect reported
  -> workshop notified
  -> vehicle VOR
  -> planner notified
  -> driver reassigned
  -> customer informed by approved template
  -> repair evidence collected
  -> vehicle returned to available
```

Atlas may suggest and explain workflow steps. The backend workflow engine must execute them.

## Office Automation

Future Atlas workflows may include:

- incoming email triage
- booking extraction
- job draft creation
- driver/vehicle suggestion
- legal-hours check
- calendar update
- invoice draft
- manager approval workflow

These must be implemented as approved tools, not direct email/LLM automation.

## Digital Operations Centre

Atlas should provide a daily operational briefing:

- jobs completed yesterday
- open defects
- repaired defects
- overdue checks
- fuel anomalies
- expiring driver documents
- upcoming maintenance
- invoices awaiting approval
- route/compliance risks
- missing evidence

The dashboard should prioritise actions over raw data.

## Business Intelligence

Atlas should eventually explain why operational or financial performance changed.

Example:

```text
Profit fell this month because fuel increased, empty mileage rose, overtime increased, two vehicles were VOR, and agency spend increased.
```

This requires trusted data pipelines before LLM narrative.

## Guardrails

- Atlas cannot bypass RLS or permission helpers.
- Atlas cannot query arbitrary SQL directly.
- Atlas must log requests, tool calls, decisions, and generated outputs.
- Compliance calculations must come from deterministic rules.
- Customer-facing actions require approved templates and confirmation.
- High-risk actions require explicit user approval.

## Implementation Order

Recommended order:

1. Finish rota/job/event systems.
2. Finish deterministic maintenance/compliance rules.
3. Finish messaging/event sync.
4. Build Atlas Operations API.
5. Add Atlas summaries over existing results.
6. Add controlled recommendations.
7. Add natural language and voice.
8. Consider multi-agent orchestration later.

## Related Documents

- `docs/adr/ADR-0021 - Unified Event Synchronisation, Messaging and Atlas Integration`
- `docs/adr/ADR-0025_Tenant_Aware_Atlas_AI.md`
- `docs/adr/ADR-0029_Atlas_Driver_Assistant_And_Voice_Operations.md`
- `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`
