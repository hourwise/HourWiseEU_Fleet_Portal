import React from 'react';
import { useTranslation } from 'react-i18next';

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">{t('terms.title')}</h1>
          <p className="text-xl mt-4 text-slate-300 font-medium">{t('common.lastUpdated', { date: '1st March 2026' })}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate max-w-none text-slate-700">

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.agreement.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('terms.sections.agreement.p1')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.license.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('terms.sections.license.p1')}</p>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('terms.sections.license.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.accuracy.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('terms.sections.accuracy.p1')}</p>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('terms.sections.accuracy.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.subscriptions.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('terms.sections.subscriptions.p1')}</p>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-2">{t('terms.sections.subscriptions.solo.title')}</h3>
            <p className="text-slate-600 mb-4">{t('terms.sections.subscriptions.solo.p1')}</p>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-2">{t('terms.sections.subscriptions.fleet.title')}</h3>
            <p className="text-slate-600 mb-4">{t('terms.sections.subscriptions.fleet.p1')}</p>

            <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-2">{t('terms.sections.subscriptions.general.title')}</h3>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('terms.sections.subscriptions.general.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.liability.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('terms.sections.liability.p1')}</p>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('terms.sections.liability.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.law.title')}</h2>
            <p className="text-slate-600 leading-relaxed">{t('terms.sections.law.p1')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.changes.title')}</h2>
            <p className="text-slate-600 leading-relaxed">{t('terms.sections.changes.p1')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('terms.sections.contact.title')}</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 shadow-sm">
              <p className="text-slate-900 font-black uppercase tracking-widest text-xs mb-2">{t('terms.sections.contact.team')}</p>
              <p className="text-slate-600 text-lg font-bold">{t('privacy.sections.contact.emailLabel')} <span className="text-blue-600">legal@hourwiseeu.co.uk</span></p>
              <p className="text-slate-500 mt-2 font-medium">Website: www.hourwiseeu.co.uk</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
