# Frontend Implementation Guide

This guide explains how to integrate the compliant dual-subscription model into your HourWise frontend.

---

## New Components Created

### 1. SignupForm (Updated)
**Location:** `src/components/auth/SignupForm.tsx`

**Features:**
- Account type selection screen (Solo vs Fleet)
- Solo driver signup with automatic trial activation
- Fleet driver signup with company code validation
- Beautiful, professional UI with gradient cards

**Usage:**
```tsx
import { SignupForm } from './components/auth/SignupForm';

function SignupPage() {
  return <SignupForm />;
}
```

**Flow:**
1. User sees two options: Solo Driver or Join Fleet
2. Selecting Solo Driver → Shows solo signup form with trial info
3. Selecting Join Fleet → Shows fleet signup form with company code input
4. On submit, creates account and sets appropriate subscription status

### 2. PaywallScreen
**Location:** `src/components/subscription/PaywallScreen.tsx`

**Features:**
- Beautiful paywall shown when trial expires or subscription inactive
- Shows all premium features
- Clear pricing information
- Call-to-action to subscribe

**Usage:**
```tsx
import { PaywallScreen } from './components/subscription/PaywallScreen';
import { useSubscription } from './hooks/useSubscription';

function App() {
  const { hasAccess, trialEndsAt } = useSubscription();

  if (!hasAccess) {
    return <PaywallScreen
      trialEndsAt={trialEndsAt}
      onSubscribe={() => {
        // Trigger In-App Purchase flow here
        // Use RevenueCat or native IAP
      }}
    />;
  }

  return <Dashboard />;
}
```

### 3. TrialBanner
**Location:** `src/components/subscription/TrialBanner.tsx`

**Features:**
- Shows countdown of trial days remaining
- Changes color when trial is urgent (2 days or less)
- Dismissible
- Call-to-action to subscribe

**Usage:**
```tsx
import { TrialBanner } from './components/subscription/TrialBanner';
import { useSubscription } from './hooks/useSubscription';

function Dashboard() {
  const { accountType, subscriptionStatus, trialEndsAt } = useSubscription();

  return (
    <>
      {accountType === 'solo' && subscriptionStatus === 'trial' && trialEndsAt && (
        <TrialBanner
          trialEndsAt={trialEndsAt}
          onSubscribe={() => {
            // Trigger In-App Purchase
          }}
        />
      )}
      <div className="content">
        {/* Dashboard content */}
      </div>
    </>
  );
}
```

### 4. SubscriptionManager
**Location:** `src/components/subscription/SubscriptionManager.tsx`

**Features:**
- Shows subscription status for solo drivers
- Shows fleet membership for fleet drivers
- Displays trial countdown
- Shows renewal dates
- Manage subscription button

**Usage:**
```tsx
import { SubscriptionManager } from './components/subscription/SubscriptionManager';

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1>Account Settings</h1>
      <SubscriptionManager />
      {/* Other settings */}
    </div>
  );
}
```

---

## Hooks

### useSubscription()
**Location:** `src/hooks/useSubscription.ts`

**Purpose:** Central hook for checking subscription access

**Returns:**
```typescript
{
  hasAccess: boolean;           // Can user access premium features?
  accountType: 'solo' | 'fleet'; // Account type
  subscriptionStatus: string;   // 'trial', 'active', 'inactive', 'cancelled'
  trialEndsAt?: string | null;  // Trial end date (solo only)
  subscriptionPeriodEnd?: string | null; // Subscription end date
  companyName?: string;         // Company name (fleet only)
  reason?: string;              // Access reason
  loading: boolean;             // Loading state
  error?: string;               // Error message
  refreshAccess: () => void;    // Refresh access status
}
```

**Usage:**
```tsx
import { useSubscription } from './hooks/useSubscription';

function MyComponent() {
  const {
    hasAccess,
    accountType,
    subscriptionStatus,
    loading,
    refreshAccess
  } = useSubscription();

  if (loading) return <LoadingSpinner />;

  if (!hasAccess) {
    return <PaywallScreen />;
  }

  return <PremiumContent />;
}
```

---

## Utility Functions

### Location: `src/lib/subscription.ts`

### validateFleetCode()
Validates a company auth code

