// src/App.tsx

import React, { useCallback, useEffect, useMemo, useState, useContext, createContext } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { HomePage } from './components/public/HomePage';
import { PrivacyPage } from './components/public/PrivacyPage';
import { TermsPage } from './components/public/TermsPage';
import { HowToPage } from './components/public/HowToPage';
import { ContactPage } from './components/public/ContactPage';
import { Header } from './components/public/Header';
import { Footer } from './components/public/Footer';
import { MfaChallengeScreen } from './components/auth/MfaChallengeScreen';
import { AlertTriangle } from 'lucide-react';
import { PrivacyRequestPage } from './pages/PrivacyRequestPage';
import { useTranslation } from 'react-i18next'; // Import

type Route = '/' | '/login' | '/signup' | '/privacy' | '/terms' | '/how-to' | '/dashboard' | '/privacy-request' | '/contact';

const PUBLIC_ROUTES: Route[] = ['/', '/privacy', '/terms', '/how-to', '/privacy-request', '/contact'];
const AUTH_ROUTES: Route[] = ['/login', '/signup'];
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

function AuthShell({ view }: { view: 'login' | 'signup' }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-slate-800 to-brand-card flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {view === 'login' ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  state = { error: null };

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black text-white p-6">
          <h1 className="text-xl font-bold mb-2">App crashed</h1>
          <pre className="text-sm whitespace-pre-wrap opacity-90">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}


function AppContent() {
  const { user, profile, loading, isSigningUp, needsMfa, refreshSession, signOut } = useAuth();
  const { currentPath, navigate } = useRouter();
  const { t } = useTranslation(); // Use hook

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
      return <PrivacyRequestPage />;
  }

  if (isPublic) {
    return (
      <>
        <PublicLayout>
          {currentPath === '/' && <HomePage />}
          {currentPath === '/privacy' && <PrivacyPage />}
          {currentPath === '/terms' && <TermsPage />}
          {currentPath === '/how-to' && <HowToPage />}
          {currentPath === '/contact' && <ContactPage />}
        </PublicLayout>
        {debugOverlay}
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthShell view={currentPath === '/signup' ? 'signup' : 'login'} />
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
        <MfaChallengeScreen onSuccess={refreshSession} />
        {debugOverlay}
      </>
    );
  }

  if (profile.role !== 'manager') {
    return (
      <>
        <AuthShell view="login" />
        {debugOverlay}
      </>
    );
  }

  return (
    <>
      <ManagerDashboard />
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
