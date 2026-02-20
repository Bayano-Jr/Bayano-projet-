import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileText, Download, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, PlanStructure, Chapter } from '../types';
import { generateChapterContent, generateFrontMatter } from '../services/geminiService';

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
  const totalSteps = plan.chapitres.length + 1; // Front matter + Chapters

  const startGeneration = async () => {
    setStatus('generating');
    setError(null);
    
    try {
      // 1. Generate Front Matter
      setCurrentStep(0);
      const frontMatter = await generateFrontMatter(project);
      
      // Save front matter as a special chapter or metadata
      await fetch(`/api/projects/${project.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `front-${project.id}`,
          title: 'Éléments Préliminaires',
          content: JSON.stringify(frontMatter),
          order_index: -1,
          word_count: 500
        })
      });

      // 2. Generate Chapters sequentially
      let context = "";
      for (let i = 0; i < plan.chapitres.length; i++) {
        const chapTitle = plan.chapitres[i].titre;
        setCurrentStep(i + 1);
        setProgress(((i + 1) / totalSteps) * 100);

        const content = await generateChapterContent(project, plan, chapTitle, context);
        const wordCount = content.split(/\s+/).length;
        
        const chapterData = {
          id: `${project.id}-ch-${i}`,
          title: chapTitle,
          content: content,
          order_index: i,
          word_count: wordCount
        };

        await fetch(`/api/projects/${project.id}/chapters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chapterData)
        });

        setChapters(prev => [...prev, chapterData as Chapter]);
        setTotalWords(prev => prev + wordCount);
        context += `\nRésumé du chapitre ${i+1}: ${content.substring(0, 500)}...\n`;
      }

      // 3. Generate Conclusion
      // (Simplified for this demo, could be another step)

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
    <div className="max-w-4xl mx-auto p-8">
      <div className="glass-card p-10 text-center">
        <h2 className="text-3xl mb-4">Rédaction du Mémoire</h2>
        <p className="text-gray-500 mb-10">
          Gemini rédige actuellement votre mémoire en respectant les normes académiques. 
          Cette opération peut prendre plusieurs minutes.
        </p>

        <div className="mb-12">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progression globale</span>
            <span className="text-accent font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider font-bold">Volume estimé</div>
            <div className="text-3xl font-serif">{estimatedPages} / {project.min_pages} pages</div>
          </div>
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider font-bold">Mots générés</div>
            <div className="text-3xl font-serif">{totalWords.toLocaleString()}</div>
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
