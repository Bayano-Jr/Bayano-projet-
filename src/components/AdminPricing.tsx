import React, { useState, useEffect } from 'react';
import { CreditCard, Save, RefreshCcw, CheckCircle2 } from 'lucide-react';

export default function AdminPricing({ settings, setSettings, handleSave, saveStatus, resetToDefaults }: any) {
  return (
    <div className="space-y-6 md:space-y-8">
      <section className="glass-card p-6 md:p-10">
        <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-10">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-accent shrink-0">
            <CreditCard size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Prix & Abonnements</h2>
            <p className="text-slate-500 text-xs md:text-sm font-serif italic">Gérez les tarifs des plans et des packs de crédits.</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Abonnements Mensuels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Prix Étudiant Plus (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="academic-input"
                  value={settings.priceStudent || 9.99}
                  onChange={(e) => setSettings({...settings, priceStudent: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Prix Premium (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="academic-input"
                  value={settings.pricePremium || 24.99}
                  onChange={(e) => setSettings({...settings, pricePremium: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Packs de Crédits (Achat Unique)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pack Mini (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="academic-input"
                  value={settings.pricePackMini || 4.99}
                  onChange={(e) => setSettings({...settings, pricePackMini: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pack Medium (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="academic-input"
                  value={settings.pricePackMedium || 12.99}
                  onChange={(e) => setSettings({...settings, pricePackMedium: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pack Mémoire (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="academic-input"
                  value={settings.pricePackMemoire || 29.99}
                  onChange={(e) => setSettings({...settings, pricePackMemoire: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Promotions & Réductions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Réduction globale (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  className="academic-input"
                  value={settings.globalDiscount || 0}
                  onChange={(e) => setSettings({...settings, globalDiscount: parseInt(e.target.value) || 0})}
                />
                <p className="text-[10px] text-slate-400 mt-2 italic">S'applique à tous les abonnements et packs.</p>
              </div>
            </div>
          </div>
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
    </div>
  );
}
