# 04 — User Personas

| Field | Value |
|---------|---------|
| **Document Purpose** | Define the primary users of HourWise and understand their goals, frustrations and daily workflows. |
| **Audience** | Founders, developers, designers, AI coding agents, testers and business stakeholders. |
| **Dependencies** | 01_Executive_Summary.md, 02_Product_Philosophy.md, 03_Problems_We_Solve.md |
| **Status** | Living Document |
| **Owner** | Product Architecture |
| **Priority** | Critical |

---

# Introduction

HourWise is not built for "users."

It is built for people.

Every design decision should begin by asking:

> Who is using this?

Different people have different goals.

Different levels of technical knowledge.

Different frustrations.

Different measures of success.

Understanding those differences leads to better software.

---

# Persona 1 — James

## Independent Owner Driver

---

### Profile

Age: 42

Business:

Owner Driver

Fleet Size:

1 Vehicle

Technical Confidence:

Moderate

Uses Phone:

Constantly

Uses Computer:

Occasionally

---

## Goals

Stay compliant.

Finish paperwork quickly.

Track income and expenses.

Generate invoices.

Reduce administration.

Spend more time driving than doing paperwork.

---

## Frustrations

Too many separate apps.

Paper receipts.

Working out remaining driving time.

Preparing invoices.

Keeping records organised.

---

## Measures of Success

"I can finish today's paperwork in under ten minutes."

---

## Primary Features

Driver App

Expenses

Reports

Invoices

Calendar

Compliance alerts

---

# Persona 2 — Sarah

## Transport Manager

---

### Profile

Age: 38

Fleet:

65 Vehicles

Technical Confidence:

High

Time Available:

Very Limited

---

## Goals

Know what requires attention.

Keep drivers compliant.

Reduce infringements.

Prepare audits.

Communicate with drivers.

---

## Frustrations

Information scattered across systems.

Missing paperwork.

Chasing drivers.

Preparing inspections.

Spreadsheet overload.

---

## Success Looks Like

"I know today's priorities within two minutes of opening the dashboard."

---

## Primary Features

Fleet Portal

Driver Management

Tachograph

Daily Checks

Atlas

Reports

Messaging

---

# Persona 3 — Mike

## Fleet Director

---

### Profile

Age:

55

Fleet:

220 Vehicles

Focus:

Business performance.

---

## Goals

Reduce costs.

Improve compliance.

See trends.

Support managers.

Scale operations.

---

## Doesn't Care About

Entering data.

Individual timer calculations.

Minor UI details.

---

## Wants

Dashboards.

KPIs.

Monthly reports.

Risk summaries.

Atlas insights.

---

# Persona 4 — Emma

## Compliance Manager

---

### Profile

Age:

46

Primary Focus:

Documentation.

Audits.

Evidence.

Policies.

---

## Goals

Never be surprised by an audit.

Know document expiry dates.

Keep evidence organised.

Generate reports quickly.

---

## Biggest Fear

Finding missing paperwork during an inspection.

---

## Favourite Features

Document Centre.

Compliance reminders.

Atlas.

Evidence packs.

Expiry monitoring.

---

# Persona 5 — Alex

## Fleet Driver

---

Works for an operator using HourWise.

---

## Goals

Complete daily tasks quickly.

Stay compliant.

Receive clear instructions.

Avoid unnecessary paperwork.

---

## Uses

Driver App

Messaging

Vehicle Checks

Expenses

Incidents

Shift Timer

---

## Wants

Simple.

Fast.

Reliable.

---

# Persona 6 — Olivia

## Business Owner

---

Owns a transport company.

May not be involved in day-to-day compliance.

---

## Wants

Business visibility.

Profitability.

Compliance confidence.

Growth.

---

## Measures Success By

Reduced admin.

Fewer software subscriptions.

Better reporting.

Better staff productivity.

---

# Shared Expectations

Every persona expects HourWise to be:

Reliable.

Fast.

Easy to understand.

Secure.

Professional.

Available on mobile.

---

# What They Never Want

Complex setup.

Hidden costs.

Confusing terminology.

Unnecessary clicks.

Slow loading.

Duplicated work.

Repeated data entry.

---

# Designing for Personas

Every feature specification should identify:

Primary Persona

Secondary Persona

Frequency of Use

Business Value

Complexity

Training Required

---

# Example

## Driver Expenses

Primary Persona

James

Secondary Persona

Alex

Business Value

High

Frequency

Daily

Training Required

Minimal

---

## Atlas Morning Briefing

Primary Persona

Sarah

Secondary Persona

Mike

Business Value

Very High

Frequency

Daily

Training Required

Low

---

# Design Rule

When a feature benefits multiple personas, optimise first for the person who uses it most frequently.

Avoid making everyday workflows more complicated simply to satisfy occasional users.

---

# Long-Term Principle

HourWise should grow with its users.

The experience for James with one truck should feel as carefully designed as the experience for Mike managing hundreds of vehicles.

No customer should feel that the platform was built for someone else.

---

# Related Documents

05_Product_Ecosystem.md

10_MVP.md

11_Driver_App.md

12_Fleet_Portal.md