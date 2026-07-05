# HourWise EU Homepage Addendum — Mock Atlas Chatbot for Coming Soon Landing Page

## Document purpose

This document extends the HourWise EU homepage revamp plan with a low-cost, no-AI first version of an Atlas chatbot for the public coming-soon landing page.

The goal is not to build the full Atlas fleet assistant yet. The goal is to give visitors an interactive way to understand HourWise quickly, ask common questions, request features, and join the early-access/news list.

This should be built as a **controlled marketing chatbot**, not an unrestricted AI chatbot.

---

## Recommended decision

Implement a **mock Atlas homepage assistant** using:

- A local/prestored HourWise knowledge base
- Keyword and intent matching
- Suggested question chips
- Clear fallback responses
- Early-access capture
- Feature request capture
- Optional no-cost external search link fallback
- No OpenAI/Gemini/Claude API in version 1

Do **not** add an AI API to the public landing page yet.

Reason:

- The homepage is public and can be abused by bots.
- A true AI API introduces cost, prompt injection risk, hallucination risk, and compliance/legal risk.
- Most visitor questions will be predictable.
- A scripted assistant is enough to improve engagement and explain the product.
- Feature requests are more valuable at this stage than open-ended AI answers.

---

## Positioning

### Public name

Use:

```txt
Atlas Preview
```

or:

```txt
Ask Atlas
```

Avoid implying this is the full production Atlas assistant.

Suggested label:

```txt
Atlas Preview
A guided assistant for learning about HourWise EU.
```

### Important wording

Make it clear that this is a preview/demo:

```txt
Atlas Preview can answer common questions about HourWise EU and collect feedback. It is not the full fleet compliance assistant yet.
```

---

## Why this helps the homepage

The homepage already needs to explain instantly:

- What HourWise EU is
- What the driver app does
- What the fleet portal does
- How the app and portal work together
- Why operators and drivers should care
- What is coming soon
- How to request early access

The chatbot helps because visitors can ask in their own words instead of scrolling through a long landing page.

It also supports conversion by turning uncertainty into a signup path:

```txt
Visitor asks question → Atlas answers → Atlas suggests early access / feature request / contact
```

---

## Core user journeys

### 1. Visitor wants to know what HourWise is

Example question:

```txt
What is HourWise?
```

Expected response:

```txt
HourWise EU is a connected driver hours app and fleet compliance portal for UK/EU transport operators. The driver app helps track work, driving, breaks and POA, while the fleet portal gives managers visibility over shifts, vehicle checks, expenses, incidents, tachograph data and compliance actions.
```

Suggested follow-up chips:

- Driver app
- Fleet portal
- Tachograph analysis
- Early access

---

### 2. Solo driver wants to know if it is useful for them

Example question:

```txt
Can solo drivers use it?
```

Expected response:

```txt
Yes. Solo drivers can use the HourWise app to track shifts, work time, driving time, breaks and POA, receive reminders before limits, record expenses and generate daily or weekly reports. The fleet portal is optional for operators and teams.
```

Suggested follow-up chips:

- App features
- Pricing
- Reports
- Join early access

---

### 3. Fleet manager wants to know what the portal does

Example question:

```txt
What does the fleet portal do?
```

Expected response:

```txt
The fleet portal is designed as a transport control centre. It helps managers view drivers, vehicles, shifts, daily checks, defects, expenses, incidents, tachograph uploads, reports and compliance reminders in one place.
```

Suggested follow-up chips:

- Vehicle checks
- Driver records
- Tachograph files
- Atlas assistant

---

### 4. Visitor asks about tachograph files

Example question:

```txt
Can it read driver cards?
```

Expected response:

```txt
The portal is being built to support driver card and vehicle unit file import and analysis where compatible data is available, including clear timelines, legal totals, events, infringements and reports. HourWise is a compliance support tool and does not replace legally required tachograph equipment or operator responsibility.
```

Suggested follow-up chips:

