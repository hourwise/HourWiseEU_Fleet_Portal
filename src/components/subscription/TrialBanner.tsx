import { Clock, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { getTrialDaysRemaining } from '../../lib/subscription';

interface TrialBannerProps {
  trialEndsAt: string;
  onSubscribe: () => void;
}

export function TrialBanner({ trialEndsAt, onSubscribe }: TrialBannerProps) {
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
                  {daysRemaining === 1 ? 'Last day' : `${daysRemaining} days left`} in your free trial!
                </>
              ) : (
                <>
                  Your free trial ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </>
              )}
            </p>
            <p className="text-sm opacity-90">
              Subscribe now for just £9.99/month to keep using all features
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSubscribe}
            className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-2 rounded-lg font-semibold text-sm transition whitespace-nowrap"
          >
            Subscribe Now
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
