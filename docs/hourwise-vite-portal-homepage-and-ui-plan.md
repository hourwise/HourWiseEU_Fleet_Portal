# HourWise EU Vite Portal UI Refresh and Homepage Plan

## Purpose

Refresh the HourWise EU Fleet Portal and public homepage at `www.hourwiseeu.co.uk` so the product feels professional, trustworthy, and ready for fleet customers.

The public homepage should clearly explain:

- What HourWise EU is
- What the driver app does
- What the fleet portal does
- How the app and portal work together
- Why operators and drivers should care
- Which features are available for solo drivers, fleet drivers, and transport managers
- What is coming soon

---

## Current Homepage Issue

The current homepage appears unfinished and does not yet communicate the full value of the HourWise app and portal ecosystem.

The updated page should feel like a polished SaaS landing page for a UK/EU transport compliance product.

---

## Brand Direction

### Brand Feel

HourWise should feel:

- Professional
- Calm
- Reliable
- Compliance-focused
- Modern
- Transport-specific
- Built for real drivers and real operators

### Visual Style

Recommended style:

**Dark fleet command centre + digital route grid + tachograph rings**

Use:

- Deep navy backgrounds
- Blue/teal highlights
- Subtle route-grid pattern
- Tachograph circular timer rings
- Driver app mockups
- Portal dashboard mockups
- Clean cards and feature blocks

Avoid:

- Generic lorry stock photos
- Cheap clipart
- Overcrowded dashboards
- Excessive gradients
- Red warning-heavy design unless showing compliance risk

---

## Colour System

```css
:root {
  --hw-navy-950: #07111F;
  --hw-navy-900: #0B1628;
  --hw-navy-800: #10233A;
  --hw-blue-700: #1D4ED8;
  --hw-blue-600: #2563EB;
  --hw-cyan-500: #06B6D4;
  --hw-teal-500: #14B8A6;
  --hw-green-500: #22C55E;
  --hw-amber-500: #F59E0B;
  --hw-red-500: #EF4444;
  --hw-slate-50: #F8FAFC;
  --hw-slate-100: #F1F5F9;
  --hw-slate-300: #CBD5E1;
  --hw-slate-500: #64748B;
  --hw-white: #FFFFFF;
}
```

### Homepage Background

Hero background:

```css
background:
  radial-gradient(circle at 20% 10%, rgba(37,99,235,0.25), transparent 35%),
  radial-gradient(circle at 80% 20%, rgba(20,184,166,0.18), transparent 30%),
  linear-gradient(180deg, #07111F 0%, #0B1628 55%, #10233A 100%);
```

Overlay pattern:

- Faint route grid
- Circular tachograph rings
- GPS dots
- Map curves
- 3–7% opacity

---

## Typography

Recommended web fonts:

- Headings: `Inter`, `Manrope`, or `Sora`
- Body: `Inter` or system sans-serif
- Data/timer values: `Roboto Mono` or tabular numerals using `font-variant-numeric: tabular-nums`

Suggested setup:

```css
body {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.timer-value,
.metric-value {
  font-variant-numeric: tabular-nums;
}
```

---

## Logo and Icon Direction

### Main Logo

Recommended logo mark:

**Circular tachograph/timer ring + curved route line + compliance tick**

Use lockups:

1. Full horizontal logo: icon + `HourWise EU`
2. Compact icon only
3. Light logo for dark backgrounds
4. Dark logo for white backgrounds

### Portal Icons

Use Lucide for the portal.

Suggested mappings:

| Feature | Lucide Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Drivers | `Users` |
| Vehicles | `Truck` |
| Tachograph | `Gauge` / `Disc3` |
| Compliance | `ShieldCheck` |
| Reports | `FileText` |
| Calendar | `CalendarDays` |
| Messages | `MessageSquare` |
| Expenses | `Receipt` |
| Incidents | `TriangleAlert` |
| Maintenance | `Wrench` |
| AI Assistant | `Sparkles` |

---

## Public Homepage Structure

### 1. Header / Navigation

Header should be sticky or semi-sticky on desktop.

Suggested links:

- Product
- Driver App
- Fleet Portal
- Tachograph Analysis
- Pricing
- About
- Contact
- Login

Primary CTA:

```txt
Request early access
```

Secondary CTA:

```txt
View features
```

---

## 2. Hero Section

### Hero Goal

Immediately explain that HourWise connects a driver app with a fleet compliance portal.

### Suggested Hero Copy

```txt
Driver hours, tachograph insight and fleet compliance — connected in one platform.
```

Supporting text:

```txt
HourWise EU helps UK and European drivers track work, driving, breaks and POA while giving operators a clearer view of shifts, vehicle checks, expenses, incidents and tachograph analysis.
```

CTA buttons:

```txt
Request early access
Explore the platform
```

Trust line:

