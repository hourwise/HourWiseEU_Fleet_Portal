# HourWise EU Homepage / Landing Screen Improvement Plan

**Document type:** Agent-ready implementation plan  
**Created:** 2026-07-05  
**Target repo:** `HourWiseEU_Fleet_Portal`  
**Likely target folders:** `src/components/marketing`, `src/components/public`  
**Primary goal:** Improve the public homepage so a first-time visitor immediately understands what HourWise EU does, trusts it enough to keep reading, and signs up for coming soon / early access updates.

---

## 1. Executive Summary

The current homepage direction is better than the original version, but it still needs to become a sharper SaaS landing screen rather than a general portal page. The homepage must do three jobs quickly:

1. **Explain the product within 5 seconds.**
   - HourWise EU is a connected driver app and fleet portal for UK/EU driver hours, tachograph insight, vehicle checks, expenses, incidents, messaging, and compliance workflows.

2. **Show the connection between app and portal.**
   - The app is for drivers in the cab.
   - The portal is for transport managers in the office.
   - The value is in the connected workflow: daily driver activity, checks, incidents, expenses, messages, reports, tachograph data, and management actions all joining up.

3. **Convert interest into signups.**
   - The page is not currently selling a mature, fully launched enterprise platform.
   - It should sell early access, beta participation, coming soon updates, and founder credibility.
   - The CTA should be simple: **Join early access** / **Get launch updates**.

The page should avoid becoming a long vertical brochure. Use a strong above-the-fold hero, followed by compact tabbed or horizontally-scrollable sections so visitors can explore by role or feature without being forced through a long page.

---

## 2. Known Inputs and Constraints

### 2.1 Source Inputs

Use the existing HourWise direction from previous planning:

- Dark fleet command centre visual style.
- Deep navy, blue, cyan, and teal palette.
- Route-grid / tachograph ring background motif.
- Driver app + fleet portal connected ecosystem.
- Separate positioning for solo drivers, fleet drivers, and transport managers.
- Early access / coming soon conversion goal.
- Compliance support language, not legal replacement language.

### 2.2 Repo Constraint

The public GitHub URL may not be accessible from outside the authenticated environment. The agent should work inside the local repo and inspect:

```txt
src/components/marketing
src/components/public
src/pages
src/routes
src/App.tsx
src/main.tsx
src/styles
```

Do not assume file names. Search the local codebase for:

```txt
Home
Landing
Public
Marketing
Header
Hero
Footer
EarlyAccess
Contact
```

### 2.3 Non-Negotiable Guardrails

1. Do not break existing authentication, login, Supabase, or portal routes.
2. Keep the public marketing homepage separate from authenticated fleet portal screens.
3. Do not expose Supabase keys, private table data, customer data, or internal debug output on the public page.
4. Do not overclaim legal approval, DVSA approval, certified tachograph replacement, or guaranteed compliance.
5. Clearly separate **live**, **beta**, **planned**, and **coming soon** features.
6. Maintain a fast, lightweight public page.
7. Build reusable components instead of one huge homepage file.
8. Use semantic HTML and accessible components.
9. Ensure the page is mobile-first, but still polished on desktop.
10. Keep the primary CTA visible early and repeated naturally.

---

## 3. Homepage Positioning

### 3.1 Plain-English Product Definition

Use this internally as the product definition:

> HourWise EU is a connected driver app and fleet portal for UK and European commercial transport operators. Drivers can track work, driving, breaks and POA, while fleets can manage shifts, checks, defects, incidents, expenses, tachograph files, reports, messaging, and compliance actions from one portal.

### 3.2 Main Homepage Message

Use this as the main headline:

```txt
Driver hours, tachograph insight and fleet compliance — connected in one platform.
```

Alternative shorter version:

```txt
The connected driver app and fleet portal for UK/EU transport teams.
```

Recommended subheadline:

```txt
HourWise EU helps drivers track work, driving, breaks and POA while giving operators a clearer view of shifts, checks, expenses, incidents, tachograph data and compliance actions.
```

### 3.3 Visitor Must Understand Instantly

Within the first screen, the visitor should know:

- This is for **UK/EU HGV/commercial transport**.
- There is a **driver app**.
- There is a **fleet portal**.
- It helps with **hours, tachograph data, checks, reports, expenses, incidents and compliance workflows**.
- It is **coming soon / early access**.
- They can **join updates**.

### 3.4 Suggested Tagline Options

Use one only; do not crowd the hero.

```txt
From cab to office, keep driver hours and fleet records connected.
```

```txt
A practical compliance workflow for drivers, fleets and transport managers.
```

```txt
Built for real drivers, small fleets and growing operators.
```

---

## 4. SaaS Landing Rules to Apply

These rules convert earlier SaaS/product discussion into actual homepage behaviour.

### 4.1 Sell Outcomes, Not Just Features

Avoid opening with a list of modules. Open with outcomes:

- Know who is working.
- See which records are missing.
- Catch issues before they become paperwork problems.
- Give drivers a practical app instead of more admin.
- Keep tachograph, checks, incidents and expenses easier to review.

Feature lists should support the promise, not replace it.

### 4.2 Cut the Homepage MVP in Half

The homepage should not try to explain every planned module in full detail. The main homepage MVP should focus on:

1. Driver app.
2. Fleet portal.
3. Tachograph insight.
4. Connected workflow.
5. Early access signup.

Everything else can be in tabs, expandable cards, future pages, or “coming soon” chips.

### 4.3 Distribution Before Features

The homepage must help people share and understand the idea quickly. Add concise shareable copy:

```txt
HourWise EU connects a driver hours app with a fleet portal for UK/EU transport teams.
```

This exact sentence can be used in Open Graph, meta description, social cards, README, and early-access confirmation emails.

