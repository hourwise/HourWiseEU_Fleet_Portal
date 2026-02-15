import { Lock, Sparkles, Receipt, TrendingUp, FileText, Calendar } from 'lucide-react';

interface PaywallScreenProps {
  trialEndsAt?: string | null;
  onSubscribe: () => void;
}

export function PaywallScreen({ trialEndsAt, onSubscribe }: PaywallScreenProps) {
  const isTrialExpired = trialEndsAt && new Date(trialEndsAt) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-12 text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {isTrialExpired ? 'Trial Expired' : 'Unlock Full Access'}
          </h1>
          <p className="text-blue-100 text-lg">
            {isTrialExpired
              ? 'Subscribe to continue using HourWise'
              : 'Get unlimited access to all features'}
          </p>
        </div>

        <div className="p-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Invoice Generation</h3>
                  <p className="text-sm text-gray-600">Professional invoices for your clients</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Expense Tracking</h3>
                  <p className="text-sm text-gray-600">Monitor all your business expenses</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Hours Compliance</h3>
                  <p className="text-sm text-gray-600">Stay compliant with UK regulations</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Tax Reports</h3>
                  <p className="text-sm text-gray-600">Export reports for self-assessment</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-center text-white mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-6 h-6" />
              <span className="text-2xl font-bold">£9.99</span>
              <span className="text-blue-200">/month</span>
            </div>
            <p className="text-blue-100 mb-6">
              Cancel anytime. No long-term commitment.
            </p>
            <button
              onClick={onSubscribe}
              className="w-full bg-white text-blue-600 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition shadow-lg"
            >
              Subscribe Now
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <p>Cancel anytime from your account settings</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <p>Secure payment via Apple/Google</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <p>Instant access after subscription</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
