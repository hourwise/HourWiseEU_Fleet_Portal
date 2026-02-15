import { Link } from '../common/Link';

export function Footer() {
  return (
    <footer className="bg-brand-card/30 border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-10 w-10 bg-brand-accent-dark rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <span className="font-bold text-xl text-white">HourWise EU</span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-md">
              Smart fleet management and compliance tracking for European transport companies.
              Stay compliant, stay efficient.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="hover:text-brand-accent transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/how-to" className="hover:text-brand-accent transition-colors">
                  How To
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-brand-accent transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Account</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="hover:text-brand-accent transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-brand-accent transition-colors">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-brand-border mt-12 pt-8 text-sm text-slate-400 text-center">
          <p>&copy; {new Date().getFullYear()} HourWise EU. All rights reserved.</p>
          <p className="mt-2">www.hourwiseeu.co.uk</p>
        </div>
      </div>
    </footer>
  );
}