- Driver card view
- Vehicle unit files
- Compliance disclaimer
- Early access

---

### 5. Visitor asks for pricing

Example question:

```txt
How much will it cost?
```

Expected response:

```txt
Initial pricing is expected to be simple and affordable: the solo driver app is planned around £2.99/month, the fleet portal from around £19.99/month, and fleet-connected drivers around £2.99 per driver/month. Pricing may change during beta and early access.
```

Suggested follow-up chips:

- Solo driver
- Fleet pricing
- Early access
- Beta testing

---

### 6. Visitor asks for a feature that is not built yet

Example question:

```txt
Will it support GPS tracking?
```

Expected response:

```txt
GPS and location-related workflows are being considered carefully. Driver privacy, company devices, consent and operator use cases all matter. If this is important for your fleet, you can leave a feature request and we can prioritise it during development.
```

Suggested follow-up chips:

- Suggest feature
- Company phones
- Fleet portal
- Contact

---

### 7. Atlas does not know the answer

Expected response:

```txt
I do not have a confirmed answer for that yet. You can leave the question for the HourWise team, request early access, or search the HourWise site for related information.
```

Suggested actions:

- Leave a question
- Request early access
- Suggest a feature
- Search HourWise site

---

## What Atlas should be allowed to answer

Atlas Preview can answer questions about:

- What HourWise EU is
- Driver app features
- Fleet portal features
- Tachograph analysis plans
- Vehicle checks
- Defects and incidents
- Expenses and receipts
- Payroll/reporting support
- Atlas future assistant concept
- UK/EU focus
- Solo driver use
- Fleet driver use
- Early access
- Beta testing
- Pricing expectations
- Planned features
- Compliance disclaimer
- Data/privacy at a high level
- How to contact HourWise
- How to request a feature

---

## What Atlas should not do

Atlas Preview must not:

- Give legal advice
- Claim DVSA approval or certification
- Claim to replace a tachograph
- Claim the product is fully launched if it is still coming soon/beta
- Invent features that are not planned
- Give exact compliance rulings for real operational scenarios
- Analyse real tachograph data on the public homepage
- Ask for sensitive personal data
- Store unnecessary personal details
- Use a paid AI API in version 1
- Run unrestricted web searches from the client
- Expose Supabase keys beyond normal public anon usage with Row Level Security

---

## Recommended UI placement

### Desktop

Add a floating widget in the bottom-right corner:

```txt
[ Ask Atlas ]
```

When opened:

```txt
┌──────────────────────────────────────┐
│ Atlas Preview                         │
│ Ask about the app, portal or beta.    │
├──────────────────────────────────────┤
│ Atlas: Hi, I’m Atlas Preview. I can   │
│ answer common questions about         │
│ HourWise EU.                          │
│                                      │
│ Chips:                               │
│ [What is HourWise?] [Driver app]      │
│ [Fleet portal] [Tachograph]           │
│ [Pricing] [Early access]              │
│                                      │
│ User input...                         │
└──────────────────────────────────────┘
```

### Mobile

Use a bottom pill button:

```txt
Ask Atlas
```

When opened:

- Full-height bottom sheet
- Max 85% viewport height
- Close button top-right
- Input fixed at bottom
- Suggested chips horizontally scrollable

---

## Homepage section integration

Add a visible Atlas teaser near the hero or early-access section.

Suggested block:

```txt
Not sure where to start?
Ask Atlas Preview what HourWise can do for drivers, fleets and transport managers.
```

CTA:

```txt
Ask Atlas
```

This should open the same chat widget.

---

## Visual style

Atlas should match the dark fleet command centre style from the homepage revamp.

Recommended design:

- Dark navy panel
- Subtle teal/blue glow
- Small circular Atlas icon
- Sparkles or route-ring icon
- Rounded chat bubbles
- Clear distinction between user and Atlas messages
- “Preview” badge
- No cartoon robot
- No generic AI stock image

