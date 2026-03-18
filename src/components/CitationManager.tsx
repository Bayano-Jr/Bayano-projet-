import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, CheckCircle, AlertTriangle, Loader2, Copy, Search, FileText } from 'lucide-react';
import { generateCitation, verifySource } from '../services/geminiService';

interface CitationManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CitationManager({ isOpen, onClose }: CitationManagerProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'verify'>('generate');
  
  // Generator State
  const [format, setFormat] = useState<'APA' | 'MLA' | 'Chicago' | 'Harvard'>('APA');
  const [formData, setFormData] = useState({
    author: '',
    title: '',
    year: '',
    publisher: '',
    url: '',
    type: 'Livre'
  });
  const [generatedCitation, setGeneratedCitation] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Verifier State
  const [sourceText, setSourceText] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    isReliable: boolean;
    score: number;
    explanation: string;
    provenance: string;
    relevance: string;
    type: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const citation = await generateCitation(formData, format);
      setGeneratedCitation(citation);
      setCopied(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim()) return;
    setIsVerifying(true);
    try {
      const result = await verifySource(sourceText);
      setVerificationResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedCitation) {
      navigator.clipboard.writeText(generatedCitation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="citation-manager" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div 
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-academic-900 text-white flex items-center justify-center shadow-lg shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-academic-900">Gestion des Citations</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-medium mt-1">Générateur & Vérificateur</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap px-2 sm:px-4 ${activeTab === 'generate' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText size={16} /> Générer
              </div>
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap px-2 sm:px-4 ${activeTab === 'verify' ? 'text-academic-900 border-b-2 border-academic-900 bg-academic-50' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <Search size={16} /> Vérifier
              </div>
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {activeTab === 'generate' ? (
              <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  {['APA', 'MLA', 'Chicago', 'Harvard'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f as any)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${format === f ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Auteur(s)</label>
                      <input 
                        type="text" 
                        value={formData.author}
                        onChange={e => setFormData({...formData, author: e.target.value})}
                        placeholder="Ex: Dupont, J."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Année</label>
                      <input 
                        type="text" 
                        value={formData.year}
                        onChange={e => setFormData({...formData, year: e.target.value})}
                        placeholder="Ex: 2023"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Titre de l'œuvre</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        placeholder="Ex: L'impact de l'IA sur l'éducation"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Éditeur / Revue</label>
                      <input 
                        type="text" 
                        value={formData.publisher}
                        onChange={e => setFormData({...formData, publisher: e.target.value})}
                        placeholder="Ex: Presses Universitaires"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">URL / DOI (Optionnel)</label>
                      <input 
                        type="text" 
                        value={formData.url}
                        onChange={e => setFormData({...formData, url: e.target.value})}
                        placeholder="Ex: https://doi.org/..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isGenerating || (!formData.author && !formData.title)}
                    className="w-full py-4 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {isGenerating ? 'Génération...' : 'Générer la citation'}
                  </button>
                </form>

                {generatedCitation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative group"
                  >
                    <p className="text-sm text-slate-700 pr-10">{generatedCitation}</p>
                    <button 
                      onClick={copyToClipboard}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                      title="Copier"
                    >
                      {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Source à vérifier</label>
                    <textarea 
                      value={sourceText}
                      onChange={e => setSourceText(e.target.value)}
                      placeholder="Collez ici une citation, un lien, un nom d'auteur ou un extrait de texte..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-academic-900 focus:ring-2 focus:ring-academic-900/20 outline-none transition-all text-sm min-h-[120px] resize-none"
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isVerifying || !sourceText.trim()}
                    className="w-full py-4 bg-academic-900 hover:bg-academic-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {isVerifying ? 'Analyse en cours...' : 'Vérifier la fiabilité'}
                  </button>
                </form>

                {verificationResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 sm:p-5 rounded-xl border ${verificationResult.isReliable ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                      <div className={`p-2 sm:p-3 rounded-full shrink-0 ${verificationResult.isReliable ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {verificationResult.isReliable ? <CheckCircle size={20} className="sm:w-6 sm:h-6" /> : <AlertTriangle size={20} className="sm:w-6 sm:h-6" />}
                      </div>
                      <div className="space-y-3 sm:space-y-4 w-full">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                            <h3 className={`text-sm sm:text-base font-bold ${verificationResult.isReliable ? 'text-emerald-800' : 'text-amber-800'}`}>
                              {verificationResult.isReliable ? 'Source Fiable' : 'Source Douteuse ou Non Académique'}
                            </h3>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${verificationResult.isReliable ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                              Score: {verificationResult.score}/100
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">Type: {verificationResult.type}</p>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Évaluation</p>
                          <p className={`text-xs sm:text-sm ${verificationResult.isReliable ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {verificationResult.explanation}
                          </p>
                        </div>
                        
                        {verificationResult.provenance && verificationResult.provenance !== "Inconnue" && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Provenance</p>
                            <p className="text-xs sm:text-sm text-slate-700">
                              {verificationResult.provenance}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
