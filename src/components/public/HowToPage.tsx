import { UserPlus, Users, Clock, Shield, AlertTriangle, FileText } from 'lucide-react';
import { Link } from '../common/Link';

export function HowToPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl lg:text-5xl font-bold">How to Use HourWise EU</h1>
          <p className="text-xl mt-4 text-blue-100">
            Everything you need to know to get started with fleet management
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Getting Started</h2>

          <div className="space-y-8">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="bg-blue-100 rounded-full p-3 mr-4">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Step 1: Create Your Account</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    Start by creating a fleet manager account. You'll need to provide your company information
                    and create a secure password. This account will give you full access to manage your fleet.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create Account
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
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Step 2: Add Your Drivers</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    Once logged in, navigate to the Driver Management section. You can add drivers by
                    creating accounts for them. Each driver will receive credentials to log in and submit
                    their daily hours.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 space-y-2">
                    <li>Enter driver name and email address</li>
                    <li>System generates secure login credentials</li>
                    <li>Driver receives welcome email with instructions</li>
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
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Step 3: Track Daily Hours</h3>
                  <p className="text-slate-700 leading-relaxed mb-4">
                    Drivers log in to their dashboard to submit daily hours. The system automatically
                    tracks their cumulative hours and alerts them when approaching regulatory limits.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 space-y-2">
                    <li>Drivers enter daily driving hours</li>
                    <li>Real-time calculation of weekly and fortnightly totals</li>
                    <li>Automatic alerts for approaching limits</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">For Fleet Managers</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                Compliance Monitoring
              </h3>
              <p className="text-slate-700 leading-relaxed">
                View real-time compliance status for your entire fleet. The Compliance Scoreboard shows
                which drivers are within limits and which require attention. Click on any driver to see
                detailed hour breakdowns.
              </p>
            </div>

            <div className="border-l-4 border-red-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Violation Management
              </h3>
              <p className="text-slate-700 leading-relaxed">
                When a driver exceeds regulatory limits, the system automatically logs an infraction.
                View all infractions in the Infraction Report, where you can see violation details,
                dates, and driver information for audit purposes.
              </p>
            </div>

            <div className="border-l-4 border-purple-600 pl-6 py-2">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-purple-600" />
                Audit Trail
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Every action in the system is logged in the Audit Trail. Track when drivers were added,
                hours were submitted, or settings were changed. This comprehensive log ensures complete
                accountability and meets regulatory requirements.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">For Drivers</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Daily Workflow</h3>
            <ol className="space-y-4">
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Log in to your driver dashboard</p>
                  <p className="text-slate-700">Use the credentials provided by your fleet manager</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Submit your daily driving hours</p>
                  <p className="text-slate-700">Enter the total hours driven for the day</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Check your compliance status</p>
                  <p className="text-slate-700">View your weekly and fortnightly hour totals</p>
                </div>
              </li>
              <li className="flex">
                <span className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                  4
                </span>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Pay attention to warnings</p>
                  <p className="text-slate-700">The system alerts you when approaching hour limits</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Understanding EU Regulations</h2>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Key Limits</h3>
            <div className="space-y-3 text-slate-700">
              <p>
                <strong>Weekly Limit:</strong> Maximum 56 hours of driving per week
              </p>
              <p>
                <strong>Fortnightly Limit:</strong> Maximum 90 hours over any two consecutive weeks
              </p>
              <p className="pt-3 border-t border-slate-300 text-sm">
                HourWise EU automatically monitors both limits and alerts drivers and managers when
                approaching or exceeding these thresholds.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Need More Help?</h2>
          <p className="text-xl text-blue-100 mb-6">
            Contact our support team for personalized assistance
          </p>
          <p className="text-lg">Email: [Your Support Email]</p>
        </section>
      </div>
    </div>
  );
}
