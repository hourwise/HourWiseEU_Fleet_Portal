# HourWise Source Of Truth Index

Date created: 2026-07-02
Status: Living Document
Owner: Product Architecture

## Purpose

This index provides stable document IDs for the HourWise Source of Truth.

Stable IDs should be used in changelog entries, implementation backlog items, ADR links, review notes, and AI coding-agent instructions. Current filenames remain unchanged unless a separate controlled rename pass is approved.

## Usage Rules

- Use the stable document ID when referring to a source-of-truth document in work items.
- Use the current filename link when opening the document.
- Do not infer document identity from filename alone.
- If a file is renamed later, keep the stable ID unchanged and update this index.
- If a document is superseded, mark it here and link to the replacement.

## Document Categories

| Category | Range | Purpose |
| --- | --- | --- |
| Foundation | `SOT-00`, `SOT-98`, `SOT-99` | README, changelog, glossary |
| Strategy | `SOT-01` to `SOT-09` | Vision, principles, personas, market position |
| Planning | `SOT-10` to `SOT-14` | MVP, capability model, journeys, service blueprints |
| Product and Architecture | `SOT-15` to `SOT-17` | Platform architecture, Driver App, Fleet Portal |
| Compliance Intelligence | `SOT-18` to `SOT-18-11` | Compliance subsystem and engine specifications |
| Detailed Platform Specs | `SOT-19` to `SOT-24` | Atlas, reporting, data model, security, integrations, ADRs |

## Canonical Document Index

