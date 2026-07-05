import { Link } from '../common/Link';
import { useTranslation } from 'react-i18next';
import { Mail, Shield, ExternalLink, Linkedin, Twitter } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="bg-hw-navy-950 border-t border-white/5 relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6 group">
              <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-hw-blue-600/30 group-hover:scale-110 transition-transform">
                <span className="text-white font-bold text-xl">H</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-hw-white leading-none">HourWise</span>
                <span className="text-[10px] font-bold text-hw-blue-600 tracking-[0.2em] uppercase mt-1">EU</span>
              </div>
            </Link>
            <p className="text-hw-slate-400 leading-relaxed max-w-sm mb-8">
              HourWise EU connects a practical driver hours app with a fleet portal for UK/EU transport teams. Built from real operational experience.
            </p>
            <div className="flex space-x-4">
               <a href="#" className="p-2 bg-hw-navy-900 rounded-lg text-hw-slate-500 hover:text-hw-blue-600 hover:bg-hw-blue-600/10 transition-all">
                  <Linkedin size={20} />
               </a>
               <a href="#" className="p-2 bg-hw-navy-900 rounded-lg text-hw-slate-500 hover:text-hw-blue-600 hover:bg-hw-blue-600/10 transition-all">
                  <Twitter size={20} />
               </a>
               <a href="mailto:info@hourwiseeu.co.uk" className="p-2 bg-hw-navy-900 rounded-lg text-hw-slate-500 hover:text-hw-blue-600 hover:bg-hw-blue-600/10 transition-all">
                  <Mail size={20} />
               </a>
            </div>
          </div>

          <div>
            <h4 className="text-hw-white font-bold uppercase tracking-[0.2em] text-[10px] mb-6">Product</h4>
            <ul className="space-y-4">
              <li><a href="#product" onClick={(e) => handleScrollTo(e, '#product')} className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Platform</a></li>
              <li><a href="#driver-app" onClick={(e) => handleScrollTo(e, '#driver-app')} className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Driver App</a></li>
              <li><a href="#fleet-portal" onClick={(e) => handleScrollTo(e, '#fleet-portal')} className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Fleet Portal</a></li>
              <li><a href="#tachograph" onClick={(e) => handleScrollTo(e, '#tachograph')} className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Tachograph</a></li>
              <li><a href="#pricing" onClick={(e) => handleScrollTo(e, '#pricing')} className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Pricing</a></li>
              <li><Link href="/login" className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Fleet Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-hw-white font-bold uppercase tracking-[0.2em] text-[10px] mb-6">Compliance & Legal</h4>
            <ul className="space-y-4">
              <li><Link href="/privacy" className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/contact" className="text-sm text-hw-slate-400 hover:text-hw-blue-600 transition-colors">Contact Support</Link></li>
              <li><span className="text-sm text-hw-slate-400 flex items-center"><Shield size={14} className="mr-2 text-hw-green-500" /> Secure Storage</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
           <p className="text-[10px] text-hw-slate-500 italic mb-8 max-w-4xl">
             Disclaimer: HourWise EU is designed as a compliance support and workflow tool. It does not replace legally required tachograph equipment, official records or the operator’s legal responsibilities.
           </p>

           <div className="flex flex-col md:flex-row justify-between items-center text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">
            <p>&copy; {new Date().getFullYear()} HourWise EU. All rights reserved.</p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
               <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-hw-teal-500 mr-2"></div> Beta Phase</span>
               <a href="https://www.hourwiseeu.co.uk" className="hover:text-hw-white transition-colors flex items-center">
                  www.hourwiseeu.co.uk <ExternalLink size={12} className="ml-1" />
               </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
