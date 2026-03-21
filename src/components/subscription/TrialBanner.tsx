import { Clock, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { getTrialDaysRemaining } from '../../lib/subscription';
import { useTranslation } from 'react-i18next';

interface TrialBannerProps {
  trialEndsAt: string;
  onSubscribe: () => void;
}

export function TrialBanner({ trialEndsAt, onSubscribe }: TrialBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const daysRemaining = getTrialDaysRemaining(trialEndsAt);

  if (dismissed || daysRemaining <= 0) return null;

  const isUrgent = daysRemaining <= 2;

  return (
    <div
      className={`${
        isUrgent
          ? 'bg-gradient-to-r from-orange-500 to-red-500'
          : 'bg-gradient-to-r from-blue-500 to-blue-600'
      } text-white px-4 py-3 shadow-lg relative`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0">
            {isUrgent ? (
              <Clock className="w-6 h-6 animate-pulse" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {isUrgent ? (
                <>
                  {daysRemaining === 1 ? t('subscription.banner.lastDay') : t('subscription.banner.daysLeft', { count: daysRemaining })}{t('subscription.banner.trialSuffix')}
                </>
              ) : (
                <>
                  {t('subscription.banner.endsIn', { count: daysRemaining })}
                </>
              )}
            </p>
            <p className="text-sm opacity-90">
              {t('subscription.banner.cta')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSubscribe}
            className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-2 rounded-lg font-semibold text-sm transition whitespace-nowrap"
          >
            {t('subscription.banner.subscribeNow')}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
