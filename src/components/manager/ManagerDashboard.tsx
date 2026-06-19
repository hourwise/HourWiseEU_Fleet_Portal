import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import type { ElementType } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogOut, LayoutDashboard, Users, FileBarChart2, Settings, Shield, ShieldCheck, ShieldAlert, Truck, Activity, GraduationCap, MessageSquare, Fuel, Calendar as CalendarIcon } from 'lucide-react';

// Lazy load dashboard components
const DriverManagement = lazy(() => import('./DriverManagement').then(m => ({ default: m.DriverManagement })));
const ReportsAndExports = lazy(() => import('./ReportsAndExports').then(m => ({ default: m.ReportsAndExports })));
const CompanySettings = lazy(() => import('./CompanySettings').then(m => ({ default: m.CompanySettings })));
const SupervisorManagement = lazy(() => import('./SupervisorManagement').then(m => ({ default: m.SupervisorManagement })));
const AlertsFeed = lazy(() => import('./AlertsFeed').then(m => ({ default: m.AlertsFeed })));
const MfaSettings = lazy(() => import('./MfaSettings').then(m => ({ default: m.MfaSettings })));
const BillingManager = lazy(() => import('./BillingManager').then(m => ({ default: m.BillingManager })));
const BroadcastMessage = lazy(() => import('./BroadcastMessage').then(m => ({ default: m.BroadcastMessage })));
const VehicleChecksModule = lazy(() => import('./VehicleChecksModule').then(m => ({ default: m.VehicleChecksModule })));
const VehicleManagement = lazy(() => import('./VehicleManagement').then(m => ({ default: m.VehicleManagement })));
const FuelMileageTracker = lazy(() => import('./FuelMileageTracker').then(m => ({ default: m.FuelMileageTracker })));
const MessagingHub = lazy(() => import('./MessagingHub').then(m => ({ default: m.MessagingHub })));
const VehicleComplianceSnapshot = lazy(() => import('./VehicleComplianceSnapshot').then(m => ({ default: m.VehicleComplianceSnapshot })));
const DriverComplianceSnapshot = lazy(() => import('./DriverComplianceSnapshot').then(m => ({ default: m.DriverComplianceSnapshot })));
const ComplianceSnapshot = lazy(() => import('./ComplianceSnapshot').then(m => ({ default: m.ComplianceSnapshot })));
const TachoTrainingModule = lazy(() => import('./TachoTrainingModule').then(m => ({ default: m.TachoTrainingModule })));
const UserProfileSettings = lazy(() => import('./UserProfileSettings').then(m => ({ default: m.UserProfileSettings })));
const DriverRiskSnapshot = lazy(() => import('./DriverRiskSnapshot').then(m => ({ default: m.DriverRiskSnapshot })));
const ShiftPlanner = lazy(() => import('./ShiftPlanner').then(m => ({ default: m.ShiftPlanner })));
const IncidentReporting = lazy(() => import('./IncidentReporting').then(m => ({ default: m.IncidentReporting })));
const OLicenceComplianceCentre = lazy(() => import('./OLicenceComplianceCentre').then(m => ({ default: m.OLicenceComplianceCentre })));
const TachoComplianceWorkspace = lazy(() => import('./tachograph/TachoComplianceWorkspace').then(m => ({ default: m.TachoComplianceWorkspace })));

function TabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent" />
    </div>
  );
}

type Workspace = 'dashboard' | 'people' | 'fleet' | 'compliance' | 'reports' | 'settings';
type PeopleSection = 'drivers' | 'training' | 'shifts' | 'supervisors' | 'messages';
type FleetSection = 'vehicles' | 'vehicle_checks' | 'fuel' | 'olicence' | 'incidents';
type SettingsSection = 'account' | 'company';
type TachoTab = 'overview' | 'imports' | 'driver_cards' | 'vehicle_units' | 'simulator';

interface DashboardRouteState {
  workspace: Workspace;
  people: PeopleSection;
  fleet: FleetSection;
  settings: SettingsSection;
  tacho: TachoTab;
  focusedDriverId?: string;
  focusedVehicleId?: string;
  focusedDate?: string;
  reportDriverId?: string;
  reportDate?: string;
}

