import { Play, Star, Clock, Shield, TrendingUp, UserPlus, FileText, DollarSign, Lock, EyeOff } from 'lucide-react';
import { Link } from '../common/Link';
import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();

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
                  <span className="text-2xl font-bold text-white">{t('app.name')}</span>
                </div>
              </div>

              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                {t('home.hero.title')}
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-slate-300">
                {t('home.hero.subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/signup"
                  className="bg-brand-accent-dark text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-accent transition-colors text-center shadow-lg"
                >
                  {t('home.hero.cta.primary')}
                </Link>
                <Link
                  href="/login"
                  className="bg-brand-card text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-700 transition-colors text-center border-2 border-brand-border"
                >
                  {t('home.hero.cta.secondary')}
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
                  <p className="text-lg font-medium text-white">{t('home.hero.video.title')}</p>
                  <p className="text-sm text-slate-300 mt-2">{t('home.hero.video.placeholder')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GDPR & Privacy Banner */}
      <section className="bg-slate-900/50 border-b border-brand-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-brand-accent" />
            {t('home.gdpr.status')}
          </div>
          <span className="hidden sm:inline opacity-20">|</span>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-brand-accent" />
            {t('home.gdpr.storage')}
          </div>
          <span className="hidden sm:inline opacity-20">|</span>
          <Link href="/privacy-request" className="hover:text-white transition-colors flex items-center gap-2">
            <EyeOff size={14} className="text-brand-accent" />
            {t('home.gdpr.deletion')}
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-brand-dark py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-xl text-center text-slate-400 mb-16 max-w-3xl mx-auto">
            {t('home.howItWorks.subtitle')}
          </p>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <UserPlus className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{t('home.howItWorks.step1.title')}</h3>
              <p className="text-slate-400 leading-relaxed">
                {t('home.howItWorks.step1.description')}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <FileText className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{t('home.howItWorks.step2.title')}</h3>
              <p className="text-slate-400 leading-relaxed">
                {t('home.howItWorks.step2.description')}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-brand-card border-2 border-brand-border rounded-full p-6 inline-block mb-4">
                <DollarSign className="h-10 w-10 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{t('home.howItWorks.step3.title')}</h3>
              <p className="text-slate-400 leading-relaxed">
                {t('home.howItWorks.step3.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
          {t('home.features.title')}
        </h2>
        <p className="text-xl text-center text-slate-400 mb-16 max-w-3xl mx-auto">
          {t('home.features.subtitle')}
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-blue-900/50 rounded-full p-4 inline-block mb-4">
              <Clock className="h-8 w-8 text-brand-accent" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{t('home.features.feature1.title')}</h3>
            <p className="text-slate-400 leading-relaxed">
              {t('home.features.feature1.description')}
            </p>
          </div>
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-green-900/50 rounded-full p-4 inline-block mb-4">
              <Shield className="h-8 w-8 text-compliance-success" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{t('home.features.feature2.title')}</h3>
            <p className="text-slate-400 leading-relaxed">
              {t('home.features.feature2.description')}
            </p>
          </div>
          <div className="bg-brand-card rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-brand-border">
            <div className="bg-orange-900/50 rounded-full p-4 inline-block mb-4">
              <TrendingUp className="h-8 w-8 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{t('home.features.feature3.title')}</h3>
            <p className="text-slate-400 leading-relaxed">
              {t('home.features.feature3.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-brand-card/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
            {t('home.testimonials.title')}
          </h2>
          <p className="text-xl text-center text-slate-400 mb-16">
            {t('home.testimonials.subtitle')}
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
                  "{t(`home.testimonials.testimonial${i}.text`)}"
                </p>
                <div className="border-t border-brand-border pt-4">
                  <p className="font-semibold text-white">{t(`home.testimonials.testimonial${i}.name`)}</p>
                  <p className="text-sm text-slate-400">{t(`home.testimonials.testimonial${i}.company`)}</p>
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
            {t('home.cta.title')}
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            {t('home.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-white text-brand-accent-dark px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
            >
              {t('home.cta.primary')}
            </Link>
            <Link
              href="/how-to"
              className="bg-brand-accent text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-accent-dark transition-colors border-2 border-white border-opacity-30"
            >
              {t('home.cta.secondary')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
