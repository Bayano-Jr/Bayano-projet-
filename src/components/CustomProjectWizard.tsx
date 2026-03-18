import React, { useState } from 'react';
import { ArrowLeft, Sparkles, FileText, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Project, User } from '../types';
import { useAlert } from '../contexts/AlertContext';
import i18n from '../i18n';

interface CustomProjectWizardProps {
  user: User;
  onCancel: () => void;
  onComplete: (project: Partial<Project>) => void;
  onShowPricing: () => void;
}

export default function CustomProjectWizard({ user, onCancel, onComplete, onShowPricing }: CustomProjectWizardProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    documentType: '',
    min_pages: 5,
    instructions: '',
    language: (() => {
      try {
        return i18n.language.startsWith('en') ? 'Anglais' : 'Français';
      } catch {
        return 'Français';
      }
    })(),
    aiModel: 'gemini-3-flash-preview',
    generationMode: 'structured'
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.documentType) {
      showAlert({ message: "Veuillez remplir le titre et le type de document.", type: 'warning' });
      return;
    }
    onComplete(formData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 md:py-24">
      <header className="mb-12 md:mb-20">
        <button onClick={onCancel} className="text-slate-400 hover:text-academic-900 flex items-center gap-2 mb-8 md:mb-12 transition-colors text-sm font-medium uppercase tracking-wider">
          <ArrowLeft size={16} />
          {t('wizard.back')}
        </button>
        <div className="flex items-center gap-2 md:gap-3 text-indigo-600 font-bold uppercase tracking-[0.3em] text-[8px] md:text-[10px] mb-4 md:mb-6">
          <div className="w-6 md:w-8 h-[1px] bg-indigo-600" />
          Travail sur mesure
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-7xl mb-4 md:mb-8 font-serif font-semibold tracking-tight text-academic-900 leading-[0.9] break-words">
          Concevez votre document
        </h2>
        <p className="text-base md:text-xl text-slate-500 font-serif italic leading-relaxed">
          Rapport de visite, TP, ou tout autre format spécifique.
        </p>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 md:p-12 shadow-2xl shadow-academic-900/5 border border-slate-100"
      >
        <div className="space-y-8 md:space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
                Type de document
              </label>
              <input 
                type="text"
                placeholder="Ex: Rapport de visite guidée, TP de chimie..."
                className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                value={formData.documentType}
                onChange={e => setFormData({...formData, documentType: e.target.value})}
              />
            </div>
            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
                {t('wizard.fields.title')}
              </label>
              <input 
                type="text"
                placeholder={t('wizard.placeholders.title')}
                className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
                {t('wizard.fields.pages')}
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  className="w-full accent-indigo-600"
                  value={formData.min_pages}
                  onChange={e => setFormData({...formData, min_pages: parseInt(e.target.value)})}
                />
                <span className="text-2xl font-serif font-bold text-academic-900 min-w-[3ch]">{formData.min_pages}</span>
              </div>
            </div>
            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
                {t('wizard.fields.language')}
              </label>
              <select 
                className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                value={formData.language}
                onChange={e => setFormData({...formData, language: e.target.value})}
              >
                <option value="Français">Français</option>
                <option value="Anglais">Anglais</option>
                <option value="Espagnol">Espagnol</option>
                <option value="Allemand">Allemand</option>
              </select>
            </div>
          </div>

          <div className="group">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
              {t('wizard.fields.instructions')}
            </label>
            <textarea 
              placeholder="Décrivez ce que vous attendez, le contexte, les points clés à aborder..."
              className="academic-input min-h-[160px] p-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all resize-y"
              value={formData.instructions}
              onChange={e => setFormData({...formData, instructions: e.target.value})}
            />
          </div>

          <div className="group">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
              {t('wizard.fields.aiModel')}
            </label>
            <select 
              className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
              value={formData.aiModel}
              onChange={e => setFormData({...formData, aiModel: e.target.value})}
            >
              <option value="gemini-3-flash-preview">{t('wizard.flash')}</option>
              <option value="gemini-3.1-pro-preview">{t('wizard.pro')}</option>
            </select>
            <p className="text-xs text-slate-400 mt-2 italic">{t('wizard.modelDesc')}</p>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-end mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-100">
        <button 
          onClick={handleSubmit} 
          disabled={!formData.title || !formData.documentType}
          className="btn-primary w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={20} />
          Générer le plan
        </button>
      </div>
    </div>
  );
}