Suggested icon:

- Lucide `Sparkles`
- Lucide `MessageCircle`
- Lucide `BotMessageSquare`
- Or HourWise tachograph-ring icon with a small spark

---

## Data structure

Create a local knowledge base file:

```txt
src/components/marketing/atlas/atlasKnowledge.ts
```

Example shape:

```ts
export type AtlasIntent = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  followUps?: string[];
  cta?: {
    label: string;
    action: 'earlyAccess' | 'featureRequest' | 'contact' | 'search';
  };
};

export const atlasKnowledge: AtlasIntent[] = [
  {
    id: 'what-is-hourwise',
    title: 'What is HourWise EU?',
    keywords: ['what is hourwise', 'what do you do', 'what is this', 'hourwise eu', 'overview'],
    answer:
      'HourWise EU is a connected driver hours app and fleet compliance portal for UK/EU transport. The app helps drivers track work, driving, breaks and POA, while the portal helps operators manage shifts, checks, expenses, incidents, tachograph data and compliance actions.',
    followUps: ['Driver app', 'Fleet portal', 'Tachograph analysis', 'Early access'],
    cta: { label: 'Request early access', action: 'earlyAccess' },
  },
];
```

---

## Matching logic

Create:

```txt
src/components/marketing/atlas/atlasMatcher.ts
```

Version 1 matching should be simple and transparent.

Recommended process:

1. Lowercase query
2. Remove punctuation
3. Check exact phrase matches
4. Check keyword matches
5. Score intents by number of keyword hits
6. Return the best answer above threshold
7. If no match, return fallback

Pseudo-code:

```ts
export function findAtlasAnswer(query: string) {
  const normalised = normalise(query);

  const scored = atlasKnowledge.map((intent) => {
    const score = intent.keywords.reduce((total, keyword) => {
      return normalised.includes(normalise(keyword)) ? total + keyword.length : total;
    }, 0);

    return { intent, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 6) {
    return fallbackAnswer(query);
  }

  return best.intent;
}
```

Optional enhancement:

- Add synonym groups
- Add fuzzy matching later
- Add analytics for unknown queries

---

## Suggested starter knowledge base

Include these intents in version 1:

1. What is HourWise?
2. Who is HourWise for?
3. Driver app overview
4. Solo driver features
5. Fleet driver features
6. Fleet portal overview
7. Tachograph analysis
8. Driver card files
9. Vehicle unit files
10. Vehicle checks
11. Defects and incidents
12. Expenses and receipts
13. Payroll/reporting
14. Atlas future assistant
15. Pricing
16. Early access
17. Beta testing
18. UK/EU support
19. 2.5t–3.5t vehicle future planning
20. Data/privacy overview
21. Is HourWise a tachograph replacement?
22. Can I suggest a feature?
23. Can I speak to the founder/team?
24. What is coming next?

---

## Fallback handling

When Atlas does not know, do not pretend.

Fallback response:

```txt
I do not have a confirmed answer for that yet. HourWise is still being shaped, so this would be useful feedback. Would you like to leave this as a question or feature request?
```

Fallback actions:

```txt
[Leave question]
[Suggest feature]
[Request early access]
[Search HourWise site]
```

---

## Feature request capture

Add a mode where a user can submit:

- Name, optional
- Email, optional but recommended
- Role: Driver / Fleet manager / Owner / Compliance / Other
- Fleet size, optional
- Feature request or question
- Consent checkbox

Suggested wording:

```txt
Tell us what you would like HourWise to support. The best feature ideas will help shape the app and portal before launch.
```

Required privacy note:

```txt
By submitting this, you agree that HourWise may use your message to improve the product and may contact you if you provide an email address.
```

---

## Suggested Supabase table

If the project already has an early-access table, extend it instead of creating a duplicate.

Otherwise create:

