import React from 'react';

export function PrivacyPage() {
  return (
    <div className="bg-white">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold">Privacy Policy</h1>
          <p className="text-xl mt-4 text-slate-300">Last updated: 17th July 2024</p>
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
            <p>We collect and process data provided by Fleet Managers and Drivers to deliver our services.</p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2.1 Information Provided by Fleet Managers</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Manager Account Information:</b> Full name, company name, and email address used to create and manage the fleet account.</li>
              <li><b>Driver Information:</b> To create a comprehensive driver file and facilitate payroll, managers may enter the following information about their drivers into the Portal:</li>
                <ul className="list-circle pl-6 mt-2 space-y-2">
                    <li>Full Name & Email Address</li>
                    <li><b>Payroll & Employment Details:</b> Payroll Number, Date of Birth, National Insurance Number (or EU equivalent), Full Address.</li>
                    <li><b>Contact Details:</b> Phone Number, Emergency Contact Name & Phone Number.</li>
                    <li><b>Compliance & Licensing Details:</b> Driving Licence Number & Expiry Date, CPC/DQC Number & Expiry Date, and records of CPC training hours.</li>
                    <li><b>Scanned Documents:</b> Images of the front and back of a driver's Driving Licence, CPC/Tacho cards, or other relevant certifications.</li>
                </ul>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2.2 Information Provided by Drivers (via the App)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Work Sessions:</b> Start and end times of work, break, and rest periods, used to calculate hours and ensure compliance with driving time regulations.</li>
              <li><b>Expenses:</b> Details of expenses incurred, including amount, description, and photos of receipts.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. How We Use Your Information</h2>
            <p>Our primary purpose for collecting this data is to provide a functional and compliant fleet management service. Our legal basis for processing this data is the performance of our contract with you and the legitimate interests of your employer (the Fleet Manager) for compliance and payroll purposes.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To <b>Provide Core Services:</b> Tracking driver hours, managing compliance, calculating gross pay, and tracking expenses.</li>
              <li>To <b>Facilitate Fleet Management:</b> Allowing Fleet Managers to maintain a central, up-to-date file for each driver, containing all necessary compliance and payroll information.</li>
              <li>To <b>Generate Reports:</b> Enabling the export of payroll summaries and expense reports for the company's accounting purposes.</li>
              <li>To <b>Ensure Compliance:</b> Helping companies meet their legal obligations under EU/UK transport and employment law by tracking licence expiries, CPC hours, and driving times.</li>
              <li>To <b>Provide Support:</b> To respond to your comments, questions, and support requests.</li>
            </ul>
          </section>
          
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Data Security & Storage</h2>
            <p>We take the security of your data very seriously. We implement robust technical and organizational measures to protect it:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><b>Access Control:</b> All data is protected using Supabase's Row Level Security (RLS). This means a user can only ever access data associated with their own company. A Fleet Manager from one company cannot access the data of another.</li>
              <li><b>Secure Storage:</b> Uploaded documents (licences, etc.) are stored in a private, access-controlled bucket. They are not publicly accessible and can only be viewed by authenticated users from the correct company via secure, time-limited URLs.</li>
              <li><b>Encryption:</b> All data is encrypted at rest and in transit between our applications and servers.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Your Data Protection Rights (GDPR & UK DPA)</h2>
            <p>You have rights over your personal data. If you are a driver, your primary point of contact for exercising these rights is your Fleet Manager, who is the Data Controller for your employment information.</p>
             <ul className="list-disc pl-6 space-y-2">
              <li><b>Right to Access:</b> You can request a copy of the personal data held about you.</li>
              <li><b>Right to Rectification:</b> You can request to have inaccurate or incomplete data corrected.</li>
              <li><b>Right to Erasure:</b> You can request the deletion of your personal data, subject to legal and contractual retention requirements.</li>
            </ul>
            <p className="mt-4">Fleet Managers can view, edit, and delete driver information directly through the Portal. Deleting a driver permanently removes their account and associated personal data from our active systems.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us:</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <p><strong>HourWise EU</strong></p>
              <p className="mt-2">Email: <strong>support@hourwiseeu.co.uk</strong></p>
              <p>Website: www.hourwiseeu.co.uk</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
