import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { BookOpen, Clock, ChevronDown, ChevronUp, GraduationCap, CheckCircle } from 'lucide-react';
import type { Database } from '../../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface TrainingModule {
  id: string;
  title: string;
  duration: string;
  hours: number;
  category: string;
  summary: string;
  sections: { heading: string; body: string; callout?: string }[];
}

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'eu-hours',
    title: "EU Drivers' Hours Rules",
    duration: '20 min',
    hours: 0.33,
    category: 'Compliance',
    summary: 'EC 561/2006 daily and weekly driving limits, mandatory break rules, and rest period requirements.',
    sections: [
      {
        heading: 'Daily Driving Limit',
        body: 'You must not drive for more than 9 hours in a day. This can be extended to 10 hours no more than twice per week.',
        callout: '⚠️ Key Rule: 9-hour daily limit, extendable to 10 hours twice a week.',
      },
      {
        heading: 'Mandatory Breaks',
        body: 'After 4½ hours of driving you must take a break of at least 45 minutes. This can be split into a first break of at least 15 minutes followed by a break of at least 30 minutes — taken in that order.',
        callout: '⚠️ Key Rule: Break after 4.5 hrs — either 45 min continuous or 15 + 30 min split.',
      },
      {
        heading: 'Daily Rest',
        body: 'Regular daily rest is at least 11 consecutive hours. This can be reduced to 9 hours no more than 3 times per week (reduced daily rest). A split daily rest of 3 hrs + 9 hrs is also permitted.',
      },
      {
        heading: 'Weekly Driving Limit',
        body: 'You must not exceed 56 hours driving in a single week, and no more than 90 hours in any two consecutive weeks.',
        callout: '⚠️ Key Rule: 56-hour weekly limit, 90 hours fortnightly.',
      },
      {
        heading: 'Weekly Rest',
        body: 'Regular weekly rest is at least 45 consecutive hours. It can be reduced to 24 hours (reduced weekly rest) as long as the reduction is compensated in full, attached to another rest period of at least 9 hours, before the end of the third week following the week in question.',
      },
    ],
  },
  {
    id: 'tacho-modes',
    title: 'Tachograph Mode Switching',
    duration: '15 min',
    hours: 0.25,
    category: 'Tachograph',
    summary: 'When and how to switch tachograph modes correctly — the most common source of infringement notices.',
    sections: [
      {
        heading: 'The Four Modes',
        body: 'Your digital tachograph records in one of four modes at all times:\n• 🚗 Driving — selected automatically when the vehicle moves\n• 🔨 Other Work — loading, paperwork, vehicle checks\n• 🛠️ Availability — waiting at a ferry, waiting to be loaded\n• 🛌 Rest/Break — off duty, sleeper cab time',
      },
      {
        heading: 'Common Mistakes',
        body: 'The most frequent infringements occur when drivers:\n1. Forget to switch from Rest to Other Work before a walkaround check\n2. Leave the tacho in Driving mode during a break stop\n3. Do not manually enter activities when the card is not inserted',
        callout: '⚠️ Always switch mode BEFORE starting the activity — not after.',
      },
      {
        heading: 'Manual Entries',
        body: 'If your card was not in the tachograph (e.g. on a ferry, previous employer, illness), you MUST manually enter activities via the manual entry function. Failure to do so is an offence regardless of the reason.',
      },
      {
        heading: 'Printouts & Downloads',
        body: 'Drivers must be able to produce a printout on request from enforcement officers. The vehicle unit must be downloaded every 90 days and the driver card every 28 days by the operator.',
        callout: '⚠️ Card download every 28 days — operator responsibility.',
      },
    ],
  },
  {
    id: 'walkaround',
    title: 'Daily Walkaround Checks',
    duration: '15 min',
    hours: 0.25,
    category: 'Vehicle Safety',
    summary: 'What to inspect, how to record it, and what to do when you find a defect.',
    sections: [
      {
        heading: 'Legal Requirement',
        body: 'Drivers have a legal duty under the Road Vehicles (Construction and Use) Regulations 1986 to ensure the vehicle is in a roadworthy condition before driving. A daily walkaround check is the primary means of fulfilling this duty.',
      },
      {
        heading: 'What to Check',
        body: 'Work systematically around the vehicle:\n• Tyres — pressure, tread depth (min 1mm HGV), condition, wheel nuts\n• Lights & reflectors — headlights, brake lights, indicators, number plate light\n• Brakes — check air pressure gauge, listen for leaks\n• Mirrors & glass — clean, correctly adjusted, no cracks\n• Bodywork — no sharp edges, doors secure, curtainsides intact\n• Fuel, oil, coolant levels\n• Load security — straps, curtains, sheeting\n• Any fluid leaks underneath',
      },
      {
        heading: 'Recording Defects',
        body: 'Any defects found MUST be recorded immediately in the defect report (or via this app). Minor defects that do not affect roadworthiness should still be reported. Major defects mean the vehicle must NOT be driven until repaired.',
        callout: '⚠️ "No defects" is still a record — you must record a nil defect check too.',
      },
      {
        heading: 'What Happens If You Skip It',
        body: 'An incomplete or missing daily check puts the licence of both driver and operator at risk. Enforcement officers can issue immediate prohibitions and fixed penalties. Serious cases are referred to the Traffic Commissioner.',
      },
    ],
  },
  {
    id: 'infraction-consequences',
    title: 'Infraction Consequences',
    duration: '15 min',
    hours: 0.25,
    category: 'Compliance',
    summary: "What happens when hours rules are broken — fines, prohibitions, and impact on the operator's licence.",
    sections: [
      {
        heading: 'DVSA Enforcement',
        body: 'The Driver and Vehicle Standards Agency (DVSA) and police can stop any commercial vehicle and require the production of tachograph data for the current day and the previous 28 days.',
      },
      {
        heading: 'Fixed Penalty Notices',
        body: 'Drivers can receive fixed penalties of up to £300 per offence at the roadside. More serious offences are referred to court where unlimited fines are possible. Common roadside penalties:\n• Exceeding daily driving limit: £300\n• No or insufficient break: £300\n• Insufficient rest: £300',
        callout: '⚠️ Multiple offences at a single stop are treated separately — costs add up fast.',
      },
      {
        heading: 'Immediate Prohibition',
        body: 'If a driver is found to be fatigued or has exceeded driving limits, enforcement officers can issue an immediate prohibition — you park the vehicle where it stands until the rest requirement is met.',
      },
      {
        heading: 'Impact on Operator Licence',
        body: "Every infringement found by DVSA is recorded against the operator's licence. Accumulated infringements trigger a call-up to the Traffic Commissioner, which can result in curtailment, suspension, or revocation of the operator's licence — meaning the company cannot legally operate its vehicles.",
      },
    ],
  },
  {
    id: 'weekly-rest',
    title: 'Weekly & Fortnightly Rest Rules',
    duration: '15 min',
    hours: 0.25,
    category: 'Compliance',
    summary: 'Regular and reduced weekly rest explained clearly, including compensatory rest obligations.',
    sections: [
      {
        heading: 'Regular Weekly Rest',
        body: 'A regular weekly rest period is a minimum of 45 consecutive hours. This must begin no later than the end of six 24-hour periods from the end of the previous weekly rest period.',
      },
      {
        heading: 'Reduced Weekly Rest',
        body: 'Weekly rest can be reduced to no less than 24 consecutive hours. However, for every hour of reduction, you must compensate it in a single block, attached to a rest of at least 9 hours, before the end of the third week after the reduction week.',
        callout: '⚠️ You cannot carry more than one reduced rest compensation at a time.',
      },
      {
        heading: 'Location of Weekly Rest',
        body: 'Since 2020 (EU Regulation 2020/1054), drivers must not take regular or reduced weekly rest in the cab of their vehicle. Accommodation of appropriate quality — at the employer\'s cost — must be provided. The vehicle can be used for daily rest (max 3 reduced daily rests between weekly rests).',
      },
      {
        heading: 'Ferry & Train Exception',
        body: 'When a driver accompanies a vehicle on a ferry or train, the weekly rest may be interrupted no more than twice by other activities not exceeding one hour in total (e.g. boarding and disembarking). The driver must have access to a sleeper cabin or couchette during the regular weekly rest.',
      },
    ],
  },
];

