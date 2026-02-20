import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileText, Download, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, PlanStructure, Chapter } from '../types';
import { generateChapterContent, generateFrontMatter } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface GenerationViewProps {
  project: Project;
  onComplete: () => void;
}

export default function GenerationView({ project, onComplete }: GenerationViewProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0: Front matter, 1+: Chapters
  const [status, setStatus] = useState<'idle' | 'generating' | 'saving' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const plan: PlanStructure = JSON.parse(project.plan || '{}');
  const totalSteps = plan.chapitres.length + 4; // Front matter + Intro + Chapters + Conclusion + Biblio

  const startGeneration = async () => {
    setStatus('generating');
    setError(null);
    
    try {
      // 1. Generate Front Matter
      setCurrentStep(0);
      const frontMatter = await generateFrontMatter(project);
      
      // Save front matter as a special chapter or metadata
      const frontMatterChapter: Chapter = {
        id: `front-${project.id}`,
        project_id: project.id,
        title: 'Éléments Préliminaires',
        content: JSON.stringify(frontMatter),
        order_index: -1,
        word_count: 500
      };
      storageService.saveChapter(frontMatterChapter);
      setChapters([frontMatterChapter]);
      setProgress((1 / totalSteps) * 100);

      // 2. Generate Introduction
      setCurrentStep(1);
      const introContent = await generateChapterContent(project, plan, plan.introduction.titre, "");
      const introChapter: Chapter = {
        id: `${project.id}-intro`,
        project_id: project.id,
        title: plan.introduction.titre,
        content: introContent,
        order_index: 0,
        word_count: introContent.split(/\s+/).length
      };
      storageService.saveChapter(introChapter);
      setChapters(prev => [...prev, introChapter]);
      setTotalWords(prev => prev + introChapter.word_count);
      let context = `Résumé de l'introduction: ${introContent.substring(0, 500)}...\n`;
      setProgress((2 / totalSteps) * 100);

      // 3. Generate Chapters sequentially
      for (let i = 0; i < plan.chapitres.length; i++) {
        const chapTitle = plan.chapitres[i].titre;
        setCurrentStep(i + 2);
        setProgress(((i + 3) / totalSteps) * 100);

        const content = await generateChapterContent(project, plan, chapTitle, context);
        const wordCount = content.split(/\s+/).length;
        
        const chapterData: Chapter = {
          id: `${project.id}-ch-${i}`,
          project_id: project.id,
          title: chapTitle,
          content: content,
          order_index: i + 1,
          word_count: wordCount
        };

        storageService.saveChapter(chapterData);

        setChapters(prev => [...prev, chapterData]);
        setTotalWords(prev => prev + wordCount);
        context += `\nRésumé du chapitre ${i+1}: ${content.substring(0, 500)}...\n`;
      }

      // 4. Generate Conclusion
      setCurrentStep(plan.chapitres.length + 2);
      const conclusionContent = await generateChapterContent(project, plan, "CONCLUSION GÉNÉRALE", context);
      const conclusionChapter: Chapter = {
        id: `${project.id}-conclusion`,
        project_id: project.id,
        title: 'CONCLUSION GÉNÉRALE',
        content: conclusionContent,
        order_index: 999,
        word_count: conclusionContent.split(/\s+/).length
      };
      storageService.saveChapter(conclusionChapter);
      setChapters(prev => [...prev, conclusionChapter]);
      setProgress(((plan.chapitres.length + 3) / totalSteps) * 100);

      // 5. Generate Bibliography (Detailed)
      setCurrentStep(plan.chapitres.length + 3);
      const biblioContent = await generateChapterContent(project, plan, "BIBLIOGRAPHIE DÉTAILLÉE", context);
      const biblioChapter: Chapter = {
        id: `${project.id}-biblio`,
        project_id: project.id,
        title: 'BIBLIOGRAPHIE DÉTAILLÉE',
        content: biblioContent,
        order_index: 1000,
        word_count: biblioContent.split(/\s+/).length
      };
      storageService.saveChapter(biblioChapter);
      setChapters(prev => [...prev, biblioChapter]);
      setProgress(100);

      // Update project status to completed
      const updatedProject = { ...project, status: 'completed' as const };
      storageService.saveProject(updatedProject);

      setStatus('idle');
      onComplete();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de la génération.");
      setStatus('error');
    }
  };

  const estimatedPages = Math.round(totalWords / 300);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-12 py-8 md:py-20">
      <div className="glass-card p-8 md:p-20 text-center">
        <div className="w-20 h-20 bg-academic-900 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-academic-900/20">
          <Sparkles className="text-white animate-pulse" size={32} />
        </div>
        <h2 className="text-4xl md:text-6xl mb-6 font-serif font-medium tracking-tight">Rédaction en cours</h2>
        <p className="text-lg text-slate-500 mb-16 font-serif italic max-w-xl mx-auto">
          Bayano Académie orchestre la rédaction de votre mémoire. 
          Chaque chapitre est ciselé pour répondre aux plus hautes exigences académiques.
        </p>

        <div className="mb-20">
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-4 text-slate-400">
            <span>Progression de l'œuvre</span>
            <span className="text-accent">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-accent shadow-[0_0_15px_rgba(180,83,9,0.4)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-20">
          <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
            <div className="text-slate-300 text-[10px] mb-2 uppercase tracking-[0.2em] font-bold">Volume de l'ouvrage</div>
            <div className="text-4xl font-serif text-academic-900">{estimatedPages} <span className="text-lg text-slate-400">/ {project.min_pages} pages</span></div>
          </div>
          <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
            <div className="text-slate-300 text-[10px] mb-2 uppercase tracking-[0.2em] font-bold">Mots rédigés</div>
            <div className="text-4xl font-serif text-academic-900">{totalWords.toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-4 text-left max-w-md mx-auto mb-12">
          <div className="flex items-center gap-3">
            {currentStep > 0 ? <CheckCircle2 className="text-green-500" size={20} /> : <Loader2 className="text-accent animate-spin" size={20} />}
            <span className={currentStep > 0 ? "text-gray-400" : "font-medium"}>Éléments techniques (Page de garde, Résumé...)</span>
          </div>
          {plan.chapitres.map((chap, i) => (
            <div key={i} className="flex items-center gap-3">
              {currentStep > i + 1 ? (
                <CheckCircle2 className="text-green-500" size={20} />
              ) : currentStep === i + 1 ? (
                <Loader2 className="text-accent animate-spin" size={20} />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
              )}
              <span className={currentStep > i + 1 ? "text-gray-400" : currentStep === i + 1 ? "font-medium" : "text-gray-300"}>
                {chap.titre}
              </span>
            </div>
          ))}
        </div>

        {status === 'idle' && progress === 0 && (
          <button onClick={startGeneration} className="btn-primary mx-auto px-12 py-4 text-lg">
            Lancer la génération complète
          </button>
        )}

        {status === 'error' && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl mb-6 flex items-center gap-3 justify-center">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {status === 'generating' && (
          <div className="text-accent font-medium flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" />
            Rédaction en cours... Ne fermez pas cette page.
          </div>
        )}
      </div>
    </div>
  );
}
