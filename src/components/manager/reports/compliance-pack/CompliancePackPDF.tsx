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
});

interface CompliancePackProps {
  data: {
    driver: any;
    sessions: any[];
    training: any[];
    infringements: any[];
    checks: any[];
    generatedAt: string;
    companyName?: string;
  };
}

export const CompliancePackPDF = ({ data }: CompliancePackProps) => {
  const { driver, sessions, training, infringements, checks, generatedAt, companyName } = data;

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
          <Text style={styles.title}>4. Tacho / Work Audit (Last 13 Weeks)</Text>
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

      {/* PAGE 3: INFRINGEMENTS & DEBRIEFS */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>5. Infringement Debrief History</Text>
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
          Page 3 • Compliance Evidence Pack • Official Record
        </Text>
      </Page>

      {/* PAGE 4: VEHICLE CHECKS */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>6. Vehicle Daily Checks (Audit)</Text>
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
          Page 4 • Vehicle Check Audit Trail
        </Text>
      </Page>
    </Document>
  );
};
