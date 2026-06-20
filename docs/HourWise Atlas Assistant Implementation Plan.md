# HourWise Atlas Assistant

## Fleet Intelligence & AI Roadmap

---

# Vision

**HourWise Atlas Assistant** is not intended to be a chatbot.

Atlas is a digital transport manager, compliance assistant and accreditation advisor.

Its purpose is to:

* Monitor fleet health.
* Monitor driver risk.
* Monitor vehicle risk.
* Detect problems before they become infringements.
* Assist operators with O-Licence compliance.
* Support FORS, SQAS, Earned Recognition and EcoStars accreditation.
* Reduce management workload.
* Convert data into actions.

Internally and in marketing:

**Full name**

HourWise Atlas Assistant

**Short name**

Atlas

Examples:

* Ask Atlas
* Atlas says...
* Atlas Alert
* Atlas Briefing
* Atlas Risk Score
* Atlas Recommendation

---

# Design Principles

Atlas should:

* Be proactive, not reactive.
* Explain issues clearly.
* Never overwhelm users.
* Prefer silence over noise.
* Only surface meaningful items.
* Explain why something matters.
* Suggest corrective actions.
* Never fabricate information.

---

# Development Roadmap

Phase 1

Rule-Based Fleet Intelligence Engine

(No AI required)

↓

Phase 2

AI Explanation Layer

(GPT API)

↓

Phase 3

Natural Language Assistant

("Ask Atlas")

↓

Phase 4

Predictive Compliance Engine

↓

Phase 5

Accreditation Assistant

---

# PHASE 1

## Fleet Intelligence Engine

### Goal

Provide valuable intelligence using SQL and business rules only.

No LLM required.

All alerts must be deterministic and explainable.

---

# Architecture

Database

↓

Scheduled Jobs

↓

Risk Engine

↓

Alert Generation

↓

Atlas Dashboard

↓

Daily Briefing

---

# New Tables

## atlas_alerts

Stores active alerts.

Fields:

* id
* company_id
* severity
* category
* title
* description
* action_url
* resolved
* created_at

---

## atlas_daily_briefs

Stores daily summaries.

Fields:

* id
* company_id
* fleet_health_score
* summary
* generated_at

---

## atlas_risk_scores

Stores calculated scores.

Fields:

* driver_id
* vehicle_id
* score
* category
* generated_at

---

# Driver Monitoring

Atlas checks:

## Driving Hours

Weekly:

* 50h warning
* 54h warning
* 56h breach

Fortnight:

* 80h warning
* 85h warning
* 90h breach

---

## Working Time

Warnings:

* 55h week
* 60h week

Average WTD calculations.

---

## Rest Patterns

Detect:

* repeated reduced rests
* insufficient weekly rest
* excessive spreadovers

---

## Driver Records

Detect:

* missing clock-in
* missing clock-out
* missing tacho upload
* missing vehicle check
* missing payroll data

---

# Qualification Monitoring

Check:

## Driving Licence

Warnings:

90 days

30 days

7 days

Expired

---

## Driver CPC

Expiry warnings.

---

## Driver Card

Expiry warnings.

---

## Medical

Expiry warnings.

---

# Vehicle Monitoring

## PMI

30 days

14 days

7 days

Overdue

---

## MOT

30 days

14 days

7 days

Overdue

---

## Insurance

Due soon

Expired

---

## Tax

Due

Expired

---

## Defects

Open defects

Repeated defects

Critical defects

---

# Payroll Monitoring

Compare:

App hours

Tacho activity

Payroll hours

Mileage

Expenses

Detect:

* missing shifts
* duplicate claims
* excessive overtime
* anomalies

---

# Fleet Health Score

100 = perfect.

Reduce score for:

* infringements
* defects
* overdue documents
* incidents
* missing records

Display:

Fleet Health

Driver Health

Vehicle Health

---

# Daily Atlas Briefing

Example:

Atlas says:

Good morning.

Fleet Health Score: 92%

Attention required today:

• 2 drivers approaching weekly driving limits.

• Vehicle AB12 XYZ requires PMI in 10 days.