### 4.4 Trust Before Complexity

Because transport compliance is serious, the design must feel reliable before it feels flashy. Use:

- Clear language.
- Compliance disclaimer.
- Founder / real-world origin section.
- Transparent beta status.
- Specific but non-overpromising feature names.
- Screenshots/mockups instead of vague animation only.

### 4.5 One Primary Action

The public homepage has one job:

```txt
Join early access / Get launch updates
```

Secondary actions are allowed, but should not compete:

```txt
Explore features
View driver app
View fleet portal
```

---

## 5. Recommended Information Architecture

Do not build a long multipage-feeling vertical scroll. Use a compact structure with tabs and horizontal exploration.

### 5.1 Page Sections

Recommended homepage order:

1. Header
2. Above-the-fold hero
3. Instant role selector / tabbed product view
4. Connected workflow strip
5. Feature explorer with tabs
6. Screenshot / mockup carousel
7. Tachograph + compliance support section
8. Early access signup panel
9. Founder / credibility note
10. FAQ accordion
11. Footer

### 5.2 Desktop Behaviour

Desktop should feel like a single polished landing experience:

- Hero occupies most of the first viewport.
- Next section is a tabbed “Choose your view” module.
- Feature explorer uses tabs rather than a huge vertical list.
- Screenshot area can be side-by-side or horizontal carousel.
- Early access CTA appears at top, mid-page, and bottom.

### 5.3 Mobile Behaviour

Mobile can scroll vertically, but each section must be compact:

- Hero CTA near top.
- Mockups stack cleanly.
- Tabs become horizontal pill navigation.
- Feature cards become swipeable or two-column short cards.
- Early access email field remains easy to reach.

---

## 6. Header / Navigation Plan

### 6.1 Header Goals

The header should reassure visitors that this is a real product and help them jump quickly.

Suggested nav:

```txt
Product
Driver App
Fleet Portal
Tachograph
Pricing
FAQ
Login
```

Primary CTA:

```txt
Join early access
```

### 6.2 Header Rules

- Keep header sticky or semi-sticky on desktop.
- On mobile, use a clean menu button.
- Use one primary CTA button.
- Login should be visible but not dominant.
- Avoid nav labels like “Solutions” unless there are multiple pages behind them.

---

## 7. Hero Section Plan

### 7.1 Hero Layout

Desktop two-column hero:

```txt
LEFT:
- Product badge
- H1
- Subheadline
- CTA row
- Trust/support line
- Tiny role chips

RIGHT:
- App mockup + portal mockup
- Floating metric cards
- Route-grid/tachograph ring background
```

Mobile layout:

```txt
Badge
H1
Subheadline
Email / CTA
Trust line
Mockups
```

### 7.2 Hero Copy

Badge:

```txt
Coming soon for UK/EU drivers and fleet operators
```

H1:

```txt
Driver hours, tachograph insight and fleet compliance — connected in one platform.
```

Subheadline:

```txt
HourWise EU combines a practical driver app with a fleet portal for shifts, checks, expenses, incidents, tachograph analysis, messaging and compliance workflows.
```

Primary CTA:

```txt
Join early access
```

Secondary CTA:

```txt
Explore the platform
```

Trust line:

```txt
Built for solo drivers, fleet drivers, transport managers and growing operators.
```

Role chips:

```txt
Solo drivers
Fleet drivers
Transport managers
Small fleets
HGV operators
```

### 7.3 Hero Screenshot Positions

Use the right side of the hero for three layered visual assets:

#### Screenshot Slot A — Driver App Timer

Position: front-left phone mockup.  
Purpose: show this is not just a portal; there is a real driver-facing app.

Suggested content to capture:

- Active shift screen.
- Work timer.
- Driving timer.
- Break / POA state.
- Warning or countdown area.
- Clean “Start shift” / “End shift” / “Break” controls.

Suggested caption:

```txt
Driver app: work, drive, break and POA tracking.
```

#### Screenshot Slot B — Fleet Portal Dashboard

Position: larger panel behind or to the right of phone.  
Purpose: show the operator dashboard.

Suggested content to capture:

- Drivers active today.
- Missing vehicle checks.
- Open defects.
- Driver card due download.
- Vehicle due PMI.
- Recent incidents.
- Tachograph uploads pending.

Suggested caption:

```txt
Fleet portal: daily records, checks and compliance actions.
```

#### Floating Metric Cards

Position: around mockups.  
Purpose: communicate product value without relying on tiny screenshots.

Examples:

```txt
Driving remaining: 00:48
Vehicle check submitted
Driver card due: 12 days
Open defects: 2
Weekly drive: 42h / 56h
Message acknowledged
```

---

## 8. Role Selector / Tabbed Product View

### 8.1 Purpose

Immediately after the hero, let visitors self-identify. This reduces confusion because HourWise serves several user types.

### 8.2 Tabs

Use four tabs:

```txt
Solo Driver
Fleet Driver
Transport Manager
Compliance / Admin
```

### 8.3 Tab Content

#### Tab 1 — Solo Driver

Headline:

```txt
Keep your working day organised from one app.
```

Bullets:

- Track work, driving, breaks and POA.
- Get alerts before key limits.
- Keep daily reports and calendar history.
- Log expenses and estimate pay.
- Export records when needed.

Screenshot idea:

- App dashboard, calendar, report download screen.

CTA:

```txt
Get app launch updates
```

#### Tab 2 — Fleet Driver

Headline:

```txt
Send the office what they need without extra paperwork.
```

Bullets:

- Clock in/out or submit shift activity.
- Complete vehicle checks.
- Report defects and incidents.
- Submit expenses and receipts.
- Receive messages and reminders.

Screenshot idea:

- Vehicle check screen, defect form, messages screen.

