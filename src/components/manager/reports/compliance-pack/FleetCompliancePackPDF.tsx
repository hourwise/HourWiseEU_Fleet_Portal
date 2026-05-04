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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  }
});

interface FleetCompliancePackProps {
  data: {
    company: any;
    stats: any;
    generatedAt: string;
    fleetStats: {
      totalVehicles: number;
      totalTrailers: number;
      maintenanceCompliance: string;
      defectRectification: string;
      infringementDebriefRate: string;
    };
  };
}

export const FleetCompliancePackPDF = ({ data }: FleetCompliancePackProps) => {
  const { company, stats, generatedAt, fleetStats } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Fleet O-Licence Evidence Pack</Text>
            <Text style={styles.subtitle}>{company?.name || 'Fleet Portal'} • Operator Licence Compliance Report</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#94A3B8' }}>Generated: {generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Operator Licence Status</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Licence Number:</Text>
            <Text style={styles.value}>{company?.olicence_number || 'NOT SET'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Licence Type:</Text>
            <Text style={styles.value}>{company?.olicence_type?.replace(/_/g, ' ').toUpperCase() || 'NOT SET'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Current Status:</Text>
            <Text style={styles.value}>{company?.olicence_status?.toUpperCase() || 'NOT SET'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Expiry Date:</Text>
            <Text style={styles.value}>{company?.olicence_expiry || 'NOT SET'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Region:</Text>
            <Text style={styles.value}>{company?.olicence_region || 'NOT SET'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Authorization & Utilization</Text>
          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Authorized Vehicles</Text>
              <Text style={styles.statValue}>{company?.auth_vehicles || 0}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>In-Use Vehicles</Text>
              <Text style={styles.statValue}>{stats.actualVehicles}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Utilization</Text>
              <Text style={styles.statValue}>
                {company?.auth_vehicles ? Math.round((stats.actualVehicles / company.auth_vehicles) * 100) : 0}%
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Authorized Trailers</Text>
              <Text style={styles.statValue}>{company?.auth_trailers || 0}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>In-Use Trailers</Text>
              <Text style={styles.statValue}>{stats.actualTrailers}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Trailer Utilization</Text>
              <Text style={styles.statValue}>
                {company?.auth_trailers ? Math.round((stats.actualTrailers / company.auth_trailers) * 100) : 0}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Transport Management</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Transport Manager:</Text>
            <Text style={styles.value}>{company?.transport_manager_name || 'NOT ASSIGNED'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CPC Expiry / Refresher Due:</Text>
            <Text style={styles.value}>{company?.transport_manager_cpc_expiry || 'NOT SET'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Fleet Compliance KPIs</Text>
          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>PMI Compliance</Text>
              <Text style={styles.statValue}>{fleetStats.maintenanceCompliance}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Defect Rectification</Text>
              <Text style={styles.statValue}>{fleetStats.defectRectification}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Infringement Debriefs</Text>
              <Text style={styles.statValue}>{fleetStats.infringementDebriefRate}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Open Infringements</Text>
              <Text style={styles.statValue}>{stats.openInfringements}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Pending Defects</Text>
              <Text style={styles.statValue}>{stats.pendingDefects}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Safety Checks (7D)</Text>
              <Text style={styles.statValue}>{stats.recentChecks}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 10 }}>Compliance Declaration:</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4, color: '#475569' }}>
            This document serves as an aggregated evidence pack of the fleet's regulatory standing as of {generatedAt}.
            The data contained herein is drawn from the HourWiseEU Fleet Portal and reflects live operational records,
            including vehicle authorizations, transport management oversight, and safety inspection compliance.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 30, gap: 40 }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 5 }}>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Transport Manager Signature</Text>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 5 }}>
              <Text style={{ fontSize: 8, color: '#64748B' }}>Date</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          O-Licence Evidence Pack • {company?.name} • Confidential Regulatory Document
        </Text>
      </Page>
    </Document>
  );
};
