# 05 — Product Ecosystem

| Field | Value |
|---------|---------|
| **Document Purpose** | Define the complete HourWise ecosystem and explain how each product and service fits together. |
| **Audience** | Founders, developers, designers, AI coding agents, testers and business stakeholders. |
| **Dependencies** | 01_Executive_Summary.md, 02_Product_Philosophy.md, 04_User_Personas.md |
| **Status** | Living Document |
| **Owner** | Product Architecture |
| **Priority** | Critical |

---

# Introduction

HourWise is not a single application.

It is an ecosystem of connected products designed to reduce paperwork, improve compliance and simplify transport management.

Every product should strengthen every other product.

The value of HourWise increases as organisations adopt more of the ecosystem.

---

# Platform Overview

```
                    HourWise Platform

                           │

 ┌──────────────────────────────────────────────────┐
 │                                                  │
 │              Shared Cloud Platform               │
 │                                                  │
 └──────────────────────────────────────────────────┘

        │          │          │          │

        ▼          ▼          ▼          ▼

 Driver App   Fleet Portal   Atlas   Resource Centre

        │          │          │

        └──────────┼──────────┘

                   ▼

            Reporting Engine

                   │

                   ▼

           Compliance Database

                   │

                   ▼

         Integrations & APIs
```

---

# Core Products

The HourWise ecosystem currently consists of six primary products.

Each product has a clearly defined responsibility.

---

# 1. HourWise Driver App

## Purpose

Provide drivers with a practical daily companion that simplifies compliance and administration.

---

## Responsibilities

Working time

Driving time

Break management

POA

Expenses

Vehicle checks

Incident reporting

Messaging

Reports

Calendar

Notifications

---

## Users

Owner Drivers

Fleet Drivers

---

## Success

Drivers complete their working day with minimal paperwork and a clear understanding of their compliance position.

---

# 2. HourWise Fleet Portal

## Purpose

Provide transport managers with a complete operational overview.

---

## Responsibilities

Driver management

Vehicle management

Tachograph analysis

Incident management

Maintenance

Messaging

Reporting

Documents

Compliance

---

## Users

Transport Managers

Compliance Managers

Fleet Operators

Business Owners

---

## Success

Managers identify priorities within minutes rather than hours.

---

# 3. Atlas

## Purpose

Convert operational data into meaningful intelligence.

---

## Atlas is NOT

A chatbot.

A search engine.

A replacement transport manager.

---

## Atlas IS

A proactive compliance assistant.

A digital transport manager.

A fleet intelligence engine.

---

## Responsibilities

Daily briefings

Risk scoring

Recommendations

Compliance monitoring

Predictive analysis

Audit preparation

---

# 4. Public Website

## Purpose

Introduce HourWise to potential customers.

Educate.

Convert visitors.

Support existing users.

---

## Responsibilities

Marketing

Product information

Knowledge Centre

Downloads

Documentation

Early access

Support

SEO

---

# 5. Resource Centre

## Purpose

Provide practical transport resources regardless of whether visitors purchase the software.

---

## Free Resources

Vehicle checks

Accident forms

Driver statements

Incident forms

Rotas

Maintenance forms

Toolbox talks

Compliance checklists

---

## Premium Resources

Policies

Compliance manuals

Training guides

Audit packs

Fleet templates

Business documentation

---

## Long-Term Goal

Become the industry's most useful compliance knowledge library.

---

# 6. APIs & Integrations

## Purpose

Connect HourWise with the wider transport ecosystem.

---

## Future Integrations

GPS tracking

Payroll

Accounting

Fuel cards

DVLA

OCR

Email

SMS

Calendars

Third-party fleet software

---

# Shared Services

All products should rely on common platform services.

---

## Authentication

Single identity across every HourWise product.

---

## Database

One authoritative source of operational data.

---

## Reporting Engine

Generates:

PDF reports

Management reports

Driver summaries

Audit evidence

Compliance exports

---

## Notification Service

Push notifications

Email

SMS (future)

Portal alerts

Atlas briefings

---

## File Storage

Documents

Receipts

Driver cards

Vehicle unit files

Policies

Certificates

Images

Reports

---

# Data Flow

The Driver App captures operational information.

↓

The Fleet Portal organises and manages it.

↓

Atlas analyses it.

↓

The Reporting Engine produces evidence.

↓

The Resource Centre teaches users how to improve.

↓

The Website attracts new customers.

Everything contributes back into the platform.

---

# Ecosystem Design Principles

Every product must:

Have a clearly defined responsibility.

Share data rather than duplicate it.

Reuse components wherever practical.

Feel visually consistent.

Share authentication.

Share branding.

Share design language.

---

# Product Boundaries

To avoid unnecessary complexity:

The Driver App should never become a full management portal.

The Fleet Portal should never become a replacement mobile app.

Atlas should never replace human decision making.

The Website should never duplicate portal functionality.

The Resource Centre should educate rather than become another application.

Each product has a clear role.

---

# Ecosystem Growth Strategy

HourWise should expand horizontally rather than vertically.

Instead of making one enormous application, build focused products that work together.

Examples:

Driver App

↓

Fleet Portal

↓

Atlas

↓

API Platform

↓

Marketplace

↓

Enterprise Services

↓

White Label Platform

Each layer builds upon the previous one.

---

# Future Ecosystem

Potential future products include:

Fleet Scheduling

Driver Recruitment

Training Platform

Compliance Academy

Marketplace

Fleet Benchmarking

Insurance Integrations

Telematics Hub

Partner Portal

Developer API

These should only be developed once the core ecosystem is mature.

---

# Success Measures

The ecosystem succeeds when:

Drivers enjoy using the Driver App.

Managers rely on the Fleet Portal daily.

Atlas becomes the first screen managers check each morning.

The Resource Centre becomes an industry reference.

The Website consistently generates new customers.

Every product strengthens the value of every other product.

---

# Related Documents

06_Guiding_Principles.md

10_MVP.md

11_Driver_App.md

12_Fleet_Portal.md

14_Atlas.md

15_Website.md

16_Resource_Centre.md

19_APIs_and_Integrations.md