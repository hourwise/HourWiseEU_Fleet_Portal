import { UserPlus, Users, Clock, Shield, AlertTriangle, FileText, ChevronRight, CheckCircle2, Info } from 'lucide-react';
import { Link } from '../common/Link';
import { useTranslation } from 'react-i18next';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';

export function HowToPage() {
  const { t } = useTranslation();

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-hw-navy-950 text-hw-white">
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 overflow-hidden hw-hero-bg">
        <div className="absolute inset-0 hw-grid-overlay opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight">
              {t('howTo.title')}
            </h1>
            <p className="text-xl text-hw-slate-300 leading-relaxed">
              {t('howTo.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Getting Started Section */}
        <section className="mb-24">
          <div className="flex items-center space-x-3 mb-12">
            <div className="h-10 w-1 bg-hw-blue-600 rounded-full"></div>
            <h2 className="text-3xl font-bold">{t('howTo.sections.gettingStarted.title')}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <HWCard variant="glass" className="flex flex-col h-full border-white/5 hover:border-hw-blue-600/30 transition-colors">
              <div className="bg-hw-blue-600/10 rounded-2xl p-4 w-fit mb-6">
                <UserPlus className="h-8 w-8 text-hw-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-4">{t('howTo.sections.gettingStarted.step1.title')}</h3>
              <p className="text-hw-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                {t('howTo.sections.gettingStarted.step1.description')}
              </p>
              <HWButton
                variant="primary"
                size="sm"
                className="w-full group"
                onClick={() => window.location.href = '/contact'}
              >
                Join early access
                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </HWButton>
            </HWCard>

            {/* Step 2 */}
            <HWCard variant="glass" className="flex flex-col h-full border-white/5 hover:border-hw-blue-600/30 transition-colors">
              <div className="bg-hw-teal-500/10 rounded-2xl p-4 w-fit mb-6">
                <Users className="h-8 w-8 text-hw-teal-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">{t('howTo.sections.gettingStarted.step2.title')}</h3>
              <p className="text-hw-slate-400 text-sm leading-relaxed mb-6">
                {t('howTo.sections.gettingStarted.step2.description')}
              </p>
              <ul className="space-y-3">
                {(t('howTo.sections.gettingStarted.step2.list', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index} className="flex items-start space-x-3 text-xs text-hw-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-hw-teal-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </HWCard>

            {/* Step 3 */}
            <HWCard variant="glass" className="flex flex-col h-full border-white/5 hover:border-hw-blue-600/30 transition-colors">
              <div className="bg-hw-amber-500/10 rounded-2xl p-4 w-fit mb-6">
                <Clock className="h-8 w-8 text-hw-amber-500" />
              </div>
              <h3 className="text-xl font-bold mb-4">{t('howTo.sections.gettingStarted.step3.title')}</h3>
              <p className="text-hw-slate-400 text-sm leading-relaxed mb-6">
                {t('howTo.sections.gettingStarted.step3.description')}
              </p>
              <ul className="space-y-3">
                {(t('howTo.sections.gettingStarted.step3.list', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index} className="flex items-start space-x-3 text-xs text-hw-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-hw-amber-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </HWCard>
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-24 items-start">
          {/* Manager Section */}
          <section>
            <div className="flex items-center space-x-3 mb-10">
              <div className="h-8 w-1 bg-hw-blue-600 rounded-full"></div>
              <h2 className="text-2xl font-bold">{t('howTo.sections.managers.title')}</h2>
            </div>

            <div className="space-y-8">
              <div className="group">
                <div className="flex items-center space-x-3 mb-3">
                  <Shield className="h-5 w-5 text-hw-blue-600" />
                  <h3 className="font-bold text-hw-white group-hover:text-hw-blue-600 transition-colors">
                    {t('howTo.sections.managers.compliance.title')}
                  </h3>
                </div>
                <p className="text-hw-slate-400 text-sm leading-relaxed border-l border-white/10 pl-8 ml-2.5">
                  {t('howTo.sections.managers.compliance.description')}
                </p>
              </div>

              <div className="group">
                <div className="flex items-center space-x-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-hw-red-500" />
                  <h3 className="font-bold text-hw-white group-hover:text-hw-red-500 transition-colors">
                    {t('howTo.sections.managers.violations.title')}
                  </h3>
                </div>
                <p className="text-hw-slate-400 text-sm leading-relaxed border-l border-white/10 pl-8 ml-2.5">
                  {t('howTo.sections.managers.violations.description')}
                </p>
              </div>

              <div className="group">
                <div className="flex items-center space-x-3 mb-3">
                  <FileText className="h-5 w-5 text-hw-cyan-500" />
                  <h3 className="font-bold text-hw-white group-hover:text-hw-cyan-500 transition-colors">
                    {t('howTo.sections.managers.audit.title')}
                  </h3>
                </div>
                <p className="text-hw-slate-400 text-sm leading-relaxed border-l border-white/10 pl-8 ml-2.5">
                  {t('howTo.sections.managers.audit.description')}
                </p>
              </div>
            </div>
          </section>

          {/* Driver Workflow */}
          <section>
            <div className="flex items-center space-x-3 mb-10">
              <div className="h-8 w-1 bg-hw-blue-600 rounded-full"></div>
              <h2 className="text-2xl font-bold">{t('howTo.sections.drivers.title')}</h2>
            </div>

            <HWCard variant="glass" className="p-8 border-hw-blue-600/10 bg-hw-blue-600/5">
              <h3 className="text-xl font-bold mb-8 text-hw-blue-600">{t('howTo.sections.drivers.workflow.title')}</h3>
              <div className="space-y-8 relative">
                {/* Vertical Step Line */}
                <div className="absolute top-0 bottom-0 left-4 w-px bg-hw-blue-600/20"></div>

                {[1, 2, 3, 4].map((stepNum) => (
                  <div key={stepNum} className="relative flex items-start pl-12">
                    <span className="absolute left-0 w-8 h-8 bg-hw-blue-600 text-hw-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-hw-blue-600/20 z-10">
                      {stepNum}
                    </span>
                    <div>
                      <h4 className="font-bold text-hw-white mb-1">
                        {t(`howTo.sections.drivers.workflow.step${stepNum}.title`)}
                      </h4>
                      <p className="text-sm text-hw-slate-400">
                        {t(`howTo.sections.drivers.workflow.step${stepNum}.description`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </HWCard>
          </section>
        </div>

        {/* Regulations Section */}
        <section className="mt-24">
          <div className="flex items-center space-x-3 mb-12">
            <div className="h-8 w-1 bg-hw-blue-600 rounded-full"></div>
            <h2 className="text-2xl font-bold">{t('howTo.sections.regulations.title')}</h2>
          </div>

          <HWCard variant="glass" className="p-8 border-white/5 bg-hw-navy-900/50">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="h-5 w-5 text-hw-blue-600" />
              <h3 className="text-xl font-bold">{t('howTo.sections.regulations.limits.title')}</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-hw-slate-400 text-sm">{t('howTo.sections.regulations.limits.weekly')}</span>
                  <span className="font-bold text-hw-white">{t('howTo.sections.regulations.limits.weeklyValue')}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-hw-slate-400 text-sm">{t('howTo.sections.regulations.limits.fortnightly')}</span>
                  <span className="font-bold text-hw-white">{t('howTo.sections.regulations.limits.fortnightlyValue')}</span>
                </div>
              </div>
              <div className="bg-hw-navy-950/50 p-6 rounded-2xl border border-white/5 flex items-center">
                <p className="text-xs text-hw-slate-500 italic leading-relaxed">
                  {t('howTo.sections.regulations.limits.footnote')}
                </p>
              </div>
            </div>
          </HWCard>
        </section>

        {/* Support Section */}
        <section className="mt-24 text-center">
          <HWCard variant="glass" className="py-16 px-8 border-hw-blue-600/20 bg-gradient-to-br from-hw-blue-600/10 via-transparent to-hw-teal-500/10">
            <h2 className="text-3xl font-bold mb-4">{t('howTo.sections.help.title')}</h2>
            <p className="text-lg text-hw-slate-300 mb-10 max-w-2xl mx-auto">
              {t('howTo.sections.help.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <HWButton
                variant="primary"
                size="lg"
                onClick={() => window.location.href = 'mailto:support@hourwiseeu.co.uk'}
                className="w-full sm:w-auto"
              >
                {t('howTo.sections.help.emailLabel')} support@hourwiseeu.co.uk
              </HWButton>
              <HWButton
                variant="outline"
                size="lg"
                onClick={() => window.location.href = '/contact'}
                className="w-full sm:w-auto"
              >
                Contact Support
              </HWButton>
            </div>
          </HWCard>
        </section>
      </div>
    </div>
  );
}
