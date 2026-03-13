import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ProjectWizard from './components/ProjectWizard';
import PlanEditor from './components/PlanEditor';
import GenerationView from './components/GenerationView';
import ProjectDetail from './components/ProjectDetail';
import AdminBackoffice from './components/AdminBackoffice';
import Auth from './components/Auth';
import TwoFactorSetup from './components/TwoFactorSetup';
import ChatAssistant from './components/ChatAssistant';
import AntiPlagiarism from './components/AntiPlagiarism';
import PricingModal from './components/PricingModal';
import { Project, PlanStructure, AppSettings, User } from './types';
import { generatePlan } from './services/geminiService';
import { storageService } from './services/storageService';
import { BookOpen, Sparkles, Shield, LogOut, Settings as SettingsIcon, MessageSquare, Search } from 'lucide-react';
import i18n from './i18n';

type View = 'dashboard' | 'wizard' | 'plan_editor' | 'generation' | 'detail' | 'admin' | 'chat' | 'anti_plagiarism';

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
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
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
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
    checkAuth();
    loadSettings();
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

  const checkAuth = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      console.log("[App] Checking auth...");
      
      // Add a timeout to the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const headers: Record<string, string> = {};
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }

      const response = await fetch('/api/auth/me', { 
        headers,
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log("[App] Auth success:", data.user.email);
        handleSetUser(data.user, data.sessionId);
      } else {
        console.log("[App] Auth failed with status:", response.status);
        // If we get a 401, clear the local user as it's definitely invalid
        if (response.status === 401) {
          handleSetUser(null);
        }
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setAuthError("Impossible de se connecter au serveur.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const headers: Record<string, string> = {};
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        headers,
        credentials: 'include' 
      });
    } catch (err) {
      console.error("Logout failed");
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

    // Check credits for plan generation
    try {
      const res = await fetch('/api/saas/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plan' }),
        credentials: 'include'
      });
      if (res.status === 401) {
        setUser(null);
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
      alert("Erreur lors de la vérification des crédits.");
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 2, description: `Génération plan: ${data.title?.substring(0, 20)}...` }),
        credentials: 'include'
      });
      
      if (deductRes.ok) {
        const deductData = await deductRes.json();
        handleSetUser({ ...user, credits: deductData.remainingCredits });
      } else {
        throw new Error("Crédits insuffisants");
      }

      // 1. Generate Plan with Gemini
      const plan = await generatePlan(newProject);
      setGeneratedPlan(plan);
      
      // 2. Save Project to Storage
      const projectToSave = { ...newProject, plan: JSON.stringify(plan) };
      await storageService.saveProject(projectToSave);

      setCurrentProject(projectToSave);
      setSelectedProjectId(id);
      setIsGeneratingPlan(false);
      setView('plan_editor');
    } catch (error: any) {
      console.error("Error generating or saving plan:", error);
      setIsGeneratingPlan(false);
      
      if (error.message.includes("Non autorisé")) {
        setUser(null);
        alert("Votre session a expiré. Veuillez vous reconnecter.");
      } else {
        alert(`Erreur lors de la création du projet: ${error.message || "Veuillez réessayer."}`);
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
      alert(`Erreur lors de la validation du plan: ${error.message}`);
    }
  };

  const handleGenerationComplete = () => {
    setView('detail');
  };

  const handleSessionError = React.useCallback(() => {
    handleSetUser(null);
    setView('dashboard');
    // Use a ref or state to prevent multiple alerts
    alert("Votre session a expiré. Veuillez vous reconnecter.");
  }, []);

  if (isAuthLoading || !settings) {
    return (
      <div className="min-h-screen bg-academic-50 flex flex-col items-center justify-center p-10 text-center">
        <div className="w-16 h-16 border-4 border-academic-900/20 border-t-academic-900 rounded-full animate-spin mb-8"></div>
        <h2 className="text-2xl font-serif font-bold text-academic-900 mb-2">Bayano Académie</h2>
        <p className="text-slate-400 italic">Initialisation de votre environnement de recherche...</p>
        
        {authError && (
          <div className="mt-10 p-6 bg-red-50 border border-red-100 rounded-2xl max-w-sm">
            <p className="text-red-600 text-sm font-medium mb-4">{authError}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => checkAuth()} 
                className="btn-primary bg-red-600 hover:bg-red-700 py-2 text-xs"
              >
                Réessayer la connexion
              </button>
              <button onClick={() => window.location.reload()} className="text-[10px] font-bold uppercase tracking-widest text-red-700 hover:underline">
                Rafraîchir la page
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={(u, sid) => handleSetUser(u, sid)} />;
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
            title="Assistant IA"
            onClick={() => setView('chat')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${view === 'chat' ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-105' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:scale-105 shadow-sm'}`}
          >
            <MessageSquare size={16} className={view !== 'chat' ? 'text-emerald-600' : ''} />
            <span className="hidden lg:inline">Assistant IA</span>
          </button>

          <button 
            title="Anti-Plagiat"
            onClick={() => setView('anti_plagiarism')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${view === 'anti_plagiarism' ? 'bg-academic-900 text-white shadow-lg shadow-academic-900/20 scale-105' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:scale-105 shadow-sm'}`}
          >
            <Search size={16} className={view !== 'anti_plagiarism' ? 'text-slate-600' : ''} />
            <span className="hidden lg:inline">Anti-Plagiat</span>
          </button>
          
          <div className="hidden xl:flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Sparkles size={14} className="text-accent animate-pulse" />
            Propulsé par {settings.aiModel.includes('pro') ? 'Gemini Pro' : 'Gemini Flash'}
          </div>

          <button 
            onClick={() => setIsPricingOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors border border-slate-200"
          >
            <div className={`w-2 h-2 rounded-full ${user.plan === 'premium' ? 'bg-yellow-400' : user.plan === 'student' ? 'bg-accent' : 'bg-slate-400'}`}></div>
            <span className="text-xs font-bold text-slate-700">{user.credits || 0} crédits</span>
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
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">{user.plan === 'premium' ? 'Premium' : user.plan === 'student' ? 'Étudiant Plus' : 'Gratuit'}</span>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-academic-900 text-white flex items-center justify-center font-serif text-lg shadow-xl shadow-academic-900/10 border border-white/10 group-hover:scale-105 transition-transform shrink-0">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
              </div>
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <>
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
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Connecté en tant que</p>
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
                      Gérer l'abonnement
                    </button>
                    
                    <button 
                      onClick={() => {
                        setIs2FASetupOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-6 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-academic-900 flex items-center gap-3 transition-colors"
                    >
                      <SettingsIcon size={18} className="text-slate-400" />
                      Sécurité & 2FA
                    </button>

                    <div className="h-px bg-slate-50 my-2"></div>

                    <button 
                      onClick={handleLogout}
                      className="w-full px-6 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <LogOut size={18} />
                      Déconnexion
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {is2FASetupOpen && (
        <TwoFactorSetup 
          user={user} 
          onUpdate={(u) => handleSetUser(u)} 
          onClose={() => setIs2FASetupOpen(false)} 
        />
      )}

      {isPricingOpen && (
        <PricingModal 
          user={user}
          onClose={() => setIsPricingOpen(false)}
          onUpdateUser={(u) => handleSetUser(u)}
        />
      )}

      <main className={`flex-1 flex flex-col ${view === 'chat' ? 'h-[calc(100vh-80px)] overflow-hidden' : 'py-4 md:py-8'}`}>
        {isGeneratingPlan ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={32} />
            </div>
            <h2 className="text-3xl mb-4">Analyse de votre sujet...</h2>
            <p className="text-gray-500 max-w-md">
              Notre intelligence artificielle structure votre mémoire en respectant les normes académiques internationales.
            </p>
          </div>
        ) : (
          <>
            {/* Main Views */}
            <div className={view === 'dashboard' ? 'block' : 'hidden'}>
              <Dashboard 
                onNewProject={handleNewProject} 
                onSelectProject={handleSelectProject} 
                onSessionError={handleSessionError}
              />
            </div>
            {view === 'anti_plagiarism' && (
              <AntiPlagiarism onBack={() => setView('dashboard')} />
            )}

            {view === 'wizard' && (
              <ProjectWizard 
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
              />
            )}

            {view === 'admin' && (
              <AdminBackoffice 
                onClose={() => setView('dashboard')} 
              />
            )}

            {view === 'chat' && (
              <ChatAssistant />
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
              <a href="#" className="hover:text-academic-900 transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-academic-900 transition-colors">Conditions</a>
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
