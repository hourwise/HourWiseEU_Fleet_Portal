import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogOut, LayoutDashboard, Users, FileBarChart2, Settings, Shield, ShieldCheck, ShieldAlert, Truck, Activity, GraduationCap, MessageSquare, Fuel, Calendar as CalendarIcon } from 'lucide-react';

// Lazy load dashboard components
const ComplianceScoreboard = lazy(() => import('./ComplianceScoreboard').then(m => ({ default: m.ComplianceScoreboard })));
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
const InfringementManagement = lazy(() => import('./InfringementManagement').then(m => ({ default: m.InfringementManagement })));
const ShiftPlanner = lazy(() => import('./ShiftPlanner').then(m => ({ default: m.ShiftPlanner })));
const IncidentReporting = lazy(() => import('./IncidentReporting').then(m => ({ default: m.IncidentReporting })));
const OLicenceComplianceCentre = lazy(() => import('./OLicenceComplianceCentre').then(m => ({ default: m.OLicenceComplianceCentre })));

function TabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent" />
    </div>
  );
}

type Tab = 'dashboard' | 'drivers' | 'shifts' | 'incidents' | 'olicence' | 'compliance' | 'training' | 'fleet' | 'fuel' | 'vehicle_checks' | 'supervisors' | 'messages' | 'reports' | 'settings';

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Live unread count — messages sent to this manager that haven't been read
  useEffect(() => {
    if (!profile?.id || !profile?.company_id) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('recipient_id', profile.id)
        .is('read_at', null);
      setUnreadMessages(count ?? 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('dashboard:unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `company_id=eq.${profile.company_id}` }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, profile?.company_id]);

  const tabs = [
    { id: 'dashboard' as Tab, label: t('navigation.dashboard'), icon: LayoutDashboard },
    { id: 'drivers' as Tab, label: t('navigation.drivers'), icon: Users },
    { id: 'incidents' as Tab, label: 'Incidents', icon: ShieldAlert },
    { id: 'shifts' as Tab, label: 'Shifts', icon: CalendarIcon },
    { id: 'olicence' as Tab, label: 'O-Licence Centre', icon: Shield },
    { id: 'compliance' as Tab, label: t('navigation.compliance'), icon: Activity },
    { id: 'training' as Tab, label: t('navigation.training'), icon: GraduationCap },
    { id: 'fleet' as Tab, label: t('navigation.fleet'), icon: Truck },
    { id: 'fuel' as Tab, label: 'Fuel & Mileage', icon: Fuel },
    { id: 'vehicle_checks' as Tab, label: t('navigation.safetyChecks'), icon: ShieldCheck },
    { id: 'supervisors' as Tab, label: t('navigation.supervisors'), icon: Users },
    { id: 'messages' as Tab, label: 'Messages', icon: MessageSquare },
    { id: 'reports' as Tab, label: 'Reports & Exports', icon: FileBarChart2 },
    { id: 'settings' as Tab, label: t('navigation.settings'), icon: Settings },
  ];

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
                <p className="text-xs text-slate-400">{t('navigation.dashboard')}</p>
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
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-black text-xs uppercase tracking-widest border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-brand-accent text-brand-accent bg-brand-dark/50'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-brand-card/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'messages' && unreadMessages > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      {unreadMessages}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Suspense fallback={<TabLoading />}>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ComplianceSnapshot onAction={() => setActiveTab('compliance')} />
                  <VehicleComplianceSnapshot onAction={() => setActiveTab('fleet')} />
                  <DriverComplianceSnapshot onAction={() => setActiveTab('drivers')} />
                </div>

                {/* Driver Risk Scores — full width row */}
                <DriverRiskSnapshot onAction={() => setActiveTab('compliance')} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <AlertsFeed title={t('dashboard.manager.alerts.title')} />
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
                          onClick={() => setActiveTab('training')}
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

            {activeTab === 'drivers' && <DriverManagement />}
            {activeTab === 'incidents' && <IncidentReporting />}
            {activeTab === 'shifts' && <ShiftPlanner />}
            {activeTab === 'olicence' && <OLicenceComplianceCentre />}
            {activeTab === 'compliance' && (
              <div className="space-y-8">
                <ComplianceScoreboard onViewSession={() => setActiveTab('reports')} />
                <InfringementManagement />
              </div>
            )}
            {activeTab === 'training' && <TachoTrainingModule />}
            {activeTab === 'fleet' && <VehicleManagement />}
            {activeTab === 'fuel' && <FuelMileageTracker />}
            {activeTab === 'vehicle_checks' && <VehicleChecksModule onNavigateToFleet={() => setActiveTab('fleet')} />}
            {activeTab === 'supervisors' && <SupervisorManagement />}
            {activeTab === 'messages' && <MessagingHub />}
            {activeTab === 'reports' && <ReportsAndExports />}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                  <UserProfileSettings />
                  <BillingManager />
                  <CompanySettings />
                  <MfaSettings />
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