const WORKSPACES: Workspace[] = ['dashboard', 'people', 'fleet', 'compliance', 'reports', 'settings'];
const PEOPLE_SECTIONS: PeopleSection[] = ['drivers', 'training', 'shifts', 'supervisors', 'messages'];
const FLEET_SECTIONS: FleetSection[] = ['vehicles', 'vehicle_checks', 'fuel', 'olicence', 'incidents'];
const SETTINGS_SECTIONS: SettingsSection[] = ['account', 'company'];
const TACHO_TABS: TachoTab[] = ['overview', 'imports', 'driver_cards', 'vehicle_units', 'simulator'];

const DEFAULT_DASHBOARD_ROUTE: DashboardRouteState = {
  workspace: 'dashboard',
  people: 'drivers',
  fleet: 'vehicles',
  settings: 'account',
  tacho: 'overview',
};

function readDashboardRouteState(): DashboardRouteState {
  const params = new URLSearchParams(window.location.search);
  const workspace = asOneOf(params.get('workspace'), WORKSPACES, DEFAULT_DASHBOARD_ROUTE.workspace);

  return {
    workspace,
    people: asOneOf(params.get('people'), PEOPLE_SECTIONS, DEFAULT_DASHBOARD_ROUTE.people),
    fleet: asOneOf(params.get('fleet'), FLEET_SECTIONS, DEFAULT_DASHBOARD_ROUTE.fleet),
    settings: asOneOf(params.get('settings'), SETTINGS_SECTIONS, DEFAULT_DASHBOARD_ROUTE.settings),
    tacho: asOneOf(params.get('tacho'), TACHO_TABS, DEFAULT_DASHBOARD_ROUTE.tacho),
    focusedDriverId: params.get('driver') ?? undefined,
    focusedVehicleId: params.get('vehicle') ?? undefined,
    focusedDate: params.get('date') ?? undefined,
    reportDriverId: params.get('reportDriver') ?? undefined,
    reportDate: params.get('reportDate') ?? undefined,
  };
}

function asOneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? value as T : fallback;
}