```sql
create table if not exists public.public_atlas_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  role text,
  fleet_size text,
  message_type text not null check (message_type in ('question', 'feature_request', 'early_access_interest', 'unknown_query')),
  question text,
  atlas_matched_intent text,
  page_path text,
  user_agent text,
  consent_contact boolean not null default false
);
```

### Row Level Security

Enable RLS.

Allow anonymous inserts only.

Do not allow anonymous reads.

Example policy:

```sql
alter table public.public_atlas_feedback enable row level security;

create policy "Public can submit Atlas feedback"
on public.public_atlas_feedback
for insert
to anon
with check (true);
```

Do not expose feedback entries publicly.

---

## Search fallback options

### Recommended version 1: no API, no cost

Do not perform actual automated Google searches from the chatbot.

Instead provide a search link that opens a new tab.

Example:

```ts
const query = encodeURIComponent(`site:hourwiseeu.co.uk ${userQuery}`);
const url = `https://www.google.com/search?q=${query}`;
```

Label:

```txt
Search the HourWise site
```

This avoids API keys, cost, scraping problems and backend complexity.

### Version 2: site search page

Create a simple local `/search` page that searches static HourWise content/FAQ text.

This can use the same knowledge base and homepage content.

### Version 3: paid/managed search

Only consider paid search later if the site has enough content to search.

Do not rely on Google Custom Search JSON API for a new project without checking availability, because the JSON API is closed to new customers and existing customers have a transition deadline.

---

## Should we use an AI API?

Not for version 1.

Possible future option:

- Add a very small model behind a serverless endpoint
- Use strict rate limits
- Use a fixed HourWise knowledge base as context
- Do not let the model browse the web
- Do not answer legal/compliance edge cases
- Capture unanswered questions for manual review

If an AI API is used later, it must be protected by:

- Server-side API key only
- No API key in frontend code
- Rate limiting by IP/session
- Captcha or turnstile after repeated use
- Daily/monthly spend limit
- Max token limit
- Prompt injection guardrails
- Fallback to contact form for sensitive/legal questions

But for now, the no-AI mock Atlas is cheaper, safer and better aligned with the coming-soon goal.

---

## Recommended component structure

```txt
src/components/marketing/atlas/
  AtlasChatWidget.tsx
  AtlasLauncher.tsx
  AtlasChatPanel.tsx
  AtlasMessageBubble.tsx
  AtlasSuggestionChips.tsx
  AtlasFeedbackForm.tsx
  atlasKnowledge.ts
  atlasMatcher.ts
  atlasTypes.ts
```

Optional styles:

```txt
src/components/marketing/atlas/atlas.css
```

Or use existing styling system if the project already has one.

---

## Suggested chatbot states

```ts
type AtlasMode =
  | 'intro'
  | 'chat'
  | 'collectingFeatureRequest'
  | 'collectingQuestion'
  | 'collectingEarlyAccess'
  | 'submitted';
