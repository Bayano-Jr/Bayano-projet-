import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Upload, FileText, X, Loader2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Project, User } from '../types';
import { useAlert } from '../contexts/AlertContext';
import * as pdfjs from 'pdfjs-dist';
import { extractTextFromDocx } from '../utils/docxUtils';

// Set worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface ProjectWizardProps {
  user: User;
  onCancel: () => void;
  onComplete: (project: Partial<Project>) => void;
  onShowPricing: () => void;
}

import i18n from '../i18n';

export default function ProjectWizard({ user, onCancel, onComplete, onShowPricing }: ProjectWizardProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    field: '',
    university: '',
    country: '',
    level: 'Master',
    norm: 'APA',
    methodology: 'classic',
    min_pages: 60,
    instructions: '',
    referenceText: '',
    documentType: 'memoire',
    generationMode: 'structured',
    language: (() => {
      try {
        return i18n.language.startsWith('en') ? 'Anglais' : 'Français';
      } catch {
        return 'Français';
      }
    })(),
    aiModel: 'gemini-3-flash-preview'
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setFormData(prev => ({ ...prev, referenceText: fullText }));
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        try {
          const text = await extractTextFromDocx(arrayBuffer);
          setFormData(prev => ({ ...prev, referenceText: text }));
        } catch (docxErr: any) {
          console.error("Docx error:", docxErr);
          throw new Error("Erreur lors de la lecture du fichier DOCX.");
        }
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      showAlert({ message: "Erreur lors de la lecture du fichier. Assurez-vous qu'il s'agit d'un PDF ou DOCX valide.", type: 'error' });
    } finally {
      setIsParsing(false);
    }
  };

  const removeFile = () => {
    setFileName(null);
    setFormData(prev => ({ ...prev, referenceText: '' }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => {
    onComplete(formData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 md:py-16">
      <button onClick={onCancel} className="flex items-center gap-3 text-slate-400 hover:text-academic-900 mb-10 transition-all text-xs font-bold uppercase tracking-widest group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        {t('wizard.back')}
      </button>

      <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-8 md:mb-24">
          <div className="flex gap-2 md:gap-3 flex-1 max-w-[200px] sm:max-w-xs">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 flex flex-col gap-2 md:gap-3">
                <div className={`h-1.5 rounded-full transition-all duration-700 ${
                  i <= step ? 'bg-academic-900' : 'bg-slate-100'
                }`} />
                <span className={`text-[8px] md:text-[10px] uppercase tracking-[0.2em] font-bold ${
                  i === step ? 'text-academic-900' : 'text-slate-300'
                }`}>
                  Étape 0{i}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-slate-300">
            <Sparkles size={14} className="sm:w-4 sm:h-4" />
            <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-bold hidden sm:inline">Conception Assistée</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-6xl mb-3 sm:mb-4 md:mb-6 font-serif font-semibold tracking-tight text-academic-900">{t('wizard.step1')}</h2>
              <p className="text-sm sm:text-base md:text-xl text-slate-500 mb-6 sm:mb-8 md:mb-16 font-serif italic leading-relaxed">{t('wizard.step1Desc')}</p>
              
              <div className="space-y-6 md:space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.documentType')}</label>
                    <select 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                      value={formData.documentType || 'memoire'}
                      onChange={e => setFormData({...formData, documentType: e.target.value as any})}
                    >
                      <option value="memoire">{t('wizard.options.memoire')}</option>
                      <option value="tp">{t('wizard.options.tp')}</option>
                      <option value="article">{t('wizard.options.article')}</option>
                      <option value="rapport">{t('wizard.options.rapport')}</option>
                    </select>
                  </div>
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.language')}</label>
                    <select 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                      value={formData.language || 'Français'}
                      onChange={e => setFormData({...formData, language: e.target.value})}
                    >
                      <option value="Français">{t('wizard.options.french')}</option>
                      <option value="Anglais">{t('wizard.options.english')}</option>
                    </select>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.subject')}</label>
                  <textarea 
                    className="academic-input h-32 resize-none text-lg md:text-xl font-serif p-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                    placeholder={t('wizard.placeholders.subject')}
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.field')}</label>
                    <input 
                      type="text" 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                      placeholder={t('wizard.placeholders.field')}
                      value={formData.field}
                      onChange={e => setFormData({...formData, field: e.target.value})}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.level')}</label>
                    <select 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                      value={formData.level}
                      onChange={e => setFormData({...formData, level: e.target.value})}
                    >
                      <option>{t('wizard.options.licence')}</option>
                      <option>{t('wizard.options.master')}</option>
                      <option>{t('wizard.options.doctorat')}</option>
                      <option>{t('wizard.options.tfc')}</option>
                    </select>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.instructions')}</label>
                  <textarea 
                    className="academic-input h-24 resize-none p-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                    placeholder={t('wizard.placeholders.instructions')}
                    value={formData.instructions}
                    onChange={e => setFormData({...formData, instructions: e.target.value})}
                  />
                </div>
                
                <div className="group">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.referenceText')}</label>
                  {!fileName ? (
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-100 border-dashed rounded-[24px] cursor-pointer bg-slate-50/50 hover:bg-white hover:border-accent/40 transition-all group/upload">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-3 shadow-sm group-hover/upload:text-accent transition-colors">
                            <Upload size={20} />
                          </div>
                          <p className="text-xs text-slate-500"><span className="font-bold text-academic-900">Cliquez pour uploader</span> un PDF ou DOCX</p>
                        </div>
                        <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-6 bg-academic-900 text-white rounded-[24px] shadow-xl shadow-academic-900/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                          <FileText size={24} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold truncate max-w-[200px]">{fileName}</span>
                          <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold">
                            {isParsing ? 'Analyse en cours...' : 'Modèle chargé'}
                          </span>
                        </div>
                      </div>
                      <button onClick={removeFile} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-6xl mb-3 sm:mb-4 md:mb-6 font-serif font-semibold tracking-tight text-academic-900">{t('wizard.step2')}</h2>
              <p className="text-sm sm:text-base md:text-xl text-slate-500 mb-6 sm:mb-8 md:mb-16 font-serif italic leading-relaxed">{t('wizard.step2Desc')}</p>
              
              <div className="space-y-6 md:space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.university')}</label>
                    <input 
                      type="text" 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                      placeholder={t('wizard.placeholders.university')}
                      value={formData.university}
                      onChange={e => setFormData({...formData, university: e.target.value})}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.country')}</label>
                    <input 
                      type="text" 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                      placeholder="Ex: France, RD Congo..."
                      value={formData.country}
                      onChange={e => setFormData({...formData, country: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.norm')}</label>
                    <select 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                      value={formData.norm}
                      onChange={e => setFormData({...formData, norm: e.target.value})}
                    >
                      <option>APA (7ème éd.)</option>
                      <option>MLA</option>
                      <option>Chicago</option>
                      <option>Vancouver</option>
                      <option>ISO 690</option>
                    </select>
                  </div>
                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.fields.methodology')}</label>
                    <select 
                      className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                      value={formData.methodology}
                      onChange={e => setFormData({...formData, methodology: e.target.value as any})}
                    >
                      <option value="classic">{t('wizard.options.classic')}</option>
                      <option value="empirical">{t('wizard.options.empirical')}</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (() => {
            let minPages = 30;
            let maxPages = 150;
            let stepPages = 5;
            let defaultPages = 60;
            let advice = "Un minimum de 60 pages est recommandé pour un Master.";

            if (formData.documentType === 'article') {
              minPages = 5;
              maxPages = 30;
              stepPages = 1;
              defaultPages = 15;
              advice = "Un article scientifique fait généralement entre 10 et 20 pages.";
            } else if (formData.documentType === 'tp') {
              minPages = 5;
              maxPages = 40;
              stepPages = 1;
              defaultPages = 10;
              advice = "Un TP fait généralement entre 5 et 15 pages selon la matière.";
            } else if (formData.documentType === 'rapport') {
              minPages = 15;
              maxPages = 80;
              stepPages = 5;
              defaultPages = 30;
              advice = "Un rapport de stage fait généralement entre 30 et 50 pages.";
            }

            // Limit max pages based on available credits, but ensure it's at least minPages for the slider to work
            // The actual generation will still be blocked if credits are insufficient
            let planMaxPages = Math.max(minPages, Math.min(maxPages, user.credits));

            // Ensure current value is within bounds
            if (formData.min_pages! < minPages) formData.min_pages = minPages;
            if (formData.min_pages! > planMaxPages) formData.min_pages = planMaxPages;

            return (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-6xl mb-3 sm:mb-4 md:mb-6 font-serif font-semibold tracking-tight text-academic-900">{t('wizard.step3Title')}</h2>
                <p className="text-sm sm:text-base md:text-xl text-slate-500 mb-6 sm:mb-8 md:mb-16 font-serif italic leading-relaxed">{t('wizard.step3Subtitle')}</p>
                
                <div className="space-y-8 md:space-y-12">
                  <div>
                    <div className="flex justify-between mb-4 md:mb-8">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">{t('wizard.pagesWanted')}</label>
                      <span className="text-2xl md:text-3xl font-serif font-bold text-academic-900">{formData.min_pages} <span className="text-xs md:text-sm font-sans text-slate-400 font-normal">{t('wizard.pages')}</span></span>
                    </div>
                    <div className="relative h-12 flex items-center">
                      <input 
                        type="range" 
                        min={minPages} 
                        max={planMaxPages} 
                        step={stepPages}
                        className="w-full accent-academic-900 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer"
                        value={formData.min_pages}
                        onChange={e => setFormData({...formData, min_pages: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-300 mt-4">
                      <span>{minPages} {t('wizard.pages')} (≈ {minPages * 300} {t('wizard.words')})</span>
                      <span>{planMaxPages} {t('wizard.pages')} (≈ {planMaxPages * 300} {t('wizard.words')})</span>
                    </div>
                    {planMaxPages < maxPages && (
                      <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-start gap-3">
                        <Lock size={16} className="text-accent shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-600 mb-2">
                            Vos crédits actuels ({user.credits}) limitent la génération à <strong className="text-academic-900">{planMaxPages} pages</strong>.
                          </p>
                          <button onClick={onShowPricing} className="text-xs font-bold text-accent hover:underline">
                            Débloquer plus de pages
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6 md:p-10 bg-slate-50 rounded-[24px] md:rounded-[32px] border border-slate-100 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center text-accent shadow-sm shrink-0">
                      <Sparkles size={24} />
                    </div>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                      <strong className="text-academic-900 font-bold">{t('wizard.expertAdvice')}</strong> {t('wizard.adviceText')} {t(
                        formData.documentType === 'article' ? 'wizard.adviceArticle' :
                        formData.documentType === 'tp' ? 'wizard.adviceTp' :
                        formData.documentType === 'rapport' ? 'wizard.adviceRapport' :
                        'wizard.adviceMemoire'
                      )}
                    </p>
                  </div>

                  <div className="group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.aiModel')}</label>
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

                  {formData.documentType === 'tp' && (
                    <div className="group">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-accent transition-colors">{t('wizard.tpMode')}</label>
                      <select 
                        className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                        value={formData.generationMode || 'structured'}
                        onChange={e => setFormData({...formData, generationMode: e.target.value as 'structured' | 'direct'})}
                      >
                        <option value="structured">{t('wizard.structured')}</option>
                        <option value="direct">{t('wizard.direct')}</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-2 italic">{t('wizard.tpModeDesc')}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row justify-between mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-100 gap-3">
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3">
            {step > 1 ? (
              <button onClick={prevStep} className="btn-secondary w-full sm:w-auto">
                {t('wizard.back')}
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}
            
            {step < 3 ? (
              <button 
                onClick={nextStep} 
                className="btn-primary w-full sm:w-auto"
                disabled={!formData.title || !formData.field}
              >
                {t('wizard.next')}
                <ArrowRight size={18} />
              </button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary bg-accent hover:bg-accent/90 w-full sm:w-auto shadow-xl shadow-accent/20 border-none px-10">
              {t('wizard.generatePlan')} ✨
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