function buildDashboardUrl(state: DashboardRouteState) {
  const params = new URLSearchParams();

  if (state.workspace !== DEFAULT_DASHBOARD_ROUTE.workspace) params.set('workspace', state.workspace);
  if (state.workspace === 'people' && state.people !== DEFAULT_DASHBOARD_ROUTE.people) params.set('people', state.people);
  if (state.workspace === 'fleet' && state.fleet !== DEFAULT_DASHBOARD_ROUTE.fleet) params.set('fleet', state.fleet);
  if (state.workspace === 'settings' && state.settings !== DEFAULT_DASHBOARD_ROUTE.settings) params.set('settings', state.settings);
  if (state.workspace === 'compliance' && state.tacho !== DEFAULT_DASHBOARD_ROUTE.tacho) params.set('tacho', state.tacho);
  if ((state.workspace === 'compliance' || state.workspace === 'people') && state.focusedDriverId) params.set('driver', state.focusedDriverId);
  if ((state.workspace === 'compliance' || state.workspace === 'fleet') && state.focusedVehicleId) params.set('vehicle', state.focusedVehicleId);
  if (state.workspace === 'compliance' && state.focusedDate) params.set('date', state.focusedDate);
  if (state.workspace === 'reports' && state.reportDriverId) params.set('reportDriver', state.reportDriverId);
  if (state.workspace === 'reports' && state.reportDate) params.set('reportDate', state.reportDate);

  const query = params.toString();
  return query ? `/dashboard?${query}` : '/dashboard';
}

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const initialRoute = readDashboardRouteState();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(initialRoute.workspace);
  const [activePeopleSection, setActivePeopleSection] = useState<PeopleSection>(initialRoute.people);
  const [activeFleetSection, setActiveFleetSection] = useState<FleetSection>(initialRoute.fleet);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>(initialRoute.settings);
  const [focusedDriverRecordId, setFocusedDriverRecordId] = useState<string | undefined>(initialRoute.focusedDriverId);
  const [focusedVehicleRecordId, setFocusedVehicleRecordId] = useState<string | undefined>(initialRoute.focusedVehicleId);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [complianceWorkspaceState, setComplianceWorkspaceState] = useState<{
    tab?: TachoTab;
    focusedVehicleId?: string;
    focusedDriverId?: string;
    focusedDate?: string;
  }>({
    tab: initialRoute.tacho,
    focusedVehicleId: initialRoute.focusedVehicleId,
    focusedDriverId: initialRoute.focusedDriverId,
    focusedDate: initialRoute.focusedDate,
  });
  const [reportsWorkspaceState, setReportsWorkspaceState] = useState<{
    focusedDriverId?: string;
    focusedDate?: string;
  }>({
    focusedDriverId: initialRoute.reportDriverId,
    focusedDate: initialRoute.reportDate,
  });

  const applyDashboardRoute = useCallback((next: Partial<DashboardRouteState>, mode: 'push' | 'replace' = 'push') => {
    const has = (key: keyof DashboardRouteState) => Object.prototype.hasOwnProperty.call(next, key);
    const routeState: DashboardRouteState = {
      workspace: next.workspace ?? activeWorkspace,
      people: next.people ?? activePeopleSection,
      fleet: next.fleet ?? activeFleetSection,
      settings: next.settings ?? activeSettingsSection,
      tacho: next.tacho ?? complianceWorkspaceState.tab ?? 'overview',
      focusedDriverId: has('focusedDriverId') ? next.focusedDriverId : complianceWorkspaceState.focusedDriverId,
      focusedVehicleId: has('focusedVehicleId') ? next.focusedVehicleId : complianceWorkspaceState.focusedVehicleId,
      focusedDate: has('focusedDate') ? next.focusedDate : complianceWorkspaceState.focusedDate,
      reportDriverId: has('reportDriverId') ? next.reportDriverId : reportsWorkspaceState.focusedDriverId,
      reportDate: has('reportDate') ? next.reportDate : reportsWorkspaceState.focusedDate,
    };

    setActiveWorkspace(routeState.workspace);
    setActivePeopleSection(routeState.people);
    setActiveFleetSection(routeState.fleet);
    setActiveSettingsSection(routeState.settings);
    setFocusedDriverRecordId(routeState.focusedDriverId);
    setFocusedVehicleRecordId(routeState.focusedVehicleId);
    setComplianceWorkspaceState({
      tab: routeState.tacho,
      focusedDriverId: routeState.focusedDriverId,
      focusedVehicleId: routeState.focusedVehicleId,
      focusedDate: routeState.focusedDate,
    });
    setReportsWorkspaceState({
      focusedDriverId: routeState.reportDriverId,
      focusedDate: routeState.reportDate,
    });

    const nextUrl = buildDashboardUrl(routeState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', nextUrl);
    }
  }, [
    activeFleetSection,
    activePeopleSection,
    activeSettingsSection,
    activeWorkspace,
    complianceWorkspaceState.focusedDate,
    complianceWorkspaceState.focusedDriverId,
    complianceWorkspaceState.focusedVehicleId,
    complianceWorkspaceState.tab,
    reportsWorkspaceState.focusedDate,
    reportsWorkspaceState.focusedDriverId,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const route = readDashboardRouteState();
      setActiveWorkspace(route.workspace);
      setActivePeopleSection(route.people);
      setActiveFleetSection(route.fleet);
      setActiveSettingsSection(route.settings);
      setFocusedDriverRecordId(route.focusedDriverId);
      setFocusedVehicleRecordId(route.focusedVehicleId);
      setComplianceWorkspaceState({
        tab: route.tacho,
        focusedDriverId: route.focusedDriverId,
        focusedVehicleId: route.focusedVehicleId,
        focusedDate: route.focusedDate,
      });
      setReportsWorkspaceState({
        focusedDriverId: route.reportDriverId,
        focusedDate: route.reportDate,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Live unread count — messages sent to this manager that haven't been read
  useEffect(() => {
    if (!profile?.id || !profile?.company_id) return;
    const companyId = profile.company_id;
    const profileId = profile.id;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('recipient_id', profileId)
        .is('read_at', null);
      setUnreadMessages(count ?? 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('dashboard:unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `company_id=eq.${companyId}` }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, profile?.company_id]);

  const workspaces = [
    { id: 'dashboard' as Workspace, label: t('navigation.dashboard'), icon: LayoutDashboard },
    { id: 'people' as Workspace, label: 'People', icon: Users },
    { id: 'fleet' as Workspace, label: t('navigation.fleet'), icon: Truck },
    { id: 'compliance' as Workspace, label: t('navigation.compliance'), icon: Activity },
    { id: 'reports' as Workspace, label: 'Reports', icon: FileBarChart2 },
    { id: 'settings' as Workspace, label: t('navigation.settings'), icon: Settings },
  ];

  const peopleSections: { id: PeopleSection; label: string; icon: ElementType; badge?: number }[] = [
    { id: 'drivers', label: t('navigation.drivers'), icon: Users },
    { id: 'training', label: t('navigation.training'), icon: GraduationCap },
    { id: 'shifts', label: 'Shifts', icon: CalendarIcon },
    { id: 'supervisors', label: t('navigation.supervisors'), icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
  ];

  const fleetSections: { id: FleetSection; label: string; icon: ElementType }[] = [
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'vehicle_checks', label: t('navigation.safetyChecks'), icon: ShieldCheck },
    { id: 'fuel', label: 'Fuel', icon: Fuel },
    { id: 'olicence', label: 'O-Licence', icon: Shield },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  ];

  const settingsSections: { id: SettingsSection; label: string; icon: ElementType }[] = [
    { id: 'account', label: 'Account', icon: Settings },
    { id: 'company', label: 'Company', icon: Settings },
  ];

  const openComplianceWorkspace = (
    tab: TachoTab = 'overview',
    options?: { focusedVehicleId?: string; focusedDriverId?: string; focusedDate?: string }
  ) => {
    applyDashboardRoute({
      workspace: 'compliance',
      tacho: tab,
      focusedVehicleId: options?.focusedVehicleId,
      focusedDriverId: options?.focusedDriverId,
      focusedDate: options?.focusedDate,
    });
  };

  const openReportsWorkspace = (options?: { focusedDriverId?: string; focusedDate?: string }) => {
    applyDashboardRoute({
      workspace: 'reports',
      reportDriverId: options?.focusedDriverId,
      reportDate: options?.focusedDate,
    });
  };

  return (
    <div className="min-h-screen bg-brand-dark text-slate-200">
      <nav className="bg-brand-card border-b border-brand-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-brand-accent-dark rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{t('app.name')}</h1>
                <p className="text-xs text-slate-400">{t('dashboard.manager.title')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-slate-400">
                  {workspaces.find((workspace) => workspace.id === activeWorkspace)?.label ?? t('navigation.dashboard')}
                </p>
              </div>
              <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-brand-dark rounded-lg transition">
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">{t('navigation.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-brand-card rounded-xl shadow-sm mb-6 border border-brand-border">
          <div className="flex overflow-x-auto scrollbar-hide">
            {workspaces.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <button
                  key={workspace.id}
                  onClick={() => applyDashboardRoute({
                    workspace: workspace.id,
                    tacho: workspace.id === 'compliance' ? 'overview' : complianceWorkspaceState.tab ?? 'overview',
                    focusedDriverId: undefined,
                    focusedVehicleId: undefined,
                    focusedDate: undefined,
                    reportDriverId: undefined,
                    reportDate: undefined,
                  })}
                  className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest border-b-2 transition whitespace-nowrap ${
                    activeWorkspace === workspace.id
                      ? 'border-brand-accent text-brand-accent bg-brand-dark/50'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-brand-card/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {workspace.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeWorkspace !== 'dashboard' && activeWorkspace !== 'reports' && activeWorkspace !== 'compliance' && (
          <div className="bg-brand-card rounded-xl shadow-sm mb-6 border border-brand-border p-2">
            <div className="flex flex-wrap gap-2">
              {(activeWorkspace === 'people' ? peopleSections : activeWorkspace === 'fleet' ? fleetSections : activeWorkspace === 'settings' ? settingsSections : []).map((section) => {
                const Icon = section.icon;
                const isActive =
                  (activeWorkspace === 'people' && activePeopleSection === section.id) ||
                  (activeWorkspace === 'fleet' && activeFleetSection === section.id) ||
                  (activeWorkspace === 'settings' && activeSettingsSection === section.id);

                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      if (activeWorkspace === 'people') {
                        applyDashboardRoute({ workspace: 'people', people: section.id as PeopleSection, focusedDriverId: undefined });
                      }
                      if (activeWorkspace === 'fleet') {
                        applyDashboardRoute({ workspace: 'fleet', fleet: section.id as FleetSection, focusedVehicleId: undefined });
                      }
                      if (activeWorkspace === 'settings') applyDashboardRoute({ workspace: 'settings', settings: section.id as SettingsSection });
                    }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                      isActive ? 'bg-brand-dark text-white' : 'text-slate-400 hover:bg-brand-dark/40 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                    {'badge' in section && section.badge && section.badge > 0 ? (
                      <span className="ml-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                        {section.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Suspense fallback={<TabLoading />}>
            {activeWorkspace === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ComplianceSnapshot onAction={() => openComplianceWorkspace('overview')} />
                  <VehicleComplianceSnapshot
                    onAction={() => applyDashboardRoute({ workspace: 'fleet', fleet: 'vehicles', focusedVehicleId: undefined })}
                    onReviewVehicle={(vehicleId, focusedDate) => openComplianceWorkspace('vehicle_units', { focusedVehicleId: vehicleId, focusedDate })}
                  />
                  <DriverComplianceSnapshot
                    onAction={() => applyDashboardRoute({ workspace: 'people', people: 'drivers', focusedDriverId: undefined })}
                    onReviewDriver={(driverId, focusedDate) => openComplianceWorkspace('driver_cards', { focusedDriverId: driverId, focusedDate })}
                  />
                </div>

                {/* Driver Risk Scores — full width row */}
                <DriverRiskSnapshot
                  onAction={() => openComplianceWorkspace('overview')}
                  onReviewDriver={(driverId, focusedDate) => openComplianceWorkspace('driver_cards', { focusedDriverId: driverId, focusedDate })}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <AlertsFeed />
                  </div>
                  <div className="lg:col-span-1 space-y-6">
                    <BroadcastMessage />
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-900/20">
                      <div className="flex items-center gap-2 mb-4">
                        <GraduationCap className="text-blue-200" size={20} />
                        <h4 className="font-black uppercase tracking-widest text-xs opacity-80">{t('dashboard.manager.alerts.trainingMode')}</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{t('dashboard.manager.alerts.discrepancy')}</span>
                          <span className="font-bold text-amber-300">2 Alerts</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1.5">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '60%' }}></div>
                        </div>
                        <p className="text-[10px] leading-relaxed opacity-70">
                          Historical tacho imports show mode-switch errors for 2 drivers. Assign refresher training modules to clear these alerts.
                        </p>
                        <button
                          onClick={() => applyDashboardRoute({ workspace: 'people', people: 'training', focusedDriverId: undefined })}
                          className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition"
                        >
                          Open Training Center
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeWorkspace === 'people' && activePeopleSection === 'drivers' && (
              <DriverManagement
                focusedDriverId={focusedDriverRecordId}
                onOpenDriverTacho={(driverId) => openComplianceWorkspace('driver_cards', { focusedDriverId: driverId })}
                onOpenDriverCompliance={(driverId) => openComplianceWorkspace('driver_cards', { focusedDriverId: driverId })}
                onOpenDriverTraining={() => applyDashboardRoute({ workspace: 'people', people: 'training', focusedDriverId: undefined })}
              />
            )}
            {activeWorkspace === 'people' && activePeopleSection === 'training' && <TachoTrainingModule />}
            {activeWorkspace === 'people' && activePeopleSection === 'shifts' && <ShiftPlanner />}
            {activeWorkspace === 'people' && activePeopleSection === 'supervisors' && <SupervisorManagement />}
            {activeWorkspace === 'people' && activePeopleSection === 'messages' && <MessagingHub />}

            {activeWorkspace === 'fleet' && activeFleetSection === 'vehicles' && (
              <VehicleManagement
                focusedVehicleId={focusedVehicleRecordId}
                onOpenVehicleTacho={(vehicleId) => openComplianceWorkspace('vehicle_units', { focusedVehicleId: vehicleId })}
                onOpenVehicleIncidents={() => applyDashboardRoute({ workspace: 'fleet', fleet: 'incidents', focusedVehicleId: undefined })}
              />
            )}
            {activeWorkspace === 'fleet' && activeFleetSection === 'vehicle_checks' && (
              <VehicleChecksModule onNavigateToFleet={() => applyDashboardRoute({ workspace: 'fleet', fleet: 'vehicles', focusedVehicleId: undefined })} />
            )}
            {activeWorkspace === 'fleet' && activeFleetSection === 'fuel' && <FuelMileageTracker />}
            {activeWorkspace === 'fleet' && activeFleetSection === 'olicence' && <OLicenceComplianceCentre />}
            {activeWorkspace === 'fleet' && activeFleetSection === 'incidents' && <IncidentReporting />}

            {activeWorkspace === 'compliance' && (
                <TachoComplianceWorkspace
                  onViewSession={(driverId, date) => openReportsWorkspace({ focusedDriverId: driverId, focusedDate: date })}
                  onOpenDriverAnalysis={(driverId, date) =>
                    openComplianceWorkspace('driver_cards', {
                      focusedDriverId: driverId,
                      focusedDate: date,
                    })
                  }
                  onOpenPersonnelFile={(driverId) => {
                    applyDashboardRoute({ workspace: 'people', people: 'drivers', focusedDriverId: driverId });
                  }}
                  onOpenDriverCompliance={(driverId) => openComplianceWorkspace('driver_cards', { focusedDriverId: driverId })}
                  onOpenDriverTraining={(driverId) => applyDashboardRoute({ workspace: 'people', people: 'training', focusedDriverId: driverId })}
                  onOpenFleetRecord={(vehicleId) => {
                    applyDashboardRoute({ workspace: 'fleet', fleet: 'vehicles', focusedVehicleId: vehicleId });
                  }}
                  onOpenVehicleMaintenance={(vehicleId) => {
                    applyDashboardRoute({ workspace: 'fleet', fleet: 'vehicles', focusedVehicleId: vehicleId });
                  }}
                  onOpenVehicleIncidents={(vehicleId) => applyDashboardRoute({ workspace: 'fleet', fleet: 'incidents', focusedVehicleId: vehicleId })}
                  onTabChange={(tab) => applyDashboardRoute({ workspace: 'compliance', tacho: tab })}
                  initialTab={complianceWorkspaceState.tab}
                  focusedVehicleId={complianceWorkspaceState.focusedVehicleId}
                  focusedDriverId={complianceWorkspaceState.focusedDriverId}
                  focusedDate={complianceWorkspaceState.focusedDate}
                />
              )}

            {activeWorkspace === 'reports' && (
              <ReportsAndExports
                focusedDriverId={reportsWorkspaceState.focusedDriverId}
                focusedDate={reportsWorkspaceState.focusedDate}
                onOpenDriverAnalysis={(driverId, date) =>
                  openComplianceWorkspace('driver_cards', {
                    focusedDriverId: driverId,
                    focusedDate: date,
                  })
                }
              />
            )}
            {activeWorkspace === 'settings' && activeSettingsSection === 'account' && (
              <div className="space-y-6">
                  <UserProfileSettings />
                  <MfaSettings />
              </div>
            )}
            {activeWorkspace === 'settings' && activeSettingsSection === 'company' && (
              <div className="space-y-6">
                  <BillingManager />
                  <CompanySettings />
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