```typescript
const result = await validateFleetCode('ABC12345');
if (result.valid) {
  console.log('Valid company:', result.company.name);
} else {
  console.error('Error:', result.error);
}
```

### createFleetCheckout()
Creates a Stripe checkout session for fleet managers (use on website, NOT in app)

```typescript
const result = await createFleetCheckout({
  plan: 'professional',
  companyName: 'My Company',
  managerEmail: 'manager@company.com',
  managerName: 'John Doe'
});

if (result.sessionUrl) {
  window.location.href = result.sessionUrl;
}
```

### getTrialDaysRemaining()
Gets number of days remaining in trial

```typescript
const daysLeft = getTrialDaysRemaining(profile.trial_ends_at);
console.log(`${daysLeft} days left in trial`);
```

### isTrialExpired()
Checks if trial has expired

```typescript
const expired = isTrialExpired(profile.trial_ends_at);
if (expired) {
  // Show paywall
}
```

---

## Complete App Integration Example

### App.tsx
```tsx
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './hooks/useSubscription';
import { PaywallScreen } from './components/subscription/PaywallScreen';
import { TrialBanner } from './components/subscription/TrialBanner';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { ManagerDashboard } from './components/manager/ManagerDashboard';

export function App() {
  const { user, profile, loading: authLoading } = useAuth();
  const {
    hasAccess,
    accountType,
    subscriptionStatus,
    trialEndsAt,
    loading: subLoading
  } = useSubscription();

  if (authLoading || subLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  // Solo driver without access
  if (accountType === 'solo' && !hasAccess) {
    return <PaywallScreen
      trialEndsAt={trialEndsAt}
      onSubscribe={handleSubscribe}
    />;
  }

  return (
    <>
      {/* Show trial banner for solo drivers in trial */}
      {accountType === 'solo' && subscriptionStatus === 'trial' && trialEndsAt && (
        <TrialBanner
          trialEndsAt={trialEndsAt}
          onSubscribe={handleSubscribe}
        />
      )}

      {/* Show appropriate dashboard */}
      {profile?.role === 'manager' ? (
        <ManagerDashboard />
      ) : (
        <DriverDashboard />
      )}
    </>
  );
}

function handleSubscribe() {
  // CRITICAL: This MUST trigger native In-App Purchase
  // Use RevenueCat or react-native-iap

  alert('This will trigger In-App Purchase flow.\n\n' +
        'Implementation:\n' +
        '- iOS: Apple In-App Purchase\n' +
        '- Android: Google Play Billing\n\n' +
        'Do NOT link to website for payment!');

  // Example with RevenueCat:
  // const { customerInfo } = await Purchases.purchasePackage(package);
}
```

---

## Access Control Pattern

Use this pattern throughout your app to protect premium features:

```tsx
import { useSubscription } from './hooks/useSubscription';

function InvoiceGeneratorPage() {
  const { hasAccess, accountType, loading } = useSubscription();

  if (loading) return <LoadingSpinner />;

  // Fleet drivers don't have access to invoicing
  if (accountType === 'fleet') {
    return (
      <div className="p-8 text-center">
        <h2>Feature Not Available</h2>
        <p>Invoice generation is only available for solo drivers.</p>
      </div>
    );
  }

  // Solo driver without subscription
  if (!hasAccess) {
    return <PaywallScreen onSubscribe={handleSubscribe} />;
  }

  // User has access
  return <InvoiceGenerator />;
}
```

---

## Important Compliance Notes

### DO NOT:
- ❌ Link to website for solo driver payments
- ❌ Show "Subscribe on our website" buttons
- ❌ Mention prices or payment on website for solo plan
- ❌ Use external payment links in the app

### DO:
- ✅ Use native In-App Purchase for solo drivers
- ✅ Trigger Apple/Google payment sheets directly
- ✅ Use RevenueCat or similar SDK for IAP
- ✅ Show pricing within the app (allowed)
- ✅ Link to website for fleet managers (B2B exemption)

---

## Testing Checklist

### Solo Driver Flow
- [ ] Select "Solo Driver" on signup
- [ ] Complete signup form
- [ ] Verify trial starts automatically
- [ ] See trial banner with countdown
- [ ] Access premium features during trial
- [ ] See paywall when trial expires
- [ ] Tap subscribe → Native IAP screen appears
- [ ] Complete purchase (sandbox)
- [ ] Verify access restored
- [ ] See "Active" status in SubscriptionManager

