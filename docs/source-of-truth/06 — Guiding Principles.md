# 06 — Guiding Principles

| Field | Value |
|---------|---------|
| **Document Purpose** | Define the design, engineering and business principles that guide every decision within the HourWise platform. |
| **Audience** | Founders, developers, designers, AI coding agents, testers and future contributors. |
| **Dependencies** | 02_Product_Philosophy.md, 05_Product_Ecosystem.md |
| **Status** | Living Document |
| **Owner** | Product Architecture |
| **Priority** | Critical |

---

# Introduction

These principles exist to ensure that HourWise evolves consistently over many years.

Technology will change.

Features will evolve.

Customer requirements will grow.

These principles should remain relatively stable.

Whenever uncertainty exists, decisions should favour these principles over short-term convenience.

---

# Principle 1

## Build Trust Before Features

Trust is the foundation of the platform.

Users must believe that:

- calculations are accurate
- reports are reliable
- alerts are meaningful
- data is secure

Adding new features should never reduce confidence in existing functionality.

---

# Principle 2

## Solve Problems, Not Requests

Customers often describe solutions rather than problems.

Our responsibility is to understand the underlying problem before designing the feature.

Example:

Customer request:

"I need another report."

Possible real problem:

"They cannot find important information quickly enough."

The correct solution may not be another report.

---

# Principle 3

## Compliance is a Daily Experience

Compliance should not exist only during audits.

HourWise should help users remain compliant throughout every working day.

Good compliance is continuous.

Not retrospective.

---

# Principle 4

## Reduce Cognitive Load

Transport managers already process enormous amounts of information.

Drivers already make hundreds of decisions every day.

HourWise should reduce mental effort.

Not increase it.

Interfaces should feel calm.

---

# Principle 5

## Show the Next Action

Every warning should answer:

What happened?

Why does it matter?

What should I do next?

Software should never stop at identifying a problem.

---

# Principle 6

## Capture Data Once

The same information should never need to be entered repeatedly.

Whenever possible:

Collect once.

Reuse everywhere.

Synchronise automatically.

---

# Principle 7

## Everything Should Connect

Every module should contribute to the wider ecosystem.

Examples:

Vehicle checks influence compliance.

Incidents influence Atlas.

Driver documents influence alerts.

Expenses influence reporting.

Nothing should become an isolated feature.

---

# Principle 8

## Manual Work is a Last Resort

If software can safely automate repetitive administration, it should.

Manual processes remain available only when:

required legally

required operationally

or automation would reduce reliability.

---

# Principle 9

## Explain Before Warning

Compliance software often tells users something is wrong.

HourWise should explain:

What occurred.

Why it occurred.

How to correct it.

How to avoid it.

Education builds confidence.

---

# Principle 10

## Design for Busy People

Most HourWise users are busy.

Drivers are working.

Managers are multitasking.

Business owners have limited time.

Every workflow should respect that reality.

---

# Principle 11

## Progressive Complexity

Simple users should see simple software.

Advanced users should discover additional capability naturally.

Avoid overwhelming first-time users with enterprise functionality.

---

# Principle 12

## Make Good Decisions Easy

Software should naturally guide users towards good operational practice.

Examples:

Reminders.

Templates.

Suggested actions.

Defaults.

Helpful explanations.

Good software encourages good behaviour.

---

# Principle 13

## Every Screen Has One Primary Purpose

Avoid screens attempting to solve multiple unrelated problems.

Every page should answer:

"What is this screen for?"

If the answer is unclear, redesign it.

---

# Principle 14

## Consistency Builds Confidence

Buttons.

Terminology.

Colours.

Navigation.

Icons.

Layouts.

Behaviour.

Everything should remain consistent throughout the platform.

Consistency reduces training requirements.

---

# Principle 15

## Accessibility is a Feature

Accessibility is not optional.

HourWise should remain usable for people with varying:

experience

technical confidence

vision

motor ability

language

environment

Accessibility benefits everyone.

---

# Principle 16

## Mobile is the First Experience

Most operational data begins in the Driver App.

The mobile experience deserves the same design quality as desktop.

Never compromise the mobile experience to improve desktop convenience.

---

# Principle 17

## Security is Invisible

Users should rarely notice security.

It should quietly protect them.

Authentication.

Encryption.

Permissions.

Backups.

Auditing.

All should work without unnecessary friction.

---

# Principle 18

## Every Feature Should Strengthen the Platform

Before approving any feature ask:

Does this strengthen the ecosystem?

Does it increase long-term value?

Or does it simply increase complexity?

---

# Principle 19

## Build for Longevity

Prefer:

Readable code.

Documented decisions.

Maintainable architecture.

Reusable components.

Reliable technology.

Avoid solutions that create unnecessary future maintenance.

---

# Principle 20

## Leave the Platform Better Than You Found It

Whenever work is undertaken:

Improve documentation.

Improve code quality.

Reduce technical debt.

Improve consistency.

Fix nearby issues where practical.

Every contribution should improve the platform.

---

# Decision Framework

When making product decisions, evaluate options in this order:

1. Safety
2. Compliance
3. Security
4. Reliability
5. User Experience
6. Simplicity
7. Performance
8. Scalability
9. Commercial Value
10. Nice-to-Have Features

If two options are otherwise equal, choose the one that is easier to maintain.

---

# Guiding Question

Before implementing anything, ask:

> "Will this make life easier for the people using HourWise tomorrow?"

If the answer is uncertain, revisit the problem before writing code.

---

# Success Statement

The principles in this document should be visible throughout the platform.

Users may never read them.

But they should experience them every day.

---

# Related Documents

02_Product_Philosophy.md

03_Problems_We_Solve.md

04_User_Personas.md

05_Product_Ecosystem.md

10_MVP.md

22_Coding_Standards.md