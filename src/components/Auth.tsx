import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Sparkles, Chrome, Apple } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User, sessionId?: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [simulatedEmail, setSimulatedEmail] = useState<{title: string, code: string, desc: string} | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Allow current origin
      if (origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setLoading(true);
        const token = event.data.token;
        
        // Use the token to login and establish the session in the main window's context
        fetch(`/api/auth/token-login?token=${token}`, { credentials: 'include' })
          .then(res => {
            if (!res.ok) throw new Error('Échec de la validation du jeton');
            return res.json();
          })
          .then(data => {
            if (data.user) {
              onLogin(data.user, data.sessionId);
            } else {
              setError('Utilisateur non trouvé après connexion');
            }
          })
          .catch(err => {
            console.error('Token login error:', err);
            setError(`Erreur de synchronisation. Veuillez réessayer.`);
          })
          .finally(() => setLoading(false));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    try {
      const origin = window.location.origin;
      const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`, { credentials: 'include' });
      const { url } = await response.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (err) {
      setError('Impossible de lancer la connexion Google');
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setSuccessMessage('');
    if (!email) {
      setError('Veuillez entrer votre adresse email pour recevoir un code de connexion sécurisé.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setIsOtpMode(true);
        if (data.devCode) {
          setSimulatedEmail({
            title: "Code de connexion",
            desc: "Pour vous connecter sans mot de passe, utilisez ce code :",
            code: data.devCode
          });
        }
      } else {
        setError(data.error || 'Erreur lors de la demande');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
        } else {
          onLogin(data.user, data.sessionId);
        }
      } else {
        setError(data.error || 'Code invalide');
      }
    } catch (err) {
      setError('Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!email) {
      setError('Veuillez entrer votre adresse email');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setIsResetMode(true);
        if (data.devCode) {
          setSimulatedEmail({
            title: "Réinitialisation de mot de passe",
            desc: "Voici votre code de réinitialisation :",
            code: data.devCode
          });
        }
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: resetCode, newPassword }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMessage('Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
        setIsResetMode(false);
        setIsForgotPassword(false);
        setPassword('');
        setSimulatedEmail(null);
      } else {
        setError(data.error || 'Erreur lors de la réinitialisation');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
        } else {
          onLogin(data.user, data.sessionId);
        }
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twoFactorToken }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user, data.sessionId);
      } else {
        setError(data.error || 'Code 2FA invalide');
      }
    } catch (err) {
      setError('Erreur lors de la vérification 2FA');
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 p-12">
          <div className="text-center mb-8">
            <div className="bg-academic-900 w-16 h-16 rounded-2xl text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-academic-900/20">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-3xl font-serif font-medium text-academic-900 mb-3">Double Authentification</h2>
            <p className="text-slate-500 font-serif italic">Entrez le code généré par votre application d'authentification.</p>
          </div>

          <form onSubmit={handle2FAVerify} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Code de sécurité</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  required
                  autoFocus
                  className="academic-input pl-12 text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  maxLength={6}
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3"
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full py-5 text-lg shadow-2xl shadow-academic-900/20 group"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Vérifier le code
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setRequires2FA(false)}
              className="w-full text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-academic-900 transition-colors"
            >
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 md:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-academic-900 text-white relative overflow-hidden">
          <div className="relative z-10">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 mb-12"
            >
              <div className="w-16 h-16 bg-white rounded-2xl p-1 flex items-center justify-center shadow-lg">
                <img src="/logo.svg" alt="Bayano Académie Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-3xl font-serif font-bold tracking-tight">Bayano Académie</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-6xl font-serif font-medium leading-[0.9] mb-8 tracking-tighter"
            >
              L'excellence <br />
              académique <br />
              <span className="text-accent italic font-light">redéfinie.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-slate-300 font-serif italic max-w-md leading-relaxed"
            >
              Propulsez vos recherches avec une intelligence artificielle qui comprend les nuances du discours académique.
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative z-10 flex items-center gap-6"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <img 
                  key={i}
                  src={`https://picsum.photos/seed/${i + 20}/100/100`} 
                  className="w-12 h-12 rounded-full border-2 border-academic-900 shadow-xl"
                  alt="User"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-none">+2,400</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Chercheurs actifs</span>
            </div>
          </motion.div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        </div>

        {/* Right Side: Form */}
        <div className="p-6 sm:p-8 md:p-16 lg:p-20 flex flex-col justify-center w-full max-w-full overflow-hidden">
          <div className="mb-10 md:mb-12">
            <div className="lg:hidden flex items-center gap-4 mb-6 md:mb-8">
              <div className="w-14 h-14 bg-white rounded-xl p-1 flex items-center justify-center shadow-md border border-slate-100">
                <img src="/logo.svg" alt="Bayano Académie Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-2xl font-serif font-bold tracking-tight text-academic-900">Bayano</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-medium text-academic-900 mb-3 break-words">
              {isResetMode ? 'Nouveau mot de passe' : isOtpMode ? 'Code de connexion' : isForgotPassword ? 'Mot de passe oublié' : isLogin ? t('auth.welcomeBack', 'Bon retour parmi nous') : t('auth.createAccount', 'Créer votre compte')}
            </h2>
            <p className="text-slate-500 font-serif italic text-sm sm:text-base">
              {isResetMode ? 'Entrez le code reçu et votre nouveau mot de passe.' : isOtpMode ? 'Entrez le code à 6 chiffres envoyé à votre adresse email.' : isForgotPassword ? 'Entrez votre adresse email pour recevoir un lien de réinitialisation.' : isLogin ? t('auth.loginDesc', 'Entrez vos identifiants pour accéder à vos travaux.') : t('auth.registerDesc', 'Commencez votre voyage académique dès aujourd\'hui.')}
            </p>
          </div>

          <AnimatePresence>
            {simulatedEmail && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-8 p-6 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Mail size={20} className="text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Simulation d'email</span>
                      <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">DÉMO</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{simulatedEmail.title}</h3>
                    <p className="text-sm text-slate-300 mb-4">{simulatedEmail.desc}</p>
                    <div className="bg-black/50 rounded-xl p-4 flex items-center justify-center">
                      <span className="text-3xl font-mono font-bold tracking-[0.5em] text-accent">{simulatedEmail.code}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={isResetMode ? handleResetPassword : isOtpMode ? handleOtpVerify : isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-5 sm:space-y-6 w-full">
            <AnimatePresence mode="wait">
              {!isLogin && !isForgotPassword && !isOtpMode && !isResetMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full"
                >
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{t('auth.fullName', 'Nom complet')}</label>
                  <div className="relative w-full">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required
                      className="academic-input pl-12 w-full"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{t('auth.email', 'Adresse Email')}</label>
              <div className="relative w-full">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required
                  disabled={isOtpMode || isResetMode}
                  className="academic-input pl-12 w-full disabled:opacity-50"
                  placeholder="jean.dupont@université.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isOtpMode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden"
                >
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Code de connexion (6 chiffres)</label>
                  <div className="relative w-full">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required
                      className="academic-input pl-12 w-full text-center tracking-widest font-mono"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isResetMode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden space-y-5"
                >
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Code de réinitialisation</label>
                    <div className="relative w-full">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        className="academic-input pl-12 w-full text-center tracking-widest font-mono"
                        placeholder="123456"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Nouveau mot de passe</label>
                    <div className="relative w-full">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        required
                        className="academic-input pl-12 w-full"
                        placeholder="••••••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {!isForgotPassword && !isOtpMode && !isResetMode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">{t('auth.password', 'Mot de passe')}</label>
                    {isLogin && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                          setSuccessMessage('');
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                      >
                        {t('auth.forgot', 'Oublié ?')}
                      </button>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      required={!isForgotPassword}
                      className="academic-input pl-12 w-full"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 sm:p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs sm:text-sm font-medium flex items-center gap-3 w-full"
              >
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <Lock size={12} />
                </div>
                <span className="break-words flex-1">{error}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 sm:p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-xs sm:text-sm font-medium flex items-center gap-3 w-full"
              >
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                  <Mail size={12} />
                </div>
                <span className="break-words flex-1">{successMessage}</span>
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full py-4 sm:py-5 text-base sm:text-lg shadow-2xl shadow-academic-900/20 group"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isResetMode ? 'Valider le nouveau mot de passe' : isOtpMode ? 'Vérifier le code' : isForgotPassword ? 'Envoyer le code' : isLogin ? t('auth.login', 'Se connecter') : t('auth.register', 'Créer mon compte')}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {!isForgotPassword && !isOtpMode && !isResetMode && (
              <>
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] sm:text-xs uppercase tracking-widest font-bold">
                    <span className="bg-white px-4 text-slate-400">{t('auth.orContinue', 'Ou continuer avec')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full py-3 sm:py-4 px-4 border border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm"
                  >
                    <Chrome size={18} className="text-academic-900" />
                    Google
                  </button>
                  <button 
                    type="button"
                    onClick={handleAppleLogin}
                    className="w-full py-3 sm:py-4 px-4 border border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm"
                  >
                    <Mail size={18} className="text-academic-900" />
                    Code à usage unique
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-100 text-center">
            {isForgotPassword || isOtpMode || isResetMode ? (
              <button 
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsOtpMode(false);
                  setIsResetMode(false);
                  setError('');
                  setSuccessMessage('');
                  setSimulatedEmail(null);
                }}
                className="text-academic-900 font-bold uppercase tracking-widest text-[10px] sm:text-xs hover:text-accent transition-colors underline underline-offset-8 decoration-slate-200 hover:decoration-accent"
              >
                Retour à la connexion
              </button>
            ) : (
              <>
                <p className="text-slate-500 text-xs sm:text-sm font-serif italic mb-3 sm:mb-4">
                  {isLogin ? t('auth.noAccount', "Vous n'avez pas encore de compte ?") : t('auth.hasAccount', "Vous avez déjà un compte ?")}
                </p>
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-academic-900 font-bold uppercase tracking-widest text-[10px] sm:text-xs hover:text-accent transition-colors underline underline-offset-8 decoration-slate-200 hover:decoration-accent"
                >
                  {isLogin ? t('auth.createFree', "Créer un compte gratuitement") : t('auth.loginSpace', "Se connecter à mon espace")}
                </button>
              </>
            )}
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Sécurisé par SSL</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Propulsé par Gemini</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
