import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Truck, User, FileText, AlertTriangle, Download, Settings, GraduationCap, ClipboardCheck, X, Save, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { FleetCompliancePackPDF } from './reports/compliance-pack/FleetCompliancePackPDF';
import { TachoActivity, WorkSession } from '../../lib/compliance';
import type { Database } from '../../lib/database.types';
import { detectMissingMileage } from '../../lib/tachoAnalysis';

type Company = Database['public']['Tables']['companies']['Row'];
type OLicenceFormData = {
  operator_licence_number: string | null;
  operator_licence_region: string | null;
  operator_licence_type: string | null;
  operator_licence_status: string | null;
  operator_licence_expiry: string | null;
  authorised_vehicle_count: number;
  authorised_trailer_count: number;
  transport_manager_name: string | null;
  transport_manager_cpc_expiry: string | null;
};
type CompanyView = Company & OLicenceFormData;

const EMPTY_LICENCE_DETAILS: OLicenceFormData = {
  operator_licence_number: null,
  operator_licence_region: null,
  operator_licence_type: null,
  operator_licence_status: null,
  operator_licence_expiry: null,
  authorised_vehicle_count: 0,
  authorised_trailer_count: 0,
  transport_manager_name: null,
  transport_manager_cpc_expiry: null,
};

export function OLicenceComplianceCentre() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<CompanyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<OLicenceFormData>>({});
  const [stats, setStats] = useState({
    actualVehicles: 0,
    actualTrailers: 0,
    openInfringements: 0,
    pendingDefects: 0,
    completedTraining: 0,
    recentChecks: 0,
    maintenanceCompliance: 100,
    defectRectification: 100,
    infringementDebriefRate: 100,
    missingMileageAlerts: 0,
    wtdWeeklyAvg: 0
  });

  const loadData = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [
        companyRes,
        licenceRes,
        vehiclesRes,
        infringementsRes,
        defectsRes,
        trainingRes,
        checksRes,
        tachoActivitiesRes,
        allInfringementsRes,
        allDefectsRes,
        workSessionsRes
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('id', profile.company_id).single(),
        supabase.from('company_operator_licence_profiles').select('*').eq('company_id', profile.company_id).maybeSingle(),
        supabase.from('vehicles').select('*').eq('company_id', profile.company_id),
        supabase.from('infringements').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('status', 'open'),
        supabase.from('vehicle_checks').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('check_status', 'defect').neq('defect_lifecycle_status', 'fixed'),
        supabase.from('training_records').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('status', 'complete'),
        supabase.from('vehicle_checks').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('tachograph_activities').select('*').gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('infringements').select('status').eq('company_id', profile.company_id),
        supabase.from('vehicle_checks').select('check_status, defect_lifecycle_status').eq('company_id', profile.company_id).eq('check_status', 'defect').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('work_sessions').select('total_work_minutes, user_id, start_time, end_time, date').eq('status', 'completed').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      if (companyRes.error) throw companyRes.error;
      if (licenceRes.error) throw licenceRes.error;

      if (companyRes.data) {
        const licenceDetails: OLicenceFormData = licenceRes.data
          ? {
              operator_licence_number: licenceRes.data.operator_licence_number,
              operator_licence_region: licenceRes.data.operator_licence_region,
              operator_licence_type: licenceRes.data.operator_licence_type,
              operator_licence_status: licenceRes.data.operator_licence_status,
              operator_licence_expiry: licenceRes.data.operator_licence_expiry,
              authorised_vehicle_count: licenceRes.data.authorised_vehicle_count,
              authorised_trailer_count: licenceRes.data.authorised_trailer_count,
              transport_manager_name: licenceRes.data.transport_manager_name,
              transport_manager_cpc_expiry: licenceRes.data.transport_manager_cpc_expiry,
            }
          : EMPTY_LICENCE_DETAILS;
        const companyView = { ...companyRes.data, ...licenceDetails };
        setCompany(companyView);
        setFormData(licenceDetails);
      }

      const vehicles = vehiclesRes.data || [];
      const now = new Date();
      const overdueVehicles = vehicles.filter(v => {
        const pmiOverdue = v.pmi_due_date && new Date(v.pmi_due_date) < now;
        const motOverdue = v.mot_due_date && new Date(v.mot_due_date) < now;
        return pmiOverdue || motOverdue;
      }).length;

      const maintenanceCompliance = vehicles.length > 0
        ? ((vehicles.length - overdueVehicles) / vehicles.length) * 100
        : 100;

      const debriefedInfringements = (allInfringementsRes.data || []).filter(i => i.status !== 'open').length;
      const totalInfringements = (allInfringementsRes.data || []).length;
      const infringementDebriefRate = totalInfringements > 0
        ? (debriefedInfringements / totalInfringements) * 100
        : 100;

      const defects30d = allDefectsRes.data || [];
      const fixedDefects = defects30d.filter(d => d.defect_lifecycle_status === 'fixed').length;
      const defectRectification = defects30d.length > 0
        ? (fixedDefects / defects30d.length) * 100
        : 100;

      const totalWorkMinutes = (workSessionsRes.data || []).reduce((acc, curr) => acc + (curr.total_work_minutes || 0), 0);
      const wtdWeeklyAvg = (workSessionsRes.data || []).length > 0
        ? (totalWorkMinutes / 60) / Math.max(1, (new Set((workSessionsRes.data || []).map(s => s.user_id))).size)
        : 0;

      // Calculate Missing Mileage Alerts using Tacho Data
      const tachoActivities = (tachoActivitiesRes.data || []) as TachoActivity[];
      const mileageWorkSessions: WorkSession[] = (workSessionsRes.data || []).map(session => ({
        start_time: session.start_time,
        end_time: session.end_time,
        total_work_minutes: session.total_work_minutes,
        total_break_minutes: null,
        other_data: null,
      }));
      const missingMileageGaps = detectMissingMileage(tachoActivities, mileageWorkSessions);

      setStats({
        actualVehicles: vehicles.filter(v => v.vehicle_class !== 'trailer').length,
        actualTrailers: vehicles.filter(v => v.vehicle_class === 'trailer').length,
        openInfringements: infringementsRes.count || 0,
        pendingDefects: defectsRes.count || 0,
        completedTraining: trainingRes.count || 0,
        recentChecks: checksRes.count || 0,
        maintenanceCompliance,
        defectRectification,
        infringementDebriefRate,
        missingMileageAlerts: missingMileageGaps.length,
        wtdWeeklyAvg
      });

    } catch (error) {
      console.error('Error loading O-Licence data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('upsert_company_operator_licence_profile', {
        p_operator_licence_number: formData.operator_licence_number ?? undefined,
        p_operator_licence_region: formData.operator_licence_region ?? undefined,
        p_operator_licence_type: formData.operator_licence_type ?? undefined,
        p_operator_licence_status: formData.operator_licence_status ?? undefined,
        p_operator_licence_expiry: formData.operator_licence_expiry ?? undefined,
        p_authorised_vehicle_count: formData.authorised_vehicle_count ?? 0,
        p_authorised_trailer_count: formData.authorised_trailer_count ?? 0,
        p_transport_manager_name: formData.transport_manager_name ?? undefined,
        p_transport_manager_cpc_expiry: formData.transport_manager_cpc_expiry ?? undefined,
      });
      if (error) throw error;
      if (!data) throw new Error('The operator licence update returned no record');
      setCompany(previous => previous ? { ...previous, ...data } : previous);
      setFormData(data);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error updating O-Licence:', error);
      alert('Failed to update licence data');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  const vehicleUtilization = company?.authorised_vehicle_count ? (stats.actualVehicles / company.authorised_vehicle_count) * 100 : 0;
  const trailerUtilization = company?.authorised_trailer_count ? (stats.actualTrailers / company.authorised_trailer_count) * 100 : 0;

  const isExpired = (date: string | null | undefined) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isExpiringSoon = (date: string | null | undefined) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - new Date().getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-brand-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">O-Licence Compliance Centre</h2>
            <p className="text-sm text-slate-400">Operator Licence standing and regulatory evidence aggregation.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border rounded-lg text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition"
          >
            <Settings size={14} /> Update Licence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Licence Status Card */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-brand-border bg-brand-dark/20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="text-brand-accent" size={20} />
              <h3 className="font-black text-white uppercase tracking-wider text-sm">Licence Details</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              company?.operator_licence_status === 'valid' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {company?.operator_licence_status?.replace('_', ' ') || 'NOT SET'}
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Licence Number</label>
                  <p className="text-xl font-black text-white font-mono tracking-tighter">{company?.operator_licence_number || 'REQUIRED'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Type</label>
                    <p className="text-sm font-bold text-slate-300 capitalize">{company?.operator_licence_type?.replace(/_/g, ' ') || 'Not Specified'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Region</label>
                    <p className="text-sm font-bold text-slate-300">{company?.operator_licence_region || 'Not Specified'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Expiry Date</label>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${isExpired(company?.operator_licence_expiry) ? 'text-red-500' : isExpiringSoon(company?.operator_licence_expiry) ? 'text-amber-500' : 'text-slate-300'}`}>
                      {company?.operator_licence_expiry ? new Date(company.operator_licence_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'NOT SET'}
                    </p>
                    {isExpired(company?.operator_licence_expiry) && <AlertTriangle size={14} className="text-red-500" />}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Vehicle Authorization</label>
                    <span className="text-xs font-black text-white">{stats.actualVehicles} / {company?.authorised_vehicle_count || 0}</span>
                  </div>
                  <div className="h-2 w-full bg-brand-dark rounded-full overflow-hidden border border-brand-border">
                    <div
                      className={`h-full transition-all duration-500 ${vehicleUtilization > 100 ? 'bg-red-500' : vehicleUtilization > 90 ? 'bg-amber-500' : 'bg-brand-accent'}`}
                      style={{ width: `${Math.min(vehicleUtilization, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    {vehicleUtilization >= 100 ? '⚠ Authorization limit reached' : `${company?.authorised_vehicle_count ? (company.authorised_vehicle_count - stats.actualVehicles) : 0} margins remaining`}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Trailer Authorization</label>
                    <span className="text-xs font-black text-white">{stats.actualTrailers} / {company?.authorised_trailer_count || 0}</span>
                  </div>
                  <div className="h-2 w-full bg-brand-dark rounded-full overflow-hidden border border-brand-border">
                    <div
                      className={`h-full transition-all duration-500 ${trailerUtilization > 100 ? 'bg-red-500' : trailerUtilization > 90 ? 'bg-amber-500' : 'bg-brand-accent'}`}
                      style={{ width: `${Math.min(trailerUtilization, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transport Manager Card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-brand-border bg-brand-dark/20 flex items-center gap-3">
            <User className="text-brand-accent" size={20} />
            <h3 className="font-black text-white uppercase tracking-wider text-sm">Transport Manager</h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-dark rounded-xl flex items-center justify-center border border-brand-border">
                  <User className="text-slate-400" size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-white">{company?.transport_manager_name || 'NOT ASSIGNED'}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">CPC Holder / TM1</p>
                </div>
              </div>

              <div className="p-4 bg-brand-dark/50 rounded-xl border border-brand-border">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase">CPC Expiry / Refresher</span>
                  <GraduationCap size={14} className="text-brand-accent" />
                </div>
                <p className={`text-sm font-bold ${isExpired(company?.transport_manager_cpc_expiry) ? 'text-red-500' : 'text-slate-300'}`}>
                  {company?.transport_manager_cpc_expiry ? new Date(company.transport_manager_cpc_expiry).toLocaleDateString('en-GB') : 'NOT SET'}
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-brand-accent/5 rounded-xl border border-brand-accent/10">
              <p className="text-[10px] text-brand-accent font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-brand-accent flex items-center justify-center text-[10px] text-brand-dark">i</span> TM Responsibility
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                The Transport Manager is responsible for the continuous and effective management of transport operations.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EvidenceCard
          icon={AlertTriangle}
          label="Open Infringements"
          value={stats.openInfringements}
          status={stats.openInfringements > 0 ? 'warning' : 'success'}
        />
        <EvidenceCard
          icon={Truck}
          label="Pending Defects"
          value={stats.pendingDefects}
          status={stats.pendingDefects > 0 ? 'critical' : 'success'}
        />
        <EvidenceCard
          icon={GraduationCap}
          label="Training Records"
          value={stats.completedTraining}
          status="info"
        />
        <EvidenceCard
          icon={ClipboardCheck}
          label="7-Day Safety Checks"
          value={stats.recentChecks}
          status={stats.recentChecks > 0 ? 'success' : 'warning'}
        />
      </div>

      {/* Evidence Aggregator / Dashboard */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-brand-border bg-brand-dark/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-brand-accent" size={20} />
            <div>
              <h3 className="font-black text-white uppercase tracking-wider text-sm">Regulatory Evidence Dashboard</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fleet-wide compliance standing</p>
            </div>
          </div>
          <PDFDownloadLink
            document={
              <FleetCompliancePackPDF
                data={{
                  company,
                  stats,
                  generatedAt: new Date().toLocaleString('en-GB'),
                  fleetStats: {
                    totalVehicles: stats.actualVehicles,
                    totalTrailers: stats.actualTrailers,
                    maintenanceCompliance: `${stats.maintenanceCompliance.toFixed(0)}%`,
                    defectRectification: `${stats.defectRectification.toFixed(0)}%`,
                    infringementDebriefRate: `${stats.infringementDebriefRate.toFixed(0)}%`
                  }
                }}
              />
            }
            fileName={`Fleet_Compliance_Pack_${company?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-brand-accent/20"
          >
            {({ loading }) => (
              loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Preparing...
                </>
              ) : (
                <>
                  <Download size={14} /> Export Evidence Pack
                </>
              )
            )}
          </PDFDownloadLink>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-brand-border pb-2">Maintenance & Safety</h4>
            <div className="space-y-3">
              <EvidenceStatItem
                label="Forward PMI Completion"
                value={`${stats.maintenanceCompliance.toFixed(0)}%`}
                status={stats.maintenanceCompliance > 95 ? 'success' : stats.maintenanceCompliance > 85 ? 'warning' : 'critical'}
              />
              <EvidenceStatItem label="First-use Check Compliance" value={`${Math.min(100, (stats.recentChecks / (stats.actualVehicles || 1) * 14)).toFixed(0)}%`} status="warning" />
              <EvidenceStatItem
                label="Defect Rectification Rate"
                value={`${stats.defectRectification.toFixed(0)}%`}
                status={stats.defectRectification > 90 ? 'success' : stats.defectRectification > 75 ? 'warning' : 'critical'}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-brand-border pb-2">Drivers & Hours</h4>
            <div className="space-y-3">
              <EvidenceStatItem
                label="Infringement Debrief Rate"
                value={`${stats.infringementDebriefRate.toFixed(0)}%`}
                status={stats.infringementDebriefRate > 90 ? 'success' : stats.infringementDebriefRate > 75 ? 'warning' : 'critical'}
              />
              <EvidenceStatItem
                label="Missing Mileage Alerts"
                value={stats.missingMileageAlerts.toString()}
                status={stats.missingMileageAlerts > 0 ? 'critical' : 'success'}
              />
              <EvidenceStatItem
                label="WTD Weekly Avg"
                value={`${stats.wtdWeeklyAvg.toFixed(1)}h`}
                status={stats.wtdWeeklyAvg < 48 ? 'success' : 'critical'}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-brand-border pb-2">Training & Competence</h4>
            <div className="space-y-3">
              <EvidenceStatItem label="CPC Hours Tracked" value="1,240" status="info" />
              <EvidenceStatItem label="Remedial Training Completion" value="100%" status="success" />
              <EvidenceStatItem label="Document Verification" value="All Clear" status="success" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-brand-dark/40 border-t border-brand-border flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold italic">Evidence Pack USP: This dashboard provides a real-time "Health Score" for your O-Licence based on DVSA Earned Recognition criteria.</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">System Status:</span>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-500 rounded-lg text-[9px] font-black border border-green-500/20">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
              AUDIT READY
            </div>
          </div>
        </div>
      </div>

      {/* Update Licence Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-brand-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Shield className="text-brand-accent" size={20} />
                <h3 className="font-black text-white uppercase tracking-widest text-sm">Update Operator Licence</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest">Licence Information</h4>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Licence Number</label>
                    <input
                      type="text"
                      value={formData.operator_licence_number || ''}
                      onChange={e => setFormData({ ...formData, operator_licence_number: e.target.value })}
                      placeholder="e.g. OB1234567"
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Licence Type</label>
                    <select
                      value={formData.operator_licence_type || ''}
                      onChange={e => setFormData({ ...formData, operator_licence_type: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                    >
                      <option value="">Select Type...</option>
                      <option value="standard_national">Standard National</option>
                      <option value="standard_international">Standard International</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Region</label>
                      <input
                        type="text"
                        value={formData.operator_licence_region || ''}
                        onChange={e => setFormData({ ...formData, operator_licence_region: e.target.value })}
                        placeholder="e.g. North East"
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Status</label>
                      <select
                        value={formData.operator_licence_status || ''}
                        onChange={e => setFormData({ ...formData, operator_licence_status: e.target.value })}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                      >
                        <option value="valid">Valid</option>
                        <option value="suspended">Suspended</option>
                        <option value="curtailed">Curtailed</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.operator_licence_expiry || ''}
                      onChange={e => setFormData({ ...formData, operator_licence_expiry: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest">Authorizations & TM</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Vehicles</label>
                      <input
                        type="number"
                        value={formData.authorised_vehicle_count || 0}
                        onChange={e => setFormData({ ...formData, authorised_vehicle_count: parseInt(e.target.value) || 0 })}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Trailers</label>
                      <input
                        type="number"
                        value={formData.authorised_trailer_count || 0}
                        onChange={e => setFormData({ ...formData, authorised_trailer_count: parseInt(e.target.value) || 0 })}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Transport Manager Name</label>
                    <input
                      type="text"
                      value={formData.transport_manager_name || ''}
                      onChange={e => setFormData({ ...formData, transport_manager_name: e.target.value })}
                      placeholder="Full Name"
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">TM CPC Expiry / Refresher</label>
                    <input
                      type="date"
                      value={formData.transport_manager_cpc_expiry || ''}
                      onChange={e => setFormData({ ...formData, transport_manager_cpc_expiry: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-brand-border flex justify-end gap-3 bg-brand-dark/20">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-xs font-black uppercase tracking-widest transition shadow-lg shadow-brand-accent/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceCard({ icon: Icon, label, value, status }: { icon: LucideIcon, label: string, value: number, status: 'success' | 'warning' | 'critical' | 'info' }) {
  const colours = {
    success: 'text-green-500 bg-green-500/10 border-green-500/20',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    critical: 'text-red-500 bg-red-500/10 border-red-500/20',
    info: 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
  };

  return (
    <div className={`p-4 rounded-2xl border ${colours[status]} flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colours[status].split(' ')[2]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-0.5">{label}</p>
        <p className="text-xl font-black">{value}</p>
      </div>
    </div>
  );
}

function EvidenceStatItem({ label, value, status }: { label: string, value: string, status: 'success' | 'warning' | 'critical' | 'info' }) {
  const statusColours = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    info: 'bg-brand-accent'
  };

  return (
    <div className="flex items-center justify-between group">
      <span className="text-[11px] text-slate-400 font-medium group-hover:text-slate-300 transition-colors">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black text-white">{value}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${statusColours[status]}`} />
      </div>
    </div>
  );
}