CTA:

```txt
Join fleet driver beta
```

#### Tab 3 — Transport Manager

Headline:

```txt
See the records that need attention before they become a problem.
```

Bullets:

- View driver activity and submitted records.
- Monitor missing checks and open defects.
- Review expenses, incidents and reports.
- Manage vehicles and document reminders.
- Use tachograph analysis and summaries.

Screenshot idea:

- Manager dashboard with action list.

CTA:

```txt
Request fleet portal access
```

#### Tab 4 — Compliance / Admin

Headline:

```txt
Build a clearer audit trail across drivers, vehicles and files.
```

Bullets:

- Tachograph file import and analysis.
- Driver card and VU file storage.
- Activity timelines and legal totals.
- Infringement and event review.
- Exportable reports and supporting evidence.

Screenshot idea:

- Tachograph timeline / driver card view.

CTA:

```txt
Get compliance updates
```

---

## 9. Connected Workflow Strip

### 9.1 Purpose

This should visually answer the key product question:

> How do the app and portal communicate with each other?

### 9.2 Visual Layout

Use a horizontal workflow strip:

```txt
Driver App → Secure Cloud → Fleet Portal → Reports & Actions
```

Each step is a card with 2–4 short bullets.

### 9.3 Step Details

#### Driver App Captures

- Work, drive, break and POA records.
- Vehicle checks and defects.
- Incidents and expenses.
- Messages and acknowledgements.

#### Secure Cloud Sync

- Supabase-backed account and fleet data.
- Role-based access.
- Public marketing routes kept separate from portal data.
- Real-time/push updates where implemented.

#### Fleet Portal Reviews

- Driver records.
- Vehicle records.
- Checks, defects and incidents.
- Tachograph files and reports.

#### Reports & Actions

- Payroll support.
- Compliance review.
- Document reminders.
- Download/export records.

### 9.4 Copy

```txt
Drivers capture the day as it happens. Managers review, action and report from the portal.
```

---

## 10. Feature Explorer

### 10.1 Purpose

Replace a long vertical feature list with a tabbed, compact explorer.

### 10.2 Recommended Tabs

```txt
Hours & Alerts
Tachograph
Checks & Defects
Expenses & Reports
Messaging
Atlas Assistant
```

### 10.3 Tab Copy

#### Hours & Alerts

Headline:

```txt
Track the working day before it becomes a paperwork problem.
```

Cards:

- Work timer.
- Driving timer.
- Break and POA tracking.
- Spoken and push alerts.
- Daily report history.

Screenshot slot:

- App active timer screen.

#### Tachograph

Headline:

```txt
Make driver card and vehicle unit files easier to review.
```

Cards:

- Driver card import.
- VU file import.
- Activity timeline.
- Legal totals.
- Events and infringements.
- Parser validation / debug confidence.

Screenshot slot:

- Driver card visual timeline.

Disclaimer:

```txt
HourWise supports review and record keeping. It does not replace legally required tachograph equipment or operator responsibilities.
```

#### Checks & Defects

Headline:

```txt
Keep daily checks and defects visible to the office.
```

Cards:

- Walkaround checks.
- Defect reports.
- Open defect status.
- Vehicle assignment.
- Maintenance reminders.
- PMI calendar.

Screenshot slot:

- Mobile check submission and portal open-defects panel.

#### Expenses & Reports

Headline:

```txt
Turn receipts and shift records into usable reports.
```

Cards:

- Fuel, toll and mileage logging.
- Receipts.
- Driver expenses.
- Pay estimate support.
- Downloadable reports.
- Payroll summaries.

Screenshot slot:

- Expense capture and report export.

#### Messaging

Headline:

```txt
Connect transport office messages with driver acknowledgements.
```

Cards:

- Driver messages.
- Announcements.
- Acknowledgement tracking.
- Reminders.
- Policy updates.

Screenshot slot:

- Portal messaging panel and driver app message.

#### Atlas Assistant

Headline:

```txt
Ask Atlas what needs attention across your fleet.
```

Cards:

- Missing checks summary.
- Upcoming document expiry.
- Driver risk flags.
- Weekly digest.
- Tachograph issue summaries.

Screenshot slot:

- Dashboard card with “Ask Atlas” prompt examples.

Label clearly as:

```txt
Planned / beta feature
```

---

## 11. Screenshot and Asset Plan

### 11.1 Naming Convention

Ask the agent to create placeholder asset paths now. You can fill them later.

```txt
public/marketing/mockups/app-timer.png
public/marketing/mockups/app-checks.png
public/marketing/mockups/app-expenses.png
public/marketing/mockups/app-messages.png
public/marketing/mockups/portal-dashboard.png
public/marketing/mockups/portal-tachograph.png
public/marketing/mockups/portal-defects.png
public/marketing/mockups/portal-atlas.png
public/marketing/backgrounds/route-grid-hero.svg
public/marketing/backgrounds/tachograph-rings.svg
public/marketing/social/hourwise-og-card.png
```

### 11.2 Placeholder Strategy

The agent should not block implementation waiting for final screenshots. Use elegant placeholders that make it clear where assets go:

- Gradient device mockups.
- Wireframe cards.
- “Screenshot coming soon” label only in development if necessary.
- Avoid obvious grey boxes on production.

### 11.3 Screenshot Ideas for You to Fill In

#### App Screenshots

1. **Active shift / timer dashboard**
   - Best for hero.
   - Show work, drive, break, POA.

2. **Calendar / daily report history**
   - Best for solo driver tab.
   - Show records and report download.

3. **Vehicle check form**
   - Best for fleet driver tab.
   - Show submitted check and defect flow.

4. **Expense / receipt logging**
   - Best for expenses section.

5. **Messages / announcement screen**
   - Best for connected workflow and messaging section.

