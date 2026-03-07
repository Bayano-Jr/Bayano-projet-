import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Loader2, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

interface TwoFactorSetupProps {
  user: User;
  onUpdate: (user: User) => void;
  onClose: () => void;
}

export default function TwoFactorSetup({ user, onUpdate, onClose }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'initial' | 'setup' | 'verify'>('initial');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setStep('setup');
      } else {
        setError(data.error || 'Erreur lors de la configuration');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdate({ ...user, twoFactorEnabled: true });
        setStep('initial');
      } else {
        setError(data.error || 'Code invalide');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Voulez-vous vraiment désactiver la double authentification ?')) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/disable', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        onUpdate({ ...user, twoFactorEnabled: false });
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-academic-900 p-2 rounded-xl text-white">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-serif font-bold text-academic-900">Sécurité du compte</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-academic-900 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'initial' && (
              <motion.div 
                key="initial"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  {user.twoFactorEnabled ? (
                    <ShieldCheck className="text-green-500 shrink-0" size={32} />
                  ) : (
                    <ShieldAlert className="text-amber-500 shrink-0" size={32} />
                  )}
                  <div>
                    <h3 className="font-bold text-academic-900">Double Authentification (2FA)</h3>
                    <p className="text-sm text-slate-500">
                      {user.twoFactorEnabled 
                        ? 'Votre compte est protégé par une couche de sécurité supplémentaire.' 
                        : 'Ajoutez une couche de sécurité supplémentaire à votre compte.'}
                    </p>
                  </div>
                </div>

                {user.twoFactorEnabled ? (
                  <button 
                    onClick={handleDisable}
                    disabled={loading}
                    className="w-full py-4 px-6 border border-red-100 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Désactiver la 2FA'}
                  </button>
                ) : (
                  <button 
                    onClick={handleStartSetup}
                    disabled={loading}
                    className="btn-primary w-full py-4 shadow-xl shadow-academic-900/10"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Configurer la 2FA'}
                  </button>
                )}
              </motion.div>
            )}

            {step === 'setup' && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <p className="text-sm text-slate-600">Scannez ce code QR avec votre application d'authentification (Google Authenticator, Authy, etc.).</p>
                <div className="bg-white p-4 border border-slate-100 rounded-2xl inline-block mx-auto shadow-inner">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-slate-500 break-all">
                  Clé secrète: {secret}
                </div>
                <button 
                  onClick={() => setStep('verify')}
                  className="btn-primary w-full py-4"
                >
                  Continuer
                </button>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div 
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <p className="text-sm text-slate-600 text-center">Entrez le code à 6 chiffres généré par votre application pour confirmer la configuration.</p>
                <input 
                  type="text"
                  maxLength={6}
                  autoFocus
                  className="academic-input text-center text-3xl tracking-[0.5em] font-mono py-6"
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                />
                {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep('setup')}
                    className="flex-1 py-4 text-slate-400 font-bold text-sm hover:text-academic-900 transition-colors"
                  >
                    Retour
                  </button>
                  <button 
                    onClick={handleVerify}
                    disabled={loading || token.length !== 6}
                    className="btn-primary flex-[2] py-4"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmer'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
