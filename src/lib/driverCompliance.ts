export type DriverDocumentComplianceState =
  | 'missing'
  | 'unverified'
  | 'expired'
  | 'expiring'
  | 'verified_valid'
  | 'expiry_unknown';

export interface DriverComplianceDocument {
  expiry_date: string | null;
  verified_at: string | null;
}

export interface DriverDocumentComplianceResult {
  state: DriverDocumentComplianceState;
  daysUntilExpiry: number | null;
}

export function evaluateDriverDocumentCompliance(
  documents: DriverComplianceDocument[],
  today = new Date()
): DriverDocumentComplianceResult {
  if (documents.length === 0) {
    return { state: 'missing', daysUntilExpiry: null };
  }

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const expiryDays = documents
    .map((document) => {
      if (!document.expiry_date) return null;
      // Persisted expiry values are calendar dates. Parse them in local time
      // so DST does not turn yesterday into a zero-day difference.
      const expiryDate = document.expiry_date.slice(0, 10);
      const expiry = new Date(`${expiryDate}T00:00:00`);
      return Math.ceil((expiry.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
    })
    .filter((days): days is number => days !== null);

  const mostUrgentExpiry = expiryDays.length > 0 ? Math.min(...expiryDays) : null;
  if (mostUrgentExpiry !== null && mostUrgentExpiry < 0) {
    return { state: 'expired', daysUntilExpiry: mostUrgentExpiry };
  }

  if (documents.some((document) => !document.verified_at)) {
    return { state: 'unverified', daysUntilExpiry: mostUrgentExpiry };
  }

  if (mostUrgentExpiry === null) {
    return { state: 'expiry_unknown', daysUntilExpiry: null };
  }

  if (mostUrgentExpiry <= 30) {
    return { state: 'expiring', daysUntilExpiry: mostUrgentExpiry };
  }

  return { state: 'verified_valid', daysUntilExpiry: mostUrgentExpiry };
}
