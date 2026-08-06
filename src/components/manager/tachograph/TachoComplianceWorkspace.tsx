import { useEffect, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Activity, CreditCard, FileUp, FlaskConical, Truck } from 'lucide-react';
import { ComplianceScoreboard } from '../ComplianceScoreboard';
import { InfringementManagement } from '../InfringementManagement';
import { DriverCardAnalysis } from './DriverCardAnalysis';
import { TachoImportCentre } from './TachoImportCentre';
import { TachoSimulatorPreview } from './TachoSimulatorPreview';
import { VehicleUnitAnalysis } from './VehicleUnitAnalysis';

type Tab = 'overview' | 'imports' | 'driver_cards' | 'vehicle_units' | 'simulator';

const BASE_TABS: { id: Exclude<Tab, 'simulator'>; label: string; icon: ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'imports', label: 'Import Centre', icon: FileUp },
  { id: 'driver_cards', label: 'Driver Cards', icon: CreditCard },
  { id: 'vehicle_units', label: 'Vehicle Units', icon: Truck },
];

export function TachoComplianceWorkspace({
  onViewSession,
  onOpenDriverAnalysis,
  onOpenPersonnelFile,
  onOpenDriverCompliance,
  onOpenDriverTraining,
  onOpenFleetRecord,
  onOpenVehicleMaintenance,
  onOpenVehicleIncidents,
  initialTab,
  focusedVehicleId,
  focusedDriverId,
  focusedDate,
  onTabChange,
}: {
  onViewSession?: (driverId: string, date: string) => void;
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
  onOpenPersonnelFile?: (driverId: string) => void;
  onOpenDriverCompliance?: (driverId: string) => void;
  onOpenDriverTraining?: (driverId: string) => void;
  onOpenFleetRecord?: (vehicleId: string) => void;
  onOpenVehicleMaintenance?: (vehicleId: string) => void;
  onOpenVehicleIncidents?: (vehicleId: string) => void;
  initialTab?: Tab;
  focusedVehicleId?: string;
  focusedDriverId?: string;
  focusedDate?: string;
  onTabChange?: (tab: Tab) => void;
}) {
  const isDev = import.meta.env.DEV;
  const tabs: { id: Tab; label: string; icon: ElementType }[] = isDev
    ? [...BASE_TABS, { id: 'simulator', label: 'Simulator', icon: FlaskConical }]
    : BASE_TABS;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'overview');
  const [focusedImportId, setFocusedImportId] = useState<string | undefined>();

  useEffect(() => {
    if (initialTab && (initialTab !== 'simulator' || isDev)) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isDev]);

  useEffect(() => {
    if (focusedDriverId) setFocusedImportId(undefined);
  }, [focusedDriverId]);

  const openImportCentre = () => {
    setActiveTab('imports');
    onTabChange?.('imports');
  };

  const openCandidateCardAnalysis = (importId: string) => {
    setFocusedImportId(importId);
    setActiveTab('driver_cards');
    onTabChange?.('driver_cards');
  };

  const openDriverCards = () => {
    setFocusedImportId(undefined);
    setActiveTab('driver_cards');
    onTabChange?.('driver_cards');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id !== 'driver_cards') setFocusedImportId(undefined);
                setActiveTab(tab.id);
                onTabChange?.(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <ComplianceScoreboard onViewSession={onViewSession} onOpenDriverAnalysis={onOpenDriverAnalysis} />
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Tachograph workflow</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <WorkflowCard
                icon={<CreditCard className="w-5 h-5 text-blue-600" />}
                title="Driver Cards"
                text="Live driver-card reading and card analysis. Connect the desktop helper, insert a card, and review the driver's activity."
              />
              <WorkflowCard
                icon={<Truck className="w-5 h-5 text-blue-600" />}
                title="Vehicle Units"
                text="Vehicle-unit analysis for VU downloads, technical events and unit-level records."
              />
              <WorkflowCard
                icon={<FileUp className="w-5 h-5 text-blue-600" />}
                title="Import Centre"
                text="Manual uploads, VU downloads, import monitoring and support — including the manual driver-card file fallback."
              />
            </div>
          </div>
          <InfringementManagement onOpenDriverTacho={onOpenDriverAnalysis} />
        </div>
      )}
      {activeTab === 'imports' && <TachoImportCentre onOpenDriverAnalysis={onOpenDriverAnalysis} onOpenCandidateCardAnalysis={openCandidateCardAnalysis} onOpenDriverCards={openDriverCards} />}
      {activeTab === 'driver_cards' && (
        <DriverCardAnalysis
          driverId={focusedDriverId}
          importId={focusedImportId}
          focusedDate={focusedDate}
          onOpenImportCentre={openImportCentre}
          onOpenPersonnelFile={onOpenPersonnelFile}
          onOpenComplianceActions={onOpenDriverCompliance}
          onOpenTraining={onOpenDriverTraining}
        />
      )}
      {activeTab === 'vehicle_units' && (
        <VehicleUnitAnalysis
          vehicleId={focusedVehicleId}
          focusedDate={focusedDate}
          onOpenImportCentre={openImportCentre}
          onOpenFleetRecord={onOpenFleetRecord}
          onOpenMaintenance={onOpenVehicleMaintenance}
          onOpenIncidents={onOpenVehicleIncidents}
        />
      )}
      {isDev && activeTab === 'simulator' && <TachoSimulatorPreview />}
    </div>
  );
}

function WorkflowCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}
