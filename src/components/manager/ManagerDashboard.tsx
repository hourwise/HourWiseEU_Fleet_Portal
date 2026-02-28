import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, LayoutDashboard, Users, AlertTriangle, FileText, Settings, Shield, DollarSign, Receipt } from 'lucide-react';
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
import { BroadcastMessage } from './BroadcastMessage'; // Import the new component

type Tab = 'dashboard' | 'drivers' | 'supervisors' | 'payroll' | 'expenses' | 'reports' | 'audit' | 'settings';

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'drivers' as Tab, label: 'Drivers', icon: Users },
    { id: 'supervisors' as Tab, label: 'Supervisors', icon: Shield },
    { id: 'payroll' as Tab, label: 'Payroll', icon: DollarSign },
    { id: 'expenses' as Tab, label: 'Expenses', icon: Receipt },
    { id: 'reports' as Tab, label: 'Reports', icon: FileText },
    { id: 'audit' as Tab, label: 'Audit Trail', icon: AlertTriangle },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-brand-dark">
      <nav className="bg-brand-card border-b border-brand-border shadow-sm">
        {/* ... (Navbar content remains the same) ... */}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-brand-card rounded-xl shadow-sm mb-6 border border-brand-border">
          {/* ... (Tabs content remains the same) ... */}
        </div>

        <div>
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ComplianceScoreboard />
                <AlertsFeed />
              </div>
              <div className="lg:col-span-1 space-y-6">
                <BroadcastMessage />
              </div>
            </div>
          )}
          {activeTab === 'drivers' && <DriverManagement />}
          {activeTab === 'supervisors' && <SupervisorManagement />}
          {activeTab === 'payroll' && <PayrollModule />}
          {activeTab === 'expenses' && <ExpenseApproval />}
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
