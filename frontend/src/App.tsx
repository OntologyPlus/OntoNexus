import { useState, Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { OntologyProvider } from './contexts/OntologyContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OnboardingGuide from './components/OnboardingGuide';

const BriefPage = lazy(() => import('./components/BriefPage'));
const WatchPage = lazy(() => import('./components/WatchPage'));
const ApprovePage = lazy(() => import('./components/ApprovePage'));
const EffectPage = lazy(() => import('./components/EffectPage'));
const CheckedPage = lazy(() => import('./components/CheckedPage'));
const GuardPage = lazy(() => import('./components/GuardPage'));
const WrittenPage = lazy(() => import('./components/WrittenPage'));
const OntologyGraphView = lazy(() => import('./components/OntologyGraphView'));
const HubWhatIf = lazy(() => import('./components/HubWhatIf'));
const HubInsights = lazy(() => import('./components/HubInsights'));
const HubRules = lazy(() => import('./components/HubRules'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const pageVariants = {
  initial: { opacity: 0, y: 15, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
};

function resolveTab(tab: string, role?: string) {
  if (tab === 'decisions') return 'insights';
  if (tab === 'tools' || tab === 'workspace') return 'brief';
  if (tab === 'rules' && role !== 'admin') return 'brief';
  return tab;
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('brief');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('ontonexus_onboarded'));
  const { user } = useAuth();

  const goTab = (tab: string) => setActiveTab(resolveTab(tab, user?.role));

  const renderContent = () => {
    const tab = resolveTab(activeTab, user?.role);
    const content = (() => {
      switch (tab) {
        case 'brief': return <BriefPage onTabChange={goTab} />;
        case 'watch': return <WatchPage onTabChange={goTab} />;
        case 'approve': return <ApprovePage />;
        case 'checked': return <CheckedPage onTabChange={goTab} />;
        case 'guard': return <GuardPage />;
        case 'written': return <WrittenPage onTabChange={goTab} />;
        case 'effect': return <EffectPage />;
        case 'ontology': return <OntologyGraphView />;
        case 'insights': return <HubInsights />;
        case 'rules': return <HubRules />;
        case 'scenario': return <HubWhatIf />;
        case 'chat': return <ChatInterface />;
        default: return <BriefPage onTabChange={goTab} />;
      }
    })();

    return (
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }>
        {content}
      </Suspense>
    );
  };

  const userId = user?.id || 'default_user';

  return (
    <OntologyProvider userId={userId}>
      <Layout activeTab={resolveTab(activeTab, user?.role)} onTabChange={goTab} onNavigateToOntology={() => goTab('ontology')} onShowHelp={() => setShowOnboarding(true)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full w-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
      {showOnboarding && (
        <OnboardingGuide onComplete={() => {
          localStorage.setItem('ontonexus_onboarded', 'true');
          setShowOnboarding(false);
        }} onNavigate={(tab) => {
          goTab(tab);
          setShowOnboarding(false);
        }} />
      )}
    </OntologyProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin mb-4" />
          <div className="text-white font-medium text-lg animate-pulse">Loading...</div>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
