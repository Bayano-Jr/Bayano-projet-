import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';

interface ProjectWizardProps {
  onCancel: () => void;
  onComplete: (project: Partial<Project>) => void;
}

export default function ProjectWizard({ onCancel, onComplete }: ProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    field: '',
    university: '',
    country: '',
    level: 'Master',
    norm: 'APA',
    min_pages: 60
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => {
    onComplete(formData);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <button onClick={onCancel} className="flex items-center gap-2 text-gray-500 hover:text-academic-900 mb-8 transition-colors">
        <ArrowLeft size={20} />
        Retour au tableau de bord
      </button>

      <div className="glass-card p-10">
        <div className="flex gap-2 mb-10">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-accent' : 'bg-gray-100'
              }`} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-3xl mb-2">Informations de base</h2>
              <p className="text-gray-500 mb-8">Commençons par définir le cadre de votre recherche.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Sujet du mémoire</label>
                  <textarea 
                    className="academic-input h-24 resize-none"
                    placeholder="Ex: L'impact de l'intelligence artificielle sur le droit d'auteur en Europe..."
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Filière / Domaine</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: Droit, Économie, Informatique..."
                      value={formData.field}
                      onChange={e => setFormData({...formData, field: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Niveau académique</label>
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
              <h2 className="text-3xl mb-2">Contexte Institutionnel</h2>
              <p className="text-gray-500 mb-8">Ces détails permettent d'adapter le style et les références.</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Université</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: Université de Paris, UNIKIN..."
                      value={formData.university}
                      onChange={e => setFormData({...formData, university: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Pays</label>
                    <input 
                      type="text" 
                      className="academic-input"
                      placeholder="Ex: France, RD Congo, Sénégal..."
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
              <h2 className="text-3xl mb-2">Objectifs de Volume</h2>
              <p className="text-gray-500 mb-8">Définissez la longueur attendue de votre document.</p>
              
              <div className="space-y-8">
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

                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-medium mb-4">Importer un modèle de mémoire (Optionnel)</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez</p>
                        <p className="text-xs text-gray-400">PDF ou DOCX (MAX. 10MB)</p>
                      </div>
                      <input type="file" className="hidden" accept=".pdf,.docx" />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 italic">
                    L'IA analysera la structure et le style du modèle pour l'appliquer à votre mémoire.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-12 pt-8 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={prevStep} className="btn-secondary">
              Précédent
            </button>
          ) : (
            <div />
          )}
          
          {step < 3 ? (
            <button 
              onClick={nextStep} 
              className="btn-primary"
              disabled={!formData.title || !formData.field}
            >
              Suivant
              <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn-primary bg-accent hover:bg-accent/90">
              Générer le plan
              <Sparkles size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