```txt
Built for HGV drivers, transport managers, small fleets and growing operators.
```

### Hero Visual

Use a split mockup:

Left:

- Mobile driver app screen showing active drive/work timer

Right:

- Fleet portal dashboard showing drivers, vehicles, warnings, tachograph status

Background:

- Subtle digital route grid
- Tachograph rings
- Floating metric cards

Floating cards examples:

```txt
Driving remaining: 00:48
Driver card due: 12 days
Vehicle check submitted
Weekly drive: 42h / 56h
```

---

## 3. Problem Section

Headline:

```txt
Transport compliance is still spread across too many tools.
```

Pain points:

- Drivers track hours manually or rely only on memory
- Fleet managers chase paperwork, checks and receipts
- Tachograph files are hard to interpret quickly
- Small fleets lack affordable compliance tooling
- Driver app data and office records often do not connect

Design:

Use 4–5 cards with icons and short copy.

---

## 4. Solution Section

Headline:

```txt
HourWise connects the driver, the vehicle and the transport office.
```

Three columns:

### Driver App

- Track work, drive, break and POA
- Receive alerts before limits
- Submit expenses, checks and incidents

### Fleet Portal

- View drivers, shifts, vehicles and records
- Manage compliance tasks
- Review tachograph data and reports

### Connected Workflow

- App data flows into the portal
- Managers can message drivers
- Reports support payroll and compliance review

---

## 5. Driver App Feature Section

Headline:

```txt
A practical daily companion for professional drivers.
```

### Solo Driver Features

- Shift timer
- Work timer
- Driving timer
- Break timer
- POA tracking
- Auto driving detection
- Optional low-speed yard detection
- Spoken alerts
- Push notifications
- 4h30 driving break warnings
- 6h/9h working time break warnings
- Daily reports
- Calendar history
- Manual edits
- Expense logging
- Pay estimates
- Allowance tracking
- Downloadable reports
- Multi-language support
- Fatigue reminders
- Compliance heatmap

### Fleet Driver Features

- Clock in/out connected to fleet portal
- Fleet-visible daily shift records
- Vehicle check submission
- Defect reporting
- Incident reporting
- Expense and receipt submission
- Fuel/toll/mileage reporting
- Messages from transport office
- Fleet announcements
- Assigned vehicle visibility
- Compliance reminders
- Driver card download reminders
- Licence/document reminders

### Suggested Copy

```txt
For solo drivers, HourWise helps keep daily hours, breaks and reports organised. For fleet drivers, the same app becomes a direct link to the transport office.
```

---

## 6. Fleet Portal Feature Section

Headline:

```txt
A clearer control centre for transport managers.
```

Feature groups:

### Driver Management

- Driver profiles
- Licence/document expiry tracking
- Driver app connection
- Driver shift visibility
- Messaging and announcements

### Tachograph Analysis

- Driver card upload/import
- Vehicle unit file upload/import
- `.DDD`, `.C1B`, `.V1B` support where available
- Parsed driver card view
- Activity timelines
- Legal totals
- Events and infringements
- Exportable reports
- Validation/debug mode for parser confidence

### Fleet Compliance

- Daily vehicle checks
- Defects
- Incident reporting
- Accident records
- Maintenance reminders
- PMI calendar
- O-licence document area
- FORS/Ecostars/SQAS support area

### Finance and Admin

- Expenses
- Fuel, toll and mileage records
- Payroll support
- Working time summaries
- Driver reports
- Downloadable records

### AI Assistant / Atlas

- Ask Atlas for fleet summaries
- Identify missing checks
- Flag upcoming expiries
- Highlight driver risk areas
- Produce daily/weekly management summaries

---

## 7. App + Portal Interaction Section

Headline:

```txt
One connected workflow from cab to office.
```

Suggested visual:

```txt
Driver App → Secure Cloud → Fleet Portal → Reports & Compliance Actions
```

### Driver App Sends

- Shift records
- Work, drive, break and POA totals
- Manual corrections
- Vehicle checks
- Defects
- Incidents
- Expenses and receipts
- Messages and acknowledgements

### Portal Sends

- Messages
- Announcements
- Driver reminders
- Assigned vehicle information
- Compliance actions
- Policy updates

### Copy

```txt
Drivers capture the information during the day. Managers review, action and report on it from the portal.
```

---

## 8. Tachograph-Specific Section

Headline:

```txt
Tachograph files made easier to understand.
```

Explain:

- Upload or read driver card data
- Upload vehicle unit data
- View clear timelines
- Review totals and potential infringements
- Keep original files for audit purposes
- Use analysis as a compliance aid, not a replacement for operator responsibility

Feature cards:

- Driver card view
- Vehicle unit analysis
- Activity timeline
- Infringement summary
- Download archive
- Parser validation report

Suggested caution text:

```txt
HourWise is designed as a compliance support tool. Operators remain responsible for checking records and meeting their legal obligations.
```

