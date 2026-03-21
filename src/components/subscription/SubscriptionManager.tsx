import { CreditCard, Calendar, CheckCircle, XCircle, AlertCircle, Users } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { getTrialDaysRemaining } from '../../lib/subscription';
import { useTranslation } from 'react-i18next';

export function SubscriptionManager() {
  const { t } = useTranslation();
  const {
    accountType,
    subscriptionStatus,
    trialEndsAt,
    subscriptionPeriodEnd,
    companyName,
    loading,
  } = useSubscription();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (accountType === 'fleet') {
    return (
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border-2 border-green-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{t('subscription.manager.fleetMember')}</h3>
            <p className="text-gray-700 mb-3">
              {t('subscription.manager.partOf', { company: companyName })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">{t('subscription.manager.fleetAccess')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInTrial = subscriptionStatus === 'trial' && trialEndsAt;
  const daysRemaining = isInTrial ? getTrialDaysRemaining(trialEndsAt!) : 0;
  const isActive = subscriptionStatus === 'active';
  const isInactive = subscriptionStatus === 'inactive' || subscriptionStatus === 'cancelled';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{t('subscription.manager.soloTitle')}</h3>
          <p className="text-gray-600 text-sm">{t('subscription.manager.manageDesc')}</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive
              ? 'bg-green-100 text-green-700'
              : isInTrial
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {isActive ? t('subscription.manager.status.active') : isInTrial ? t('subscription.manager.status.trial') : t('subscription.manager.status.inactive')}
        </div>
      </div>

      <div className="space-y-4">
        {isInTrial && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 mb-1">{t('subscription.manager.trialPeriod')}</p>
                <p className="text-sm text-blue-700">
                  {daysRemaining > 0
                    ? t('subscription.manager.trialDays', { count: daysRemaining })
                    : t('subscription.manager.trialEnded')}
                </p>
              </div>
            </div>
          </div>
        )}

        {isActive && subscriptionPeriodEnd && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 mb-1">{t('subscription.manager.activeSub')}</p>
                <p className="text-sm text-green-700">
                  {t('subscription.manager.renewsOn', { date: new Date(subscriptionPeriodEnd).toLocaleDateString('en-GB') })}
                </p>
              </div>
            </div>
          </div>
        )}

        {isInactive && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 mb-1">{t('subscription.manager.noActiveSub')}</p>
                <p className="text-sm text-red-700">{t('subscription.manager.subscribeAccess')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{t('subscription.manager.planLabel')}</span>
            <span className="font-medium text-gray-900">{t('subscription.manager.soloPlan')}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{t('subscription.manager.priceLabel')}</span>
            <span className="font-medium text-gray-900">{t('subscription.manager.priceValue')}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('subscription.manager.paymentLabel')}</span>
            <span className="font-medium text-gray-900">
              {isActive ? t('subscription.manager.nativePay') : t('subscription.manager.notSetUp')}
            </span>
          </div>
        </div>

        {isActive && (
          <button
            onClick={() => {
              alert(t('subscription.manager.manageAlert'));
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {t('subscription.manager.manageButton')}
          </button>
        )}

        {(isInTrial || isInactive) && (
          <button
            onClick={() => {
              alert(t('subscription.manager.demoAlert'));
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {isInTrial ? t('subscription.manager.subscribeNow') : t('subscription.manager.resubscribe')}
          </button>
        )}
      </div>
    </div>
  );
}
