import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a standard font for a professional look
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/font-nosvg/helvetica.ttf' },
    { src: 'https://cdn.jsdelivr.net/font-nosvg/helvetica-bold.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#F1F5F9',
    padding: 6,
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
    alignItems: 'center',
  },
  label: {
    width: 150,
    fontWeight: 'bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    color: '#0F172A',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingVertical: 4,
  },
  tableCell: {
    padding: 4,
  },
  tableCellBold: {
    padding: 4,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#94A3B8',
    fontSize: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  badgeGreen: { backgroundColor: '#DCFCE7', color: '#166534' },
  badgeRed: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  evidenceNote: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
    fontSize: 8,
    color: '#475569',
  },
});

interface CompliancePackProps {
  data: {
    driver: any;
    sessions: any[];
    training: any[];
    infringements: any[];
    checks: any[];
    tacho?: {
      downloads: any[];
      imports: any[];
      daySummaries: any[];
      findings: any[];
      reconciliation: any[];
      totals: {
        downloadCount: number;
        importCount: number;
        activeImportCount: number;
        dayCount: number;
        drivingMins: number;
        workMins: number;
        poaMins: number;
        restMins: number;
        findingCount: number;
        criticalFindingCount: number;
        unreviewedFindingCount: number;
        reconciliationIssueCount: number;
      };
    };
    generatedAt: string;
    companyName?: string;
  };
}

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB');
};

const formatHours = (minutes?: number | null) => `${((minutes || 0) / 60).toFixed(2)}h`;

const labelize = (value?: string | null) => (value || 'N/A').replace(/_/g, ' ').toUpperCase();