---

## 9. Van / 2026 Expansion Section

Optional but valuable for future marketing.

Headline:

```txt
Preparing for the changing tachograph landscape.
```

Copy:

```txt
From July 2026, some 2.5–3.5t light commercial vehicles used in international transport will come into tachograph scope. HourWise is being built with flexible vehicle profiles so operators can prepare for changing requirements.
```

Feature:

- HGV profile
- Bus/coach profile
- Van 2.5–3.5t profile planned
- Smart Tachograph 2 support planned

---

## 10. Pricing Section

Keep pricing simple and transparent.

Suggested initial pricing display:

### Solo Driver App

```txt
£2.99 / month
```

For individual drivers tracking hours, reports, alerts and pay estimates.

### Fleet Portal

```txt
From £19.99 / month
```

For operators managing drivers, vehicles, checks, expenses, reports and compliance records.

### Fleet Driver App Add-on

```txt
£2.99 / driver / month
```

For drivers connected to a fleet portal account.

Add note:

```txt
Pricing may vary during early access and beta testing.
```

---

## 11. Early Access / Beta Section

Headline:

```txt
Help shape HourWise before launch.
```

Copy:

```txt
We are looking for drivers, small fleets, transport managers and compliance professionals to test HourWise and provide feedback before full release.
```

CTA:

```txt
Join early access
```

Collect:

- Name
- Email
- Company
- Driver/operator/consultant role
- Fleet size
- Message

---

## 12. About Section

Headline:

```txt
Built from real driver and operator problems.
```

Suggested copy:

```txt
HourWise started as a practical driver app for tracking work, driving, breaks and POA. It has grown into a connected platform for drivers and operators who need clearer records, simpler reporting and better compliance visibility.
```

Keep this personal and honest. This can help differentiate HourWise from faceless enterprise software.

---

## 13. FAQ Section

Suggested questions:

### Is HourWise a tachograph replacement?

No. HourWise is a support, analysis and record-keeping tool. It does not replace legally required tachograph equipment or operator responsibilities.

### Can solo drivers use the app?

Yes. Solo drivers can use the mobile app to track hours, receive alerts, record expenses and generate reports.

### Can fleet drivers connect to an operator?

Yes. Fleet-connected drivers can send shift data, checks, incidents and expenses to the portal.

### Does the portal support tachograph files?

The portal is being built to support driver card and vehicle unit file import/analysis where compatible data is available.

### Is this for UK or EU drivers?

HourWise is designed for UK/EU commercial driver workflows, with international expansion possible later.

### Is HourWise suitable for small fleets?

Yes. The portal should be positioned strongly for small and growing operators who need affordable compliance tooling.

---

## 14. Footer

Include:

- Logo
- Short description
- Contact email
- Support email
- Privacy Policy
- GDPR/Data Processing
- Terms
- Login
- Social links if available

Suggested footer copy:

```txt
HourWise EU helps drivers and operators manage working time, tachograph data, fleet records and compliance workflows.
```

---

## Homepage Component Plan for Vite

Suggested components:

```txt
src/components/marketing/Header.tsx
src/components/marketing/HeroSection.tsx
src/components/marketing/ProblemSection.tsx
src/components/marketing/SolutionSection.tsx
src/components/marketing/DriverAppSection.tsx
src/components/marketing/FleetPortalSection.tsx
src/components/marketing/ConnectedWorkflowSection.tsx
src/components/marketing/TachographSection.tsx
src/components/marketing/PricingSection.tsx
src/components/marketing/EarlyAccessSection.tsx
src/components/marketing/FaqSection.tsx
src/components/marketing/Footer.tsx
src/components/ui/HWButton.tsx
src/components/ui/HWCard.tsx
src/components/ui/HWFeatureCard.tsx
src/components/ui/HWBadge.tsx
src/components/ui/HWMetricCard.tsx
```

---

## Portal App UI Refresh

### Portal Shell

Use a professional SaaS layout:

```txt
Left sidebar navigation
Top bar with fleet name, search, notifications, profile
Main dashboard content area
Right-side alert/action panel where useful
```

### Navigation Sections

- Dashboard
- Drivers
- Vehicles
- Tachograph
- Reports
- Calendar
- Checks
- Defects
- Incidents
- Expenses
- Messages
- Documents
- Atlas Assistant
- Settings

---

## Manager Dashboard Suggestions

Dashboard cards:

- Active drivers today
- Missing vehicle checks
- Driver cards due download
- Upcoming licence expiries
- Vehicles due PMI
- Open defects
- Recent incidents
- Weekly driving risk
- Working time warnings
- Tachograph uploads pending analysis

Add a daily action list:

```txt
Today needs attention
- 3 missing walkaround checks
- 1 driver card due download
- 2 open vehicle defects
- 1 driver near weekly driving limit
```

