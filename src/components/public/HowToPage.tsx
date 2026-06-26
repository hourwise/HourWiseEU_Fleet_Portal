import { UserPlus, Users, Clock, Shield, AlertTriangle, FileText } from 'lucide-react';
import { Link } from '../common/Link';
import { useTranslation } from 'react-i18next';

export function HowToPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold">{t('howTo.title')}</h1>
          <p className="text-xl mt-4 text-blue-100">
            {t('howTo.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">{t('howTo.sections.gettingStarted.title')}</h2>

          <div className="space-y-8">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="bg-blue-100 rounded-full p-3 mr-4">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{t('howTo.sections.gettingStarted.step1.title')}</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    {t('howTo.sections.gettingStarted.step1.description')}
                  </p>
                  <Link
                    href="/contact"
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Contact us
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="bg-green-100 rounded-full p-3 mr-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{t('howTo.sections.gettingStarted.step2.title')}</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    {t('howTo.sections.gettingStarted.step2.description')}
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 space-y-2">
                    {(t('howTo.sections.gettingStarted.step2.list', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="bg-orange-100 rounded-full p-3 mr-4">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{t('howTo.sections.gettingStarted.step3.title')}</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    {t('howTo.sections.gettingStarted.step3.description')}
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 space-y-2">
                    {(t('howTo.sections.gettingStarted.step3.list', { returnObjects: true }) as string[]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">{t('howTo.sections.managers.title')}</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                {t('howTo.sections.managers.compliance.title')}
              </h3>
              <p className="text-slate-700 leading-relaxed">
                {t('howTo.sections.managers.compliance.description')}
              </p>
            </div>

            <div className="border-l-4 border-red-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                {t('howTo.sections.managers.violations.title')}
              </h3>
              <p className="text-slate-700 leading-relaxed">
                {t('howTo.sections.managers.violations.description')}
              </p>
            </div>

            <div className="border-l-4 border-purple-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-purple-600" />
                {t('howTo.sections.managers.audit.title')}
              </h3>
              <p className="text-slate-700 leading-relaxed">
                {t('howTo.sections.managers.audit.description')}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">{t('howTo.sections.drivers.title')}</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('howTo.sections.drivers.workflow.title')}</h3>
            <ol className="space-y-4">
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{t('howTo.sections.drivers.workflow.step1.title')}</p>
                  <p className="text-slate-700">{t('howTo.sections.drivers.workflow.step1.description')}</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{t('howTo.sections.drivers.workflow.step2.title')}</p>
                  <p className="text-slate-700">{t('howTo.sections.drivers.workflow.step2.description')}</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{t('howTo.sections.drivers.workflow.step3.title')}</p>
                  <p className="text-slate-700">{t('howTo.sections.drivers.workflow.step3.description')}</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  4
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{t('howTo.sections.drivers.workflow.step4.title')}</p>
                  <p className="text-slate-700">{t('howTo.sections.drivers.workflow.step4.description')}</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">{t('howTo.sections.regulations.title')}</h2>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">{t('howTo.sections.regulations.limits.title')}</h3>
            <div className="space-y-3 text-slate-700">
              <p>
                <strong>{t('howTo.sections.regulations.limits.weekly')}</strong> {t('howTo.sections.regulations.limits.weeklyValue')}
              </p>
              <p>
                <strong>{t('howTo.sections.regulations.limits.fortnightly')}</strong> {t('howTo.sections.regulations.limits.fortnightlyValue')}
              </p>
              <p className="pt-3 border-t border-slate-300 text-sm">
                {t('howTo.sections.regulations.limits.footnote')}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('howTo.sections.help.title')}</h2>
          <p className="text-xl text-blue-100 mb-6">
            {t('howTo.sections.help.subtitle')}
          </p>
          <p className="text-lg">{t('howTo.sections.help.emailLabel')} support@hourwiseeu.co.uk</p>
        </section>
      </div>
    </div>
  );
}