```

Message shape:

```ts
type AtlasMessage = {
  id: string;
  role: 'atlas' | 'user' | 'system';
  text: string;
  createdAt: string;
  intentId?: string;
};
```

---

## Suggested initial welcome message

```txt
Hi, I’m Atlas Preview. I can answer common questions about HourWise EU, the driver app, the fleet portal, tachograph analysis and early access. What would you like to know?
```

Initial chips:

- What is HourWise?
- Driver app
- Fleet portal
- Tachograph analysis
- Pricing
- Early access
- Suggest a feature

---

## Suggested answers for common questions

### What is HourWise?

```txt
HourWise EU is a connected driver hours app and fleet compliance portal for UK/EU transport. The app helps drivers track work, driving, breaks and POA. The portal helps operators manage drivers, vehicles, checks, defects, expenses, incidents, tachograph data and compliance actions.
```

### What does the driver app do?

```txt
The driver app is designed to help professional drivers track shifts, work time, driving time, breaks and POA, with alerts before key limits. It can also support daily reports, expenses, pay estimates, calendar history and fleet-connected workflows.
```

### What does the fleet portal do?

```txt
The fleet portal gives managers a clearer view of drivers, vehicles and daily compliance workflows. It is being built to support driver records, vehicle checks, defects, incidents, expenses, reports, tachograph analysis and reminders.
```

### Can it analyse tachograph files?

```txt
The portal is being built to support driver card and vehicle unit file import and analysis where compatible files are available. The aim is to show clear activity timelines, totals, events, infringements and exportable reports. HourWise supports compliance review but does not replace legal tachograph equipment or operator responsibility.
```

### Is HourWise live?

```txt
HourWise is currently being prepared for launch and early access. The driver app and fleet portal are being developed together so early users can help shape the product before full release.
```

### How do I get access?

```txt
You can request early access from the homepage. We are especially interested in feedback from solo drivers, small fleets, transport managers and compliance professionals.
```

### Can I suggest a feature?

```txt
Yes. Feature requests are very welcome during this stage. Tell us what you need, what type of fleet or driver workflow it supports, and how important it is for your operation.
```

### Is this legal advice?

```txt
No. HourWise is a support, tracking and reporting tool. It does not provide legal advice, replace tachograph equipment, replace official records or remove operator responsibility.
```

---

## Analytics and insight

The chatbot should help product discovery.

Track locally or via Supabase:

- Most clicked suggested questions
- Unknown questions
- Feature requests
- Early access clicks from Atlas
- Conversion path from Atlas to signup

Avoid excessive tracking or invasive analytics.

Useful metrics:

```txt
atlas_opened
atlas_question_asked
atlas_answer_matched
atlas_fallback_triggered
atlas_feature_request_started
atlas_feature_request_submitted
atlas_early_access_clicked
```

---

## SEO and AI search considerations

Do not hide all important homepage information inside the chatbot.

Search engines and AI crawlers need visible page content.

The chatbot should supplement the page, not replace it.

Keep these visible in normal HTML:

- Main product description
- Driver app section
- Fleet portal section
- Tachograph analysis section
- Pricing/early-access section
- FAQ section
- Compliance disclaimer

Optional but recommended:

- Reuse chatbot Q&A content inside a normal FAQ section
- Add FAQPage JSON-LD for public Q&A
- Add `/llms.txt` summarising HourWise for AI search tools
- Keep robots.txt friendly to normal search crawlers

---

## Accessibility requirements

Atlas must be keyboard accessible.

Requirements:

- Launcher button has `aria-label="Open Atlas Preview"`
- Chat panel has `role="dialog"`
- Close button has `aria-label="Close Atlas Preview"`
- Focus moves into chat when opened
- Escape closes the panel
- Screen reader text identifies Preview status
- Messages are readable without relying on colour alone
- Input has visible label
- Suggested chips are buttons, not divs
- Respect reduced-motion preference

---

## Mobile requirements

On mobile:

- Do not cover the early-access CTA permanently
- Chat opens as bottom sheet
- Input must stay visible above keyboard
- Suggested chips should horizontally scroll
- Panel should not feel cramped
- Close button must be easy to tap

---

## Security and abuse guardrails

Even without an AI API, the feedback form needs protection.

Implement:

- Basic honeypot field
- Rate limiting if using serverless function
- Supabase RLS insert-only policy
- Do not expose private data
- Sanitize displayed user text
- Limit message length
- Do not render submitted HTML
- Optional Cloudflare Turnstile later

Suggested limits:

```txt
Question length: 300 chars
Feature request length: 1000 chars
Name length: 100 chars
Email length: 254 chars
```

---

## Implementation phases

### Phase 1 — Static Atlas Preview

- Build launcher button
- Build chat panel
- Add knowledge base
- Add matcher
- Add suggested chips
- Add fallback response
- No database writes yet

### Phase 2 — Signup and feature capture

- Connect early-access CTA
- Add feature request form
- Add unknown question capture
- Store submissions in Supabase or existing contact flow
- Add privacy/consent wording

### Phase 3 — Homepage integration

- Add Atlas teaser near hero
- Add Atlas CTA in early-access section
- Add FAQ content reused from knowledge base
- Add analytics events if available

### Phase 4 — Optional site search fallback

- Add external Google search link only
- Or build local `/search` over static HourWise FAQ/content
- Do not add paid search API yet

### Phase 5 — Future AI upgrade, if needed

- Add server-side protected endpoint
- Add small-model API only after traffic and use cases justify it
- Keep scripted fallback for cost control
- Add strict spending and rate limits

---

## Acceptance criteria

Atlas Preview is complete when:

- Visitor can open and close it on desktop and mobile
- It answers the top 20–25 HourWise questions from a local knowledge base
- It clearly says when it does not know
- It can route users to early access, feature request or contact
- It does not use an AI API
- It does not expose sensitive data
- It does not break login/auth routes
- It does not hide SEO-critical content from the normal page
- It is accessible by keyboard
- It looks consistent with the HourWise dark command-centre design
- It reinforces HourWise as app + portal + tachograph/compliance workflow, not just a generic fleet dashboard

---

## Agent implementation prompt

Use this prompt for Gemini, Codex or another coding agent:

```txt
You are working in the HourWiseEU_Fleet_Portal Vite React project.