export const CompliancePackPDF = ({ data }: CompliancePackProps) => {
  const { driver, sessions, training, infringements, checks, tacho, generatedAt, companyName } = data;
  const tachoTotals = tacho?.totals;

  return (
    <Document>
      {/* PAGE 1: COVER & PROFILE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Compliance Evidence Pack</Text>
            <Text style={styles.subtitle}>{companyName || 'Fleet Portal'} • Internal Audit Document</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#94A3B8' }}>Generated: {generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Driver Profile Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Full Name:</Text>
            <Text style={styles.value}>{driver.full_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payroll Number:</Text>
            <Text style={styles.value}>{driver.payroll_number || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>NI Number:</Text>
            <Text style={styles.value}>{driver.national_insurance_number || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>{driver.date_of_birth || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Qualification Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Driving Licence No:</Text>
            <Text style={styles.value}>{driver.driving_licence_number || 'MISSING'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Licence Expiry:</Text>
            <Text style={styles.value}>{driver.driving_licence_expiry || 'MISSING'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CPC / DQC Card No:</Text>
            <Text style={styles.value}>{driver.cpc_dqc_number || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CPC Expiry Date:</Text>
            <Text style={styles.value}>{driver.cpc_dqc_expiry || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Training & Professional Dev</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { width: '20%' }]}>Date</Text>
            <Text style={[styles.tableCellBold, { width: '50%' }]}>Module/Title</Text>
            <Text style={[styles.tableCellBold, { width: '15%' }]}>Hours</Text>
            <Text style={[styles.tableCellBold, { width: '15%' }]}>Status</Text>
          </View>
          {training.length > 0 ? training.slice(0, 10).map((t, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.tableCell, { width: '20%' }]}>{new Date(t.completed_at || t.assigned_at).toLocaleDateString()}</Text>
              <Text style={[styles.tableCell, { width: '50%' }]}>{t.title}</Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>{t.hours_credited || 0}</Text>
              <Text style={[styles.tableCell, { width: '15%', textTransform: 'uppercase', fontSize: 8 }]}>{t.status}</Text>
            </View>
          )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No training records found.</Text>}
        </View>

        <Text style={styles.footer}>
          Page 1 • {driver.full_name} • Confidental
        </Text>
      </Page>

      {/* PAGE 2: WORK SESSIONS (13 WEEKS) */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>4. App Work Audit (Last 13 Weeks)</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>Date</Text>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>Start</Text>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>End</Text>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>Work (Hrs)</Text>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>Break (Hrs)</Text>
        </View>

        {sessions.length > 0 ? sessions.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.tableCell, { width: '20%' }]}>{s.date}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{s.start_time}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{s.end_time || '—'}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{((s.total_work_minutes || 0) / 60).toFixed(2)}</Text>
            <Text style={[styles.tableCell, { width: '20%' }]}>{((s.total_break_minutes || 0) / 60).toFixed(2)}</Text>
          </View>
        )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No work session logs found for the audit period.</Text>}

        <Text style={styles.footer}>
          Page 2 • Driver Compliance Audit Trail
        </Text>
      </Page>

      {/* PAGE 3: NORMALIZED TACHOGRAPH EVIDENCE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>5. Tachograph Evidence</Text>
            <Text style={styles.subtitle}>Driver-card imports, legal findings, review state, and app-vs-tacho reconciliation.</Text>
          </View>
        </View>

        <View style={styles.evidenceNote}>
          <Text>
            Tachograph rows are sourced from normalized parser output for the same 13-week audit window.
            App work sessions remain separate so supervisors can compare portal clocking against driver-card evidence.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase' }}>Imports</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>{tachoTotals?.importCount || 0}</Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>{tachoTotals?.activeImportCount || 0} active analysis sets</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase' }}>Tacho Days</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A' }}>{tachoTotals?.dayCount || 0}</Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>{formatHours(tachoTotals?.drivingMins)} driving</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase' }}>Findings</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: (tachoTotals?.criticalFindingCount || 0) > 0 ? '#991B1B' : '#0F172A' }}>
              {tachoTotals?.findingCount || 0}
            </Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>{tachoTotals?.criticalFindingCount || 0} high/critical</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase' }}>Open Review</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: (tachoTotals?.unreviewedFindingCount || 0) > 0 ? '#92400E' : '#0F172A' }}>
              {tachoTotals?.unreviewedFindingCount || 0}
            </Text>
            <Text style={{ fontSize: 7, color: '#64748B' }}>{tachoTotals?.reconciliationIssueCount || 0} recon issues</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Card Downloads</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { width: '22%' }]}>Downloaded</Text>
            <Text style={[styles.tableCellBold, { width: '23%' }]}>Card</Text>
            <Text style={[styles.tableCellBold, { width: '20%' }]}>Coverage Start</Text>
            <Text style={[styles.tableCellBold, { width: '20%' }]}>Coverage End</Text>
            <Text style={[styles.tableCellBold, { width: '15%' }]}>Status</Text>
          </View>
          {tacho?.downloads?.length ? tacho.downloads.slice(0, 5).map((download, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.tableCell, { width: '22%' }]}>{formatDateTime(download.downloaded_at)}</Text>
              <Text style={[styles.tableCell, { width: '23%' }]}>{download.card_number || 'N/A'}</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>{formatDate(download.period_start)}</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>{formatDate(download.period_end)}</Text>
              <Text style={[styles.tableCell, { width: '15%', fontSize: 8 }]}>{labelize(download.download_status)}</Text>
            </View>
          )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No driver-card downloads found in this audit period.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Tacho Day Totals</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, { width: '18%' }]}>Date</Text>
            <Text style={[styles.tableCellBold, { width: '16%' }]}>Driving</Text>
            <Text style={[styles.tableCellBold, { width: '16%' }]}>Work</Text>
            <Text style={[styles.tableCellBold, { width: '16%' }]}>POA</Text>
            <Text style={[styles.tableCellBold, { width: '16%' }]}>Rest</Text>
            <Text style={[styles.tableCellBold, { width: '18%' }]}>Findings</Text>
          </View>
          {tacho?.daySummaries?.length ? tacho.daySummaries.slice(0, 14).map((day, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.tableCell, { width: '18%' }]}>{formatDate(day.summary_date)}</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>{formatHours(day.driving_mins)}</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>{formatHours(day.work_mins)}</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>{formatHours(day.poa_mins)}</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>{formatHours(day.rest_mins)}</Text>
              <Text style={[styles.tableCell, { width: '18%' }]}>{day.findings_count || 0}</Text>
            </View>
          )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No normalized tacho day totals found.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal / Data Quality Findings</Text>
          {tacho?.findings?.length ? tacho.findings.slice(0, 10).map((finding, i) => {
            const reviewStatus = finding.review?.status || 'open';
            return (
              <View key={i} style={{ marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0F172A' }}>{finding.title || finding.rule_code}</Text>
                  <Text style={{ fontSize: 8, color: finding.severity === 'critical' || finding.severity === 'high' ? '#991B1B' : '#64748B' }}>
                    {labelize(finding.severity)} / {labelize(reviewStatus)}
                  </Text>
                </View>
                <Text style={{ fontSize: 8, color: '#475569' }}>{finding.summary}</Text>
                <Text style={{ fontSize: 7, color: '#94A3B8', marginTop: 2 }}>
                  {formatDateTime(finding.occurred_at)} - {finding.rule_code} - Source: {labelize(finding.source)}
                  {finding.review?.corrective_action_type ? ` - Action: ${labelize(finding.review.corrective_action_type)}` : ''}
                </Text>
              </View>
            );
          }) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No normalized tacho findings found.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App vs Tacho Reconciliation</Text>
          {tacho?.reconciliation?.length ? tacho.reconciliation.slice(0, 8).map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.tableCell, { width: '18%' }]}>{formatDate(item.recon_date)}</Text>
              <Text style={[styles.tableCell, { width: '17%', fontSize: 8 }]}>{labelize(item.status)}</Text>
              <Text style={[styles.tableCell, { width: '27%', fontSize: 8 }]}>{item.app_label}</Text>
              <Text style={[styles.tableCell, { width: '27%', fontSize: 8 }]}>{item.tacho_label}</Text>
              <Text style={[styles.tableCell, { width: '11%', fontSize: 8 }]}>{formatHours(item.tacho_driving_mins)}</Text>
            </View>
          )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No reconciliation rows found for this audit period.</Text>}
        </View>

        <Text style={styles.footer}>
          Page 3 - Normalized Tachograph Evidence
        </Text>
      </Page>

      {/* PAGE 4: INFRINGEMENTS & DEBRIEFS */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>6. Infringement Debrief History</Text>
        </View>

        {infringements.length > 0 ? infringements.map((inf, i) => (
          <View key={i} style={{ marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 11 }}>{inf.violation_type}</Text>
              <Text style={{ fontSize: 9, color: '#64748B' }}>Occurred: {new Date(inf.occurred_at).toLocaleDateString()}</Text>
            </View>
            <Text style={{ fontSize: 9, marginBottom: 5 }}>Severity: <Text style={{ fontWeight: 'bold' }}>{inf.severity.toUpperCase()}</Text></Text>
            <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#475569', marginBottom: 2 }}>Manager Debrief Notes:</Text>
              <Text style={{ fontSize: 9 }}>{inf.manager_notes || 'No notes provided.'}</Text>
            </View>
            <View style={{ marginTop: 5, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 8, color: '#94A3B8' }}>Debriefed on: {new Date(inf.debriefed_at).toLocaleDateString()}</Text>
            </View>
          </View>
        )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No infringement debriefs recorded.</Text>}

        <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Manager Declaration:</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
            I confirm that the above records represent a true and accurate reflection of the driver's compliance and training history
            within this organisation. All infringements have been debriefed and remedial action taken where necessary.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 30, gap: 40 }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 5 }}>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Manager Signature</Text>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 5 }}>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Date Signed</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Page 4 • Compliance Evidence Pack • Official Record
        </Text>
      </Page>

      {/* PAGE 5: VEHICLE CHECKS */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>7. Vehicle Daily Checks (Audit)</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellBold, { width: '25%' }]}>Date/Time</Text>
          <Text style={[styles.tableCellBold, { width: '15%' }]}>Reg</Text>
          <Text style={[styles.tableCellBold, { width: '20%' }]}>Status</Text>
          <Text style={[styles.tableCellBold, { width: '40%' }]}>Defects Reported</Text>
        </View>

        {checks.length > 0 ? checks.slice(0, 20).map((c, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.tableCell, { width: '25%' }]}>{new Date(c.created_at).toLocaleString()}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>{c.reg_number}</Text>
            <Text style={[styles.tableCell, { width: '20%', fontWeight: 'bold', color: c.check_status === 'defect' ? '#991B1B' : '#166534' }]}>
              {c.check_status.toUpperCase()}
            </Text>
            <Text style={[styles.tableCell, { width: '40%', fontSize: 8 }]}>
              {c.defect_details || (c.check_status === 'safe' ? 'Nil' : 'No details')}
            </Text>
          </View>
        )) : <Text style={{ padding: 10, fontStyle: 'italic', color: '#94A3B8' }}>No vehicle check records found for this period.</Text>}

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 8, color: '#64748B' }}>* Only the last 20 checks are shown in this summary. Full history is available in the Fleet Management module.</Text>
        </View>

        <Text style={styles.footer}>
          Page 5 • Vehicle Check Audit Trail
        </Text>
      </Page>
    </Document>
  );
};
