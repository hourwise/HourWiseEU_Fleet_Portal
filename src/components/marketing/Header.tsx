import { Menu, X, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from '../common/Link';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../common/LanguageSelector';
import { HWButton } from '../ui/HWButton';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-hw-navy-950/80 backdrop-blur-lg border-b border-white/5 py-3' : 'bg-transparent py-5'
    }`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-hw-blue-600/30 group-hover:scale-110 transition-transform">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-hw-white leading-none">HourWise</span>
                <span className="text-[10px] font-bold text-hw-blue-600 tracking-[0.2em] uppercase mt-1">EU Portal</span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <nav className="flex items-center space-x-6 text-sm font-medium text-hw-slate-300">
              <Link href="/" className="hover:text-hw-blue-600 transition-colors uppercase tracking-wider">{t('navigation.home')}</Link>
              <Link href="/how-to" className="hover:text-hw-blue-600 transition-colors uppercase tracking-wider">{t('navigation.howTo')}</Link>
              <Link href="/privacy" className="hover:text-hw-blue-600 transition-colors uppercase tracking-wider">{t('navigation.privacy')}</Link>
              <Link href="/contact" className="hover:text-hw-blue-600 transition-colors uppercase tracking-wider">{t('navigation.contact')}</Link>
            </nav>

            <div className="flex items-center space-x-4 border-l border-white/10 pl-6">
              <LanguageSelector />
              <Link href="/login" className="text-sm font-bold text-hw-white hover:text-hw-blue-600 transition-colors uppercase tracking-widest">
                {t('navigation.signIn')}
              </Link>
              <HWButton
                variant="primary"
                size="sm"
                className="group"
                onClick={() => window.location.href = '/signup'}
              >
                {t('navigation.getStarted')}
                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </HWButton>
            </div>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <LanguageSelector />
            <button
              className="p-2 rounded-lg bg-white/5 border border-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-hw-white" />
              ) : (
                <Menu className="h-6 w-6 text-hw-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 bg-hw-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col space-y-6">
              <Link href="/" className="text-lg font-bold text-hw-white" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link href="/how-to" className="text-lg font-bold text-hw-white" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
              <Link href="/privacy" className="text-lg font-bold text-hw-white" onClick={() => setMobileMenuOpen(false)}>Privacy</Link>
              <Link href="/contact" className="text-lg font-bold text-hw-white" onClick={() => setMobileMenuOpen(false)}>Contact</Link>

              <div className="pt-6 border-t border-white/10 flex flex-col space-y-4">
                <Link href="/login" className="text-center font-bold text-hw-white" onClick={() => setMobileMenuOpen(false)}>
                  Manager Sign In
                </Link>
                <HWButton variant="primary" className="w-full" onClick={() => window.location.href = '/signup'}>
                  Get Started Free
                </HWButton>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
