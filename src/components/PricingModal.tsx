import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Zap, Crown, GraduationCap, CreditCard, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface PricingModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

export default function PricingModal({ user, onClose, onUpdateUser }: PricingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState<'plans' | 'packs'>('plans');
  const [prices, setPrices] = useState({
    priceStudent: 9.99,
    pricePremium: 24.99,
    pricePackMini: 4.99,
    pricePackMedium: 12.99,
    pricePackMemoire: 29.99,
    globalDiscount: 0,
  });

  React.useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setPrices({
          priceStudent: data.priceStudent || 9.99,
          pricePremium: data.pricePremium || 24.99,
          pricePackMini: data.pricePackMini || 4.99,
          pricePackMedium: data.pricePackMedium || 12.99,
          pricePackMemoire: data.pricePackMemoire || 29.99,
          globalDiscount: data.globalDiscount || 0,
        });
      })
      .catch(console.error);
  }, []);

  const handleSubscribe = async (plan: 'student' | 'premium') => {
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }

      const res = await fetch('/api/saas/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan }),
        credentials: 'include'
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("Failed to parse response:", e);
      }
      if (res.ok) {
        setSuccess(`Abonnement ${plan} activé avec succès !`);
        onUpdateUser({ ...user, plan, credits: (user.credits || 0) + data.creditsAdded, subscription_expires_at: data.expiresAt });
        setTimeout(() => { setSuccess(''); onClose(); }, 2000);
      } else {
        setError(data.error || 'Erreur lors de la souscription');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPack = async (pack: 'mini' | 'medium' | 'memoire') => {
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }

      const res = await fetch('/api/saas/buy-credits', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pack }),
        credentials: 'include'
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("Failed to parse response:", e);
      }
      if (res.ok) {
        setSuccess(`Pack de ${data.creditsAdded} crédits ajouté !`);
        onUpdateUser({ ...user, credits: (user.credits || 0) + data.creditsAdded });
        setTimeout(() => { setSuccess(''); onClose(); }, 2000);
      } else {
        setError(data.error || 'Erreur lors de l\'achat');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const getDiscountedPrice = (price: number) => {
    if (!prices.globalDiscount) return price;
    return (price * (1 - prices.globalDiscount / 100)).toFixed(2);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-serif font-bold text-academic-900">Gérer votre abonnement</h2>
            <p className="text-slate-500 text-sm">Solde actuel : <span className="font-bold text-accent">{user.credits || 0} crédits</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-xl flex items-center gap-3">
              <Check size={20} />
              {success}
            </div>
          )}

          <div className="flex gap-4 mb-8 justify-center">
            <button 
              onClick={() => setView('plans')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${view === 'plans' ? 'bg-academic-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Abonnements Mensuels
            </button>
            <button 
              onClick={() => setView('packs')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${view === 'packs' ? 'bg-academic-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Packs de Crédits (Achat unique)
            </button>
          </div>

          {view === 'plans' ? (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Free Plan */}
              <div className="border border-slate-200 rounded-2xl p-6 relative flex flex-col">
                {user.plan === 'free' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Plan Actuel</div>}
                <h3 className="text-xl font-bold mb-2">Gratuit</h3>
                <p className="text-3xl font-bold mb-1">0€<span className="text-sm text-slate-400 font-normal">/mois</span></p>
                <p className="text-sm text-slate-500 mb-6">Pour découvrir la plateforme</p>
                
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-emerald-500 shrink-0" /> 30 crédits offerts</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-emerald-500 shrink-0" /> Max 15 pages</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-emerald-500 shrink-0" /> Modèle IA standard</li>
                  <li className="flex gap-2 text-sm text-slate-400"><X size={16} className="shrink-0" /> Pas d'enrichissement auto</li>
                  <li className="flex gap-2 text-sm text-slate-400"><X size={16} className="shrink-0" /> Export PDF avec filigrane</li>
                </ul>
                <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-bold cursor-not-allowed">
                  Inclus
                </button>
              </div>

              {/* Student Plan */}
              <div className="border-2 border-accent rounded-2xl p-6 relative flex flex-col shadow-xl shadow-accent/10">
                {user.plan === 'student' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Plan Actuel</div>}
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="text-accent" size={24} />
                  <h3 className="text-xl font-bold text-accent">Étudiant Plus</h3>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {prices.globalDiscount > 0 ? (
                    <>
                      <span className="line-through text-slate-400 text-xl mr-2">{prices.priceStudent}€</span>
                      {getDiscountedPrice(prices.priceStudent)}€
                    </>
                  ) : (
                    <>{prices.priceStudent}€</>
                  )}
                  <span className="text-sm text-slate-400 font-normal">/mois</span>
                </p>
                <p className="text-sm text-slate-500 mb-6">Idéal pour les rapports et mémoires</p>
                
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> 300 crédits / mois</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> Jusqu'à 60 pages</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> Modèle IA avancé (Pro)</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> Enrichissement automatique</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> Export PDF & DOCX pro</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-accent shrink-0" /> Sans publicité</li>
                </ul>
                <button 
                  onClick={() => handleSubscribe('student')}
                  disabled={loading || user.plan === 'student'}
                  className="w-full py-3 rounded-xl bg-accent text-white font-bold hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {user.plan === 'student' ? 'Actif' : 'Choisir ce plan'}
                </button>
              </div>

              {/* Premium Plan */}
              <div className="border border-academic-900 rounded-2xl p-6 relative flex flex-col bg-academic-900 text-white">
                {user.plan === 'premium' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-academic-900 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Plan Actuel</div>}
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="text-yellow-400" size={24} />
                  <h3 className="text-xl font-bold">Premium Académique</h3>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {prices.globalDiscount > 0 ? (
                    <>
                      <span className="line-through text-slate-400 text-xl mr-2">{prices.pricePremium}€</span>
                      {getDiscountedPrice(prices.pricePremium)}€
                    </>
                  ) : (
                    <>{prices.pricePremium}€</>
                  )}
                  <span className="text-sm text-slate-400 font-normal">/mois</span>
                </p>
                <p className="text-sm text-slate-300 mb-6">Pour les chercheurs et thésards</p>
                
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-yellow-400 shrink-0" /> 800+ crédits / mois</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-yellow-400 shrink-0" /> Pages illimitées</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-yellow-400 shrink-0" /> Priorité de traitement IA</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-yellow-400 shrink-0" /> Analyse approfondie</li>
                  <li className="flex gap-2 text-sm"><Check size={16} className="text-yellow-400 shrink-0" /> Détection anti-plagiat</li>
                </ul>
                <button 
                  onClick={() => handleSubscribe('premium')}
                  disabled={loading || user.plan === 'premium'}
                  className="w-full py-3 rounded-xl bg-white text-academic-900 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {user.plan === 'premium' ? 'Actif' : 'Choisir ce plan'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Pack Mini */}
              <div className="border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center hover:border-accent transition-colors">
                <Zap className="text-slate-400 mb-4" size={32} />
                <h3 className="text-xl font-bold mb-2">Pack Mini</h3>
                <p className="text-3xl font-bold text-accent mb-4">50 <span className="text-sm text-slate-500 font-normal">crédits</span></p>
                <p className="text-2xl font-bold mb-6">
                  {prices.globalDiscount > 0 ? (
                    <>
                      <span className="line-through text-slate-400 text-lg mr-2">{prices.pricePackMini}€</span>
                      {getDiscountedPrice(prices.pricePackMini)}€
                    </>
                  ) : (
                    <>{prices.pricePackMini}€</>
                  )}
                </p>
                <p className="text-sm text-slate-500 mb-8 flex-1">Idéal pour finaliser un petit projet ou faire quelques corrections.</p>
                <button 
                  onClick={() => handleBuyPack('mini')}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-slate-100 text-academic-900 font-bold hover:bg-slate-200 transition-colors"
                >
                  Acheter
                </button>
              </div>

              {/* Pack Medium */}
              <div className="border-2 border-accent rounded-2xl p-6 flex flex-col items-center text-center shadow-lg shadow-accent/10 relative">
                <div className="absolute -top-3 bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Le plus populaire</div>
                <Zap className="text-accent mb-4" size={32} />
                <h3 className="text-xl font-bold mb-2">Pack Moyen</h3>
                <p className="text-3xl font-bold text-accent mb-4">150 <span className="text-sm text-slate-500 font-normal">crédits</span></p>
                <p className="text-2xl font-bold mb-6">
                  {prices.globalDiscount > 0 ? (
                    <>
                      <span className="line-through text-slate-400 text-lg mr-2">{prices.pricePackMedium}€</span>
                      {getDiscountedPrice(prices.pricePackMedium)}€
                    </>
                  ) : (
                    <>{prices.pricePackMedium}€</>
                  )}
                </p>
                <p className="text-sm text-slate-500 mb-8 flex-1">Parfait pour un rapport de stage complet ou plusieurs petits travaux.</p>
                <button 
                  onClick={() => handleBuyPack('medium')}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
                >
                  Acheter
                </button>
              </div>

              {/* Pack Memoire */}
              <div className="border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center hover:border-academic-900 transition-colors">
                <Zap className="text-academic-900 mb-4" size={32} />
                <h3 className="text-xl font-bold mb-2">Pack Mémoire</h3>
                <p className="text-3xl font-bold text-accent mb-4">400 <span className="text-sm text-slate-500 font-normal">crédits</span></p>
                <p className="text-2xl font-bold mb-6">
                  {prices.globalDiscount > 0 ? (
                    <>
                      <span className="line-through text-slate-400 text-lg mr-2">{prices.pricePackMemoire}€</span>
                      {getDiscountedPrice(prices.pricePackMemoire)}€
                    </>
                  ) : (
                    <>{prices.pricePackMemoire}€</>
                  )}
                </p>
                <p className="text-sm text-slate-500 mb-8 flex-1">La solution complète pour un mémoire de fin d'études sans stress.</p>
                <button 
                  onClick={() => handleBuyPack('memoire')}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-academic-900 text-white font-bold hover:bg-academic-800 transition-colors"
                >
                  Acheter
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
