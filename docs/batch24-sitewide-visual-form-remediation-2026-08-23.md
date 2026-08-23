# Batch 24 — Site-wide visual and form-control remediation

Date: 2026-08-23

Scope: frontend visual foundation only

Starting revision: `7d362ae0d4c11047208b1aeda437db73cacb501f` on `main`

Database changes: none

## Outcome

The missing shared control contract is restored in `src/index.css`. The `.input` class used by the planning and job workflows now has an explicit dark-theme implementation, and a zero-specificity native-control safety net protects legacy screens that use bespoke or incomplete utility sets. Local light-theme classes continue to override the fallback.

The remediation covers text, email, password, search, number, date, time, datetime-local, select and textarea rendering; keyboard focus; hover; disabled; read-only; invalid; success; autofill; checkbox/radio accents; native date/time dark mode; and native select option colours.

## Inventory and root cause

A source inventory of all TSX files found:

| Measure | Result |
| --- | ---: |
| Files containing native controls | 50 |
| Total `input`, `select`, and `textarea` elements | 271 |
| Controls already using the intended `.input` contract | 40 |
| Controls relying on fragmented/local approaches | 231 |
| Authored `<label>` elements | 202 |

Distinct approaches found:

1. `.input` on Batch 23 planning and job controls, with no matching CSS definition.
2. Bespoke dark Tailwind utilities such as `bg-brand-dark`, `border-brand-border`, and `text-white`.
3. Intentional light surfaces, especially signup and several white manager modals, using `bg-white` and `text-gray-*`.
4. Minimally styled native controls whose foreground inherited from the dark page while their UA background could remain white.
5. Placeholder-only compact inputs in high-density planning drawers.

The cascade failure was therefore deterministic: `body` supplied light text, `.input` supplied no rules at all, and browser-native backgrounds/popovers were free to choose a light surface. The result was white-on-white or near-white-on-white controls and inconsistent native dropdowns.

## Shared foundation

Semantic tokens were added for control surface, hover surface, disabled/read-only surfaces, border, hover border, text, muted text, placeholder, focus, error, success, and option-popover surface.

The implementation has two layers:

- A low-specificity `:where(...)` baseline supplies safe foreground/background/border colours and `color-scheme: dark` to native controls. Because its specificity is zero, existing utility-class designs—including the light signup form—win without `!important` or selector escalation.
- `.input`, `.hw-input`, `.hw-select`, and `.hw-textarea` define the reusable authored contract for dimensions, typography, spacing, border, surface, caret, focus, hover, disabled, read-only, invalid, success, and autofill states.

Native `<option>` surfaces receive explicit dark background and light text. WebKit autofill receives an inset surface fill and explicit text/caret colours. Checkbox/radio instances using the shared contract retain compact dimensions and use the focus token as their accent.

No global `color-scheme` was applied to the document, avoiding collateral changes to intentionally light pages.

## Contrast evidence

Calculated WCAG contrast ratios against the primary control surface `#0D1B2E`:

| Token / use | Colour | Ratio |
| --- | --- | ---: |
| Primary text | `#F8FAFC` | 16.54:1 |
| Placeholder | `#94A3B8` | 6.75:1 |
| Focus | `#38BDF8` | 8.08:1 |
| Error | `#F87171` | 6.26:1 |
| Success | `#4ADE80` | 9.93:1 |

These exceed 4.5:1 for normal text. The focus ring also exceeds the non-text contrast target against the control surface.

## High-use workflow remediation

The Rota Planning Workspace retains visible labels for:

- leave driver, availability type, start/end dates, and notes;
- job reference, title, customer, address/location, and job type;
- run date, name, start/end time, and staffing requirement;
- staffing-pattern name and cycle length.

The dark login and password-reset controls now opt into the shared contract so browser autofill uses the same readable surface, text, and caret treatment. The intentionally light signup form remains locally styled and is not forced into dark mode.

The dense staffing requirement matrix now has persistent desktop headings for cycle day, role, start, finish, and people. Each repeated compact control also has an accessible name for mobile layouts where the heading row is hidden.

## Regression protection

`src/lib/batch24VisualFoundation.test.ts` protects:

- the semantic token and shared-class contract;
- the zero-specificity legacy fallback;
- interaction, disabled, read-only, invalid, success, autofill, and option-popup selectors;
- persistent and accessible labels in the dense planning flows.

The test is included in `npm run test:rules`.

## Visual acceptance

VISUAL ACCEPTANCE BLOCKED — AUTHENTICATED BROWSER ENVIRONMENT.

Browser discovery returned no in-app or connected browser sessions. Therefore no authenticated screenshots, viewport checks, or native opened-select popup screenshots are claimed. This is an environment limitation, not a passing visual result.

Required manual follow-up when an authenticated browser is available:

1. Desktop and narrow/mobile screenshots for login, signup, rota toolbar, vacancy drawer, leave drawer, job drawer, run drawer, staffing-pattern drawer, profile/settings form, job/dispatch screen, vehicle screen, and one error/disabled state.
2. Open a representative select on Windows/Chromium and verify option background, option text, selected value, hover/highlight, and disabled option contrast.
3. Verify text, email, password, search, number, date, time, datetime-local, select, and textarea controls at rest, hover, keyboard focus, disabled, read-only, invalid, and autofilled states.
4. Confirm screenshots contain no personal or operationally sensitive data before retaining them.

## Validation record

Focused validation completed before the full suite:

- Batch 24 contract test: 1 file, 5 tests passed.
- TypeScript typecheck: passed.
- Production build: compilation reached 2,584 transformed modules; the full build is rerun in the final validation suite below.

Final validation:

- `npm test`: passed, 64 files and 388 tests.
- `npm run test:rules`: passed, 57 files and 346 tests; the Batch 24 contract is included.
- `npm run typecheck`: passed.
- `npm run build`: passed, 2,584 modules transformed and production output emitted in 59.96 seconds. Existing chunk-size and mixed static/dynamic import warnings remain informational.
- Scoped ESLint on `LoginForm.tsx`, `RotaPlanningWorkspace.tsx`, and `batch24VisualFoundation.test.ts`: passed with no diagnostics.
- `npm run lint`: existing repository baseline remains red with 103 errors and 7 warnings in unrelated legacy auth, tachograph, PDF, compliance, hook, OCR, and edge-function files. No Batch 24 file appears in the diagnostic list.