---

## Tachograph Page Suggestions

Sections:

- Upload / read driver card
- Upload / read vehicle unit file
- Recent uploads
- Driver card viewer
- Vehicle unit viewer
- Infringement list
- Activity timeline
- Legal totals
- Parser validation report
- Export/download centre

### Driver Card View

Inspired by Tachomaster-style clarity:

- Driver details card
- Card number / issuing country / expiry
- Calendar/day selector
- Activity timeline
- Mode blocks: drive, work, break, POA
- Daily totals
- Weekly/fortnightly totals
- Infringements
- Events/faults
- Export/print buttons

---

## Atlas Assistant UI

Use Atlas as a supportive fleet assistant, not a gimmick.

Suggested entry points:

- Dashboard widget: “Ask Atlas”
- Daily summary card
- Risk alerts
- Compliance query panel

Example prompts:

- “Which drivers need attention today?”
- “Show missing vehicle checks this week.”
- “Which vehicles are due PMI soon?”
- “Summarise tachograph issues for this driver.”

---

## Website Visual Assets Needed

### Required Assets

- Full HourWise EU logo, light and dark
- Icon mark only
- Favicon sizes
- App store style mockup image
- Portal dashboard mockup image
- Digital route-grid background
- Tachograph ring background motif
- Feature icons
- Early access hero image

### Background Asset Prompt

```txt
A professional dark navy digital transport compliance background for a UK/EU fleet software website. Subtle route grid lines, faint GPS dots, curved road paths, circular tachograph timer rings, soft blue and teal glow, clean SaaS style, no trucks, no text, minimal, high-end, 16:9, suitable for a website hero background.
```

---

## Suggested Homepage Copy

### Main Headline

```txt
Driver hours, tachograph insight and fleet compliance — connected in one platform.
```

### Subheadline

```txt
HourWise EU helps drivers track work, driving, breaks and POA while giving operators a clearer view of shifts, checks, expenses, incidents, tachograph data and compliance actions.
```

### Primary CTA

```txt
Request early access
```

### Secondary CTA

```txt
Explore features
```

---

## Build Priorities

### Phase 1 — Homepage Polish

- [ ] Add new hero section
- [ ] Add app + portal mockup area
- [ ] Add driver app feature list
- [ ] Add fleet portal feature list
- [ ] Add connected workflow section
- [ ] Add early access/contact form
- [ ] Add proper footer

### Phase 2 — Visual System

- [ ] Add CSS variables
- [ ] Add route-grid background
- [ ] Add reusable cards
- [ ] Add buttons and badges
- [ ] Add responsive layout
- [ ] Add dark/light logo support

### Phase 3 — Portal Dashboard Refresh

- [ ] Improve sidebar
- [ ] Improve dashboard cards
- [ ] Add action summary panel
- [ ] Improve empty/loading states
- [ ] Add consistent status colours

### Phase 4 — Tachograph UI

- [ ] Improve upload/read flow
- [ ] Add driver card visual timeline
- [ ] Add analysis summary
- [ ] Add parser validation output
- [ ] Add export/print controls

### Phase 5 — Trust and Conversion

- [ ] Add FAQ
- [ ] Add compliance disclaimer
- [ ] Add privacy/GDPR links
- [ ] Add early access messaging
- [ ] Add beta tester callout
- [ ] Add contact/support emails

---

## Responsive Requirements

Homepage must work well on:

- Mobile width 360px+
- Tablet
- Desktop 1440px+

Hero should stack on mobile:

```txt
Headline
Subheadline
CTA buttons
App mockup
Portal mockup
```

Desktop hero should use a two-column layout.

---

## Accessibility Requirements

- Use semantic HTML
- Maintain strong contrast
- Do not use tiny grey text for important claims
- Buttons must have visible focus states
- Feature cards should be keyboard navigable where interactive
- Add alt text for mockups
- Do not communicate warning state by colour alone

---

## Legal / Trust Notes

Add a clear but non-alarming disclaimer:

```txt
HourWise is designed to support drivers and operators with time tracking, reporting and compliance workflows. It does not replace legally required tachograph equipment, official records or the operator’s legal responsibilities.
```

Include:

- Privacy Policy
- GDPR/Data Processing page
- Terms of Use
- Support contact

---

## Codex Guardrails

When implementing the homepage and portal refresh:

1. Do not break existing login/auth flows.
2. Keep marketing homepage separate from authenticated portal routes.
3. Do not expose internal Supabase data on public pages.
4. Use reusable components where possible.
5. Use CSS variables/design tokens rather than scattered hard-coded colours.
6. Keep the page fast and lightweight.
7. Avoid stock imagery dependency.
8. Do not overpromise legal certification or DVSA approval.
9. Clearly separate live features from planned/beta features.
10. Preserve existing portal functionality while improving presentation.
