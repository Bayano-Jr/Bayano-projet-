import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Upload, FileText, Sparkles, RefreshCw, Copy, Check, AlertCircle, Loader2, Trash2, Download, Type, FileUp, Search } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { detectAIContent, paraphraseText } from '../services/geminiService';
import { extractTextFromDocx } from '../utils/docxUtils';

// Set worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface AntiPlagiarismProps {
  onBack: () => void;
}

export default function AntiPlagiarism({ onBack }: AntiPlagiarismProps) {
  const { t, i18n } = useTranslation();
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [freeText, setFreeText] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParaphrasing, setIsParaphrasing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ aiProbability: number, humanProbability: number } | null>(null);
  const [paraphrasedText, setParaphrasedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setAnalysisResult(null);
    setParaphrasedText(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = '';

      if (file.type === 'application/pdf') {
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          extractedText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          extractedText = await extractTextFromDocx(arrayBuffer);
        } catch (docxErr: any) {
          console.error("Docx error:", docxErr);
          throw new Error("Erreur lors de la lecture du fichier DOCX. Assurez-vous qu'il s'agit d'un fichier Word valide.");
        }
      } else {
        throw new Error("Format de fichier non supporté. Veuillez utiliser un PDF ou DOCX.");
      }

      setFileText(extractedText);
    } catch (err: any) {
      console.error("Error reading file:", err);
      setError(err.message || "Erreur lors de la lecture du fichier.");
      setFileName(null);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeText = inputMode === 'text' ? freeText : fileText;

  const handleAnalyze = async () => {
    if (!activeText.trim()) {
      setError(t('antiPlagiarism.errorEmpty'));
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setParaphrasedText(null);

    try {
      const result = await detectAIContent(activeText);
      setAnalysisResult(result);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(t('antiPlagiarism.errorAnalyze'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleParaphrase = async () => {
    if (!activeText.trim()) {
      setError(t('antiPlagiarism.errorEmpty'));
      return;
    }

    setIsParaphrasing(true);
    setError(null);

    try {
      const result = await paraphraseText(activeText, i18n.language);
      setParaphrasedText(result);
    } catch (err) {
      console.error("Paraphrasing error:", err);
      setError(t('antiPlagiarism.errorParaphrase'));
    } finally {
      setIsParaphrasing(false);
    }
  };

  const handleCopy = () => {
    if (paraphrasedText) {
      navigator.clipboard.writeText(paraphrasedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadDocx = async () => {
    if (!paraphrasedText) return;
    
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: paraphrasedText.split('\n').map(line => new Paragraph({
            children: [new TextRun(line)]
          }))
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paraphrase_${new Date().getTime()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating DOCX:", err);
      alert("Erreur lors de la création du fichier DOCX.");
    }
  };

  const handleClear = () => {
    setFreeText('');
    setFileText('');
    setFileName(null);
    setAnalysisResult(null);
    setParaphrasedText(null);
    setError(null);
  };

  const wordCount = activeText.trim() ? activeText.trim().split(/\s+/).length : 0;
  const charCount = activeText.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-academic-900 transition-colors font-bold text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={16} />
            {t('wizard.back')}
          </button>
        </div>

        <div className="mb-8 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-serif font-semibold tracking-tight text-academic-900 mb-4 flex items-center gap-3 md:gap-4">
            <Search className="text-accent w-8 h-8 md:w-12 md:h-12" />
            {t('antiPlagiarism.title')}
          </h1>
          <p className="text-base md:text-xl text-slate-500 font-serif italic max-w-3xl leading-relaxed">
            {t('antiPlagiarism.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Input Section */}
          <div className="space-y-6 flex flex-col h-full">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xl flex-1 flex flex-col">
              
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                <button
                  onClick={() => setInputMode('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${inputMode === 'text' ? 'bg-white text-academic-900 shadow-sm' : 'text-slate-500 hover:text-academic-900'}`}
                >
                  <Type size={16} />
                  Texte Libre
                </button>
                <button
                  onClick={() => setInputMode('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${inputMode === 'file' ? 'bg-white text-academic-900 shadow-sm' : 'text-slate-500 hover:text-academic-900'}`}
                >
                  <FileUp size={16} />
                  Document
                </button>
              </div>

              {inputMode === 'file' && (
                <div className="flex-1 flex flex-col">
                  {!fileName ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors min-h-[300px]">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.docx"
                        className="hidden"
                        id="file-upload"
                      />
                      <label 
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center w-full h-full justify-center"
                      >
                        <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-6">
                          <Upload size={32} />
                        </div>
                        <span className="text-lg font-bold text-academic-900 mb-2">
                          Glissez-déposez votre fichier ici
                        </span>
                        <span className="text-sm text-slate-500 mb-6">ou cliquez pour parcourir (PDF, DOCX)</span>
                        <span className="px-6 py-3 bg-academic-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-academic-800 transition-colors">
                          Sélectionner un fichier
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-academic-900">{fileName}</h4>
                            <p className="text-xs text-emerald-600 font-medium">Fichier chargé avec succès</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setFileName(null);
                            setFileText('');
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer le fichier"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-center mb-4 mt-4">
                        <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                          Aperçu du texte extrait
                        </label>
                        <div className="text-xs font-medium text-slate-400 flex gap-4">
                          <span>{wordCount} mots</span>
                          <span>{charCount} caractères</span>
                        </div>
                      </div>
                      <div className="flex-1 w-full min-h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 overflow-y-auto font-serif">
                        {fileText ? fileText.substring(0, 1000) + (fileText.length > 1000 ? '...' : '') : 'Aucun texte extrait.'}
                      </div>
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                        <strong>Note :</strong> L'extraction se concentre sur le texte brut pour l'analyse. La mise en page complexe ne sera pas affichée ici.
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {inputMode === 'text' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Texte source
                    </label>
                    <div className="text-xs font-medium text-slate-400 flex gap-4">
                      <span>{wordCount} mots</span>
                      <span>{charCount} caractères</span>
                    </div>
                  </div>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder={t('antiPlagiarism.pasteText')}
                    className="flex-1 w-full min-h-[300px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
                  />
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isParaphrasing || !activeText.trim()}
                    className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isAnalyzing ? t('antiPlagiarism.analyzing') : t('antiPlagiarism.analyze')}
                  </button>
                  <button
                    onClick={handleParaphrase}
                    disabled={isParaphrasing || isAnalyzing || !activeText.trim()}
                    className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                  >
                    {isParaphrasing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {isParaphrasing ? t('antiPlagiarism.paraphrasing') : t('antiPlagiarism.paraphrase')}
                  </button>
                </div>
                
                {(freeText || fileText || analysisResult || paraphrasedText) && (
                  <button
                    onClick={handleClear}
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 border border-slate-200 hover:border-red-200"
                  >
                    <Trash2 size={16} />
                    Nettoyer et recommencer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6 h-full">
            <AnimatePresence mode="wait">
              {isAnalyzing && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 border border-slate-200 rounded-3xl bg-white shadow-xl"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-slate-100 border-t-academic-900 rounded-full animate-spin"></div>
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-academic-900" size={32} />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-academic-900 mb-2">Analyse en cours...</h3>
                  <p className="text-slate-500 max-w-sm">
                    L'IA examine la structure linguistique, la perplexité et la variation des phrases de votre document.
                  </p>
                </motion.div>
              )}

              {isParaphrasing && (
                <motion.div
                  key="paraphrasing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 border border-slate-200 rounded-3xl bg-white shadow-xl"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                    <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={32} />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-academic-900 mb-2">Paraphrase en cours...</h3>
                  <p className="text-slate-500 max-w-sm">
                    Reformulation académique du texte pour garantir son authenticité tout en conservant le sens original.
                  </p>
                  
                  <div className="w-full max-w-xs mt-8 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-accent"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "linear" }}
                    />
                  </div>
                </motion.div>
              )}

              {!isAnalyzing && !isParaphrasing && analysisResult && !paraphrasedText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xl"
                >
                  <h3 className="text-xl font-serif font-bold text-academic-900 mb-6 flex items-center gap-3">
                    <Sparkles className="text-accent" size={24} />
                    {t('antiPlagiarism.results')}
                  </h3>
                  
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">{t('antiPlagiarism.aiProbability')}</span>
                        <span className="text-3xl font-serif font-bold text-red-500">{analysisResult.aiProbability}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${analysisResult.aiProbability}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">{t('antiPlagiarism.humanProbability')}</span>
                        <span className="text-3xl font-serif font-bold text-emerald-500">{analysisResult.humanProbability}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${analysisResult.humanProbability}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {analysisResult.aiProbability > 50 && (
                    <div className="mt-8 p-6 bg-orange-50 border border-orange-100 rounded-2xl">
                      <h4 className="text-orange-900 font-bold mb-2 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Risque de plagiat IA détecté
                      </h4>
                      <p className="text-sm text-orange-800 leading-relaxed">
                        Ce texte présente une forte probabilité d'avoir été généré par une IA. Nous vous recommandons d'utiliser l'outil de paraphrase pour le reformuler et garantir l'authenticité de votre travail.
                      </p>
                      <button
                        onClick={handleParaphrase}
                        className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-orange-700 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw size={14} />
                        Paraphraser maintenant
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {!isAnalyzing && !isParaphrasing && paraphrasedText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xl h-full flex flex-col"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-lg md:text-xl font-serif font-bold text-academic-900 flex items-center gap-2 md:gap-3">
                      <RefreshCw className="text-accent w-5 h-5 md:w-6 md:h-6" />
                      {t('antiPlagiarism.paraphrasedResult')}
                    </h3>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleCopy}
                        className="flex-1 sm:flex-none flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-academic-900 transition-colors bg-slate-50 px-3 py-2 rounded-xl border border-slate-200"
                      >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        {copied ? t('antiPlagiarism.copied') : t('antiPlagiarism.copy')}
                      </button>
                      <button
                        onClick={handleDownloadDocx}
                        className="flex-1 sm:flex-none flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-academic-800 transition-colors bg-academic-900 px-3 py-2 rounded-xl shadow-md"
                      >
                        <Download size={14} />
                        Télécharger (DOCX)
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-slate-50 rounded-2xl p-6 border border-slate-100 overflow-y-auto max-h-[600px]">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
                      {paraphrasedText}
                    </p>
                  </div>
                </motion.div>
              )}
              
              {!isAnalyzing && !isParaphrasing && !analysisResult && !paraphrasedText && (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center shadow-sm mb-6 text-slate-300">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-slate-400 mb-2">En attente d'analyse</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Collez votre texte ou importez un fichier, puis cliquez sur Analyser ou Paraphraser pour voir les résultats ici.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
