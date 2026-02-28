// src/components/public/ContactPage.tsx

import React from 'react';
import { Mail, HelpCircle } from 'lucide-react';

const ContactCard = ({ title, email, description, icon }: { title: string; email: string; description: string; icon: React.ReactNode; }) => {
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
        Send Email
      </a>
    </div>
  );
};

export function ContactPage() {
  const supportEmail = 'support@hourwiseeu.co.uk';
  const infoEmail = 'info@hourwiseeu.co.uk';

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact Us</h1>
          <p className="mt-4 text-xl text-gray-300">
            We're here to help. Choose the best way to get in touch with us below.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <ContactCard
            title="General Inquiries"
            email={infoEmail}
            description="For general questions, partnerships, or media inquiries, please contact our info team."
            icon={<Mail className="w-8 h-8 text-blue-400" />}
          />
          <ContactCard
            title="Technical Support"
            email={supportEmail}
            description="If you're experiencing technical issues or need help with the app, reach out to our support team."
            icon={<HelpCircle className="w-8 h-8 text-green-400" />}
          />
        </div>
      </div>
    </div>
  );
}
