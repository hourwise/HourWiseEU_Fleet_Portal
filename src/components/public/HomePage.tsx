import { Play, Star, Clock, Shield, TrendingUp, UserPlus, FileText, DollarSign } from 'lucide-react';
import { Link } from '../common/Link';

export function HomePage() {
  return (
    <div className="bg-brand-dark text-slate-300">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-card to-brand-dark overflow-hidden border-b border-brand-border">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="mb-8 bg-brand-accent-dark bg-opacity-20 backdrop-blur-sm rounded-lg p-4 inline-block">
                <div className="h-16 w-48 bg-black bg-opacity-20 rounded flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">HourWise EU</span>
                </div>
              </div>

              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Smart Fleet Management Made Simple
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-slate-300">
                Track hours, ensure compliance, and manage your fleet with confidence.
                Built for European transport regulations.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/signup"
                  className="bg-brand-accent-dark text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-accent transition-colors text-center shadow-lg"
                >
                  Create Free Account
                </Link>
                <Link
                  href="/login"
                  className="bg-brand-card text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-700 transition-colors text-center border-2 border-brand-border"
                >
                  Sign In
                </Link>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-brand-border">
              <div className="aspect-video bg-slate-800 flex items-center justify-center relative group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent-dark to-brand-dark opacity-20"></div>
                <div className="relative z-10 text-center">
                  <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-full p-6 inline-block mb-4 group-hover:bg-opacity-20 transition-all">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                  <p className="text-lg font-medium text-white">Watch Demo Video</p>
                  <p className="text-sm text-slate-300 mt-2">[Video Placeholder]</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-brand-dark py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            How It Works
          </h2>
          <p className="text-xl text-center text-slate-400 mb-16 max-w-3xl mx-auto">
            Get your fleet compliant in three simple steps.
          </p>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <UserPlus className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">1. Create Your Free Account</h3>
              <p className="text-slate-400 leading-relaxed">
                Sign up as a fleet manager in seconds. No credit card required. Your account is free forever.
              </p>
            </div>
            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <FileText className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">2. Invite Your Drivers</h3>
              <p className="text-slate-400 leading-relaxed">
                Add drivers to your fleet with a simple email invite from your dashboard.
              </p>
            </div>
            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <DollarSign className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">3. Pay Per Driver</h3>
              <p className="text-slate-400 leading-relaxed">
                Your subscription starts automatically when your first driver accepts. Pay a simple flat fee for each active driver.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
          Everything You Need for Compliance
        </h2>
        <p className="text-xl text-center text-slate-400 mb-16 max-w-3xl mx-auto">
          HourWise EU helps transport companies stay compliant with driving time regulations
          while keeping operations running smoothly.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-blue-900/50 rounded-full p-4 inline-block mb-4">
              <Clock className="h-8 w-8 text-brand-accent" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Real-Time Tracking</h3>
            <p className="text-slate-400 leading-relaxed">
              Monitor driver hours in real-time with automatic alerts for approaching limits.
              Never miss a compliance deadline again.
            </p>
          </div>
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-green-900/50 rounded-full p-4 inline-block mb-4">
              <Shield className="h-8 w-8 text-compliance-success" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Full Compliance</h3>
            <p className="text-slate-400 leading-relaxed">
              Built specifically for EU regulations. Automated violation detection and
              comprehensive audit trails keep you roadworthy.
            </p>
          </div>
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-orange-900/50 rounded-full p-4 inline-block mb-4">
              <TrendingUp className="h-8 w-8 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Smart Analytics</h3>
            <p className="text-slate-400 leading-relaxed">
              Gain insights into fleet performance with detailed reports and compliance
              scorecards. Make data-driven decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-brand-card/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            What Our Customers Say
          </h2>
          <p className="text-xl text-center text-slate-400 mb-16">
            Join hundreds of transport companies across Europe
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-brand-card rounded-xl p-8 shadow-md border border-brand-border">
                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed italic">
                  "[Testimonial placeholder - Your customer testimonial will appear here highlighting
                  the benefits they've experienced with HourWise EU]"
                </p>
                <div className="border-t border-brand-border pt-4">
                  <p className="font-semibold text-white">[Customer Name]</p>
                  <p className="text-sm text-slate-400">[Company Name]</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-brand-accent-dark to-brand-accent text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Ready to Simplify Your Fleet Management?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Create your free account and get started today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-white text-brand-accent-dark px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
            >
              Get Started
            </Link>
            <Link
              href="/how-to"
              className="bg-brand-accent text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-accent-dark transition-colors border-2 border-white border-opacity-30"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
