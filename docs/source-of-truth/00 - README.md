# HourWise Platform Specification

> **Authoritative Documentation for the HourWise Platform**

---

## Purpose

This directory contains the complete product specification for HourWise.

It is the single authoritative source describing:

- Product vision
- Business goals
- Technical architecture
- User experience
- Feature specifications
- Security requirements
- Development roadmap
- Branding
- Coding standards
- Release criteria

This documentation is intended for:

- Human developers
- AI coding agents
- Designers
- Testers
- Future contributors
- Business stakeholders

---

## Philosophy

HourWise is no longer developed feature-by-feature.

Every feature must first exist in this documentation.

If it is not documented here, it should not be implemented.

This prevents:

- feature creep
- conflicting implementations
- duplicated work
- undocumented behaviour
- architectural drift

---

## Source of Truth

This folder replaces previous planning documents.

Older markdown files should be considered historical references only.

Useful information from them should be migrated into this specification before they are archived.

---

## Update Rules

Whenever a significant change is made to HourWise:

1. Update the relevant specification.
2. Update any affected dependencies.
3. Record major decisions in Architecture Decisions.
4. Update the Changelog.
5. Only then implement the change.

---

## Definition of Done

A feature is not complete until:

- specification updated
- implementation complete
- tested
- documented
- security reviewed
- changelog updated

---

## Documentation Principles

Documentation should explain:

- Why something exists.
- What problem it solves.
- How it works.
- How it should evolve.

Documentation should never simply describe code.

---

## Status Markers

Throughout the documentation the following markers are used:

| Status | Meaning |
|----------|----------|
| ✅ | Complete |
| 🚧 | In Progress |
| 📋 | Planned |
| 🔬 | Research |
| 🚀 | Future Expansion |
| ⚠ | Requires Decision |
| ❌ | Rejected |

---

## Long-Term Goal

The aim is for this documentation to become comprehensive enough that a new engineer could join the project, read these files, and understand both **what** HourWise is and **why** it has been designed this way without needing additional explanation.

The software should evolve from this documentation—not the other way around.