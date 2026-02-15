# HourWise Dual-Subscription Implementation Checklist

Complete guide to launching your compliant dual-subscription model.

---

## Backend (COMPLETED ✅)

### Database Schema
- [x] Profiles table with subscription fields for solo drivers
- [x] Companies table with subscription fields for fleet managers
- [x] Invoices table for solo driver invoicing
- [x] Default account_type set to 'solo'
- [x] RLS policies configured

### Edge Functions Deployed
- [x] `revenuecat-webhook` - Handles IAP webhooks for solo drivers
- [x] `stripe-webhook` - Handles Stripe webhooks for fleet companies
- [x] `create-fleet-checkout` - Creates Stripe checkout for fleet signup
- [x] `validate-fleet-code` - Validates company auth codes
- [x] `check-access` - Checks user subscription access

### Utilities
- [x] `useSubscription()` hook created
- [x] `subscription.ts` utility functions created
- [x] Type definitions in place

---

## Frontend (COMPLETED ✅)

### Components
- [x] SignupForm with account type selection
- [x] PaywallScreen for expired trials
- [x] TrialBanner for countdown display
- [x] SubscriptionManager for settings page

### Integration Points Ready
- [ ] App.tsx integration
- [ ] Protected routes setup
- [ ] Feature gating implementation
- [ ] Navigation updates

---

## Third-Party Setup (TODO)

### 1. Stripe Configuration
- [ ] Create Stripe account
- [ ] Add these products:
  - [ ] Solo Monthly: £9.99/month
  - [ ] Solo Annual: £99/year
  - [ ] Fleet Starter: £39/month (5 drivers)
  - [ ] Fleet Professional: £99/month (20 drivers)
  - [ ] Fleet Business: £199/month (50 drivers)
  - [ ] Fleet Enterprise: Custom
- [ ] Configure webhook:
  - URL: `https://[project-id].supabase.co/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy webhook secret to Supabase
- [ ] Test with Stripe CLI

### 2. RevenueCat Configuration
- [ ] Create RevenueCat account
- [ ] Create project: "HourWise"
- [ ] Add iOS app (App Store Connect)
- [ ] Add Android app (Google Play Console)
- [ ] Configure products:
  - [ ] `hourwise_solo_monthly` - £9.99/month
  - [ ] `hourwise_solo_annual` - £99/year
- [ ] Configure webhook:
  - URL: `https://[project-id].supabase.co/functions/v1/revenuecat-webhook`
- [ ] Get API keys (public and secret)
- [ ] Install SDK: `npm install react-native-purchases`

### 3. App Store Connect (iOS)
- [ ] Create App Store Connect account
- [ ] Create app listing
- [ ] Configure in-app purchases:
  - [ ] Auto-renewable subscription group
  - [ ] Monthly product: £9.99
  - [ ] Annual product: £99
- [ ] Link to RevenueCat
- [ ] Submit for review with explanation:
  - "App uses B2B exemption for fleet subscriptions"
  - "Individual drivers use IAP as required"

### 4. Google Play Console (Android)
- [ ] Create Play Console account
- [ ] Create app listing
- [ ] Configure subscriptions:
  - [ ] Monthly: £9.99
  - [ ] Annual: £99
- [ ] Link to RevenueCat
- [ ] Submit for review

---

## Website Development (TODO)

### Landing Page
- [ ] Homepage with value proposition
- [ ] Separate sections for Solo vs Fleet
- [ ] Pricing page
- [ ] FAQ page

### Fleet Signup Flow
- [ ] /fleet/signup page
- [ ] Plan selection UI
- [ ] Company information form
- [ ] Integration with create-fleet-checkout function
- [ ] Success page displaying auth code
- [ ] Email confirmation with auth code

### Solo Information Page
- [ ] /solo page
- [ ] Features overview
- [ ] Pricing information
- [ ] Download links (App Store + Play Store)
- [ ] CTA: "Download and start free trial"
- [ ] NO payment on website (compliance)

### Fleet Manager Portal
- [ ] Login for fleet managers
- [ ] Dashboard showing:
  - Driver count
  - Auth code
  - Subscription status
  - Billing information
- [ ] Driver management
- [ ] Billing portal link (Stripe Customer Portal)

---

## App Integration (TODO)

### 1. Install RevenueCat SDK
```bash
npm install react-native-purchases
```

