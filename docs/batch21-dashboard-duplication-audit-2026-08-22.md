# Batch 21 dashboard duplication audit — 2026-08-22

## Scope and starting point

The audit started from sealed Batch 20 `9f890170166d38f1457b0c5c13a46708e6c1689d`. It reviewed the manager dashboard composition, the Atlas briefing projection, the operational task queue, compliance summaries, POD review, proposal review, and unified timeline. This was a presentation/data-source audit only; no production rows were deleted or rewritten.

## Findings

| Existing surface | Canonical source or role | Batch 21 decision |
| --- | --- | --- |
| `AtlasOperationsBriefing` | `fetchAtlasOperationsBriefing`, which deduplicates persisted Portal signals into Yesterday / Today / Tomorrow / Next 30 Days | Keep as the Atlas Overview source-linked view; do not mount it in the dashboard right rail. |
| `ManagerOperationalTaskQueue` | Operational task projections and handling state | Move to Atlas → Tasks. The dashboard uses only the compact Atlas summary, preventing task and briefing cards from repeating the same signal. |
| `AssetReadinessPanel` and fleet forecast | Vehicle/trailer evidence, defects, annual-test/compliance dates, and assignment planning state | Move to Atlas → Compliance. Keep the existing authoritative readiness rules and hard blocks. |
| `DriverComplianceForecastPanel` | Existing profile licence/CPC dates and driver document evidence | Move to Atlas → Compliance. Preserve missing/expiry/future-planning distinctions. |
| POD review queue and reconciliation health | Governed evidence review and reconciliation RPCs | Move to Atlas → Operations. No evidence upload or review action changes lifecycle completion. |
| Proposal workbench | Governed manager proposal/revalidation/apply flow | Move to Atlas → Proposals. It is not a dashboard summary and retains explicit review boundaries. |
| Unified timeline | Bounded read model over event, task, POD, compliance, proposal, and security sources | Move to Atlas → History. It remains a read model, not a second event history. |
| Existing compliance snapshots and notifications | Compact domain summaries and manager message feed | Retain on Dashboard as summary/navigation surfaces. They do not replace the canonical Atlas attention queue. |
| “AI Assistant / Beta” card and hard-coded training alert card | No authoritative Portal loader; fixed copy and counts | Removed from the normal production dashboard. Atlas copy now states Portal-state-only deterministic behavior. |

## Resulting hierarchy

The dashboard is now a compact landing view: compliance snapshots, driver risk summary, manager notifications, broadcast messaging, and one Atlas attention summary. Full operational queues are progressively disclosed under the dedicated Atlas workspace. The summary shows critical, high-attention, and upcoming counts plus a small source-linked sample; it does not create a second queue or invent counts.

## Data and privacy notes

Atlas navigation continues to resolve to existing company-scoped workspaces. Operational detail stays behind current manager authorization and server-side company scope. The summary intentionally omits evidence storage paths, private notes, licence numbers, and other restricted fields.