#### Portal Screenshots

1. **Manager dashboard**
   - Best for hero.
   - Include action list and key metrics.

2. **Drivers page**
   - Show driver status, last shift, card download due, licence expiry.

3. **Vehicles page**
   - Show check status, defects, PMI, calibration.

4. **Tachograph driver card view**
   - Show timeline, daily totals, infringement list.

5. **Reports / exports page**
   - Show downloadable summaries.

6. **Atlas panel**
   - Show prompts and a short fleet summary.

### 11.4 Screenshot Placement Map

| Page Area | Asset | Purpose |
|---|---|---|
| Hero right | `app-timer.png` + `portal-dashboard.png` | Instant app + portal understanding |
| Role selector: Solo Driver | `app-timer.png`, `app-reports.png` | Personal driver value |
| Role selector: Fleet Driver | `app-checks.png`, `app-messages.png` | Cab-to-office workflow |
| Role selector: Manager | `portal-dashboard.png` | Manager value |
| Feature tab: Tachograph | `portal-tachograph.png` | Compliance credibility |
| Feature tab: Checks | `portal-defects.png` | Operational workflow |
| Feature tab: Atlas | `portal-atlas.png` | Future AI value |
| Early access | Simple product collage | Conversion support |

---

## 12. Early Access Signup Plan

### 12.1 Conversion Goal

The form should collect enough information to understand the lead, without scaring them away.

### 12.2 Recommended Form Fields

Required:

- Name
- Email
- Role

Optional:

- Company name
- Fleet size
- Interested in: Driver app / Fleet portal / Tachograph / Atlas / Beta testing
- Message

### 12.3 Role Options

```txt
Solo driver
Fleet driver
Transport manager
Fleet owner
Compliance consultant
Workshop / maintenance
Other
```

### 12.4 CTA Copy Options

Primary:

```txt
Join early access
```

Alternative:

```txt
Get launch updates
```

For fleets:

```txt
Request fleet beta access
```

### 12.5 Form UX

- Allow email-only signup in the hero if possible.
- Use a fuller form lower down.
- Do not require account creation for marketing signup.
- Confirm submission with a clear success state.
- Store leads securely in Supabase or the existing preferred lead storage system.
- Add honeypot field and rate limiting if implemented.
- Do not expose lead table data publicly.

### 12.6 Confirmation Message

```txt
Thanks — you’re on the HourWise EU early access list. We’ll send launch updates and beta opportunities as they become available.
```

---

## 13. SEO Plan

### 13.1 SEO Objective

The homepage should become understandable to:

- Human visitors.
- Google Search.
- Bing.
- AI search/retrieval systems.
- Social previews.

The most important SEO fix is clarity. The page must repeatedly and naturally explain what HourWise EU is, who it is for, and what problems it solves.

### 13.2 Recommended Page Title

Use a clear title instead of a generic dashboard title.

```txt
HourWise EU | Driver Hours App & Fleet Compliance Portal
```

Alternative:

```txt
HourWise EU | Connected Driver App and Fleet Portal for UK/EU Operators
```

### 13.3 Recommended Meta Description

```txt
HourWise EU connects a practical driver hours app with a fleet portal for UK/EU transport teams. Track work, driving, breaks, POA, checks, expenses, incidents, tachograph data and compliance workflows.
```

### 13.4 H1

Use one H1 only:

```txt
Driver hours, tachograph insight and fleet compliance — connected in one platform.
```

### 13.5 Suggested H2 Structure

```txt
For drivers, fleets and transport managers
How the app and portal work together
Explore the HourWise EU platform
Tachograph files made easier to understand
Join early access
Built from real driver and operator problems
Frequently asked questions
```

### 13.6 Keyword Map

Use natural language. Do not keyword-stuff.

#### Primary Keywords

- driver hours app
- fleet compliance portal
- tachograph analysis software
- HGV driver hours app
- UK fleet management software
- EU drivers hours app
- transport compliance software

#### Secondary Keywords

- driver card analysis
- vehicle unit tachograph file
- DDD tachograph file analysis
- C1B driver card file
- V1B vehicle unit file
- daily vehicle checks app
- HGV defect reporting
- fleet expenses app
- driver shift reports
- working time directive driver app
- POA tracking app
- transport manager dashboard

#### Long-Tail Keywords

- app for tracking HGV driver working time and breaks
- fleet portal for driver checks defects and expenses
- tachograph file analysis for small fleets
- driver app connected to fleet management portal
- UK transport compliance app for small operators
- HGV driver app with POA and break alerts
- fleet software for driver card downloads and vehicle checks

#### AI Search / Answer Phrases

Build exact, answerable statements into the visible page:

```txt
HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams.
```

```txt
The driver app tracks work, driving, breaks and POA, while the fleet portal helps managers review shifts, checks, expenses, incidents, tachograph data and reports.
```

```txt
HourWise EU is designed as a compliance support and workflow tool. It does not replace legally required tachograph equipment or operator legal responsibilities.
```

### 13.7 Internal Links

Even if not all pages exist yet, structure the site toward:

```txt
/
/driver-app
/fleet-portal
/tachograph-analysis
/pricing
/early-access
/privacy
/terms
/contact
/login
```

If pages do not exist yet, do not add broken links. Either add sections with anchor links now, or create simple placeholder pages with accurate copy.

### 13.8 Open Graph / Social Metadata

Add or update:

```html
<meta property="og:title" content="HourWise EU | Driver Hours App & Fleet Compliance Portal" />
<meta property="og:description" content="A connected driver app and fleet portal for UK/EU transport teams — covering hours, checks, expenses, incidents, tachograph insight and compliance workflows." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://www.hourwiseeu.co.uk/" />
<meta property="og:image" content="https://www.hourwiseeu.co.uk/marketing/social/hourwise-og-card.png" />
<meta name="twitter:card" content="summary_large_image" />
```

