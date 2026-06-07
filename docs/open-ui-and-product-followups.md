# Open UI And Product Follow-Ups

This file tracks known UI, UX, routing, and product follow-up work that should be addressed outside the current tachograph implementation flow.

## Current items

### Dashboard routing / refresh behavior

- Problem:
  - refreshing the page while inside any manager sub-screen resets the view back to the default `ManagerDashboard` landing state
  - browser back/forward does not restore internal dashboard workspace/tab state
- Current cause:
  - manager navigation state is held only in React component state inside `src/components/manager/ManagerDashboard.tsx`
  - the URL stays at `/dashboard`, so refresh and browser history cannot restore the deeper view
- Recommended fix:
  - move manager workspace and sub-section state into the URL
  - minimum viable approach: query-param backed state on `/dashboard`
  - stronger long-term approach: nested dashboard routes
- Priority:
  - high UX issue
  - deferred for now so tachograph work can continue

## Notes

- Add new bugs, friction points, and deferred improvements here as they come up.
- Keep tachograph delivery moving unless an issue blocks testing or core workflows.
