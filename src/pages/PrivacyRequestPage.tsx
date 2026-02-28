// src/pages/PrivacyRequestPage.tsx

import React from 'react';
import { DataRequestForm } from '../components/manager/DataRequestForm';

export function PrivacyRequestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Data & Privacy Request</h1>
            <p className="mt-2 text-md text-gray-600">For solo drivers using the HourWise EU mobile app.</p>
        </div>
        <DataRequestForm />
      </div>
    </div>
  );
}
