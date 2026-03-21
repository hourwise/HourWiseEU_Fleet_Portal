// src/components/public/ContactPage.tsx

import React from 'react';
import { Mail, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ContactCard = ({ title, email, description, icon, cta }: { title: string; email: string; description: string; icon: React.ReactNode; cta: string }) => {
  return (
    <div className="bg-brand-card p-6 rounded-lg border border-gray-700/50">
      <div className="flex items-center gap-4 mb-3">
        {icon}
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 mb-4">{description}</p>
      <a
        href={`mailto:${email}`}
        className="inline-block px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-dark focus:ring-blue-500"
      >
        {cta}
      </a>
    </div>
  );
};

export function ContactPage() {
  const { t } = useTranslation();
  const supportEmail = 'support@hourwiseeu.co.uk';
  const infoEmail = 'info@hourwiseeu.co.uk';

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t('contact.title')}</h1>
          <p className="mt-4 text-xl text-gray-300">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <ContactCard
            title={t('contact.general.title')}
            email={infoEmail}
            description={t('contact.general.description')}
            icon={<Mail className="w-8 h-8 text-blue-400" />}
            cta={t('contact.cta')}
          />
          <ContactCard
            title={t('contact.technical.title')}
            email={supportEmail}
            description={t('contact.technical.description')}
            icon={<HelpCircle className="w-8 h-8 text-green-400" />}
            cta={t('contact.cta')}
          />
        </div>
      </div>
    </div>
  );
}
