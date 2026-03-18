import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, FileText, Table, Quote, List, CheckCircle2, Lightbulb, Cpu, HelpCircle, Plus, Bot, Download } from 'lucide-react';

interface AcademicGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const AcademicGuide: React.FC<AcademicGuideProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'Règles Générales', icon: FileText },
    { id: 'methodology', label: 'Méthodologie', icon: Lightbulb },
    { id: 'appUsage', label: 'Utilisation App', icon: Cpu },
    { id: 'citations', label: 'Citations & Notes', icon: Quote },
    { id: 'tables', label: 'Tableaux & Figures', icon: Table },
    { id: 'structure', label: 'Structure du Plan', icon: List },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="academic-guide" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-academic-900">Guide de Rédaction</h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Normes & Conseils</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-slate-100 overflow-x-auto hide-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Le Style Académique</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      La rédaction d'un mémoire exige un style formel, objectif et précis. Évitez le jargon non défini, les tournures familières et l'utilisation du "je" (préférez le "nous" de modestie ou les tournures impersonnelles).
                    </p>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>Utilisez un vocabulaire technique approprié à votre domaine.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>Faites des phrases courtes et claires (une idée par phrase).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>Assurez des transitions logiques entre vos paragraphes.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'methodology' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Élaboration d'un Travail Académique</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">1. Définition du Sujet</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Choisissez un sujet qui vous passionne mais qui reste gérable. Délimitez-le précisément dans le temps et l'espace.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">2. Recherche Documentaire</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Utilisez des sources fiables : Google Scholar, Cairn, bibliothèques universitaires. Prenez des notes systématiques avec leurs références.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">3. Problématisation</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Ne vous contentez pas de décrire. Posez une question centrale à laquelle votre travail tentera de répondre.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">4. Rédaction Itérative</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          N'attendez pas d'avoir "tout fini" pour écrire. Rédigez au fur et à mesure et relisez-vous plusieurs fois.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appUsage' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Optimiser l'usage de Bayano</h3>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <Plus size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Générateur de Projet</h4>
                          <p className="text-xs text-slate-600">Utilisez-le pour créer une structure solide. Soyez précis dans vos instructions pour obtenir un plan pertinent.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <Bot size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Assistant IA (Bayano)</h4>
                          <p className="text-xs text-slate-600">Posez-lui des questions sur des concepts difficiles, demandez-lui de reformuler ou d'analyser vos documents (PDF/Word).</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Rédaction de Chapitres</h4>
                          <p className="text-xs text-slate-600">Générez le contenu chapitre par chapitre. Relisez et ajustez toujours le texte produit par l'IA pour y ajouter votre touche personnelle.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                          <Download size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Exportation Finale</h4>
                          <p className="text-xs text-slate-600">Exportez en Word (.docx) pour les dernières retouches de mise en page avant le rendu final.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'citations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Citations & Notes de Bas de Page</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      Toute idée empruntée à un auteur doit être dûment sourcée pour éviter le plagiat. L'IA génère des notes de bas de page automatiquement, mais il est de votre responsabilité de vérifier leur exactitude.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Format des notes (Markdown)</h4>
                      <code className="text-xs text-accent bg-accent/10 px-2 py-1 rounded block mb-2">
                        Selon Bourdieu[^1], la reproduction sociale...
                      </code>
                      <code className="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded block">
                        [^1]: Bourdieu, P. (1970). La Reproduction. Éditions de Minuit.
                      </code>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Les notes de bas de page sont également utiles pour définir un concept technique complexe sans alourdir le texte principal.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'tables' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Tableaux & Figures</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      Les tableaux permettent de synthétiser des données complexes (surtout dans les mémoires empiriques). Ils doivent toujours être commentés et annoncés dans le texte.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Format Markdown</h4>
                      <pre className="text-xs text-slate-600 bg-white border border-slate-200 p-3 rounded overflow-x-auto">
{`| Variable | Effectif | Pourcentage |
| :--- | :---: | :---: |
| Hommes | 45 | 45% |
| Femmes | 55 | 55% |
| **Total** | **100** | **100%** |`}
                      </pre>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      L'IA générera automatiquement ce format. Lors de l'export Word ou PDF, ces balises seront transformées en véritables tableaux stylisés.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'structure' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">Structure du Mémoire</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      Un mémoire académique suit une structure en entonnoir : du général au particulier.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">1</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Introduction</h4>
                          <p className="text-xs text-slate-500">Contexte, problématique, hypothèses, méthodologie et annonce du plan.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">2</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Cadre Théorique</h4>
                          <p className="text-xs text-slate-500">Revue de littérature, concepts clés et théories mobilisées.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">3</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Cadre Empirique (si applicable)</h4>
                          <p className="text-xs text-slate-500">Présentation du terrain, analyse des résultats et discussion.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">4</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">Conclusion</h4>
                          <p className="text-xs text-slate-500">Bilan, validation des hypothèses, limites et ouvertures.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-academic-900 text-white rounded-xl font-medium hover:bg-academic-800 transition-colors"
              >
                J'ai compris
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AcademicGuide;
