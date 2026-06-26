import React, { useCallback, useEffect, useMemo, useState, useContext, createContext, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/public/Header';
import { Footer } from './components/public/Footer';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Lazy load components
const LoginForm = lazy(() => import('./components/auth/LoginForm').then(m => ({ default: m.LoginForm })));
const ManagerDashboard = lazy(() => import('./components/manager/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const HomePage = lazy(() => import('./components/public/HomePage').then(m => ({ default: m.HomePage })));
const PrivacyPage = lazy(() => import('./components/public/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./components/public/TermsPage').then(m => ({ default: m.TermsPage })));
const HowToPage = lazy(() => import('./components/public/HowToPage').then(m => ({ default: m.HowToPage })));
const ContactPage = lazy(() => import('./components/public/ContactPage').then(m => ({ default: m.ContactPage })));
const MfaChallengeScreen = lazy(() => import('./components/auth/MfaChallengeScreen').then(m => ({ default: m.MfaChallengeScreen })));
const PrivacyRequestPage = lazy(() => import('./pages/PrivacyRequestPage').then(m => ({ default: m.PrivacyRequestPage })));

type Route = '/' | '/login' | '/signup' | '/privacy' | '/terms' | '/how-to' | '/dashboard' | '/privacy-request' | '/contact';

const PUBLIC_ROUTES: Route[] = ['/', '/signup', '/privacy', '/terms', '/how-to', '/privacy-request', '/contact'];
const AUTH_ROUTES: Route[] = ['/login'];
const PROTECTED_ROUTES: Route[] = ['/dashboard'];

interface RouterContextType {
  currentPath: Route;
  navigate: (path: Route) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

function RouterProvider({ children }: { children: React.ReactNode }) {
  const getPath = () => {
    const path = window.location.pathname;
    return isRoute(path) ? path : '/';
  };

  const [currentPath, setCurrentPath] = useState<Route>(getPath());

  useEffect(() => {
    const handlePopState = () => setCurrentPath(getPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: Route) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

function isRoute(path: string): path is Route {
  return (
    path === '/' ||
    path === '/login' ||
    path === '/signup' ||
    path === '/privacy' ||
    path === '/terms' ||
    path === '/how-to' ||
    path === '/dashboard' ||
    path === '/privacy-request' ||
    path === '/contact'
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark to-brand-card flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto" />
        <p className="text-center mt-4 text-gray-700 font-medium">{t('common.loading')}</p>
      </div>
    </div>
  );
}

function AuthShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-slate-800 to-brand-card flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Suspense fallback={<LoadingScreen />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}


function AppContent() {
  const { user, profile, loading, isSigningUp, needsMfa, refreshSession, signOut } = useAuth();
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation();

  const isPublic = useMemo(() => PUBLIC_ROUTES.includes(currentPath), [currentPath]);
  const isAuth = useMemo(() => AUTH_ROUTES.includes(currentPath), [currentPath]);
  const isProtected = useMemo(() => PROTECTED_ROUTES.includes(currentPath), [currentPath]);

  const DEBUG = false;

  const debugOverlay = !DEBUG ? null : (
    <div className="fixed bottom-3 left-3 z-50 text-xs bg-black/70 text-white px-3 py-2 rounded-lg">
      path: {currentPath} | loading: {String(loading)} | isSigningUp: {String(isSigningUp)} | user: {String(!!user)} | profile:{' '}
      {String(!!profile)} | needsMfa: {String(needsMfa)}
    </div>
  );

  useEffect(() => {
    if (loading) return;

    if (user && isAuth) {
      navigate('/dashboard');
      return;
    }

    if (!user && isProtected) {
      navigate('/login');
      return;
    }

    if (user && !isPublic && !isAuth && currentPath !== '/dashboard') {
      navigate('/dashboard');
    }
  }, [loading, user, isAuth, isProtected, isPublic, currentPath, navigate]);

  if (loading && !(isPublic || isAuth)) {
    return (
      <>
        <LoadingScreen />
        {debugOverlay}
      </>
    );
  }

  if (currentPath === '/privacy-request') {
      return (
        <Suspense fallback={<LoadingScreen />}>
          <PrivacyRequestPage />
        </Suspense>
      );
  }

  if (isPublic) {
    return (
      <>
        <PublicLayout>
          <Suspense fallback={<LoadingScreen />}>
            {currentPath === '/' && <HomePage />}
            {currentPath === '/privacy' && <PrivacyPage />}
            {currentPath === '/terms' && <TermsPage />}
            {currentPath === '/how-to' && <HowToPage />}
            {(currentPath === '/contact' || currentPath === '/signup') && <ContactPage />}
          </Suspense>
        </PublicLayout>
        {debugOverlay}
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthShell />
        {debugOverlay}
      </>
    );
  }

  if (!profile) {
    if (isSigningUp) {
      return (
        <>
          <LoadingScreen />
          {debugOverlay}
        </>
      );
    }
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-brand-dark to-brand-card flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-orange-500" />
            <h2 className="text-2xl font-bold text-gray-800">{t('errors.profileNotFound.title', 'Profile Not Found')}</h2>
            <p className="text-gray-600">
              {t('errors.profileNotFound.message', "We found your account, but couldn't load your profile details. This might be a temporary connection issue.")}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => refreshSession()}
                className="w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t('errors.profileNotFound.retry', 'Retry Loading Profile')}
              </button>

              <button
                onClick={() => signOut()}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {t('errors.profileNotFound.signOut', 'Sign Out and Start Over')}
              </button>
            </div>
          </div>
        </div>
        {debugOverlay}
      </>
    );
  }
  
  if (needsMfa) {
    return (
      <>
        <Suspense fallback={<LoadingScreen />}>
          <MfaChallengeScreen onSuccess={refreshSession} />
        </Suspense>
        {debugOverlay}
      </>
    );
  }

  if (profile.role !== 'manager') {
    return (
      <>
        <AuthShell />
        {debugOverlay}
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <ManagerDashboard />
      </Suspense>
      {debugOverlay}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;