interface TrainingLibraryProps {
  drivers: Profile[];
  onAssigned: () => void;
}

export function TrainingLibrary({ drivers, onAssigned }: TrainingLibraryProps) {
  const { profile } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignDriver, setAssignDriver] = useState('');
  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  const activeDrivers = drivers.filter(d => d.role === 'driver' && d.is_active);

  const handleAssign = async (mod: TrainingModule) => {
    if (!assignDriver || !profile?.company_id) return;
    setAssigning(mod.id);
    await supabase.from('training_records').insert({
      company_id: profile.company_id,
      driver_id: assignDriver,
      training_type: 'module',
      module_id: mod.id,
      title: mod.title,
      hours_credited: mod.hours,
      status: 'assigned',
      assigned_by: profile.id,
    });
    setAssigning(null);
    setAssignDriver('');
    setJustAssigned(mod.id);
    setTimeout(() => setJustAssigned(null), 2500);
    onAssigned();
  };

  const categoryColour: Record<string, string> = {
    Compliance: 'bg-blue-100 text-blue-700',
    Tachograph: 'bg-purple-100 text-purple-700',
    'Vehicle Safety': 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Select a module to read, then assign it to a driver. Each module credits CPC-equivalent hours to their training record once completed.
      </p>

      {TRAINING_MODULES.map(mod => {
        const isOpen = expandedId === mod.id;
        return (
          <div key={mod.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpandedId(isOpen ? null : mod.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-2.5 rounded-xl mt-0.5">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-black text-slate-900">{mod.title}</h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${categoryColour[mod.category] ?? 'bg-slate-100 text-slate-600'}`}>
                      {mod.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{mod.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={12} /> {mod.duration}</span>
                    <span className="text-xs text-slate-400">{mod.hours} hr credited</span>
                  </div>
                </div>
              </div>
              {isOpen ? <ChevronUp className="text-slate-400 shrink-0" size={20} /> : <ChevronDown className="text-slate-400 shrink-0" size={20} />}
            </button>

            {/* Content */}
            {isOpen && (
              <div className="border-t border-slate-100">
                <div className="p-6 space-y-5">
                  {mod.sections.map((sec, i) => (
                    <div key={i}>
                      <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">{sec.heading}</h5>
                      <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{sec.body}</p>
                      {sec.callout && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm font-bold text-amber-800">
                          {sec.callout}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Assign bar */}
                <div className="border-t border-slate-100 bg-slate-50 p-4 flex items-center gap-3">
                  <GraduationCap size={16} className="text-blue-600 shrink-0" />
                  <select
                    value={assignDriver}
                    onChange={e => setAssignDriver(e.target.value)}
                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                  >
                    <option value="">Assign to a driver…</option>
                    {activeDrivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(mod)}
                    disabled={!assignDriver || assigning === mod.id}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {justAssigned === mod.id
                      ? <><CheckCircle size={14} /> Assigned!</>
                      : assigning === mod.id ? 'Saving…' : 'Assign'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