### 2. Initialize in App.tsx
```typescript
import Purchases from 'react-native-purchases';

useEffect(() => {
  async function initPurchases() {
    await Purchases.configure({
      apiKey: process.env.REVENUECAT_PUBLIC_KEY,
      appUserID: user.id
    });
  }

  if (user) initPurchases();
}, [user]);
```

### 3. Update SignupForm
Replace the placeholder alerts with actual RevenueCat calls in:
- `src/components/auth/SignupForm.tsx`

### 4. Update PaywallScreen
Replace the placeholder in `onSubscribe`:
```typescript
async function handleSubscribe() {
  const offerings = await Purchases.getOfferings();
  const { customerInfo } = await Purchases.purchasePackage(offerings.current.monthly);

  if (customerInfo.entitlements.active['premium']) {
    // Success!
  }
}
```

### 5. Update SubscriptionManager
Replace placeholders with actual RevenueCat management

### 6. Add to Dashboard
```typescript
import { TrialBanner } from './components/subscription/TrialBanner';
import { useSubscription } from './hooks/useSubscription';

// At top of dashboard:
{accountType === 'solo' && subscriptionStatus === 'trial' && (
  <TrialBanner trialEndsAt={trialEndsAt} onSubscribe={handleSubscribe} />
)}
```

### 7. Feature Gating
Protect premium features:
```typescript
const { hasAccess, accountType } = useSubscription();

if (!hasAccess) {
  return <PaywallScreen onSubscribe={handleSubscribe} />;
}
```

### 8. Settings Page
Add subscription manager:
```typescript
import { SubscriptionManager } from './components/subscription/SubscriptionManager';

// In settings:
<SubscriptionManager />
```

---

## Testing Plan

### Solo Driver Testing
1. **Signup Flow**
   - [ ] Open app → Select "Solo Driver"
   - [ ] Complete signup
   - [ ] Verify trial_ends_at is set (+7 days)
   - [ ] Verify subscription_status is 'trial'
   - [ ] Log in successfully

2. **Trial Period**
   - [ ] See trial banner at top
   - [ ] Banner shows correct days remaining
   - [ ] Can access all features
   - [ ] Banner color changes when 2 days left

3. **Subscription Flow**
   - [ ] Tap "Subscribe" button
   - [ ] Native IAP sheet appears (Apple/Google)
   - [ ] Complete purchase with sandbox account
   - [ ] Verify RevenueCat webhook fires
   - [ ] Verify subscription_status changes to 'active'
   - [ ] Trial banner disappears
   - [ ] Continued access to features

4. **Subscription Management**
   - [ ] Open settings
   - [ ] See SubscriptionManager showing "Active"
   - [ ] See renewal date
   - [ ] Tap "Manage Subscription"
   - [ ] Redirects to device settings

5. **Expiration**
   - [ ] Cancel subscription in device settings
   - [ ] Wait for period end (or use Stripe CLI to trigger)
   - [ ] Verify webhook updates status to 'cancelled'
   - [ ] Paywall appears
   - [ ] Features locked

### Fleet Driver Testing
1. **Signup Flow**
   - [ ] Open app → Select "Join Fleet"
   - [ ] Enter valid company code
   - [ ] Complete signup
   - [ ] Verify account_type is 'fleet'
   - [ ] Verify company_id is set
   - [ ] No trial_ends_at (not needed)
   - [ ] Log in successfully

2. **Access**
   - [ ] Immediate access (no trial needed)
   - [ ] No trial banner shown
   - [ ] SubscriptionManager shows fleet membership
   - [ ] Shows company name

3. **Feature Restrictions**
   - [ ] Cannot access invoice generation
   - [ ] Can access hours tracking
   - [ ] Can access compliance monitoring

4. **Invalid Code**
   - [ ] Try signup with invalid code → Error shown
   - [ ] Try expired code → Error shown
   - [ ] Try code from company at driver limit → Error shown

### Fleet Manager Testing (Website)
1. **Signup Flow**
   - [ ] Visit website /fleet/signup
   - [ ] Select plan (e.g., Professional)
   - [ ] Enter company details
   - [ ] Redirected to Stripe Checkout
   - [ ] Complete payment with test card
   - [ ] Stripe webhook fires
   - [ ] Company created in database
   - [ ] Auth code generated
   - [ ] Success page shows auth code
   - [ ] Email sent with auth code