### 13.9 Structured Data

Add JSON-LD to the public homepage. Use accurate fields only.

Recommended schema types:

- `Organization`
- `WebSite`
- `SoftwareApplication`
- `FAQPage` if FAQ content is visible on the page

#### Example JSON-LD

Adjust URLs, images, and app availability when accurate.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.hourwiseeu.co.uk/#organization",
      "name": "HourWise EU",
      "url": "https://www.hourwiseeu.co.uk/",
      "logo": "https://www.hourwiseeu.co.uk/logo.png",
      "description": "HourWise EU builds a connected driver app and fleet portal for UK/EU commercial transport teams."
    },
    {
      "@type": "WebSite",
      "@id": "https://www.hourwiseeu.co.uk/#website",
      "url": "https://www.hourwiseeu.co.uk/",
      "name": "HourWise EU",
      "publisher": {
        "@id": "https://www.hourwiseeu.co.uk/#organization"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.hourwiseeu.co.uk/#software",
      "name": "HourWise EU",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Android, iOS planned",
      "description": "A connected driver hours app and fleet compliance portal for UK/EU transport teams.",
      "url": "https://www.hourwiseeu.co.uk/",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "GBP",
        "price": "0",
        "availability": "https://schema.org/PreOrder"
      }
    }
  ]
}
</script>
```

Important: if pricing is shown as coming soon or beta, do not mark false live pricing in schema.

### 13.10 Sitemap / Robots

Ensure:

```txt
/sitemap.xml exists
/robots.txt exists
robots.txt references sitemap
public marketing pages are crawlable
login/account pages are either noindex or not included in sitemap
```

Recommended robots intent:

```txt
User-agent: *
Allow: /

Sitemap: https://www.hourwiseeu.co.uk/sitemap.xml
```

Do not accidentally block the public homepage, public assets, or route hydration files.

---

## 14. AI Search / Generative Engine Optimisation Plan

### 14.1 Principle

AI search systems need clear, extractable answers. The homepage should include concise answer blocks written in complete sentences.

### 14.2 Add an “AI-readable summary” Block

This can be visually styled as a normal product summary card, not hidden text.

```txt
HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams. The driver app helps track work, driving, breaks and POA. The fleet portal helps operators review shifts, checks, defects, incidents, expenses, tachograph files, messages, reports and compliance actions.
```

### 14.3 Add FAQ with Direct Answers

FAQ should answer exact questions AI/search users ask:

- What is HourWise EU?
- Is HourWise a tachograph replacement?
- Who is HourWise for?
- Does HourWise support solo drivers?
- Does HourWise support fleet operators?
- What tachograph files will HourWise support?
- Is HourWise live now?
- How do I join early access?

### 14.4 Suggested FAQ Copy

#### What is HourWise EU?

```txt
HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams. It helps drivers track work, driving, breaks and POA while helping operators manage checks, defects, incidents, expenses, tachograph data, reports and compliance workflows.
```

#### Is HourWise a tachograph replacement?

```txt
No. HourWise is a compliance support, analysis and workflow tool. It does not replace legally required tachograph equipment, official records or operator responsibilities.
```

#### Who is HourWise for?

```txt
HourWise is being built for solo drivers, fleet drivers, small fleets, growing operators, transport managers and compliance teams working in UK/EU commercial transport.
```

#### Does HourWise support tachograph files?

```txt
The fleet portal is being built to support driver card and vehicle unit file import and analysis where compatible data is available, including formats such as DDD, C1B and V1B where supported.
```

#### Is HourWise available now?

```txt
HourWise is preparing for launch and early access. Drivers and fleets can join the update list to hear about beta testing and release news.
```

### 14.5 Optional `/llms.txt`

Add an optional `/llms.txt` file as an AI-readable product summary. Treat this as experimental support for AI tools, not as a guaranteed ranking feature.

Suggested file:

```txt
# HourWise EU

HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams.

## Product Summary

The driver app helps drivers track work, driving, breaks and POA. The fleet portal helps operators manage shifts, checks, defects, incidents, expenses, tachograph files, reports, messages and compliance actions.

## Key Pages

- Homepage: https://www.hourwiseeu.co.uk/
- Driver App: https://www.hourwiseeu.co.uk/driver-app
- Fleet Portal: https://www.hourwiseeu.co.uk/fleet-portal
- Tachograph Analysis: https://www.hourwiseeu.co.uk/tachograph-analysis
- Early Access: https://www.hourwiseeu.co.uk/early-access

## Important Note

