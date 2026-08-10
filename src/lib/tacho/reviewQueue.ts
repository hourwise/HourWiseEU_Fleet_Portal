export type PersistedReviewStatus = 'open' | 'reviewed' | 'action_required' | 'closed';

export interface PersistedReviewQueueRow {
  findingId: string;
  driverId: string | null;
  driverName?: string | null;
  status: PersistedReviewStatus;
  driverAcknowledgedAt: string | null;
}

export interface PersistedReviewQueueItem {
  driverId: string;
  driverName: string;
  openCount: number;
  actionRequiredCount: number;
  reviewedCount: number;
  closedCount: number;
  acknowledgedCount: number;
  totalCount: number;
}

export function buildPersistedTachoReviewQueue(
  reviews: PersistedReviewQueueRow[]
): PersistedReviewQueueItem[] {
  const byDriver = new Map<string, PersistedReviewQueueItem>();

  for (const review of reviews) {
    if (!review.driverId) continue;
    const existing = byDriver.get(review.driverId) ?? {
      driverId: review.driverId,
      driverName: review.driverName || 'Unknown driver',
      openCount: 0,
      actionRequiredCount: 0,
      reviewedCount: 0,
      closedCount: 0,
      acknowledgedCount: 0,
      totalCount: 0,
    };

    existing.driverName = existing.driverName === 'Unknown driver'
      ? review.driverName || existing.driverName
      : existing.driverName;
    existing.totalCount += 1;
    if (review.driverAcknowledgedAt) existing.acknowledgedCount += 1;
    if (review.status === 'open') existing.openCount += 1;
    if (review.status === 'action_required') existing.actionRequiredCount += 1;
    if (review.status === 'reviewed') existing.reviewedCount += 1;
    if (review.status === 'closed') existing.closedCount += 1;
    byDriver.set(review.driverId, existing);
  }

  return [...byDriver.values()]
    .filter((item) => item.openCount + item.actionRequiredCount > 0)
    .sort((left, right) => {
      const actionableDifference =
        (right.openCount + right.actionRequiredCount) -
        (left.openCount + left.actionRequiredCount);
      return actionableDifference || right.totalCount - left.totalCount || left.driverName.localeCompare(right.driverName);
    });
}
