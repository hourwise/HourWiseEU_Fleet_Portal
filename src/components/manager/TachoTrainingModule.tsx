import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, Award, BookOpen, ClipboardList, FileSearch } from 'lucide-react';
import { useDrivers } from '../../hooks/useDrivers';
import { CpcDashboard } from './training/CpcDashboard';
import { TrainingLibrary } from './training/TrainingLibrary';
import { TrainingRecords } from './training/TrainingRecords';
import { TachoChecker } from './training/TachoChecker';

type Tab = 'cpc' | 'library' | 'tacho' | 'records';

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'cpc',     label: 'CPC Dashboard', Icon: Award },
  { id: 'library', label: 'Training Library', Icon: BookOpen },
  { id: 'tacho',   label: 'Tacho Checker', Icon: FileSearch },
  { id: 'records', label: 'Records', Icon: ClipboardList },
];

export function TachoTrainingModule() {
  const { profile } = useAuth();
  const { data: drivers } = useDrivers(profile?.company_id ?? undefined);
  const [activeTab, setActiveTab] = useState<Tab>('cpc');
  const [recordsRefresh, setRecordsRefresh] = useState(0);

  const triggerRecordsRefresh = () => setRecordsRefresh(n => n + 1);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <GraduationCap className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Training Centre</h2>
          <p className="text-gray-600 text-sm">CPC tracking, compliance modules, tacho analysis, and training records</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${
              activeTab === id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'cpc' && (
        <CpcDashboard drivers={drivers ?? []} />
      )}
      {activeTab === 'library' && (
        <TrainingLibrary
          drivers={drivers ?? []}
          onAssigned={triggerRecordsRefresh}
        />
      )}
      {activeTab === 'tacho' && (
        <TachoChecker
          drivers={drivers ?? []}
          onAssigned={triggerRecordsRefresh}
        />
      )}
      {activeTab === 'records' && (
        <TrainingRecords refresh={recordsRefresh} />
      )}
    </div>
  );
}
