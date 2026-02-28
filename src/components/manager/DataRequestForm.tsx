// src/components/manager/DataRequestForm.tsx

import React, { useState } from 'react';

export function DataRequestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState<'download' | 'deletion'>('download');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Get the privacy email address from Vercel environment variables
  const privacyEmail = import.meta.env.VITE_PRIVACY_EMAIL_ADDRESS || 'support@hourwiseeu.co.uk';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = `Data Request (${requestType === 'download' ? 'Download' : 'Deletion'}) - ${name}`;
    const body = `
      A data request has been submitted with the following details:

      Name: ${name}
      Email: ${email}
      Request Type: ${requestType}

      Additional Details:
      ${details || 'None provided.'}

      ---
      Please do not alter this email. This is a request from a user of the HourWise EU app.
    `;

    // This creates and opens a pre-filled email in the user's default email client
    window.location.href = `mailto:${privacyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert">
        <p className="font-bold">Thank You!</p>
        <p>Your email client has been opened with a pre-filled request. Please review and send it to complete your request.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md border">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">As it appears on your HourWise EU account.</p>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Account Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">The email address you use to log in to the app.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Request Type</label>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as 'download' | 'deletion')}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="download">Request a copy of my data</option>
          <option value="deletion">Request account and data deletion</option>
        </select>
      </div>
       <div>
        <label htmlFor="details" className="block text-sm font-medium text-gray-700">Additional Details (Optional)</label>
        <textarea
          id="details"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <button
          type="submit"
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Proceed to Email
        </button>
      </div>
       <p className="text-xs text-gray-500 text-center mt-4">
        For security, we use your email client to verify your identity. Submitting this form will prepare an email for you to send to our privacy team.
      </p>
    </form>
  );
}
