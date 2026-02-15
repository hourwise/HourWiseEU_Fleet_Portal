# HourWise EU - Fleet Management Dashboard

A comprehensive B2B fleet management platform for managing driver hours of service compliance under EU regulations. Built with React, TypeScript, and Supabase.

## Features

### For Fleet Managers

- **Real-Time Compliance Scoreboard**: Visual traffic-light system showing driver compliance status and risk levels
- **Driver Management**: Complete driver roster with search, filtering, and activation controls
- **Company Link Code System**: Secure 8-character codes for driver onboarding (7-day expiration)
- **Infraction Risk Reporting**: Automated tracking of violations and warnings with detailed breakdowns
- **Audit Trail Export**: One-click CSV exports for regulatory compliance audits
- **Company Settings**: Manage company information and subscription details

### For Drivers

- **Activity Dashboard**: View recent driving logs, work hours, and rest periods
- **Compliance Status**: Real-time visibility into violations and warnings
- **Company Integration**: Seamless connection to fleet manager's dashboard

## Security Features

### Row Level Security (RLS)

All database tables are secured with comprehensive RLS policies:

- **Complete Data Isolation**: Fleet managers can only access their own company's data
- **Driver Privacy**: Drivers can only view their own logs
- **Role-Based Access**: Automatic enforcement based on user role (manager/driver)
- **Company Boundaries**: Zero cross-company data leakage

### Authentication

- Email/password authentication via Supabase Auth
- Secure session management
- Protected routes based on role

## Database Schema

### Core Tables

1. **companies**: Fleet company information and auth codes
2. **profiles**: User profiles with role and company association
3. **driver_logs**: Detailed activity logs for hours of service tracking

### Key Features

- Automatic timestamp tracking
- Enum types for data integrity
- Indexed foreign keys for performance
- Helper functions for code generation and validation

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (already configured)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

## Usage Guide

### Creating a Fleet Manager Account

1. Click "Create Fleet Manager Account"
2. Enter your full name, company name, email, and password
3. Upon signup, a unique 8-character company link code is automatically generated

### Generating Company Link Codes

1. Navigate to the "Settings" tab
2. View your current company link code
3. Click "Generate New Code" to create a fresh code (invalidates the old one)
4. Share the code with drivers who need to join your fleet

### Adding Drivers to Your Fleet

**For the Driver:**

1. Click "Join Fleet as Driver"
2. Enter the 8-character company link code provided by their fleet manager
3. Complete the signup form with name, license number, email, and password
4. They're automatically linked to the company

**For the Fleet Manager:**

- Drivers appear in the "Drivers" tab once they've joined
- Activate/deactivate drivers as needed
- View complete driver profiles and activity

### Monitoring Compliance

**Dashboard Tab:**

- View overall fleet compliance rate
- See individual driver risk scores (High/Medium/Low)
- Track violations, warnings, and clean logs
- Monitor recent driver activity

**Infractions Tab:**

- Filter by all infractions, violations only, or warnings only
- Export detailed CSV reports
- View infraction details including type, location, and duration

**Audit Trail Tab:**

- Set date ranges for reports
- Filter by specific driver or all drivers
- Generate complete audit trails for regulatory compliance
- Export compliance summaries with per-driver metrics

## Deployment

This application is completely portable and can be deployed to:

- **Vercel**: `npm run build` then deploy the `dist/` folder
- **Netlify**: Connect your repo and set build command to `npm run build`
- **AWS S3 + CloudFront**: Upload `dist/` folder to S3 bucket
- **Your Own Domain**: Upload `dist/` contents to any web server

### Environment Variables

The following are already configured in your `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

When deploying, ensure these environment variables are set in your hosting platform.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build Tool**: Vite

## API Integration

The dashboard is designed to work alongside a mobile app. The database schema supports:

- Real-time activity logging from mobile devices
- GPS location tracking
- Vehicle identification
- Activity type classification (driving, work, rest, break, available)
- Automatic compliance status calculation

## License

Proprietary - HourWise EU

## Support

For technical support or questions about the platform, contact your system administrator.
