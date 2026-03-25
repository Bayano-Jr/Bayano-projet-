import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ProjectWizard from './components/ProjectWizard';
import CustomProjectWizard from './components/CustomProjectWizard';
import PlanEditor from './components/PlanEditor';
import GenerationView from './components/GenerationView';
import ProjectDetail from './components/ProjectDetail';
import AdminBackoffice from './components/AdminBackoffice';
import Auth from './components/Auth';
import ChatAssistant from './components/ChatAssistant';
import AntiPlagiarism from './components/AntiPlagiarism';
import PricingModal from './components/PricingModal';
import TermsModal from './components/TermsModal';
import { Project, PlanStructure, AppSettings, User } from './types';
import { generatePlan } from './services/geminiService';
import { storageService } from './services/storageService';
import { BookOpen, Sparkles, Shield, LogOut, Settings as SettingsIcon, MessageSquare, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAlert } from './contexts/AlertContext';

type View = 'dashboard' | 'wizard' | 'custom_wizard' | 'plan_editor' | 'generation' | 'detail' | 'admin' | 'chat' | 'anti_plagiarism';

import { ErrorBoundary } from './components/ErrorBoundary';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getAuthToken } from './utils/auth';

export default function App() {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const [view, setView] = useState<View>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<PlanStructure | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bayano_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSetUser = (u: User | null, sessionId?: string) => {
    setUser(u);
    if (u) {
      localStorage.setItem('bayano_user', JSON.stringify(u));
      if (sessionId) {
        localStorage.setItem('bayano_sid', sessionId);
      }
    } else {
      localStorage.removeItem('bayano_user');
      localStorage.removeItem('bayano_sid');
    }
  };
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+A ou Cmd+Shift+A pour ouvrir le backoffice discrètement
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setView('admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSecretClick = () => {
    setAdminClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setView('admin');
        return 0;
      }
      return newCount;
    });
  };

  useEffect(() => {
    loadSettings();
    
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            handleSetUser(data.user, token);
          } else {
            handleSetUser(null);
          }
        } catch (err) {
          console.error("Auth sync failed:", err);
          handleSetUser(null);
        }
      } else {
        handleSetUser(null);
      }
      setIsAuthLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storageService.getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
      // We have DEFAULT_SETTINGS in storageService, so this shouldn't happen often
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
    handleSetUser(null);
    setView('dashboard');
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    // Refresh settings whenever view changes
    loadSettings();
  }, [view]);

  const handleNewProject = () => setView('wizard');

  const handleSelectProject = React.useCallback(async (id: string) => {
    const data = await storageService.getProject(id);
    if (data) {
      setCurrentProject(data);
      setSelectedProjectId(id);
      if (data.status === 'draft') {
        try {
          setGeneratedPlan(JSON.parse(data.plan || '{}'));
        } catch {
          setGeneratedPlan(null);
        }
        setView('plan_editor');
      } else if (data.status === 'plan_validated' || data.status === 'generating') {
        setView('generation');
      } else {
        setView('detail');
      }
    }
  }, []);

  const handleWizardComplete = async (data: Partial<Project>) => {
    if (!user) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const sid = await getAuthToken();
    if (sid) {
      headers['Authorization'] = `Bearer ${sid}`;
    }

    // Check credits for plan generation
    try {
      const res = await fetch('/api/saas/estimate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'plan' }),
        credentials: 'include'
      });
      if (res.status === 401) {
        handleSetUser(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to estimate credits");
      const estimateData = await res.json();
      
      if (!estimateData.hasEnough) {
        setIsPricingOpen(true);
        return;
      }
    } catch (err) {
      console.error("Error checking credits:", err);
      showAlert({ message: t('app.errorCheckingCredits'), type: 'error' });
      return;
    }

    setIsGeneratingPlan(true);
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newProject = { 
      ...data, 
      id, 
      status: 'draft', 
      created_at: new Date().toISOString() 
    } as Project;
    
    try {
      // Deduct credits
      const deductRes = await fetch('/api/saas/deduct', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: 2, description: `Génération plan: ${data.title?.substring(0, 20)}...` }),
        credentials: 'include'
      });
      
      if (deductRes.ok) {
        const deductData = await deductRes.json();
        handleSetUser({ ...user, credits: deductData.remainingCredits });
      } else {
        throw new Error(t('app.insufficientCredits'));
      }

      // 1. Generate Plan with Gemini
      const plan = await generatePlan(newProject);
      setGeneratedPlan(plan);
      
      // 2. Save Project to Storage
      const projectToSave = { ...newProject, plan: JSON.stringify(plan) };
      
      if (newProject.generationMode === 'direct') {
        projectToSave.status = 'plan_validated';
      }
      
      await storageService.saveProject(projectToSave);

      setCurrentProject(projectToSave);
      setSelectedProjectId(id);
      setIsGeneratingPlan(false);
      
      if (newProject.generationMode === 'direct') {
        setView('generation');
      } else {
        setView('plan_editor');
      }
    } catch (error: any) {
      console.error("Error generating or saving plan:", error);
      setIsGeneratingPlan(false);
      
      if (error.message.includes("Non autorisé")) {
        handleSetUser(null);
        showAlert({ message: t('app.sessionExpired'), type: 'warning' });
      } else {
        showAlert({ message: `${t('app.errorCreatingProject')} ${error.message || t('app.pleaseRetry')}`, type: 'error' });
      }
    }
  };

  const handlePlanValidate = async (updatedPlan: PlanStructure) => {
    if (!selectedProjectId) return;
    
    try {
      await storageService.updateProjectPlan(selectedProjectId, updatedPlan);
      setCurrentProject(prev => prev ? { ...prev, plan: JSON.stringify(updatedPlan), status: 'plan_validated' } : null);
      setView('generation');
    } catch (error: any) {
      console.error("Error validating plan:", error);
      showAlert({ message: `${t('app.errorValidatingPlan')} ${error.message}`, type: 'error' });
    }
  };

  const handlePlanAutoSave = React.useCallback(async (updatedPlan: PlanStructure) => {
    if (!selectedProjectId || !currentProject) return;
    
    try {
      const projectToSave = { ...currentProject, plan: JSON.stringify(updatedPlan) };
      await storageService.saveProject(projectToSave);
      setCurrentProject(projectToSave);
    } catch (error) {
      console.error("Error auto-saving plan:", error);
    }
  }, [selectedProjectId, currentProject]);

  const handleGenerationComplete = () => {
    setView('detail');
  };

  const handleSessionError = React.useCallback(() => {
    handleSetUser(null);
    setView('dashboard');
    // Use a ref or state to prevent multiple alerts
    showAlert({ message: t('app.sessionExpired'), type: 'warning' });
  }, [showAlert, t]);

  if (isAuthLoading || !settings) {
    return (
      <div className="min-h-screen bg-academic-50 flex flex-col items-center justify-center p-10 text-center">
        <div className="w-16 h-16 border-4 border-academic-900/20 border-t-academic-900 rounded-full animate-spin mb-8"></div>
        <h2 className="text-2xl font-serif font-bold text-academic-900 mb-2">{settings?.appName || t('app.title')}</h2>
        <p className="text-slate-400 italic">{t('app.initializing')}</p>
        
        {authError && (
          <div className="mt-10 p-6 bg-red-50 border border-red-100 rounded-2xl max-w-sm">
            <p className="text-red-600 text-sm font-medium mb-4">{authError}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.location.reload()} 
                className="btn-primary bg-red-600 hover:bg-red-700 py-2 text-xs"
              >
                {t('app.retryLogin')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth 
          onLogin={(u, sid) => handleSetUser(u, sid)} 
          onShowTerms={() => setIsTermsOpen(true)}
        />
        <TermsModal 
          isOpen={isTermsOpen}
          onClose={() => setIsTermsOpen(false)}
        />
      </>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-academic-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-academic-200 border-t-academic-900 rounded-full animate-spin"></div>
          <p className="text-academic-900 font-medium">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-academic-100 flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3 md:py-4 flex justify-between items-center sticky top-0 z-50 flex-wrap gap-y-4">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setView('dashboard')}
        >
          <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-lg shadow-academic-900/20 group-hover:scale-110 transition-transform duration-500 bg-white flex items-center justify-center p-0.5">
            <img src="/logo.svg" alt="Bayano Académie Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl md:text-3xl font-serif font-bold tracking-tight text-academic-900 leading-none">{settings.appName}</span>
            <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold text-accent/80 mt-1">{settings.appSlogan}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-6 ml-auto">
          <button 
            title={t('dashboard.aiAssistantTitle')}
            onClick={() => setView('chat')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${view === 'chat' ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-105' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:scale-105 shadow-sm'}`}
          >
            <MessageSquare size={16} className={view !== 'chat' ? 'text-emerald-600' : ''} />
            <span className="hidden lg:inline">{t('dashboard.aiAssistantTitle')}</span>
          </button>

          <button 
            title={t('dashboard.antiPlagiarismTitle')}
            onClick={() => setView('anti_plagiarism')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${view === 'anti_plagiarism' ? 'bg-academic-900 text-white shadow-lg shadow-academic-900/20 scale-105' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:scale-105 shadow-sm'}`}
          >
            <Search size={16} className={view !== 'anti_plagiarism' ? 'text-slate-600' : ''} />
            <span className="hidden lg:inline">{t('dashboard.antiPlagiarismTitle')}</span>
          </button>
          
          <div className="hidden xl:flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Sparkles size={14} className="text-accent animate-pulse" />
            {t('app.poweredBy')} {settings.aiModel.includes('pro') ? 'Gemini Pro' : 'Gemini Flash'}
          </div>

          <button 
            onClick={() => setIsPricingOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors border border-slate-200"
          >
            <div className={`w-2 h-2 rounded-full ${user.plan === 'premium' ? 'bg-yellow-400' : user.plan === 'student' ? 'bg-accent' : 'bg-slate-400'}`}></div>
            <span className="text-xs font-bold text-slate-700">{user.credits || 0} {t('app.credits')}</span>
          </button>
          
          <div className="flex items-center gap-2 border-l border-slate-100 pl-2 md:pl-6">
            <select 
              className="bg-transparent text-xs font-bold text-slate-500 uppercase tracking-widest outline-none cursor-pointer hover:text-academic-900 transition-colors"
              onChange={(e) => {
                i18n.changeLanguage(e.target.value);
              }}
              defaultValue={(() => {
                try {
                  return i18n.language.split('-')[0];
                } catch {
                  return 'fr';
                }
              })()}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 md:gap-3 pl-2 md:pl-6 border-l border-slate-100 group"
            >
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-bold text-academic-900 group-hover:text-accent transition-colors max-w-[100px] lg:max-w-[150px] truncate">{user.name}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">{user.plan === 'premium' ? t('app.plans.premium') : user.plan === 'student' ? t('app.plans.student') : t('app.plans.free')}</span>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-academic-900 text-white flex items-center justify-center font-serif text-lg shadow-xl shadow-academic-900/10 border border-white/10 group-hover:scale-105 transition-transform shrink-0">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
              </div>
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div 
                  key="user-menu-container" 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-50"
                >
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsUserMenuOpen(false)}
                  ></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 py-4 z-50 overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-50 mb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('app.loggedInAs')}</p>
                      <p className="text-sm font-bold text-academic-900 truncate">{user.email}</p>
                    </div>

                    <button 
                      onClick={() => {
                        setIsPricingOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-6 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-academic-900 flex items-center gap-3 transition-colors"
                    >
                      <Sparkles size={18} className="text-accent" />
                      {t('app.manageSubscription')}
                    </button>
                    

                    <div className="h-px bg-slate-50 my-2"></div>

                    <button 
                      onClick={handleLogout}
                      className="w-full px-6 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <LogOut size={18} />
                      {t('app.logout')}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {isPricingOpen && (
        <PricingModal 
          user={user}
          onClose={() => setIsPricingOpen(false)}
          onUpdateUser={(u) => handleSetUser(u)}
        />
      )}

      <TermsModal 
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      <main className={`flex-1 flex flex-col ${view === 'chat' ? 'h-[calc(100vh-80px)] overflow-hidden' : 'py-4 md:py-8'}`}>
        {isGeneratingPlan ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={32} />
            </div>
            <h2 className="text-3xl mb-4">{t('app.analyzingSubject')}</h2>
            <p className="text-gray-500 max-w-md">
              {t('app.structuringThesis')}
            </p>
          </div>
        ) : (
          <>
            {/* Main Views */}
            <div className={view === 'dashboard' ? 'block' : 'hidden'}>
              <Dashboard 
                onNewProject={handleNewProject} 
                onCustomProject={() => setView('custom_wizard')}
                onSelectProject={handleSelectProject} 
                onSessionError={handleSessionError}
              />
            </div>
            {view === 'anti_plagiarism' && (
              <AntiPlagiarism 
                onBack={() => setView('dashboard')} 
                user={user}
                onUpdateUser={setUser}
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}

            {view === 'wizard' && (
              <ProjectWizard 
                user={user}
                onCancel={() => setView('dashboard')} 
                onComplete={handleWizardComplete} 
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}

            {view === 'custom_wizard' && (
              <CustomProjectWizard 
                user={user}
                onCancel={() => setView('dashboard')} 
                onComplete={handleWizardComplete} 
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}

            {view === 'plan_editor' && generatedPlan && currentProject && (
              <PlanEditor 
                project={currentProject}
                plan={generatedPlan} 
                onValidate={handlePlanValidate} 
                onAutoSave={handlePlanAutoSave}
                user={user}
                onUpdateUser={setUser}
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}

            {/* Generation View - Keep mounted if generating to prevent stopping */}
            {(view === 'generation' || (view === 'detail' && currentProject?.status === 'generating')) && currentProject && (
              <div className={view === 'generation' ? 'block' : 'hidden'}>
                <GenerationView 
                  project={currentProject} 
                  user={user}
                  onUpdateUser={(u) => handleSetUser(u)}
                  onShowPricing={() => setIsPricingOpen(true)}
                  onComplete={handleGenerationComplete} 
                  onViewDetail={() => setView('detail')}
                  onBackToDashboard={() => setView('dashboard')}
                />
              </div>
            )}

            {view === 'detail' && selectedProjectId && (
              <ProjectDetail 
                projectId={selectedProjectId} 
                onBack={() => setView('dashboard')} 
                onSessionError={handleSessionError}
                user={user}
                onUpdateUser={setUser}
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}

            {view === 'admin' && (
              <AdminBackoffice 
                onClose={() => setView('dashboard')} 
              />
            )}

            {view === 'chat' && (
              <ChatAssistant 
                user={user}
                onUpdateUser={setUser}
                onShowPricing={() => setIsPricingOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      {view !== 'chat' && (
        <footer className="py-12 border-t border-slate-100 bg-white mt-auto">
          <div className="max-w-7xl mx-auto px-12 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3 opacity-30">
              <BookOpen size={20} />
              <span className="font-serif font-bold text-lg">{settings.appName}</span>
            </div>
            <div className="flex items-center gap-8 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
              <button onClick={() => setIsTermsOpen(true)} className="hover:text-academic-900 transition-colors uppercase">Conditions</button>
            </div>
            <div 
              className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-300 cursor-default select-none"
              onClick={handleSecretClick}
            >
              © 2026 {settings.appName}
            </div>
          </div>
        </footer>
      )}
    </div>
    </ErrorBoundary>
  );
}