| Stable ID | Display Title | Current Filename | Category | Owner | Status | Primary Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `SOT-00` | README | [00 - README.md](./00%20-%20README.md) | Foundation | Product Architecture | Living Document | Defines source-of-truth rules and documentation expectations. |
| `SOT-01` | Executive Summary | [01 - Executive Summary.md](./01%20%E2%80%94%20Executive%20Summary.md) | Strategy | Product Architecture | Living Document | Defines platform vision and high-level business direction. |
| `SOT-02` | Product Philosophy | [02 - Product Philosophy.md](./02%20%E2%80%94%20Product%20Philosophy.md) | Strategy | Product Architecture | Living Document | Defines principles for product and engineering decisions. |
| `SOT-03` | Problems We Solve | [03 - Problems We Solve.md](./03%20%E2%80%94%20Problems%20We%20Solve.md) | Strategy | Product Architecture | Living Document | Defines the user and industry problems HourWise addresses. |
| `SOT-04` | User Personas | [04 - User Personas.md](./04%20%E2%80%94%20User%20Personas.md) | Strategy | Product Architecture | Living Document | Defines primary users, goals, frustrations, and success measures. |
| `SOT-05` | Product Ecosystem | [05 - Product Ecosystem.md](./05%20%E2%80%94%20Product%20Ecosystem.md) | Strategy | Product Architecture | Living Document | Defines how products and shared services fit together. |
| `SOT-06` | Guiding Principles | [06 - Guiding Principles.md](./06%20%E2%80%94%20Guiding%20Principles.md) | Strategy | Product Architecture | Living Document | Defines decision principles for design, engineering, and business work. |
| `SOT-07` | Competitive Position | [07 - Competitive Position.md](./07%20%E2%80%94%20Competitive%20Position.md) | Strategy | Product Architecture | Living Document | Defines market positioning and differentiation. |
| `SOT-08` | Non Goals | [08 - Non Goals.md](./08%20%E2%80%94%20Non%20Goals.md) | Strategy | Product Architecture | Living Document | Defines boundaries to prevent product drift. |
| `SOT-09` | Product Pillars | [09 - Product Pillars.md](./09%20%E2%80%94%20Product%20Pillars.md) | Strategy | Product Architecture | Living Document | Defines the core pillars supporting platform decisions. |
| `SOT-10` | Minimum Viable Product | [10 - Minimum Viable Product (MVP).md](./10%20%E2%80%94%20Minimum%20Viable%20Product%20%28MVP%29.md) | Planning | Product Architecture | Living Document | Defines the minimum commercially viable release scope. |
| `SOT-11` | Platform Capability Model | [11 - Platform Capability Model.md](./11%20%E2%80%94%20Platform%20Capability%20Model.md) | Planning | Product Architecture | Living Document | Defines capability IDs, priorities, status markers, and product mapping. |
| `SOT-12` | Capability Register Detail | [12 - Capability Register Detail.md](./12%20%E2%80%94%20Capability%20Register%20Detail.md) | Planning | Product Architecture | Living Document | Defines the template and governance model for capability specs. |
| `SOT-13` | User Journey Map | [13 - User Journey Map.md](./13%20%E2%80%94%20User%20Journey%20Map.md) | Planning | Product Architecture | Living Document | Defines end-to-end user journeys across the platform. |
| `SOT-14` | Service Blueprints | [14 - Service Blueprints.md](./14%20%E2%80%94%20Service%20Blueprints.md) | Planning | Platform Architecture | Living Document | Defines system behaviour behind major user journeys. |
| `SOT-15` | Platform Architecture | [15 - Platform Architecture.md](./15%20%E2%80%94%20Platform%20Architecture.md) | Product and Architecture | Platform Architecture | Living Document | Defines technical architecture, services, data flow, and governance. |
| `SOT-16` | Driver App Specification | [16 - Driver App Specification.md](./16%20%E2%80%94%20Driver%20App%20Specification.md) | Product and Architecture | Product Architecture | Living Document | Defines Driver App scope, workflows, UX principles, and MVP boundaries. |
| `SOT-17` | Fleet Portal Specification | [17 - Fleet Portal Specification.md](./17%20%E2%80%94%20Fleet%20Portal%20Specification.md) | Product and Architecture | Product Architecture | Living Document | Defines Fleet Portal modules, workflows, permissions, and MVP boundaries. |
| `SOT-18` | Compliance Intelligence Platform | [18 - Compliance Intelligence Platform.md](./18%20%E2%80%94%20Compliance%20Intelligence%20Platform.md) | Compliance Intelligence | Platform Architecture | Active Development | Defines the compliance subsystem purpose, objectives, principles, and modules. |
| `SOT-18-01` | Compliance Intelligence Platform Vision | [18.1 - Compliance Intelligence Platform Vision.md](./18.1%20%E2%80%94%20Compliance%20Intelligence%20Plat.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines long-term vision, responsibilities, boundaries, and success principles. |
| `SOT-18-02` | Compliance Intelligence System Architecture | [18.2 - Compliance Intelligence System Architecture.md](./18.2%20%E2%80%94%20Compliance%20Intelligence%20Plat.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines subsystem architecture and engine pipeline. |
| `SOT-18-03` | Evidence Import Pipeline | [18.3 - Evidence Import Pipeline.md](./18.3%20%E2%80%94%20Evidence%20Import%20Pipeline.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines evidence upload, validation, storage, and import flow. |
| `SOT-18-04` | Driver Card Engine | [18.4 - Driver Card Engine.md](./18.4%20%E2%80%94%20Driver%20Card%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines driver card parsing, validation, and normalisation responsibilities. |
| `SOT-18-05` | Vehicle Unit Engine | [18.5 - Vehicle Unit Engine.md](./18.5%20%E2%80%94%20Vehicle%20Unit%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines VU parsing, validation, and vehicle activity normalisation. |
| `SOT-18-06` | Timeline Engine | [18.6 - Timeline Engine.md](./18.6%20%E2%80%94%20Timeline%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines timeline event generation and source correlation. |
| `SOT-18-07` | Compliance Engine | [18.7 - Compliance Engine.md](./18.7%20%E2%80%94%20Compliance%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines deterministic compliance checks, outcomes, rule versions, and review states. |
| `SOT-18-08` | Evidence Engine | [18.8 - Evidence Engine.md](./18.8%20%E2%80%94%20Evidence%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines evidence packs, completeness checks, and source traceability. |
| `SOT-18-09` | Evidence and Reporting Engine | [18.9 - Evidence & Reporting Engine.md](./18.9%20%E2%80%94%20Evidence%20%26%20Reporting%20Engine.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines evidence/reporting bridge and readiness support. |
| `SOT-18-10` | Atlas Interface | [18.10 - Atlas Interface.md](./18.10%20%E2%80%94%20Atlas%20Interface.md) | Compliance Intelligence | Platform Architecture | Living Document | Defines Atlas interface locations, response patterns, safety rules, and MVP restrictions. |
| `SOT-18-11` | Future Roadmap | [18.11 - Future Roadmap.md](./18.11%20%E2%80%94%20Future%20Roadmap.md) | Compliance Intelligence | Platform Architecture | Draft | Defines staged roadmap and future maturity model. |
| `SOT-19` | Atlas Specification | [19 - Atlas Specification.md](./19%20%E2%80%94%20Atlas%20Specification.md) | Detailed Platform Specs | Product Architecture | Draft | Defines Atlas product behaviour, backend model, safety, tests, and implementation checklist. |
| `SOT-20` | Reporting Platform Specification | [20 - Reporting Platform Specification.md](./20%20%E2%80%94%20Reporting%20Platform%20Specificati.md) | Detailed Platform Specs | Platform Architecture | Living Document | Defines report drafts, readiness checks, templates, exports, and report security. |
| `SOT-21` | Data Model Specification | [21 - Data Model Specification.md](./21%20%E2%80%94%20Data%20Model%20Specification.md) | Detailed Platform Specs | Platform Architecture | Living Document | Defines database entities, tenancy model, storage model, indexing, lifecycle, and MVP tables. |
| `SOT-22` | Security Model Specification | [22 - Security Model Specification.md](./22%20%E2%80%94%20Security%20Model%20Specification.md) | Detailed Platform Specs | Security | Living Document | Defines authentication, authorisation, RLS, file security, Atlas safety, and security tests. |
| `SOT-23` | Integration Architecture | [23 - Integration Architecture.md](./23%20%E2%80%94%20Integration%20Architecture.md) | Detailed Platform Specs | Platform Architecture | Living Document | Defines integration boundaries, adapters, internal/external integrations, webhooks, and provider safety. |
| `SOT-24` | Architecture Decision Records | [24 - Architecture Decision Records.md](./24%20%E2%80%94%20Architecture%20Decision%20Records.md) | Detailed Platform Specs | Platform Architecture | Draft | Defines ADR process and starter ADRs. |
| `SOT-98` | Changelog | [98 - Changelog.md](./98%20-%20Changelog.md) | Foundation | Product Architecture | Living Document | Records significant source-of-truth changes and implementation impact. |
| `SOT-99` | Glossary | [99 - Glossary.md](./99%20%E2%80%94%20Glossary.md) | Foundation | Product Architecture | Living Document | Defines authoritative terminology for source-of-truth documents. |

## Current Filename Risks

The following stable IDs intentionally shield implementation work from filename issues:

| Stable ID | Current Risk | Handling |
| --- | --- | --- |
| `SOT-10` | Filename contains parentheses. | Use stable ID in references; encode parentheses as `%28` and `%29` in links. |
| `SOT-18-01` | Filename is truncated as `Compliance Intelligence Plat`. | Use stable ID and display title from this index. |
| `SOT-18-02` | Filename is truncated as `Compliance Intelligence Plat`. | Use stable ID and display title from this index. |
| `SOT-20` | Filename is truncated as `Reporting Platform Specificati`. | Use stable ID and display title from this index. |
| Multiple | Filenames contain non-ASCII dash characters. | Use stable IDs in changelog, ADRs, backlog items, and automation. |

## Maintenance Rules

When adding or changing a source-of-truth document:

1. Add or update the stable ID in this index.
2. Update [98 - Changelog.md](./98%20-%20Changelog.md).
3. Update affected related-document links.
4. If the change affects architecture, create or update the relevant ADR.
5. If a filename changes, update links here first, then update inbound links across the source set.
