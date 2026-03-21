import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next'; // Import
import { LogOut, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Shield, DollarSign, Receipt, ShieldCheck, Truck, Activity, GraduationCap } from 'lucide-react';
import { ComplianceScoreboard } from './ComplianceScoreboard';
import { DriverManagement } from './DriverManagement';
import { ReportsModule } from './ReportsModule';
import { AuditTrail } from './AuditTrail';
import { CompanySettings } from './CompanySettings';
import { SupervisorManagement } from './SupervisorManagement';
import { AlertsFeed } from './AlertsFeed';
import { PayrollModule } from './PayrollModule';
import { MfaSettings } from './MfaSettings';
import { BillingManager } from './BillingManager';
import { ExpenseApproval } from './ExpenseApproval';
import { BroadcastMessage } from './BroadcastMessage';
import { VehicleChecksModule } from './VehicleChecksModule';
import { VehicleManagement } from './VehicleManagement';
import { VehicleComplianceSnapshot } from './VehicleComplianceSnapshot';
import { DriverComplianceSnapshot } from './DriverComplianceSnapshot';
import { ComplianceSnapshot } from './ComplianceSnapshot';
import { TachoTrainingModule } from './TachoTrainingModule';
import { UserProfileSettings } from './UserProfileSettings';

type Tab = 'dashboard' | 'drivers' | 'compliance' | 'training' | 'fleet' | 'vehicle_checks' | 'supervisors' | 'payroll' | 'expenses' | 'reports' | 'audit' | 'settings';

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation(); // Use hook
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: t('navigation.dashboard'), icon: LayoutDashboard },
    { id: 'drivers' as Tab, label: t('navigation.drivers'), icon: Users },
    { id: 'compliance' as Tab, label: t('navigation.compliance'), icon: Activity },
    { id: 'training' as Tab, label: t('navigation.training'), icon: GraduationCap },
    { id: 'fleet' as Tab, label: t('navigation.fleet'), icon: Truck },
    { id: 'vehicle_checks' as Tab, label: t('navigation.safetyChecks'), icon: ShieldCheck },
    { id: 'supervisors' as Tab, label: t('navigation.supervisors'), icon: Shield },
    { id: 'payroll' as Tab, label: t('navigation.payroll'), icon: DollarSign },
    { id: 'expenses' as Tab, label: t('navigation.expenses'), icon: Receipt },
    { id: 'reports' as Tab, label: t('navigation.reports'), icon: FileText },
    { id: 'audit' as Tab, label: t('navigation.auditTrail'), icon: AlertTriangle },
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
                </button>
              );
            })}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ComplianceSnapshot onAction={() => setActiveTab('compliance')} />
                <VehicleComplianceSnapshot onAction={() => setActiveTab('fleet')} />
                <DriverComplianceSnapshot onAction={() => setActiveTab('drivers')} />
              </div>

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
          {activeTab === 'compliance' && <ComplianceScoreboard />}
          {activeTab === 'training' && <TachoTrainingModule />}
          {activeTab === 'fleet' && <VehicleManagement />}
          {activeTab === 'vehicle_checks' && <VehicleChecksModule />}
          {activeTab === 'supervisors' && <SupervisorManagement />}
          {activeTab === 'payroll' && <PayrollModule />}
          {activeTab === 'expenses' && <ExpenseApproval />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab === 'audit' && <AuditTrail />}
          {activeTab === 'settings' && (
            <div className="space-y-6">
                <UserProfileSettings />
                <BillingManager />
                <CompanySettings />
                <MfaSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