• Driver card expiry due this month.

• One unresolved defect report.

Recommended actions:

Review Driver Smith.

Schedule vehicle inspection.

Resolve defect report.

---

# Dashboard Widgets

## Compliance

Weekly driving warnings.

Fortnight warnings.

Rest issues.

---

## Driver

Licence expiry.

CPC expiry.

Driver card expiry.

Risk score.

---

## Vehicle

PMI due.

MOT due.

Defects.

---

## Payroll

Missing hours.

Payroll anomalies.

Expense discrepancies.

---

# PHASE 2

## AI Explanation Layer

Goal:

Transform intelligence into readable guidance.

GPT never accesses raw database tables.

Only validated risk objects.

---

# Workflow

Database

↓

Risk Engine

↓

Structured JSON

↓

GPT Prompt

↓

Natural Language Summary

---

# AI Daily Brief

Atlas says:

Three compliance items require attention today.

Driver John Smith is likely to exceed weekly driving hours by Thursday.

Vehicle AB12 XYZ requires PMI within 10 days.

Driver Jones has repeated reduced rests.

---

# Driver Risk Analysis

Output:

Risk score

Contributing factors

Recommended actions

Example:

Risk: High

Reasons:

* 3 reduced rests
* 2 infringements
* recent incident

Action:

Schedule compliance review.

---

# Vehicle Risk Analysis

Analyse:

* defects
* breakdowns
* overdue inspections

Suggest actions.

---

# Payroll Assistant

Explain:

Differences between:

* app hours
* tacho hours
* payroll hours

Example:

Possible missing clock-out record detected.

---

# Incident Assistant

When an incident occurs:

Atlas creates:

## Root Cause Analysis

## Investigation Checklist

## Suggested Questions

## Evidence Requirements

## Corrective Actions

## Lessons Learned

Store complete audit trail.

---

# O-Licence Assistant

Current:

Document storage.

Future:

Compliance Command Centre.

Monitor:

* insurance
* maintenance contracts
* licences
* policies
* training records
* defect records

Generate:

Operator Licence Readiness Score

---

# FORS Assistant

Track:

* driver training
* licence checks
* fuel records
* incidents
* inspections
* policies

Generate:

FORS Readiness Score

Show missing evidence.

Create audit packs.

---

# EcoStars Assistant

Track:

* fuel economy
* mpg
* idling
* emissions
* vehicle age

Generate:

EcoStars readiness score.

Recommend improvements.

---

# SQAS Assistant

Track:

* incidents
* corrective actions
* training
* inspections

Generate:

SQAS evidence packs.

---

# DVSA Earned Recognition Assistant

Track:

* driver hours
* defects
* maintenance
* compliance records

Generate:

Earned Recognition readiness score.

---

# PHASE 3

## Ask Atlas

Natural language search.

Examples:

"Which drivers need attention this week?"

"Which vehicles are highest risk?"

"Show unresolved defects."

"Which drivers repeatedly reduce daily rest?"

"Which vehicles are due PMI in the next 14 days?"

"Which drivers have outstanding incidents?"

---

# PHASE 4

## Predictive Intelligence

Forecast:

Weekly driving limits.

Rest requirements.

Maintenance failures.

Repeated defects.

Incident likelihood.

Driver fatigue patterns.

Payroll discrepancies.

---

# PHASE 5

## Accreditation & Audit Assistant

Ultimate Goal:

Atlas becomes a digital transport manager.

Outputs:

FORS readiness.

EcoStars readiness.

SQAS readiness.

Earned Recognition readiness.

Operator Licence readiness.

Generate:

Evidence packs.

Audit folders.

Corrective actions.

Missing documentation reports.

Management reports.

---

# Long-Term Vision

HourWise Driver App

*

Fleet Portal

*

Tacho Analysis

*

Payroll Validation

*

Maintenance Management

*

Incident Management

*

Compliance Management

*

Accreditation Management

*

HourWise Atlas Assistant

Atlas transforms HourWise from a reporting platform into a proactive fleet intelligence platform.
