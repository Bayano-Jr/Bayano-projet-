import React, { useState } from 'react';
import { ArrowLeft, Sparkles, FileText, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Project, User } from '../types';
import { useAlert } from '../contexts/AlertContext';
import i18n from '../i18n';
import * as pdfjs from 'pdfjs-dist';
import { extractTextFromDocx } from '../utils/docxUtils';

// Set worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface CustomProjectWizardProps {
  user: User;
  onCancel: () => void;
  onComplete: (project: Partial<Project>) => void;
  onShowPricing: () => void;
}

export default function CustomProjectWizard({ user, onCancel, onComplete, onShowPricing }: CustomProjectWizardProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    documentType: '',
    min_pages: 5,
    instructions: '',
    referenceText: '',
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

  const processFile = async (file: File) => {
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
          throw new Error(t('wizard.errors.docxRead'));
        }
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      showAlert({ message: t('wizard.errors.fileRead'), type: 'error' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const removeFile = () => {
    setFileName(null);
    setFormData(prev => ({ ...prev, referenceText: '' }));
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.documentType) {
      showAlert({ message: t('dashboard.errors.fillTitleAndType'), type: 'warning' });
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
          {t('dashboard.customWork')}
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-7xl mb-4 md:mb-8 font-serif font-semibold tracking-tight text-academic-900 leading-[0.9] break-words">
          {t('dashboard.designDocument')}
        </h2>
        <p className="text-base md:text-xl text-slate-500 font-serif italic leading-relaxed">
          {t('dashboard.customWorkDesc')}
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
                {t('wizard.fields.documentType')}
              </label>
              <input 
                type="text"
                placeholder={t('wizard.placeholders.documentType')}
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
                <option value="Français">{t('wizard.options.french')}</option>
                <option value="Anglais">{t('wizard.options.english')}</option>
                <option value="Espagnol">{t('wizard.options.spanish')}</option>
                <option value="Allemand">{t('wizard.options.german')}</option>
              </select>
            </div>
          </div>

          <div className="group">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
              {t('wizard.fields.instructions')}
            </label>
            <textarea 
              placeholder={t('wizard.placeholders.instructionsCustom')}
              className="academic-input min-h-[160px] p-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all resize-y"
              value={formData.instructions}
              onChange={e => setFormData({...formData, instructions: e.target.value})}
            />
          </div>

          <div className="group">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
              {t('wizard.fields.referenceText')}
            </label>
            {!fileName ? (
              <div className="flex items-center justify-center w-full">
                <label 
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-[24px] cursor-pointer transition-all group/upload ${isDragging ? 'bg-indigo-600/5 border-indigo-600' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-600/40'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-3 shadow-sm group-hover/upload:text-indigo-600 transition-colors">
                      <Upload size={20} />
                    </div>
                    <p className="text-xs text-slate-500"><span className="font-bold text-academic-900">Glissez-déposez ou cliquez</span> pour uploader un PDF ou DOCX</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
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

            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4 group-focus-within:text-indigo-600 transition-colors">
                {t('wizard.tpMode')}
              </label>
              <select 
                className="academic-input h-14 px-6 bg-slate-50/50 border-slate-100 focus:bg-white transition-all appearance-none"
                value={formData.generationMode}
                onChange={e => setFormData({...formData, generationMode: e.target.value as 'structured' | 'direct'})}
              >
                <option value="structured">{t('wizard.structured')}</option>
                <option value="direct">{t('wizard.direct')}</option>
              </select>
              <p className="text-xs text-slate-400 mt-2 italic">{t('wizard.tpModeDesc')}</p>
            </div>
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
          {formData.generationMode === 'direct' ? t('wizard.startWriting') : t('wizard.generatePlan')}
        </button>
      </div>
    </div>
  );
}