Implement a public homepage-only Atlas Preview chatbot for the coming-soon landing page.

Important context:
- HourWise EU is a UK/EU driver hours app and fleet compliance portal.
- The driver app tracks work, driving, breaks and POA and supports reports, alerts, expenses and fleet-connected workflows.
- The fleet portal supports drivers, vehicles, checks, defects, incidents, expenses, tachograph analysis, reports and compliance reminders.
- Atlas is the planned future assistant, but this public chatbot must be a controlled preview, not a real AI assistant.

Requirements:
1. Create a no-AI Atlas Preview chatbot using a local knowledge base and simple keyword/intent matching.
2. Do not add OpenAI, Gemini, Claude or any paid AI API.
3. Do not expose any private Supabase data.
4. Keep it limited to public marketing pages only.
5. Keep authenticated portal routes and login flows unchanged.
6. Add suggested question chips.
7. Add fallback responses that offer early access, feature request, contact or site-search actions.
8. Add optional feature request capture if an existing public contact/early-access flow exists. If not, build the UI but isolate persistence behind a clearly named function.
9. Make the widget responsive and accessible.
10. Match the HourWise dark navy/teal SaaS visual style.
11. Reuse existing components/styles where appropriate.
12. Do not overpromise: clearly label this as Atlas Preview.
13. Include compliance disclaimer for tachograph/legal questions.
14. Ensure SEO-critical FAQ/product content remains visible on the page outside the chatbot.

Suggested files:
- src/components/marketing/atlas/AtlasChatWidget.tsx
- src/components/marketing/atlas/AtlasLauncher.tsx
- src/components/marketing/atlas/AtlasChatPanel.tsx
- src/components/marketing/atlas/AtlasMessageBubble.tsx
- src/components/marketing/atlas/AtlasSuggestionChips.tsx
- src/components/marketing/atlas/AtlasFeedbackForm.tsx
- src/components/marketing/atlas/atlasKnowledge.ts
- src/components/marketing/atlas/atlasMatcher.ts
- src/components/marketing/atlas/atlasTypes.ts

Build the simplest robust version first. Do not refactor unrelated portal code. After implementation, provide a summary of changed files, how matching works, and how to add new Q&A entries.
```

---

## Final recommendation

Build Atlas Preview now as part of the homepage revamp.

It gives the landing page a more memorable product feel, introduces the Atlas brand early, helps visitors understand HourWise faster, and captures feature requests without any AI cost.

Treat it as a conversion and product-discovery tool first.

Do not connect a paid AI model until the homepage has real traffic and the unknown-question data proves there is a need.
