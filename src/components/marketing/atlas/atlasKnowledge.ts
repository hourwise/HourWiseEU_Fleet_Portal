import { AtlasIntent } from './atlasTypes';

export const atlasKnowledge: AtlasIntent[] = [
  {
    id: 'what-is-hourwise',
    title: 'What is HourWise EU?',
    keywords: ['what is hourwise', 'what do you do', 'what is this', 'hourwise eu', 'overview', 'about'],
    answer: 'HourWise EU is a connected driver hours app and fleet compliance portal for UK/EU transport. The app helps drivers track work, driving, breaks and POA, while the portal helps operators manage shifts, checks, expenses, incidents, tachograph data and compliance actions.',
    followUps: ['Driver app', 'Fleet portal', 'Tachograph analysis', 'Early access'],
    cta: { label: 'Join early access', action: 'earlyAccess' },
  },
  {
    id: 'driver-app',
    title: 'Driver app features',
    keywords: ['driver app', 'mobile app', 'what does the app do', 'track hours', 'work timer', 'alerts'],
    answer: 'The driver app is designed to help professional drivers track shifts, work time, driving time, breaks and POA, with alerts before key limits. It also supports daily reports, expenses, pay estimates, and fleet-connected workflows.',
    followUps: ['Solo driver', 'Fleet driver', 'Alerts', 'Expenses'],
  },
  {
    id: 'fleet-portal',
    title: 'Fleet portal features',
    keywords: ['fleet portal', 'manager portal', 'control centre', 'dashboard', 'operator tools'],
    answer: 'The fleet portal gives managers a clearer view of drivers, vehicles and daily compliance workflows. It is being built to support driver records, vehicle checks, defects, incidents, expenses, reports, and tachograph analysis.',
    followUps: ['Vehicle checks', 'Defects', 'Reports', 'Tachograph'],
  },
  {
    id: 'tachograph',
    title: 'Tachograph analysis',
    keywords: ['tachograph', 'tacho', 'driver card', 'read card', 'ddd file', 'vu file', 'infringements'],
    answer: 'The portal is being built to support driver card and vehicle unit file import and analysis. The aim is to show clear activity timelines, totals, events, infringements and exportable reports. HourWise supports compliance review but does not replace legal tachograph equipment.',
    followUps: ['Driver card', 'Vehicle unit', 'Infringements', 'Compliance disclaimer'],
  },
  {
    id: 'pricing',
    title: 'Pricing expectations',
    keywords: ['pricing', 'cost', 'how much', 'subscription', 'monthly fee'],
    answer: 'Initial pricing is expected to be simple: the solo driver app planned around £2.99/month, the fleet portal from around £19.99/month, and fleet-connected drivers around £2.99 per driver/month. Prices may change during beta.',
    followUps: ['Solo driver', 'Fleet pricing', 'Early access'],
  },
  {
    id: 'early-access',
    title: 'How to get access',
    keywords: ['early access', 'join', 'signup', 'beta', 'test', 'register'],
    answer: 'You can request early access from the homepage. We are especially interested in feedback from solo drivers, small fleets, transport managers and compliance professionals during our beta phase.',
    followUps: ['Beta testing', 'Request access'],
    cta: { label: 'Go to early access form', action: 'earlyAccess' },
  },
  {
    id: 'legal-disclaimer',
    title: 'Is this legal advice?',
    keywords: ['legal advice', 'dvsa approved', 'certified', 'law', 'compliance ruling'],
    answer: 'No. HourWise is a support, tracking and reporting tool. It does not provide legal advice, replace tachograph equipment, replace official records or remove operator responsibility.',
    followUps: ['Tachograph analysis', 'Contact us'],
  },
  {
    id: 'contact',
    title: 'Contact HourWise',
    keywords: ['contact', 'email', 'support', 'help', 'talk to founder', 'team'],
    answer: 'You can contact the team at info@hourwiseeu.co.uk for general inquiries or support@hourwiseeu.co.uk for technical help. For Atlas-specific feedback, you can reach out to Atlas@hourwiseeu.co.uk.',
    followUps: ['Early access', 'Suggest a feature'],
  }
];
