import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '../common/Link';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-brand-card/50 backdrop-blur-sm border-b border-brand-border sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-10 w-10 bg-brand-accent-dark rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <span className="font-bold text-xl text-slate-100">HourWise EU</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-slate-300 hover:text-brand-accent transition-colors font-medium">
              Home
            </Link>
            <Link href="/how-to" className="text-slate-300 hover:text-brand-accent transition-colors font-medium">
              How To
            </Link>
            <Link href="/privacy" className="text-slate-300 hover:text-brand-accent transition-colors font-medium">
              Privacy Policy
            </Link>
            <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-brand-border">
              <Link href="/login" className="text-slate-300 hover:text-brand-accent transition-colors font-medium">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-brand-accent-dark text-white px-6 py-2 rounded-lg hover:bg-brand-accent transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-brand-card transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-slate-300" />
            ) : (
              <Menu className="h-6 w-6 text-slate-300" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-brand-border py-4">
            <div className="flex flex-col space-y-4">
              <Link
                href="/"
                className="text-slate-300 hover:text-brand-accent transition-colors font-medium px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/how-to"
                className="text-slate-300 hover:text-brand-accent transition-colors font-medium px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                How To
              </Link>
              <Link
                href="/privacy"
                className="text-slate-300 hover:text-brand-accent transition-colors font-medium px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Privacy Policy
              </Link>
              <div className="pt-4 border-t border-brand-border flex flex-col space-y-3">
                <Link
                  href="/login"
                  className="text-slate-300 hover:text-brand-accent transition-colors font-medium px-2 py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-brand-accent-dark text-white px-6 py-3 rounded-lg hover:bg-brand-accent transition-colors font-medium text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
