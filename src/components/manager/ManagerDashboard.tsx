import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import type { ElementType } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LogOut, LayoutDashboard, Users, FileBarChart2, Settings,
  Shield, ShieldCheck, ShieldAlert, Truck, Activity,
  GraduationCap, MessageSquare, Fuel, Calendar as CalendarIcon,
  Gauge, FileText, Wrench, AlertTriangle, Bell, Search, UserCircle,
  Menu, X, ChevronRight, ChevronDown, Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hw-blue-600" />
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      reportDriverId: has('reportDriver') ? next.reportDriverId : reportsWorkspaceState.focusedDriverId,
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
    { id: 'compliance' as Workspace, label: t('navigation.compliance'), icon: Gauge },
    { id: 'reports' as Workspace, label: 'Reports', icon: FileText },
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
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  ];

  const settingsSections: { id: SettingsSection; label: string; icon: ElementType }[] = [
    { id: 'account', label: 'Account', icon: UserCircle },
    { id: 'company', label: 'Company', icon: Shield },
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

  const currentWorkspaceLabel = workspaces.find(w => w.id === activeWorkspace)?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-hw-navy-950 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-hw-navy-900 border-r border-white/5 transition-all duration-300 z-30",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-hw-blue-600/30 flex-shrink-0">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-lg text-hw-white leading-none truncate">HourWise</span>
              <span className="text-[10px] font-bold text-hw-blue-600 tracking-[0.2em] uppercase mt-1">EU Portal</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = activeWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => applyDashboardRoute({ workspace: ws.id })}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                  isActive
                    ? "bg-hw-blue-600 text-white shadow-lg shadow-hw-blue-600/20"
                    : "text-hw-slate-400 hover:text-hw-white hover:bg-white/5"
                )}
              >
                <Icon size={20} className={cn("flex-shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-hw-slate-500")} />
                {!sidebarCollapsed && <span className="text-sm font-semibold truncate">{ws.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-3 text-hw-slate-500 hover:text-hw-white rounded-xl transition-colors"
          >
            <ChevronRight className={cn("transition-transform duration-300", sidebarCollapsed ? "rotate-0" : "rotate-180")} />
            {!sidebarCollapsed && <span className="text-xs font-bold uppercase tracking-widest">Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-hw-navy-900 z-50 transform transition-transform duration-300 lg:hidden",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">H</span>
             </div>
             <span className="font-bold text-xl text-hw-white">HourWise</span>
          </div>
          <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-hw-slate-400 hover:text-hw-white">
             <X size={24} />
          </button>
        </div>
        <nav className="px-4 py-6 space-y-2">
           {workspaces.map((ws) => {
             const Icon = ws.icon;
             return (
               <button
                 key={ws.id}
                 onClick={() => {
                   applyDashboardRoute({ workspace: ws.id });
                   setMobileSidebarOpen(false);
                 }}
                 className={cn(
                   "w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold",
                   activeWorkspace === ws.id ? "bg-hw-blue-600 text-white" : "text-hw-slate-400 hover:bg-white/5 hover:text-hw-white"
                 )}
               >
                 <Icon size={24} />
                 {ws.label}
               </button>
             );
           })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/5">
           <button onClick={signOut} className="w-full flex items-center gap-4 px-4 py-4 text-hw-red-500 font-bold hover:bg-hw-red-500/10 rounded-2xl transition-colors">
              <LogOut size={24} />
              Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-hw-navy-900/50 backdrop-blur-md border-b border-white/5 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-hw-slate-400 hover:text-hw-white bg-white/5 rounded-lg border border-white/10"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold text-hw-white hidden sm:block">{currentWorkspaceLabel}</h2>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hw-slate-500 group-focus-within:text-hw-blue-600 transition-colors" size={16} />
               <input
                 type="text"
                 placeholder="Search drivers or vehicles..."
                 className="bg-hw-navy-950 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-hw-white placeholder:text-hw-slate-600 focus:outline-none focus:border-hw-blue-600 focus:ring-1 focus:ring-hw-blue-600 transition-all w-64"
               />
            </div>

            <div className="flex items-center gap-2">
               <button className="p-2 text-hw-slate-400 hover:text-hw-white hover:bg-white/5 rounded-xl transition-all relative">
                 <Bell size={20} />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-hw-red-500 rounded-full border-2 border-hw-navy-900"></span>
               </button>
               <div className="h-8 w-px bg-white/5 mx-2 hidden sm:block"></div>
               <div className="flex items-center gap-3 pl-2">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-bold text-hw-white leading-none">{profile?.full_name}</p>
                    <p className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest mt-1">Fleet Manager</p>
                  </div>
                  <button className="h-10 w-10 rounded-xl bg-hw-navy-800 border border-white/10 flex items-center justify-center hover:border-hw-blue-600 transition-colors group overflow-hidden">
                     {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                     ) : (
                        <UserCircle size={24} className="text-hw-slate-400 group-hover:text-hw-blue-600 transition-colors" />
                     )}
                  </button>
                  <button onClick={signOut} className="hidden sm:flex p-2 text-hw-slate-400 hover:text-hw-red-500 hover:bg-hw-red-500/10 rounded-xl transition-all" title="Sign Out">
                    <LogOut size={20} />
                  </button>
               </div>
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {/* Section Navigation (Sub-tabs) */}
          {activeWorkspace !== 'dashboard' && activeWorkspace !== 'reports' && activeWorkspace !== 'compliance' && (
            <div className="flex items-center gap-1 bg-hw-navy-900 p-1 rounded-2xl border border-white/5 mb-8 w-fit">
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
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all whitespace-nowrap",
                      isActive
                        ? "bg-hw-blue-600 text-white shadow-lg shadow-hw-blue-600/10"
                        : "text-hw-slate-500 hover:text-hw-slate-200 hover:bg-white/5"
                    )}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-hw-slate-500"} />
                    {section.label}
                    {'badge' in section && section.badge && section.badge > 0 ? (
                      <span className="ml-1 bg-hw-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                        {section.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<TabLoading />}>
              {activeWorkspace === 'dashboard' && (
                <div className="space-y-8 pb-12">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                    <div>
                       <h3 className="text-2xl font-bold text-hw-white">Welcome back, {profile?.full_name?.split(' ')[0]}</h3>
                       <p className="text-hw-slate-400 text-sm">Here's a snapshot of your fleet operations today.</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <button className="flex items-center gap-2 px-4 py-2 bg-hw-navy-900 border border-white/5 rounded-xl text-xs font-bold text-hw-white hover:border-hw-blue-600 transition-all">
                          <CalendarIcon size={14} className="text-hw-blue-600" />
                          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                       </button>
                       <button
                         onClick={() => openComplianceWorkspace()}
                         className="flex items-center gap-2 px-4 py-2 bg-hw-blue-600 rounded-xl text-xs font-bold text-white shadow-lg shadow-hw-blue-600/20 hover:bg-hw-blue-700 transition-all"
                       >
                          <Gauge size={14} />
                          Tacho Analysis
                       </button>
                    </div>
                  </div>

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

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between mb-2">
                         <h4 className="text-sm font-bold text-hw-white uppercase tracking-[0.2em] flex items-center gap-2">
                           <Activity size={16} className="text-hw-blue-600" />
                           Actionable Alerts
                         </h4>
                         <button onClick={() => applyDashboardRoute({ workspace: 'people', people: 'messages' })} className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest hover:underline">View All Notifications</button>
                      </div>
                      <AlertsFeed />
                    </div>
                    <div className="lg:col-span-1 space-y-8">
                      <div className="flex flex-col gap-6">
                        <BroadcastMessage />

                        <div className="relative group overflow-hidden">
                           <div className="absolute inset-0 bg-gradient-to-br from-hw-blue-700 to-hw-blue-900 opacity-90 group-hover:scale-105 transition-transform duration-500"></div>
                           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                              <Sparkles size={120} />
                           </div>
                           <div className="relative p-6 text-white h-full flex flex-col">
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="text-hw-cyan-500 animate-pulse" size={20} />
                                <h4 className="font-bold uppercase tracking-[0.2em] text-[10px] text-hw-cyan-500">AI Assistant / Beta</h4>
                              </div>
                              <h5 className="text-lg font-bold mb-2">Ask Atlas about your fleet</h5>
                              <p className="text-xs text-hw-slate-200 leading-relaxed mb-6">
                                "Identify missing checks" or "Summarise tachograph issues for David Smith."
                              </p>
                              <div className="mt-auto">
                                <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
                                   Open Atlas Console
                                </button>
                              </div>
                           </div>
                        </div>

                        <div className="bg-hw-navy-900 border border-white/5 rounded-2xl p-6 shadow-xl">
                          <div className="flex items-center gap-2 mb-4">
                            <GraduationCap className="text-hw-blue-600" size={18} />
                            <h4 className="font-bold uppercase tracking-[0.2em] text-[10px] text-hw-slate-500">{t('dashboard.manager.alerts.trainingMode')}</h4>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-hw-white">{t('dashboard.manager.alerts.discrepancy')}</span>
                              <span className="text-xs font-bold text-hw-amber-500 bg-hw-amber-500/10 px-2 py-0.5 rounded">2 Alerts</span>
                            </div>
                            <div className="w-full bg-hw-navy-950 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-hw-amber-500 h-1.5 rounded-full" style={{ width: '60%' }}></div>
                            </div>
                            <p className="text-[10px] leading-relaxed text-hw-slate-400">
                              Historical tacho imports show mode-switch errors for 2 drivers. Assign refresher training modules to clear these alerts.
                            </p>
                            <button
                              onClick={() => applyDashboardRoute({ workspace: 'people', people: 'training', focusedDriverId: undefined })}
                              className="w-full py-2.5 bg-hw-navy-950 hover:bg-hw-blue-600/10 border border-white/5 hover:border-hw-blue-600/50 rounded-xl text-[10px] font-bold text-hw-slate-400 hover:text-hw-blue-600 uppercase tracking-widest transition-all"
                            >
                              Open Training Center
                            </button>
                          </div>
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
                <div className="space-y-6 pb-12">
                    <UserProfileSettings />
                    <MfaSettings />
                </div>
              )}
              {activeWorkspace === 'settings' && activeSettingsSection === 'company' && (
                <div className="space-y-6 pb-12">
                    <BillingManager />
                    <CompanySettings />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
