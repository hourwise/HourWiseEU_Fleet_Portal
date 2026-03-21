import React from 'react';
import { useTranslation } from 'react-i18next';

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">{t('privacy.title')}</h1>
          <p className="text-xl mt-4 text-slate-300 font-medium">{t('common.lastUpdated', { date: '1st March 2026' })}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate max-w-none text-slate-700">
          
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.intro.title')}</h2>
            <p className="text-slate-600 leading-relaxed mb-4">{t('privacy.sections.intro.p1')}</p>
            <p className="text-slate-600 leading-relaxed">{t('privacy.sections.intro.p2')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.collect.title')}</h2>

            <h3 className="text-xl font-semibold text-slate-900 mt-8 mb-3">{t('privacy.sections.collect.managers.title')}</h3>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('privacy.sections.collect.managers.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mt-8 mb-3">{t('privacy.sections.collect.drivers.title')}</h3>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('privacy.sections.collect.drivers.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mt-8 mb-3">{t('privacy.sections.collect.app.title')}</h3>
            <p className="text-slate-600 mb-4">{t('privacy.sections.collect.app.description')}</p>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('privacy.sections.collect.app.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.use.title')}</h2>
            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              {(t('privacy.sections.use.items', { returnObjects: true }) as string[]).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
          
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.security.title')}</h2>
            <p className="text-slate-600 leading-relaxed">{t('privacy.sections.security.p1')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.retention.title')}</h2>
            <p className="text-slate-600 leading-relaxed">{t('privacy.sections.retention.p1')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.rights.title')}</h2>
            <p className="text-slate-600 leading-relaxed">{t('privacy.sections.rights.p1')}</p>
            <p className="mt-4">
              <a href="/privacy-request" className="text-blue-600 font-bold hover:text-blue-800 transition">www.hourwiseeu.co.uk/privacy-request</a>
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('privacy.sections.contact.title')}</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 shadow-sm">
              <p className="text-slate-900 font-black uppercase tracking-widest text-xs mb-2">{t('privacy.sections.contact.team')}</p>
              <p className="text-slate-600 text-lg font-bold">{t('privacy.sections.contact.emailLabel')} <span className="text-blue-600">privacy@hourwiseeu.co.uk</span></p>
              <p className="text-slate-500 mt-2 font-medium">Website: www.hourwiseeu.co.uk</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
