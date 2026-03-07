import React from 'react';

export function PrivacyPage() {
  return (
    <div className="bg-white">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold">Privacy Policy</h1>
          <p className="text-xl mt-4 text-slate-300">Last updated: 1st March 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-slate max-w-none">
          
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
            <p>HourWise EU ("we", "our", or "us") provides a fleet management platform designed to help transport businesses ensure compliance and manage their operations. This Privacy Policy explains how we collect, use, disclose, and safeguard the information of Fleet Managers and their associated Drivers when using our platform.</p>
            <p>This policy applies to both our web portal (the "Portal") and our mobile application (the "App"). By using our services, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. What Information We Collect</h2>

            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2.1 Information Provided by Fleet Managers</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Manager Account Information:</b> Full name, company name, and email address.</li>
              <li><b>Driver Records:</b> Managers enter driver details including Payroll Number, Date of Birth, National Insurance Number, Address, and Emergency Contact details.</li>
              <li><b>Compliance Details:</b> Driving Licence, CPC/DQC numbers, and expiry dates.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2.2 Information Provided by Drivers (via the App)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Profile Data:</b> Full name and email address used for account creation.</li>
              <li><b>Work Sessions:</b> Timestamps for work, break, and rest periods.</li>
              <li><b>Expense Records:</b> Amount, description, and images of receipts.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2.3 App Permissions & Data</h3>
            <p>To provide essential compliance and management features, the App requests the following permissions:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Camera Access:</b> We require camera access to allow you to take and upload photos of your <b>Driving Licence, CPC cards, and fuel/expense receipts</b> directly to the portal for compliance and reimbursement.</li>
              <li><b>Location Data:</b> We capture a single GPS coordinate "stamp" only at the <b>exact moment you Start and End a shift</b>. This is used to verify work locations for fleet audit purposes and is not used for continuous background tracking.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Compliance Tracking:</b> Managing driver hours and tracking document expiries (Licence/CPC).</li>
              <li><b>Payroll Facilitation:</b> Calculating gross pay and generating summaries for employer accounting.</li>
              <li><b>Expense Management:</b> Processing driver-submitted receipts for business reconciliation.</li>
              <li><b>Audit Trails:</b> Maintaining geographic and temporal records of work sessions for legal compliance.</li>
            </ul>
          </section>
          
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Data Security & Storage</h2>
            <p>All data is protected using <b>Supabase Row Level Security (RLS)</b>, ensuring that users can only access data belonging to their own company. Documents are stored in encrypted, private storage buckets. Data is encrypted both at rest and in transit.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Data Retention</h2>
            <p>As required by UK and EU tax and labor laws, payroll-related "Records of Wages" and work sessions are retained for a minimum of 3 to 6 years (depending on jurisdiction) for audit purposes, even if an account is deactivated.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Your Data Rights (GDPR)</h2>
            <p>Under GDPR and the UK DPA, you have the right to access, rectify, or erase your data. Drivers may request data actions via their Fleet Manager or directly through our portal:</p>
            <p className="mt-2 text-blue-600 font-semibold">www.hourwiseeu.co.uk/privacy-request</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Contact Us</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <p><strong>HourWise EU Privacy Team</strong></p>
              <p className="mt-2">Email: <strong>privacy@hourwiseeu.co.uk</strong></p>
              <p>Website: www.hourwiseeu.co.uk</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