2. **Driver Management**
   - [ ] Log in to fleet portal
   - [ ] See auth code displayed
   - [ ] Share code with test driver
   - [ ] Driver signs up successfully
   - [ ] See driver count increase

3. **Billing**
   - [ ] See subscription status
   - [ ] See next billing date
   - [ ] Access Stripe Customer Portal
   - [ ] Update payment method
   - [ ] Cancel subscription
   - [ ] Webhook fires
   - [ ] Drivers lose access

---

## Deployment Checklist

### Pre-Launch
- [ ] All tests passing
- [ ] Stripe in production mode
- [ ] RevenueCat in production mode
- [ ] Environment variables set correctly
- [ ] Database RLS policies tested
- [ ] Edge functions deployed
- [ ] Website deployed

### App Store Submission (iOS)
- [ ] App bundle ready
- [ ] Screenshots prepared
- [ ] App description explains B2B model
- [ ] In-app purchases configured
- [ ] TestFlight testing complete
- [ ] Submit for review with note:
  - "Fleet subscriptions use B2B exemption per guideline 3.1.3(b)"
  - "Individual drivers use IAP as required"

### Play Store Submission (Android)
- [ ] APK/AAB ready
- [ ] Screenshots prepared
- [ ] App description clear
- [ ] Subscriptions configured
- [ ] Internal testing complete
- [ ] Submit for review

### Post-Launch
- [ ] Monitor RevenueCat dashboard
- [ ] Monitor Stripe dashboard
- [ ] Check webhook logs
- [ ] Monitor user signups
- [ ] Track trial conversions
- [ ] Respond to support requests

---

## Documentation

### For Users
- [ ] Help center article: "How to start free trial"
- [ ] Help center article: "How to subscribe"
- [ ] Help center article: "How to cancel subscription"
- [ ] Help center article: "Fleet managers: Getting started"
- [ ] FAQ page on website

### For Support Team
- [ ] Subscription troubleshooting guide
- [ ] How to check user subscription status
- [ ] How to issue refunds (Stripe/Apple/Google process)
- [ ] Common issues and solutions

---

## Monitoring & Analytics

### Key Metrics to Track
- [ ] Solo driver signups per day
- [ ] Fleet company signups per day
- [ ] Trial conversion rate (trial → paid)
- [ ] Churn rate (cancelled subscriptions)
- [ ] Average revenue per user (ARPU)
- [ ] Lifetime value (LTV)
- [ ] Failed payments
- [ ] Webhook success/failure rate

### Tools
- [ ] Set up Stripe Dashboard monitoring
- [ ] Set up RevenueCat Dashboard monitoring
- [ ] Set up Supabase monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up analytics (Mixpanel, Amplitude, etc.)

---

## Legal & Compliance

- [ ] Privacy policy updated with payment processor info
- [ ] Terms of service include subscription terms
- [ ] Refund policy clearly stated
- [ ] GDPR compliance (if applicable)
- [ ] App Store review guidelines compliance documented
- [ ] Play Store policies compliance documented

---

## Support Resources

### When Things Go Wrong

**Subscription not activating after purchase:**
1. Check RevenueCat webhook logs
2. Check Supabase edge function logs
3. Verify user_id matches between RevenueCat and Supabase
4. Manually update database if needed

**Company code not working:**
1. Check if code exists in companies table
2. Check if auth_code_expires_at is in future
3. Check if company subscription_status is 'active'
4. Check if company at max_drivers limit

**Payment failed:**
1. Check Stripe Dashboard for details
2. Send user notification
3. Update subscription_status to 'inactive'
4. Give grace period before locking access

**Webhook not firing:**
1. Check webhook signing secret matches
2. Verify endpoint is accessible
3. Check edge function logs
4. Test with Stripe CLI or RevenueCat dashboard

---

## Success Criteria

Your implementation is ready when:

✅ Solo driver can sign up and start trial in app
✅ Trial auto-expires after 7 days
✅ Solo driver can subscribe via IAP
✅ Fleet manager can sign up on website
✅ Fleet driver can join with company code
✅ Fleet driver gets immediate access
✅ Webhooks properly update database
✅ Access checks work correctly
✅ App passes App Store review
✅ App passes Play Store review
✅ Revenue flowing to correct channels

---

You're now fully equipped to launch HourWise with a compliant, profitable dual-subscription model!