### Fleet Driver Flow
- [ ] Select "Join Fleet" on signup
- [ ] Enter valid company code
- [ ] Complete signup form
- [ ] Verify immediate access (no trial needed)
- [ ] No trial banner shown
- [ ] SubscriptionManager shows fleet membership
- [ ] Company name displayed
- [ ] Cannot access invoicing features
- [ ] Access persists while company subscription active

### Edge Cases
- [ ] Try invalid company code → Error shown
- [ ] Try expired company code → Error shown
- [ ] Company at driver limit → Error shown
- [ ] Trial expires → Paywall shown
- [ ] Subscribe and cancel → Access until period end
- [ ] Billing failure → Access removed

---

## In-App Purchase Implementation

### Using RevenueCat (Recommended)

1. **Install SDK**
```bash
npm install react-native-purchases
```

2. **Initialize**
```typescript
import Purchases from 'react-native-purchases';

await Purchases.configure({
  apiKey: 'your_revenuecat_public_key',
  appUserID: user.id // Your Supabase user ID
});
```

3. **Purchase Flow**
```typescript
async function handleSubscribe() {
  try {
    // Get available packages
    const offerings = await Purchases.getOfferings();
    const monthlyPackage = offerings.current?.monthly;

    if (!monthlyPackage) {
      throw new Error('No packages available');
    }

    // Trigger purchase
    const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);

    // Check entitlements
    if (customerInfo.entitlements.active['premium']) {
      // User now has access
      // Your webhook will update database
      console.log('Subscription successful!');
    }
  } catch (error) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
    } else {
      console.error('Purchase error:', error);
    }
  }
}
```

4. **Check Current Status**
```typescript
async function checkSubscriptionStatus() {
  const customerInfo = await Purchases.getCustomerInfo();
  const hasAccess = customerInfo.entitlements.active['premium'] !== undefined;
  return hasAccess;
}
```

5. **Restore Purchases**
```typescript
async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    // Check if user has active entitlements
    if (customerInfo.entitlements.active['premium']) {
      console.log('Purchases restored!');
    }
  } catch (error) {
    console.error('Restore error:', error);
  }
}
```

### Configure RevenueCat Webhook

Point RevenueCat webhook to:
```
https://[your-project-id].supabase.co/functions/v1/revenuecat-webhook
```

This will automatically update your database when subscriptions change.

---

## Styling Tips

All components use Tailwind CSS and follow these patterns:

**Colors:**
- Solo driver: Blue theme (`bg-blue-500`, `text-blue-600`, etc.)
- Fleet driver: Green theme (`bg-green-500`, `text-green-600`, etc.)
- Warnings: Orange/Red (`bg-orange-500`, `bg-red-500`)
- Success: Green (`bg-green-500`)

**Spacing:**
- Consistent 8px grid (`p-4`, `gap-6`, `space-y-5`)
- Rounded corners (`rounded-lg`, `rounded-xl`, `rounded-2xl`)
- Shadows (`shadow-sm`, `shadow-xl`)

**Responsive:**
- All components are mobile-first
- Use `sm:`, `md:`, `lg:` breakpoints
- Grid layouts with `grid md:grid-cols-2`

---

## Next Steps

1. **Integrate RevenueCat:**
   - Sign up for RevenueCat account
   - Configure App Store Connect / Google Play Console
   - Create products (monthly and annual)
   - Add SDK to your app
   - Test with sandbox accounts

2. **Update Navigation:**
   - Add subscription status to user menu
   - Link to SubscriptionManager in settings
   - Show trial status in header

3. **Add Feature Gates:**
   - Protect invoice generation behind `hasAccess` check
   - Protect export features
   - Protect advanced analytics

4. **Add Analytics:**
   - Track trial signups
   - Track conversions from trial to paid
   - Track which features users try during trial

5. **Test Thoroughly:**
   - Test on real iOS device with sandbox account
   - Test on real Android device with test account
   - Test all flows end-to-end

---

Your frontend is now ready for compliant subscription handling! The app will pass App Store and Play Store review while maximizing your revenue.
