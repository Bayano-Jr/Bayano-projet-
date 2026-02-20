import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Upload, FileText, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface ProjectWizardProps {
  onCancel: () => void;
  onComplete: (project: Partial<Project>) => void;
}

export default function ProjectWizard({ onCancel, onComplete }: ProjectWizardProps) {
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
    min_pages: 60,
    instructions: '',
    referenceText: ''
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
        const result = await mammoth.extractRawText({ arrayBuffer });
        setFormData(prev => ({ ...prev, referenceText: result.value }));
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Erreur lors de la lecture du fichier. Assurez-vous qu'il s'agit d'un PDF ou DOCX valide.");
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
        Retour au tableau de bord
      </button>

      <div className="glass-card p-8 md:p-16">
        <div className="flex gap-3 mb-12 md:mb-16">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                i <= step ? 'bg-accent' : 'bg-slate-100'
              }`} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h2 className="text-3xl md:text-5xl mb-4 font-serif font-medium">Informations de base</h2>
              <p className="text-base md:text-lg text-slate-500 mb-10 font-serif italic">Commençons par définir le cadre intellectuel de votre recherche.</p>
              
              <div className="space-y-5 md:space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Sujet du mémoire</label>
                  <textarea 
                    className="academic-input h-24 resize-none"
                    placeholder="Ex: L'impact de l'intelligence artificielle sur le droit d'auteur en Europe..."
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Consignes particulières ou exemple (Optionnel)</label>
                  <textarea 
                    className="academic-input h-20 resize-none"
                    placeholder="Ex: Suivre la structure de l'exemple X, mettre l'accent sur l'aspect juridique..."
                    value={formData.instructions}
                    onChange={e => setFormData({...formData, instructions: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Modèle ou exemple de mémoire (Optionnel)</label>
                  {!fileName ? (
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-6 h-6 mb-2 text-gray-400" />
                          <p className="text-xs text-gray-500"><span className="font-semibold">Cliquez pour uploader</span> un PDF ou DOCX</p>
                        </div>
                        <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg text-accent">
                          <FileText size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {isParsing ? 'Analyse en cours...' : 'Modèle chargé'}
                          </span>
                        </div>
                      </div>
                      <button onClick={removeFile} className="p-2 hover:bg-accent/10 rounded-full text-gray-400 hover:text-red-500 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2 italic">
                    L'IA s'inspirera de la structure et du style de ce document pour votre travail.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 md:mb-2">Filière / Domaine</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: Droit, Économie..."
                      value={formData.field}
                      onChange={e => setFormData({...formData, field: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 md:mb-2">Niveau académique</label>
                    <select 
                      className="academic-input"
                      value={formData.level}
                      onChange={e => setFormData({...formData, level: e.target.value})}
                    >
                      <option>Licence</option>
                      <option>Master</option>
                      <option>Doctorat (Thèse)</option>
                      <option>TFC (Travail de Fin de Cycle)</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-3xl md:text-5xl mb-4 font-serif font-medium">Contexte Institutionnel</h2>
              <p className="text-base md:text-lg text-slate-500 mb-10 font-serif italic">Ces détails permettent d'adapter la rigueur et les références académiques.</p>
              
              <div className="space-y-5 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 md:mb-2">Université</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: Université de Paris..."
                      value={formData.university}
                      onChange={e => setFormData({...formData, university: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 md:mb-2">Pays</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: France, RD Congo..."
                      value={formData.country}
                      onChange={e => setFormData({...formData, country: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Norme bibliographique</label>
                  <select 
                    className="academic-input"
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
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-3xl md:text-5xl mb-4 font-serif font-medium">Objectifs de Volume</h2>
              <p className="text-base md:text-lg text-slate-500 mb-10 font-serif italic">Définissez l'ambition et la profondeur de votre document.</p>
              
              <div className="space-y-6 md:space-y-8">
                <div>
                  <div className="flex justify-between mb-4">
                    <label className="block text-sm font-medium">Nombre de pages minimum</label>
                    <span className="text-accent font-bold">{formData.min_pages} pages</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="150" 
                    step="5"
                    className="w-full accent-academic-900"
                    value={formData.min_pages}
                    onChange={e => setFormData({...formData, min_pages: parseInt(e.target.value)})}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>30 pages (≈ 9,000 mots)</span>
                    <span>150 pages (≈ 45,000 mots)</span>
                  </div>
                </div>

                <div className="p-6 bg-amber-50 rounded-xl border border-amber-100 flex gap-4">
                  <Sparkles className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> L'IA générera le contenu chapitre par chapitre pour garantir la cohérence et atteindre le volume demandé. Un minimum de 60 pages est recommandé pour un Master.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row justify-between mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-100 gap-3">
          <div className="flex justify-between w-full">
            {step > 1 ? (
              <button onClick={prevStep} className="btn-secondary flex-1 sm:flex-none">
                Précédent
              </button>
            ) : (
              <div />
            )}
            
            {step < 3 ? (
              <button 
                onClick={nextStep} 
                className="btn-primary flex-1 sm:flex-none"
                disabled={!formData.title || !formData.field}
              >
                Suivant
                <ArrowRight size={18} />
              </button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary bg-accent hover:bg-accent/90 flex-1 sm:flex-none shadow-xl shadow-accent/20 border-none px-10">
              Lancer la conception ✨
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
