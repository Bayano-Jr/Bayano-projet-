import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileText, Download, Eye, Sparkles, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, PlanStructure, Chapter, User } from '../types';
import { generateChapterContent, generateFrontMatter } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { exportToDOCX, downloadDOCX, generateDOCXBase64 } from '../services/exportService';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../contexts/AlertContext';

interface GenerationViewProps {
  project: Project;
  user: User;
  onUpdateUser: (u: User) => void;
  onShowPricing: () => void;
  onComplete: () => void;
  onViewDetail: () => void;
  onBackToDashboard: () => void;
}

export default function GenerationView({ project, user, onUpdateUser, onShowPricing, onComplete, onViewDetail, onBackToDashboard }: GenerationViewProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0); // 0: Front matter, 1+: Chapters
  const [status, setStatus] = useState<'idle' | 'generating' | 'saving' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    if (project.status === 'generating' && status === 'idle') {
      setIsResuming(true);
      startGeneration();
    }
  }, []);

  const getPlan = () => {
    if (!project.plan) return {};
    if (typeof project.plan === 'object') return project.plan;
    try {
      return JSON.parse(project.plan);
    } catch (e) {
      console.error("Error parsing plan:", e);
      return {};
    }
  };

  const plan = getPlan();
  const isStandardDoc = ['memoire', 'rapport', 'article'].includes(project.documentType || '');
  const hasAnnexes = plan.annexes && plan.annexes.length > 0;
  const hasBiblio = plan.bibliographie_indicative && plan.bibliographie_indicative.length > 0;
  const totalSteps = (plan.chapitres?.length || 0) + 3 + (hasBiblio ? 1 : 0) + (hasAnnexes ? 1 : 0);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startGeneration = async () => {
    setStatus('generating');
    setError(null);
    
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }

      // Check credits before generating
      const res = await fetch('/api/saas/estimate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'generation', pages: project.min_pages }),
        credentials: 'include'
      });
      if (res.status === 401) {
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }
      if (!res.ok) throw new Error("Failed to estimate credits");
      const estimateData = await res.json();
      
      if (!estimateData.hasEnough && !isResuming) {
        setStatus('error');
        setError(`Crédits insuffisants. Il vous faut environ ${estimateData.estimatedCredits} crédits pour générer ce document.`);
        onShowPricing();
        return;
      }

      if (!isResuming) {
        // Deduct credits
        const deductRes = await fetch('/api/saas/deduct', {
          method: 'POST',
          headers,
          body: JSON.stringify({ amount: estimateData.estimatedCredits, description: `Génération document: ${project.title.substring(0, 20)}...` }),
          credentials: 'include'
        });
        
        if (deductRes.ok) {
          const deductData = await deductRes.json();
          onUpdateUser({ ...user, credits: deductData.remainingCredits });
        } else {
          setStatus('error');
          setError("Erreur lors de la déduction des crédits.");
          return;
        }
      }

      // Update project status to generating in DB
      if (project.status !== 'generating') {
        const generatingProject = { ...project, status: 'generating' as const };
        await storageService.saveProject(generatingProject);
      }

      // Load existing chapters to see where we are
      const projectChapters = await storageService.getChaptersByProject(project.id);
      
      let currentChapters = [...projectChapters];
      setChapters(currentChapters);
      
      const wordCount = currentChapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
      setTotalWords(wordCount);

      const totalTargetWords = project.min_pages * 300;
      
      let introTargetWords = Math.max(600, Math.ceil(totalTargetWords * 0.1)); // 10% of total
      let conclusionTargetWords = Math.max(600, Math.ceil(totalTargetWords * 0.05)); // 5% of total
      const numChapters = plan.chapitres?.length || 1;
      let chapterTargetWords = Math.max(1000, Math.ceil((totalTargetWords - introTargetWords - conclusionTargetWords) / numChapters));

      if (!isStandardDoc) {
         introTargetWords = Math.max(300, Math.ceil(totalTargetWords * 0.1));
         conclusionTargetWords = Math.max(300, Math.ceil(totalTargetWords * 0.1));
         chapterTargetWords = Math.max(500, Math.ceil((totalTargetWords - introTargetWords - conclusionTargetWords) / numChapters));
      } else if (project.documentType === 'article') {
         introTargetWords = Math.max(500, Math.ceil(totalTargetWords * 0.15));
         conclusionTargetWords = Math.max(500, Math.ceil(totalTargetWords * 0.1));
         chapterTargetWords = Math.max(800, Math.ceil((totalTargetWords - introTargetWords - conclusionTargetWords) / numChapters));
      } else if (project.documentType === 'rapport') {
         introTargetWords = Math.min(600, Math.max(300, Math.ceil(totalTargetWords * 0.1))); // ~1-2 pages
         conclusionTargetWords = Math.min(600, Math.max(300, Math.ceil(totalTargetWords * 0.1))); // ~1-2 pages
         chapterTargetWords = Math.max(1000, Math.ceil((totalTargetWords - introTargetWords - conclusionTargetWords) / numChapters));
      }

      // 1. Generate Front Matter (Skip for custom docs)
      if (isStandardDoc && !currentChapters.find(c => c.order_index === -1)) {
        setCurrentStep(0);
        const frontMatter = await generateFrontMatter(project);
        const frontMatterChapter: Chapter = {
          id: `${project.id}-front`, // Deterministic ID
          project_id: project.id,
          title: t('generationView.frontMatter'),
          content: JSON.stringify(frontMatter),
          order_index: -1,
          word_count: 500
        };
        await storageService.saveChapter(frontMatterChapter);
        currentChapters.push(frontMatterChapter);
        setChapters([...currentChapters]);
        await delay(300); 
      } else if (!isStandardDoc && !currentChapters.find(c => c.order_index === -1)) {
        // For custom docs, just create a simple page de garde
        setCurrentStep(0);
        const frontMatter = {
          page_de_garde: `${project.documentType?.toUpperCase() || 'DOCUMENT'}\n\nSujet : ${project.title}\n\nFilière : ${project.field || 'Non spécifié'}\nUniversité : ${project.university || 'Non spécifié'}`
        };
        const frontMatterChapter: Chapter = {
          id: `${project.id}-front`,
          project_id: project.id,
          title: t('generationView.coverPage'),
          content: JSON.stringify(frontMatter),
          order_index: -1,
          word_count: 50
        };
        await storageService.saveChapter(frontMatterChapter);
        currentChapters.push(frontMatterChapter);
        setChapters([...currentChapters]);
        await delay(300); 
      }
      setProgress((1 / totalSteps) * 100);

      // 2. Generate Introduction
      let introChapter = currentChapters.find(c => c.order_index === 0);
      if (!introChapter) {
        setCurrentStep(1);
        const introTitle = plan.introduction?.titre || t('generationView.generalIntro');
        const introContent = await generateChapterContent(project, plan, introTitle, "", introTargetWords);
        introChapter = {
          id: `${project.id}-intro`, // Deterministic ID
          project_id: project.id,
          title: introTitle,
          content: introContent,
          order_index: 0,
          word_count: introContent.split(/\s+/).length
        };
        await storageService.saveChapter(introChapter);
        currentChapters.push(introChapter);
        setChapters([...currentChapters]);
        setTotalWords(prev => prev + introChapter!.word_count);
        await delay(300);
      }
      let context = `Résumé de l'introduction: ${introChapter.content.substring(0, 500)}...\n`;
      setProgress((2 / totalSteps) * 100);

      // 3. Generate Chapters Sequentially to avoid rate limits
      const generatedChapters = [];
      const chapitres = plan.chapitres || [];
      for (let i = 0; i < chapitres.length; i++) {
        const chap = chapitres[i];
        let chapterData = currentChapters.find(c => c.order_index === i + 1);
        
        if (!chapterData) {
          try {
            const content = await generateChapterContent(project, plan, chap.titre, context, chapterTargetWords);
            if (!content || content.length < 100) {
              throw new Error(`Le contenu généré pour le chapitre "${chap.titre}" est trop court.`);
            }
            const wordCount = content.split(/\s+/).length;
            
            chapterData = {
              id: `${project.id}-ch-${i}`, // Deterministic ID
              project_id: project.id,
              title: chap.titre,
              content: content,
              order_index: i + 1,
              word_count: wordCount
            };

            await storageService.saveChapter(chapterData);
            
            // Update state incrementally
            currentChapters.push(chapterData);
            setChapters([...currentChapters].sort((a, b) => a.order_index - b.order_index));
            setTotalWords(currentChapters.reduce((acc, c) => acc + (c.word_count || 0), 0));
            setProgress(((i + 3) / totalSteps) * 100);
            
            // Add slight delay between chapters to be safe
            await delay(1000);
          } catch (err) {
            console.error(`Error generating chapter ${i}:`, err);
            throw err;
          }
        }
        generatedChapters.push(chapterData);
      }
      
      // Update context for conclusion with all chapter summaries
      let fullContext = context;
      generatedChapters.forEach((ch, i) => {
        fullContext += `\nRésumé du chapitre ${i+1}: ${ch.content.substring(0, 300)}...\n`;
      });

      // 4, 5, 6. Generate Conclusion, Biblio, Annexes Sequentially
      const finalChapters = [];

      // Conclusion
      let conclusionChapter = currentChapters.find(c => c.order_index === 999);
      if (!conclusionChapter) {
        const content = await generateChapterContent(project, plan, t('generationView.generalConclusion').toUpperCase(), fullContext, conclusionTargetWords);
        conclusionChapter = {
          id: `${project.id}-conclusion`,
          project_id: project.id,
          title: t('generationView.generalConclusion').toUpperCase(),
          content: content,
          order_index: 999,
          word_count: content.split(/\s+/).length
        };
        await storageService.saveChapter(conclusionChapter);
        currentChapters.push(conclusionChapter);
        setChapters([...currentChapters].sort((a, b) => a.order_index - b.order_index));
        await delay(1000);
      }
      finalChapters.push(conclusionChapter);

      // Biblio
      if (hasBiblio) {
        let biblioChapter = currentChapters.find(c => c.order_index === 1000);
        if (!biblioChapter) {
          const content = await generateChapterContent(project, plan, t('generationView.bibliography').toUpperCase(), fullContext, 1000);
          biblioChapter = {
            id: `${project.id}-biblio`,
            project_id: project.id,
            title: t('generationView.bibliography').toUpperCase(),
            content: content,
            order_index: 1000,
            word_count: content.split(/\s+/).length
          };
          await storageService.saveChapter(biblioChapter);
          currentChapters.push(biblioChapter);
          setChapters([...currentChapters].sort((a, b) => a.order_index - b.order_index));
          await delay(1000);
        }
        finalChapters.push(biblioChapter);
      }

      // Annexes
      if (hasAnnexes) {
        let annexesChapter = currentChapters.find(c => c.order_index === 1001);
        if (!annexesChapter) {
          const content = await generateChapterContent(project, plan, t('generationView.annexes').toUpperCase(), fullContext, 1000);
          annexesChapter = {
            id: `${project.id}-annexes`,
            project_id: project.id,
            title: t('generationView.annexes').toUpperCase(),
            content: content,
            order_index: 1001,
            word_count: content.split(/\s+/).length
          };
          await storageService.saveChapter(annexesChapter);
          currentChapters.push(annexesChapter);
          setChapters([...currentChapters].sort((a, b) => a.order_index - b.order_index));
          await delay(1000);
        }
        finalChapters.push(annexesChapter);
      }

      currentChapters = [...currentChapters].sort((a, b) => a.order_index - b.order_index);
      
      setChapters([...currentChapters]);
      setTotalWords(currentChapters.reduce((acc, c) => acc + (c.word_count || 0), 0));

      setProgress(100);

      // 7. Generate and save DOCX to database
      let docxBase64 = '';
      try {
        docxBase64 = await generateDOCXBase64({ ...project, chapters: currentChapters } as any);
      } catch (docxErr) {
        console.error("Failed to generate DOCX for storage:", docxErr);
      }

      // Update project status to completed
      const updatedProject = { 
        ...project, 
        status: 'completed' as const,
        docx_data: docxBase64 || undefined
      };
      await storageService.saveProject(updatedProject);

      await delay(1000); // Give DB a moment to settle
      setStatus('idle');
      onComplete(); // Call onComplete to update the parent component state
    } catch (err: any) {
      console.error(err);
      let msg = err.message || t('generationView.errorGeneric');
      
      if (msg.includes("Non autorisé")) {
        // This will be caught by App.tsx if we re-throw or handle it here
        setError(t('generationView.errorAuth'));
        // We could potentially trigger a logout here if we had access to setUser
      } else if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        msg = t('generationView.errorQuota');
        setError(msg);
      } else {
        setError(msg);
      }
      setStatus('error');
    }
  };

  const estimatedPages = Math.round(totalWords / 300);

  const handleExportDOCX = async () => {
    if (!project) return;
    try {
      await downloadDOCX({ ...project, chapters } as any, {
        includeTitlePage: true,
        includeTableOfContents: true,
        includeBibliography: true,
        includeAnnexes: true
      });
    } catch (error) {
      console.error("Export DOCX failed:", error);
      showAlert({ message: t('generationView.exportFailed'), type: 'error' });
    }
  };

  const handleExportPDF = () => {
    onViewDetail();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-12 py-8 md:py-20">
      <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 sm:p-8 md:p-24 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
          <motion.div 
            className="h-full bg-accent shadow-[0_0_20px_rgba(180,83,9,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="relative z-10">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-academic-900 rounded-[24px] md:rounded-[32px] flex items-center justify-center mx-auto mb-8 md:mb-12 shadow-2xl shadow-academic-900/30 relative">
            <Sparkles className="text-white animate-pulse" size={32} />
            <motion.div 
              className="absolute inset-0 rounded-[24px] md:rounded-[32px] border-2 border-accent/30"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          
          <h2 className="text-4xl sm:text-5xl md:text-7xl mb-6 md:mb-8 font-serif font-semibold tracking-tight text-academic-900 leading-[1.1] md:leading-[0.9]">{t('generationView.title')}</h2>
          <p className="text-lg md:text-xl text-slate-500 mb-12 md:mb-20 font-serif italic max-w-2xl mx-auto leading-relaxed px-4">
            {t('generationView.subtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 mb-12 md:mb-20">
            <div className="p-6 md:p-10 bg-slate-50/50 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-inner group hover:bg-white transition-all duration-500">
              <div className="text-slate-300 text-[10px] mb-2 md:mb-4 uppercase tracking-[0.3em] font-bold group-hover:text-accent transition-colors">{t('generationView.progress')}</div>
              <div className="text-4xl md:text-5xl font-serif text-academic-900">{Math.round(progress)}<span className="text-lg md:text-xl text-slate-400">%</span></div>
            </div>
            <div className="p-6 md:p-10 bg-slate-50/50 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-inner group hover:bg-white transition-all duration-500">
              <div className="text-slate-300 text-[10px] mb-2 md:mb-4 uppercase tracking-[0.3em] font-bold group-hover:text-accent transition-colors">{t('generationView.estimatedVolume')}</div>
              <div className="text-4xl md:text-5xl font-serif text-academic-900">{estimatedPages} <span className="text-lg md:text-xl text-slate-400">{t('generationView.pages')}</span></div>
            </div>
            <div className="p-6 md:p-10 bg-slate-50/50 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-inner group hover:bg-white transition-all duration-500 sm:col-span-2 md:col-span-1">
              <div className="text-slate-300 text-[10px] mb-2 md:mb-4 uppercase tracking-[0.3em] font-bold group-hover:text-accent transition-colors">{t('generationView.wordsWritten')}</div>
              <div className="text-4xl md:text-5xl font-serif text-academic-900">{totalWords.toLocaleString()}</div>
            </div>
          </div>

          <div className="max-w-xl mx-auto bg-slate-50/30 rounded-[32px] md:rounded-[40px] p-6 md:p-10 border border-slate-100">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400 mb-6 md:mb-8 text-center">{t('generationView.writingLog')}</h3>
            <div className="space-y-4 md:space-y-6 text-left">
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${currentStep > 0 ? 'bg-emerald-500 text-white' : 'bg-accent text-white animate-pulse'}`}>
                  {currentStep > 0 ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
                </div>
                <span className={`text-sm font-bold tracking-tight ${currentStep > 0 ? 'text-slate-400' : 'text-academic-900'}`}>
                  {!isStandardDoc ? t('generationView.coverPage') : t('generationView.frontMatter')}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  currentStep > 1 ? 'bg-emerald-500 text-white' : 
                  currentStep === 1 ? 'bg-accent text-white animate-pulse' : 
                  'bg-slate-200 text-slate-400'
                }`}>
                  {currentStep > 1 ? <CheckCircle2 size={14} /> : 
                   currentStep === 1 ? <Loader2 size={14} className="animate-spin" /> : 
                   <span className="text-[10px] font-bold">I</span>}
                </div>
                <span className={`text-sm font-bold tracking-tight ${
                  currentStep > 1 ? 'text-slate-400' : 
                  currentStep === 1 ? 'text-academic-900' : 
                  'text-slate-300'
                }`}>
                  {plan.introduction?.titre || t('generationView.generalIntro')}
                </span>
              </div>

              {plan.chapitres?.map((chap, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    currentStep > i + 2 ? 'bg-emerald-500 text-white' : 
                    currentStep === i + 2 ? 'bg-accent text-white animate-pulse' : 
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {currentStep > i + 2 ? <CheckCircle2 size={14} /> : 
                     currentStep === i + 2 ? <Loader2 size={14} className="animate-spin" /> : 
                     <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <span className={`text-sm font-bold tracking-tight ${
                    currentStep > i + 2 ? 'text-slate-400' : 
                    currentStep === i + 2 ? 'text-academic-900' : 
                    'text-slate-300'
                  }`}>
                    {chap.titre}
                  </span>
                </div>
              ))}
              
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  currentStep > plan.chapitres.length + 2 ? 'bg-emerald-500 text-white' : 
                  currentStep === plan.chapitres.length + 2 ? 'bg-accent text-white animate-pulse' : 
                  'bg-slate-200 text-slate-400'
                }`}>
                  {currentStep > plan.chapitres.length + 2 ? <CheckCircle2 size={14} /> : 
                   currentStep === plan.chapitres.length + 2 ? <Loader2 size={14} className="animate-spin" /> : 
                   <span className="text-[10px] font-bold">C</span>}
                </div>
                <span className={`text-sm font-bold tracking-tight ${
                  currentStep > plan.chapitres.length + 2 ? 'text-slate-400' : 
                  currentStep === plan.chapitres.length + 2 ? 'text-academic-900' : 
                  'text-slate-300'
                }`}>
                  {t('generationView.generalConclusion')}
                </span>
              </div>

              {hasBiblio && (
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    currentStep > plan.chapitres.length + 3 ? 'bg-emerald-500 text-white' : 
                    currentStep === plan.chapitres.length + 3 ? 'bg-accent text-white animate-pulse' : 
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {currentStep > plan.chapitres.length + 3 ? <CheckCircle2 size={14} /> : 
                     currentStep === plan.chapitres.length + 3 ? <Loader2 size={14} className="animate-spin" /> : 
                     <span className="text-[10px] font-bold">B</span>}
                  </div>
                  <span className={`text-sm font-bold tracking-tight ${
                    currentStep > plan.chapitres.length + 3 ? 'text-slate-400' : 
                    currentStep === plan.chapitres.length + 3 ? 'text-academic-900' : 
                    'text-slate-300'
                  }`}>
                    {t('generationView.bibliography')}
                  </span>
                </div>
              )}

              {hasAnnexes && (
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    currentStep > plan.chapitres.length + (hasBiblio ? 4 : 3) ? 'bg-emerald-500 text-white' : 
                    currentStep === plan.chapitres.length + (hasBiblio ? 4 : 3) ? 'bg-accent text-white animate-pulse' : 
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {currentStep > plan.chapitres.length + (hasBiblio ? 4 : 3) ? <CheckCircle2 size={14} /> : 
                     currentStep === plan.chapitres.length + (hasBiblio ? 4 : 3) ? <Loader2 size={14} className="animate-spin" /> : 
                     <span className="text-[10px] font-bold">A</span>}
                  </div>
                  <span className={`text-sm font-bold tracking-tight ${
                    currentStep > plan.chapitres.length + (hasBiblio ? 4 : 3) ? 'text-slate-400' : 
                    currentStep === plan.chapitres.length + (hasBiblio ? 4 : 3) ? 'text-academic-900' : 
                    'text-slate-300'
                  }`}>
                    {t('generationView.annexes')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {status === 'idle' && progress === 100 && (
            <div className="mt-12 md:mt-16 space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="space-y-4">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500 text-white rounded-[24px] md:rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
                  <CheckCircle2 size={40} className="md:w-12 md:h-12" />
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-academic-900">{t('generationView.writingFinished')}</h2>
                <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto">
                  {t('generationView.finishedDesc')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
                <button 
                  onClick={onViewDetail}
                  className="w-full sm:w-auto btn-primary bg-academic-900 hover:bg-academic-800 border-none px-6 md:px-10 py-4 md:py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-academic-900/10 text-xs md:text-sm"
                >
                  <Eye size={18} className="md:w-5 md:h-5" />
                  {t('generationView.viewManuscript')}
                </button>
                <button 
                  onClick={handleExportDOCX}
                  className="w-full sm:w-auto btn-secondary border-slate-200 text-slate-600 hover:bg-slate-50 px-6 md:px-10 py-4 md:py-5 rounded-2xl flex items-center justify-center gap-3 text-xs md:text-sm"
                >
                  <Download size={18} className="md:w-5 md:h-5" />
                  {t('generationView.downloadWord')}
                </button>
              </div>
              
              <button 
                onClick={onBackToDashboard}
                className="mt-6 md:mt-8 text-slate-400 hover:text-academic-900 font-bold uppercase tracking-widest text-[10px] py-2 transition-all block mx-auto"
              >
                {t('generationView.backToDashboard')}
              </button>
            </div>
          )}

          {status === 'idle' && progress === 0 && (
            <div className="space-y-8 md:space-y-12">
              <div className="max-w-2xl mx-auto bg-slate-50/50 rounded-[24px] md:rounded-[32px] p-6 md:p-10 border border-slate-100 text-left">
                <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 md:mb-6">{t('generationView.validatedPlan')}</h4>
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center gap-3 text-academic-900 font-serif font-bold text-sm md:text-base">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent shrink-0"></div>
                    {plan.introduction?.titre || t('generationView.generalIntro')}
                  </div>
                  {plan.chapitres?.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-slate-600 font-serif pl-3 md:pl-4 text-xs md:text-sm">
                      <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-slate-300 shrink-0"></div>
                      {t('generationView.chapter')} {i+1}: {c.titre}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 text-academic-900 font-serif font-bold text-sm md:text-base">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent shrink-0"></div>
                    {t('generationView.generalConclusion')}
                  </div>
                </div>
              </div>
              
              <button onClick={startGeneration} className="btn-primary w-full sm:w-auto mx-auto px-8 md:px-16 py-4 md:py-6 text-base md:text-xl shadow-2xl shadow-academic-900/20 bg-academic-900 hover:bg-academic-800 border-none rounded-2xl md:rounded-3xl">
                {t('generationView.startWriting')}
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 md:mt-12 space-y-4 md:space-y-6">
              <div className="p-4 md:p-6 bg-red-50 text-red-700 rounded-[20px] md:rounded-[24px] border border-red-100 flex flex-col sm:flex-row items-center gap-3 md:gap-4 justify-center font-bold text-xs md:text-sm text-center sm:text-left">
                <AlertCircle size={20} className="md:w-6 md:h-6 shrink-0" />
                {error}
              </div>
              <button onClick={startGeneration} className="btn-primary w-full sm:w-auto mx-auto px-8 md:px-12 py-3 md:py-4 bg-academic-900 hover:bg-academic-800 border-none rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 text-xs md:text-sm">
                <RotateCcw size={16} className="md:w-5 md:h-5" />
                {t('generationView.retryGeneration')}
              </button>
            </div>
          )}

          {status === 'generating' && (
            <div className="mt-12 md:mt-16 space-y-6 md:space-y-8">
              <div className="text-accent font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs flex items-center justify-center gap-3 md:gap-4">
                <Loader2 className="animate-spin md:w-5 md:h-5" size={16} />
                {t('generationView.writingInProgress')}
              </div>
              
              <button 
                onClick={onViewDetail}
                className="flex items-center justify-center gap-2 mx-auto text-slate-400 hover:text-academic-900 transition-colors text-xs md:text-sm font-bold"
              >
                <Eye size={14} className="md:w-4 md:h-4" />
                {t('generationView.viewInProgress')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