HourWise EU is designed as a compliance support and workflow tool. It does not replace legally required tachograph equipment, official records or operator legal responsibilities.
```

### 14.6 AI Bot Access

Check `robots.txt` and WAF/CDN rules. If the goal is visibility in AI search, do not block legitimate search/retrieval bots accidentally. Decide separately what to allow for search indexing vs model training.

Do not make legal/privacy changes casually. Keep this as a deliberate setting.

---

## 15. Visual Design Direction

### 15.1 Brand Feel

The page should feel:

- Professional.
- Calm.
- Reliable.
- Transport-specific.
- Compliance-aware.
- Practical rather than gimmicky.
- Built from real operational pain.

### 15.2 Avoid

- Generic truck stock photos.
- Overcrowded feature walls.
- Red warning-heavy design everywhere.
- Claims like “DVSA approved” unless true.
- Vague AI hype.
- A homepage that looks like an internal admin dashboard.

### 15.3 Colour Tokens

Use the existing suggested palette or adapt the current codebase tokens:

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

### 15.4 Hero Background

```css
background:
  radial-gradient(circle at 20% 10%, rgba(37,99,235,0.25), transparent 35%),
  radial-gradient(circle at 80% 20%, rgba(20,184,166,0.18), transparent 30%),
  linear-gradient(180deg, #07111F 0%, #0B1628 55%, #10233A 100%);
```

Add a subtle overlay:

- Route-grid lines.
- Circular tachograph rings.
- GPS dots.
- Curved route paths.
- 3–7% opacity.

### 15.5 Typography

Recommended:

```css
body {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.timer-value,
.metric-value {
  font-variant-numeric: tabular-nums;
}
```

### 15.6 UI Style

Use:

- Rounded cards.
- Thin borders with low-opacity blue/white.
- Soft shadows.
- Glass-style panels only where subtle.
- Clear CTA contrast.
- Feature chips.
- Status pills.

---

## 16. Component Implementation Plan

### 16.1 Suggested Component Structure

Create or refactor toward:

```txt
src/components/marketing/MarketingHeader.tsx
src/components/marketing/HomeHero.tsx
src/components/marketing/RoleTabs.tsx
src/components/marketing/ConnectedWorkflow.tsx
src/components/marketing/FeatureExplorer.tsx
src/components/marketing/ScreenshotShowcase.tsx
src/components/marketing/TachographComplianceSection.tsx
src/components/marketing/EarlyAccessSection.tsx
src/components/marketing/FounderStorySection.tsx
src/components/marketing/HomeFaq.tsx
src/components/marketing/MarketingFooter.tsx

src/components/marketing/shared/MarketingButton.tsx
src/components/marketing/shared/MarketingCard.tsx
src/components/marketing/shared/FeaturePill.tsx
src/components/marketing/shared/MetricCard.tsx
src/components/marketing/shared/DeviceMockup.tsx
src/components/marketing/shared/SectionHeader.tsx
```

If existing components already exist, improve rather than duplicating.

### 16.2 Public Route Structure

Recommended routes:

```txt
/                 -> Homepage
/driver-app       -> Later dedicated app page or anchor for now
/fleet-portal     -> Later dedicated portal page or anchor for now
/tachograph-analysis -> Later dedicated tachograph page or anchor for now
/early-access     -> Signup anchor or page
/login            -> Existing login route
```

If only one page is being changed now, use anchor IDs:

```txt
#product
#driver-app
#fleet-portal
#tachograph
#pricing
#early-access
#faq
```

### 16.3 State and Interaction

For tabs:

- Use local React state.
- Add keyboard support.
- Use `button` elements, not clickable divs.
- Add `aria-selected`, `role="tablist"`, `role="tab"`, `role="tabpanel"` if building true tabs.
- On mobile, tab buttons can horizontal-scroll.

For screenshot carousel:

- Keep it optional.
- Avoid heavy carousel dependencies if simple CSS scroll snap works.
- Use native CSS `scroll-snap-type`.

---

## 17. Suggested Homepage Copy Deck

### 17.1 Hero

```txt
Coming soon for UK/EU drivers and fleet operators

Driver hours, tachograph insight and fleet compliance — connected in one platform.

HourWise EU combines a practical driver app with a fleet portal for shifts, checks, expenses, incidents, tachograph analysis, messaging and compliance workflows.

[Join early access] [Explore the platform]

Built for solo drivers, fleet drivers, transport managers and growing operators.
```

### 17.2 Problem Section

```txt
Transport compliance is still spread across too many tools.

Drivers manage hours, checks and receipts on the move. Managers chase records, defects, files and reports from the office. HourWise EU is being built to connect those daily workflows in one place.
```

Pain cards:

```txt
Driver hours are easy to lose track of during a busy day.
Vehicle checks and defects often sit in separate systems or paper trails.
Tachograph files can be hard to interpret quickly.
Expenses, incidents and messages rarely join up cleanly.
Small fleets need practical tools without enterprise complexity.
```

### 17.3 Solution Section

```txt
One workflow from cab to office.

Drivers capture the day as it happens. Managers review, action and report from the portal.
```

### 17.4 Tachograph Section

```txt
Tachograph files made easier to understand.

HourWise EU is being built to support driver card and vehicle unit file review with clear timelines, totals, events, infringements and exportable reports.
```

Disclaimer:

```txt
HourWise is designed to support drivers and operators with time tracking, reporting and compliance workflows. It does not replace legally required tachograph equipment, official records or the operator’s legal responsibilities.
```

### 17.5 Atlas Section

```txt
Atlas is the planned fleet assistant inside HourWise.

Ask what needs attention today, which checks are missing, which documents are due, or which tachograph records need review. Atlas should support managers with summaries and prompts, not replace professional judgement.
```

### 17.6 Early Access Section

```txt
Help shape HourWise before launch.

We are looking for drivers, small fleets, transport managers and compliance professionals to test HourWise EU and provide feedback before full release.
```

CTA:

```txt
Join early access
```

### 17.7 Founder / Story Section

```txt
Built from real driver and operator problems.

HourWise started as a practical driver app for tracking work, driving, breaks and POA. It is now growing into a connected platform for operators who need clearer records, simpler reporting and better visibility across drivers, vehicles and compliance workflows.
```

---

## 18. Pricing / Beta Messaging

If pricing is shown, keep it calm and non-scary.

Suggested display:

```txt
Solo Driver App
From £2.99 / month
For individual drivers tracking hours, alerts, reports and expenses.

Fleet Portal
From £19.99 / month
For operators managing drivers, vehicles, records and compliance workflows.

Fleet Driver Add-on
£2.99 / driver / month
For drivers connected to a fleet portal account.
```

Add note:

```txt
Pricing may vary during early access and beta testing.
```

Alternative if not ready to show pricing:

```txt
Early access pricing will be shared with beta users first.
```

---

## 19. Compliance and Trust Language

### 19.1 Must Include

```txt
HourWise is designed as a compliance support and workflow tool. It does not replace legally required tachograph equipment, official records or operator legal responsibilities.
```

### 19.2 Avoid These Claims

Do not say:

- DVSA approved.
- Guaranteed compliance.
- Legal protection.
- Replaces tachograph.
- Prevents all infringements.
- Fully automated compliance.
- Certified official analysis unless actually certified.

### 19.3 Better Wording

Use:

- Supports.
- Helps track.
- Helps review.
- Designed to assist.
- Provides visibility.
- Flags potential issues.
- Helps prepare records.

---

## 20. Analytics and Conversion Tracking

Add events if analytics exists. If not, prepare hooks or data attributes.

Track:

```txt
hero_join_early_access_click
hero_explore_platform_click
role_tab_selected
feature_tab_selected
early_access_form_started
early_access_form_submitted
early_access_form_error
faq_opened
pricing_cta_click
login_click_from_marketing
```

Do not add invasive tracking without privacy notice.

---

## 21. Accessibility Requirements

1. Use semantic HTML: `header`, `main`, `section`, `footer`.
2. Use one H1.
3. Preserve heading order.
4. Ensure contrast is strong on dark backgrounds.
5. Buttons must have visible focus states.
6. Tabs must be keyboard accessible.
7. Carousels must not trap keyboard users.
8. Images need useful alt text.
9. Do not communicate warning state by colour alone.
10. Avoid tiny pale text for important claims.

Suggested alt text examples:

```txt
HourWise EU mobile app showing driver work and driving timers.
HourWise EU fleet portal dashboard showing driver, vehicle and compliance action cards.
HourWise EU tachograph timeline showing driver activity blocks and summary totals.
```

---

## 22. Performance Requirements

1. Keep hero images compressed.
2. Use modern image formats where practical.
3. Lazy-load lower-page screenshots.
4. Do not import heavy animation libraries for simple effects.
5. Avoid auto-playing video in the hero.
6. Use CSS animations sparingly.
7. Ensure Lighthouse does not flag major layout shifts.
8. Public page should render quickly even on mobile data.

---

## 23. Suggested Build Phases

### Phase 1 — Conversion-First Homepage

- [ ] Replace/upgrade hero with clear product positioning.
- [ ] Add app + portal visual mockup area.
- [ ] Add early access CTA in hero.
- [ ] Add role selector tabs.
- [ ] Add connected workflow strip.
- [ ] Add early access form.
- [ ] Add footer links and compliance disclaimer.

### Phase 2 — SEO and AI Search

- [ ] Update title and meta description.
- [ ] Add Open Graph and Twitter card metadata.
- [ ] Add structured data JSON-LD.
- [ ] Add FAQ content visible on page.
- [ ] Add sitemap/robots review.
- [ ] Add optional `llms.txt`.
- [ ] Make public page crawlable.

### Phase 3 — Visual Polish

- [ ] Add route-grid/tachograph background motif.
- [ ] Replace placeholders with real screenshots.
- [ ] Improve device mockups.
- [ ] Add compact horizontal feature explorer.
- [ ] Polish mobile layout.

### Phase 4 — Dedicated Support Pages

- [ ] Add `/driver-app` page.
- [ ] Add `/fleet-portal` page.
- [ ] Add `/tachograph-analysis` page.
- [ ] Add `/early-access` page if needed.
- [ ] Add `/pricing` when pricing is ready.

### Phase 5 — Trust and Launch Readiness

- [ ] Add founder/story section.
- [ ] Add privacy/GDPR/terms links.
- [ ] Add support/contact email.
- [ ] Add beta status labels.
- [ ] Add analytics events.
- [ ] Test form and lead capture.

---

## 24. Agent Implementation Checklist

The agent should complete this checklist before marking the task done.

### 24.1 Discovery

- [ ] Inspect current public homepage components.
- [ ] Identify current public route entry point.
- [ ] Identify current styling approach.
- [ ] Identify whether Tailwind, CSS modules, plain CSS, or global CSS is used.
- [ ] Identify existing reusable Button/Card components.
- [ ] Identify existing login route and avoid breaking it.

### 24.2 Build

- [ ] Build or refactor marketing header.
- [ ] Build hero with clear H1, subheadline and CTA.
- [ ] Build role tabs.
- [ ] Build connected workflow strip.
- [ ] Build feature explorer tabs.
- [ ] Build screenshot showcase placeholders.
- [ ] Build tachograph/compliance section.
- [ ] Build early access form.
- [ ] Build FAQ.
- [ ] Build footer.

### 24.3 SEO

- [ ] Update document title.
- [ ] Update meta description.
- [ ] Add OG image reference.
- [ ] Add JSON-LD.
- [ ] Add canonical URL.
- [ ] Ensure one H1.
- [ ] Ensure crawlable visible content.

### 24.4 QA

- [ ] Mobile layout at 360px.
- [ ] Tablet layout.
- [ ] Desktop 1440px layout.
- [ ] Keyboard tab order.
- [ ] CTA clicks.
- [ ] Form validation.
- [ ] Form success state.
- [ ] No console errors.
- [ ] No public data leakage.
- [ ] Login still works.

---

## 25. Example Acceptance Criteria

The homepage is acceptable when:

1. A new visitor can explain HourWise EU after reading only the hero.
2. The first screen clearly shows both app and portal.
3. The primary CTA is visible without scrolling on desktop and mobile.
4. The page has a clear early access signup path.
5. Feature content is organised into tabs or compact horizontal modules, not a long feature dump.
6. The page title and meta description include driver app + fleet portal positioning.
7. The page includes visible FAQ answers suitable for search and AI retrieval.
8. The page includes a compliance disclaimer.
9. The page is responsive and accessible.
10. Existing portal login/auth remains unaffected.

---

## 26. Suggested Gemini / Agent Prompt

Use this prompt when handing the task to Gemini, Codex, or another coding agent.

```txt
You are working in the HourWiseEU_Fleet_Portal Vite React repo.

Goal: improve the public homepage/landing screen so visitors immediately understand HourWise EU and are encouraged to join early access / coming soon updates.

Primary product message:
HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams. The driver app tracks work, driving, breaks and POA. The fleet portal helps operators manage shifts, vehicle checks, defects, incidents, expenses, tachograph data, messages, reports and compliance workflows.

Important folders to inspect:
- src/components/marketing
- src/components/public
- src/pages
- src/routes
- src/App.tsx
- src/main.tsx
- src/styles

Do not break existing login/auth/Supabase portal routes.
Keep marketing/public pages separate from authenticated portal views.
Do not expose private Supabase data.
Do not overclaim legal compliance or say HourWise replaces tachographs.

Implement or refactor the homepage with:
1. Sticky marketing header with Product, Driver App, Fleet Portal, Tachograph, Pricing, FAQ, Login and Join early access CTA.
2. Strong hero section with this H1:
   “Driver hours, tachograph insight and fleet compliance — connected in one platform.”
3. Clear subheadline explaining the connected driver app and fleet portal.
4. Right-side app + portal mockup area with placeholder screenshot assets.
5. Role selector tabs: Solo Driver, Fleet Driver, Transport Manager, Compliance/Admin.
6. Connected workflow strip: Driver App → Secure Cloud → Fleet Portal → Reports & Actions.
7. Feature explorer tabs: Hours & Alerts, Tachograph, Checks & Defects, Expenses & Reports, Messaging, Atlas Assistant.
8. Screenshot showcase section with placeholders and clear asset paths under public/marketing/mockups.
9. Tachograph/compliance support section with disclaimer.
10. Early access signup form.
11. Founder/story section.
12. FAQ accordion with direct answers for SEO and AI search.
13. Footer with privacy, terms, contact, login and disclaimer.

SEO requirements:
- Page title: HourWise EU | Driver Hours App & Fleet Compliance Portal
- Meta description: HourWise EU connects a practical driver hours app with a fleet portal for UK/EU transport teams. Track work, driving, breaks, POA, checks, expenses, incidents, tachograph data and compliance workflows.
- One H1 only.
- Add Open Graph and Twitter card metadata.
- Add JSON-LD for Organization, WebSite and SoftwareApplication. Add FAQPage only if FAQ is visible.
- Ensure public homepage is crawlable and not blocked.

Design direction:
- Dark navy command-centre style.
- Blue/cyan/teal highlights.
- Subtle route grid, GPS dots and tachograph rings.
- Professional SaaS layout.
- No generic truck stock photos.
- Clear cards, tabs, metric pills and device mockups.

Responsive/accessibility:
- Mobile 360px+.
- Desktop 1440px.
- Keyboard accessible tabs.
- Visible focus states.
- Strong colour contrast.
- Useful alt text.

Use existing components/styles where possible. If creating new components, keep them reusable and small. Do not rewrite unrelated portal functionality.
```

---

## 27. Future Dedicated Pages

The homepage should be the conversion hub. After this is done, create dedicated pages for SEO depth.

### 27.1 `/driver-app`

Purpose: rank and convert for driver-specific searches.

Focus:

- HGV driver hours app.
- Work, drive, break, POA.
- Alerts.
- Reports.
- Expenses.
- Multi-language.
- Solo drivers and fleet drivers.

### 27.2 `/fleet-portal`

Purpose: rank and convert for operators.

Focus:

- Transport manager dashboard.
- Drivers.
- Vehicles.
- Checks.
- Defects.
- Incidents.
- Expenses.
- Reports.
- Messaging.

### 27.3 `/tachograph-analysis`

Purpose: rank for tachograph-specific intent.

Focus:

- Driver card import.
- Vehicle unit import.
- DDD/C1B/V1B where supported.
- Activity timeline.
- Infringements.
- Legal totals.
- Audit archive.
- Compliance disclaimer.

### 27.4 `/early-access`

Purpose: dedicated conversion page for campaigns, Reddit posts, LinkedIn posts and beta invitations.

Focus:

- Who should sign up.
- What beta users get.
- What feedback is needed.
- Simple form.
- Founder story.

---

## 28. Final Notes for the Agent

This is a conversion and clarity task first, not just a visual refresh.

The homepage should answer:

```txt
What is HourWise EU?
Who is it for?
What problem does it solve?
How do the app and portal connect?
Why should I trust it?
What can I do next?
```

Do not bury those answers below decorative sections.

The best version of the homepage will feel like:

```txt
A professional, early-stage SaaS product built by someone who understands real driver and operator problems.
```

Not:

```txt
A generic AI-generated landing page with lots of feature cards but no clear transport-specific promise.
```

---

## 29. Reference Notes

These references should guide implementation, but do not need to be displayed on the public page.

- Google Search Central: SEO is about helping search engines understand content and helping users decide whether to visit.
- Google recommends structured data as explicit clues about page meaning and generally recommends JSON-LD where possible.
- Google supports `SoftwareApplication` structured data for software app pages.
- OpenAI documents `OAI-SearchBot` for surfacing sites in ChatGPT search features, controlled separately from training-related crawlers.
- Perplexity documents `PerplexityBot` and `Perplexity-User` for search/result surfacing and user-requested access.
- `/llms.txt` is a proposed, optional markdown summary format for LLM-friendly site information. Treat it as experimental, not a replacement for sitemap, robots, visible content, or structured data.
