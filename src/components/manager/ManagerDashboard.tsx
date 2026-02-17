import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Shield, DollarSign } from 'lucide-react';
import { ComplianceScoreboard } from './ComplianceScoreboard';
import { DriverManagement } from './DriverManagement';
import { ReportsModule } from './ReportsModule';
import { AuditTrail } from './AuditTrail';
import { CompanySettings } from './CompanySettings';
import { SupervisorManagement } from './SupervisorManagement';
import { AlertsFeed } from './AlertsFeed';
import { PayrollModule } from './PayrollModule';
import { MfaSettings } from './MfaSettings';
import { BillingManager } from './BillingManager'; // Import the new billing component

type Tab = 'dashboard' | 'drivers' | 'supervisors' | 'payroll' | 'reports' | 'audit' | 'settings';

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'drivers' as Tab, label: 'Drivers', icon: Users },
    { id: 'supervisors' as Tab, label: 'Supervisors', icon: Shield },
    { id: 'payroll' as Tab, label: 'Payroll', icon: DollarSign },
    { id: 'reports' as Tab, label: 'Reports', icon: FileText },
    { id: 'audit' as Tab, label: 'Audit Trail', icon: AlertTriangle },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-brand-dark">
      <nav className="bg-brand-card border-b border-brand-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-brand-accent-dark rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">HourWise EU</h1>
                <p className="text-xs text-slate-400">Fleet Manager Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                <p className="text-xs text-slate-400">Fleet Manager</p>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-brand-dark rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-brand-card rounded-xl shadow-sm mb-6 border border-brand-border">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-brand-accent text-brand-accent bg-brand-dark/50'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-brand-card/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <ComplianceScoreboard />
              <AlertsFeed />
            </div>
          )}
          {activeTab === 'drivers' && <DriverManagement />}
          {activeTab === 'supervisors' && <SupervisorManagement />}
          {activeTab === 'payroll' && <PayrollModule />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab === 'audit' && <AuditTrail />}
          {activeTab === 'settings' && (
            <div className="space-y-6">
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
