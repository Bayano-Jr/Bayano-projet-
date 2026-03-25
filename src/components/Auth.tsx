import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Sparkles, Chrome, Github, Facebook, Mail, Lock, ArrowRight } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { User } from '../types';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider, githubProvider, facebookProvider } from '../firebase';

interface AuthProps {
  onLogin: (user: User, sessionId?: string) => void;
  onShowTerms?: () => void;
}

export default function Auth({ onLogin, onShowTerms }: AuthProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutEndTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((lockoutEndTime - now) / 1000);
        if (remaining <= 0) {
          setLockoutEndTime(null);
          setCountdown(0);
          setError('');
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

  const handleBackendSync = async (token: string) => {
    const response = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      onLogin(data.user, token);
    } else {
      const errorData = await response.json();
      setError(errorData.error || t('auth.errors.syncError'));
    }
  };

  const handleGoogleLogin = async () => {
    if (lockoutEndTime !== null) return;
    
    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      await handleBackendSync(token);
    } catch (err: any) {
      // We don't use console.error here to avoid triggering error overlays for expected user errors
      if (err.code === 'auth/too-many-requests') {
        const resetTime = Date.now() + 2 * 60 * 1000;
        setLockoutEndTime(resetTime);
        setCountdown(120);
        setError(t('auth.errors.tooManyRequests'));
      } else {
        setError(err.message || t('auth.errors.googleLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    if (lockoutEndTime !== null) return;
    
    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithPopup(auth, githubProvider);
      const token = await result.user.getIdToken();
      await handleBackendSync(token);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        const resetTime = Date.now() + 2 * 60 * 1000;
        setLockoutEndTime(resetTime);
        setCountdown(120);
        setError(t('auth.errors.tooManyRequests'));
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError(t('auth.errors.accountExistsWithDifferentCredential'));
      } else {
        setError(err.message || t('auth.errors.githubLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (lockoutEndTime !== null) return;
    
    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithPopup(auth, facebookProvider);
      const token = await result.user.getIdToken();
      await handleBackendSync(token);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        const resetTime = Date.now() + 2 * 60 * 1000;
        setLockoutEndTime(resetTime);
        setCountdown(120);
        setError(t('auth.errors.tooManyRequests'));
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError(t('auth.errors.accountExistsWithDifferentCredential'));
      } else {
        setError(err.message || t('auth.errors.facebookLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutEndTime !== null) return;
    
    if (!email || !password) {
      setError(t('auth.errors.fillAllFields'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let result;
      if (isSignUp) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      
      const token = await result.user.getIdToken();
      await handleBackendSync(token);
    } catch (err: any) {
      // We don't use console.error here to avoid triggering error overlays for expected user errors
      if (err.code === 'auth/email-already-in-use') {
        setError(t('auth.errors.emailAlreadyInUse'));
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(t('auth.errors.invalidCredentials'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('auth.errors.weakPassword'));
      } else if (err.code === 'auth/too-many-requests') {
        const resetTime = Date.now() + 2 * 60 * 1000; // 2 minutes lockout
        setLockoutEndTime(resetTime);
        setCountdown(120);
        setError(t('auth.errors.tooManyRequests'));
      } else {
        setError(err.message || t('auth.errors.authError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutEndTime !== null) return;
    
    if (!email) {
      setError(t('auth.errors.enterEmail'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      // We don't use console.error here to avoid triggering error overlays for expected user errors
      if (err.code === 'auth/user-not-found') {
        setError(t('auth.errors.userNotFound'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('auth.errors.invalidEmail'));
      } else if (err.code === 'auth/too-many-requests') {
        const resetTime = Date.now() + 2 * 60 * 1000;
        setLockoutEndTime(resetTime);
        setCountdown(120);
        setError(t('auth.errors.tooManyRequests'));
      } else {
        setError(err.message || t('auth.errors.resetEmailError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-academic-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <select 
          className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-widest outline-none cursor-pointer hover:text-academic-900 transition-colors shadow-sm"
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

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-academic-900/5 blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-academic-900/5 overflow-hidden relative z-10 border border-slate-100"
      >
        <div className="p-8 md:p-10">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-academic-900 text-white flex items-center justify-center shadow-lg shadow-academic-900/20 relative group">
              <BookOpen size={32} className="relative z-10" />
              <div className="absolute inset-0 bg-accent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Sparkles size={16} className="absolute -top-2 -right-2 text-accent animate-pulse" />
            </div>
          </div>
          
          <h2 className="text-3xl font-serif font-bold text-center text-academic-900 mb-2">
            Bayano
          </h2>
          <p className="text-center text-slate-500 mb-8 font-medium">
            {t('auth.subtitle')}
          </p>

          {error && !lockoutEndTime && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 border border-red-100 text-center"
            >
              {error}
            </motion.div>
          )}

          {lockoutEndTime !== null && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 border border-red-100 text-center flex flex-col items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span>{t('auth.tooManyAttempts')}</span>
              </div>
              <span className="text-lg font-bold">
                {t('auth.tryAgainIn')} {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </span>
            </motion.div>
          )}

          {isResettingPassword ? (
            <div className="space-y-6">
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-academic-900">{t('auth.emailSent')}</h3>
                  <p className="text-slate-500">
                    {t('auth.ifAccountExists')} <strong>{email}</strong>{t('auth.receiveResetLink')}
                  </p>
                  <button
                    onClick={() => {
                      setIsResettingPassword(false);
                      setResetEmailSent(false);
                      setError('');
                    }}
                    className="w-full py-4 px-6 mt-4 bg-academic-900 hover:bg-academic-800 text-white rounded-xl font-bold transition-all"
                  >
                    {t('auth.backToLogin')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-slate-600 text-sm mb-4 text-center">
                    {t('auth.enterEmailToReset')}
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="vous@exemple.com"
                        required
                        disabled={lockoutEndTime !== null}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading || lockoutEndTime !== null}
                    className="w-full py-4 px-6 bg-academic-900 hover:bg-academic-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {lockoutEndTime !== null ? t('auth.locked') : (loading ? t('auth.sending') : t('auth.sendResetLink'))}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(false);
                      setError('');
                    }}
                    className="w-full py-4 px-6 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all"
                  >
                    {t('auth.cancel')}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('auth.emailAddress')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="vous@exemple.com"
                      required
                      disabled={lockoutEndTime !== null}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700">
                      {t('auth.password')}
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsResettingPassword(true);
                          setError('');
                        }}
                        className="text-xs text-accent font-medium hover:underline"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      disabled={lockoutEndTime !== null}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading || lockoutEndTime !== null}
                  className="w-full py-4 px-6 bg-academic-900 hover:bg-academic-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {lockoutEndTime !== null ? t('auth.locked') : (loading ? t('auth.loggingIn') : (isSignUp ? t('auth.signUp') : t('auth.login')))}
                  {!loading && lockoutEndTime === null && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">{t('auth.orContinueWith')}</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={handleGoogleLogin}
                  type="button"
                  disabled={loading || lockoutEndTime !== null}
                  className="py-3 px-6 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  aria-label="Google"
                >
                  <Chrome size={24} className="text-red-500 group-hover:scale-110 transition-transform" />
                </button>
                
                <button 
                  onClick={handleGithubLogin}
                  type="button"
                  disabled={loading || lockoutEndTime !== null}
                  className="py-3 px-6 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  aria-label="Github"
                >
                  <Github size={24} className="text-slate-900 group-hover:scale-110 transition-transform" />
                </button>

                <button 
                  onClick={handleFacebookLogin}
                  type="button"
                  disabled={loading || lockoutEndTime !== null}
                  className="py-3 px-6 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  aria-label="Facebook"
                >
                  <Facebook size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          )}
          
          {!isResettingPassword && (
            <div className="mt-8 text-center space-y-4">
              <p className="text-sm text-slate-500">
                {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.noAccount')}
                <button 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="ml-2 text-accent font-bold hover:underline"
                >
                  {isSignUp ? t('auth.signIn') : t('auth.register')}
                </button>
              </p>
              <p className="text-xs text-slate-400">
                <Trans i18nKey="auth.terms">
                  En vous connectant, vous acceptez nos <button onClick={onShowTerms} className="text-accent hover:underline">conditions d'utilisation</button> et notre politique de confidentialité.
                </Trans>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
