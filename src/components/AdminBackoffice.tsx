import React, { useState, useEffect } from 'react';
import { Settings, Shield, Save, LogOut, RefreshCcw, Database, Cpu, Type, Layout, ArrowLeft, CheckCircle2, AlertCircle, Users, CreditCard, Activity, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { storageService } from '../services/storageService';
import { AppSettings } from '../types';
import AdminUsers from './AdminUsers';
import AdminPricing from './AdminPricing';
import AdminDashboard from './AdminDashboard';
import AdminErrors from './AdminErrors';
import { useAlert } from '../contexts/AlertContext';

interface AdminBackofficeProps {
  onClose: () => void;
}

export default function AdminBackoffice({ onClose }: AdminBackofficeProps) {
  const { showAlert, showConfirm } = useAlert();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai' | 'users' | 'pricing' | 'errors'>('dashboard');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutEndTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((lockoutEndTime - now) / 1000);
        if (remaining <= 0) {
          setLockoutEndTime(null);
          setCountdown(0);
          setLoginError(null);
          clearInterval(interval);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutEndTime]);

  const loadSettings = async () => {
    const data = await storageService.getSettings();
    setSettings(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_admin_token');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('bayano_admin_token', data.token);
        }
        setIsAuthenticated(true);
        setLoginError(null);
        setLockoutEndTime(null);
        loadSettings(); // Reload settings to get the real admin password
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429 && errData.resetTime) {
          setLockoutEndTime(errData.resetTime);
          const remaining = Math.ceil((errData.resetTime - Date.now()) / 1000);
          setCountdown(remaining > 0 ? remaining : 0);
        } else {
          setLoginError(errData.error || "Mot de passe incorrect.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Erreur de connexion.");
    }
  };

  const handleLogout = async () => {
    try {
      const headers: Record<string, string> = {};
      const sid = localStorage.getItem('bayano_admin_token');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers,
        credentials: 'include'
      });
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('bayano_admin_token');
    setIsAuthenticated(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaveStatus('saving');
    try {
      await storageService.saveSettings(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveStatus('error');
      showAlert({ message: err.message || "Erreur lors de l'enregistrement", type: 'error' });
    }
  };

  const resetToDefaults = async () => {
    showConfirm({
      title: 'Réinitialiser les réglages',
      message: 'Voulez-vous vraiment réinitialiser tous les réglages par défaut ?',
      confirmText: 'Réinitialiser',
      type: 'warning',
      onConfirm: async () => {
        const defaultSettings: AppSettings = {
          adminPassword: 'admin',
          aiModel: 'gemini-3.1-pro-preview',
          systemInstruction: "Tu es un expert en rédaction académique. Ton rôle est de rédiger des mémoires de haute qualité, structurés, avec un ton formel et des références précises.",
          appName: 'Bayano Académie',
          appSlogan: 'Excellence & IA'
        };
        setSettings(defaultSettings);
        await storageService.saveSettings(defaultSettings);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    });
  };

  if (!settings) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-card p-10"
        >
          <div className="w-16 h-16 bg-academic-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-academic-900/20">
            <Shield className="text-white" size={32} />
          </div>
          <h2 className="text-3xl font-serif font-medium text-center mb-2">Accès Administrateur</h2>
          <p className="text-slate-500 text-center mb-8 font-serif italic">Veuillez entrer le mot de passe pour accéder au backoffice.</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Mot de passe</label>
              <input 
                type="password" 
                className={`academic-input ${loginError || lockoutEndTime ? 'border-red-500 ring-red-500/10' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={lockoutEndTime !== null}
              />
              {loginError && !lockoutEndTime && <p className="text-red-500 text-xs mt-2 font-medium">{loginError}</p>}
              {lockoutEndTime !== null && (
                <p className="text-red-500 text-xs mt-2 font-medium">
                  Trop de tentatives. Réessayez dans {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}.
                </p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full" disabled={lockoutEndTime !== null}>
              {lockoutEndTime !== null ? 'Verrouillé' : 'Se connecter'}
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-academic-900 text-sm w-full text-center transition-colors">
              Retour à l'application
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Header */}
      <header className="bg-white border-b border-slate-100 px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-academic-900 w-10 h-10 md:w-12 md:h-12 rounded-[14px] md:rounded-[18px] text-white shadow-xl shadow-academic-900/20 flex items-center justify-center shrink-0">
            <Shield size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-academic-900">Backoffice Bayano</h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Système Actif</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto justify-between sm:justify-end">
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-[10px] font-bold uppercase tracking-widest transition-all group">
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
          <button onClick={onClose} className="bg-slate-50 hover:bg-slate-100 text-academic-900 text-[10px] font-bold uppercase tracking-widest px-4 md:px-6 py-2 md:py-3 rounded-xl transition-all border border-slate-100">
            Fermer
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 md:px-8 py-8 md:py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-8 px-2">Configuration</h3>
              <nav className="space-y-2">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all ${activeTab === 'dashboard' ? 'bg-academic-900 text-white shadow-xl shadow-academic-900/10' : 'text-slate-400 hover:bg-slate-50 hover:text-academic-900'}`}
                >
                  <Activity size={18} /> Tableau de Bord
                </button>
                <button 
                  onClick={() => setActiveTab('ai')}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all ${activeTab === 'ai' ? 'bg-academic-900 text-white shadow-xl shadow-academic-900/10' : 'text-slate-400 hover:bg-slate-50 hover:text-academic-900'}`}
                >
                  <Cpu size={18} /> Intelligence Artificielle
                </button>
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all ${activeTab === 'users' ? 'bg-academic-900 text-white shadow-xl shadow-academic-900/10' : 'text-slate-400 hover:bg-slate-50 hover:text-academic-900'}`}
                >
                  <Users size={18} /> Utilisateurs & Abonnements
                </button>
                <button 
                  onClick={() => setActiveTab('pricing')}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all ${activeTab === 'pricing' ? 'bg-academic-900 text-white shadow-xl shadow-academic-900/10' : 'text-slate-400 hover:bg-slate-50 hover:text-academic-900'}`}
                >
                  <CreditCard size={18} /> Prix & Abonnements
                </button>
                <button 
                  onClick={() => setActiveTab('errors')}
                  className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 transition-all ${activeTab === 'errors' ? 'bg-academic-900 text-white shadow-xl shadow-academic-900/10' : 'text-slate-400 hover:bg-slate-50 hover:text-academic-900'}`}
                >
                  <AlertTriangle size={18} /> Journal des Erreurs
                </button>
                <button className="w-full text-left px-5 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-academic-900 flex items-center gap-4 transition-all">
                  <Layout size={18} /> Apparence & Branding
                </button>
                <button className="w-full text-left px-5 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-academic-900 flex items-center gap-4 transition-all">
                  <Database size={18} /> Données & Stockage
                </button>
                <button className="w-full text-left px-5 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-academic-900 flex items-center gap-4 transition-all">
                  <Shield size={18} /> Sécurité
                </button>
              </nav>
            </div>

            <div className="p-8 bg-academic-900 rounded-[32px] text-white shadow-2xl shadow-academic-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <h4 className="font-serif text-xl mb-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-accent" /> Vigilance
              </h4>
              <p className="text-white/60 text-xs leading-relaxed font-medium">
                Les modifications impactent la précision académique et l'intégrité des mémoires générés.
              </p>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {activeTab === 'dashboard' && (
              <AdminDashboard />
            )}

            {activeTab === 'ai' && (
              <>
                <section className="glass-card p-6 md:p-10">
                  <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-10">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-accent shrink-0">
                      <Cpu size={20} className="md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Intelligence Artificielle</h2>
                      <p className="text-slate-500 text-xs md:text-sm font-serif italic">Configurez le moteur de rédaction.</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Modèle Gemini</label>
                      <select 
                        className="academic-input"
                        value={settings.aiModel}
                        onChange={(e) => setSettings({...settings, aiModel: e.target.value})}
                      >
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Recommandé - Qualité Max)</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Dernière génération - Rapide)</option>
                        <option value="gemini-flash-latest">Gemini 1.5 Flash (Stable - Meilleurs Quotas)</option>
                        <option value="gemini-flash-lite-latest">Gemini 1.5 Flash Lite (Économique)</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Expérimental)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-2 italic">Le modèle Pro offre une meilleure qualité rédactionnelle mais peut être plus lent.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Instruction Système (Prompt Global)</label>
                      <textarea 
                        className="academic-input h-48 resize-none leading-relaxed"
                        value={settings.systemInstruction}
                        onChange={(e) => setSettings({...settings, systemInstruction: e.target.value})}
                        placeholder="Définissez le rôle de l'IA..."
                      />
                      <p className="text-[10px] text-slate-400 mt-2 italic">Cette instruction est envoyée à chaque requête pour garantir la cohérence du style.</p>
                    </div>
                  </div>
                </section>

                <section className="glass-card p-6 md:p-10">
                  <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-10">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-accent shrink-0">
                      <Layout size={20} className="md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Apparence & Branding</h2>
                      <p className="text-slate-500 text-xs md:text-sm font-serif italic">Identité visuelle de l'application.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Nom de l'App</label>
                      <input 
                        type="text" 
                        className="academic-input"
                        value={settings.appName}
                        onChange={(e) => setSettings({...settings, appName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Slogan / Sous-titre</label>
                      <input 
                        type="text" 
                        className="academic-input"
                        value={settings.appSlogan}
                        onChange={(e) => setSettings({...settings, appSlogan: e.target.value})}
                      />
                    </div>
                  </div>
                </section>

                <section className="glass-card p-6 md:p-10">
                  <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-10">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-accent shrink-0">
                      <Shield size={20} className="md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Sécurité</h2>
                      <p className="text-slate-500 text-xs md:text-sm font-serif italic">Gestion des accès administratifs.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Mot de passe Administrateur</label>
                    <input 
                      type="password" 
                      className="academic-input"
                      value={settings.adminPassword}
                      onChange={(e) => setSettings({...settings, adminPassword: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400 mt-2 italic">Utilisé pour accéder à ce backoffice.</p>
                  </div>
                </section>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-8">
                  <button 
                    onClick={resetToDefaults}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    <RefreshCcw size={16} />
                    Réinitialiser par défaut
                  </button>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {saveStatus === 'success' && (
                      <span className="text-emerald-600 text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                        <CheckCircle2 size={18} /> Réglages enregistrés
                      </span>
                    )}
                    <button 
                      onClick={handleSave}
                      disabled={saveStatus === 'saving'}
                      className="btn-primary px-12 shadow-xl shadow-academic-900/20 w-full sm:w-auto"
                    >
                      {saveStatus === 'saving' ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                      Enregistrer les modifications
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <AdminUsers />
            )}

            {activeTab === 'pricing' && (
              <AdminPricing 
                settings={settings} 
                setSettings={setSettings} 
                handleSave={handleSave} 
                saveStatus={saveStatus} 
                resetToDefaults={resetToDefaults} 
              />
            )}

            {activeTab === 'errors' && (
              <AdminErrors />
            )}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-300 text-[10px] uppercase tracking-[0.3em] font-bold">
        Bayano Académie System v1.0.4
      </footer>
    </div>
  );
}
