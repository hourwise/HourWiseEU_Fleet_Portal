// src/pages/PrivacyRequestPage.tsx

import React from 'react';
import { DataRequestForm } from '../components/manager/DataRequestForm';
import { useTranslation } from 'react-i18next';

export function PrivacyRequestPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('privacyRequest.title')}</h1>
            <p className="mt-2 text-md text-gray-600">For users of the HourWise EU mobile app and portal.</p>
        </div>
        <DataRequestForm />
      </div>
    </div>
  );
}
