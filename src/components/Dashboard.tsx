import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Clock, ArrowRight, FileText, Download, Sparkles, RotateCcw, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';
import { storageService } from '../services/storageService';
import AcademicGuide from './AcademicGuide';

interface DashboardProps {
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
  onSessionError?: () => void;
}

export default function Dashboard({ onNewProject, onSelectProject, onSessionError }: DashboardProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const loadProjects = async (retries = 0) => {
    try {
      setLoading(true);
      const data = await storageService.getProjects();
      setProjects(data);
      setError(null);
    } catch (err: any) {
      console.error("Dashboard load error details:", {
        message: err.message,
        stack: err.stack,
        retries
      });
      
      if (err.message.includes("Non autorisé") && retries < 2) {
        // Small delay and retry once for potential race conditions
        const delay = retries === 0 ? 1000 : 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadProjects(retries + 1);
      }

      setError(err.message || "Impossible de charger vos projets.");
      if (err.message.includes("Non autorisé") && onSessionError) {
        onSessionError();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [onSessionError]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-12 py-8 md:py-16">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 md:gap-8 mb-10 md:mb-16">
        <div className="max-w-3xl w-full">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-accent font-bold uppercase tracking-[0.3em] text-[10px] mb-4"
          >
            <Sparkles size={12} />
            {t('dashboard.welcome')}
          </motion.div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl mb-4 md:mb-6 font-serif font-medium tracking-tight leading-[0.9] flex items-center gap-4 md:gap-6 flex-wrap">
            <span>
              {t('dashboard.recentProjects')}
            </span>
            <button 
              onClick={() => loadProjects()}
              className="p-2 md:p-3 hover:bg-slate-50 rounded-2xl text-slate-200 hover:text-academic-900 transition-all group"
              title="Actualiser la liste"
            >
              <RotateCcw size={20} className={`md:w-6 md:h-6 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-all duration-700`} />
            </button>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-serif italic max-w-xl">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 md:gap-4 flex-wrap justify-start lg:justify-end">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsGuideOpen(true)} 
            className="bg-white border border-slate-200 text-academic-900 hover:bg-slate-50 w-full sm:w-auto group py-3 md:py-4 px-4 md:px-6 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-medium transition-all shadow-sm text-sm md:text-base"
          >
            <BookOpen size={18} className="text-accent md:w-5 md:h-5" />
            {t('project.guide')}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewProject} 
            className="btn-primary w-full sm:w-auto group py-3 md:py-4 px-6 md:px-8 text-base md:text-lg shadow-2xl shadow-academic-900/20"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500 md:w-6 md:h-6" />
            {t('dashboard.newProject')}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const btn = document.querySelector('button[title="Assistant IA"]') as HTMLButtonElement;
              if (btn) btn.click();
              else window.dispatchEvent(new CustomEvent('open-chat'));
            }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 w-full sm:w-auto group py-3 md:py-4 px-4 md:px-6 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-medium transition-all shadow-sm text-sm md:text-base"
          >
            <Sparkles size={18} className="text-emerald-600 md:w-5 md:h-5" />
            {t('dashboard.chat')}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const btn = document.querySelector('button[title="Anti-Plagiat"]') as HTMLButtonElement;
              if (btn) btn.click();
            }}
            className="bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 w-full sm:w-auto group py-3 md:py-4 px-4 md:px-6 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-medium transition-all shadow-lg shadow-slate-900/20 text-sm md:text-base"
          >
            <Search size={18} className="text-slate-300 md:w-5 md:h-5" />
            Anti-Plagiat
          </motion.button>
        </div>
      </header>

      <AcademicGuide 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-academic-900 mb-4"></div>
          <p className="text-slate-400 font-serif italic">Chargement de votre bibliothèque...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-12 text-center border-red-100 bg-red-50/30">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
            <Clock size={40} />
          </div>
          <h2 className="text-2xl mb-4 text-red-900">Erreur de chargement</h2>
          <p className="text-red-600 mb-8 max-w-md mx-auto">{error}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => window.location.reload()} className="btn-primary bg-red-600 hover:bg-red-700">
              Réessayer
            </button>
            {error.includes("reconnecter") && (
              <button 
                onClick={() => onSessionError?.()} 
                className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
              >
                Se reconnecter
              </button>
            )}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl mb-4">{t('dashboard.noProjects')}</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            {t('dashboard.startFirst')}
          </p>
          <button onClick={onNewProject} className="btn-primary mx-auto">
            {t('dashboard.newProject')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: projects.indexOf(project) * 0.1 }}
              whileHover={{ y: -12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}
              className="bg-white rounded-[32px] p-10 cursor-pointer group flex flex-col h-full border border-slate-100 hover:border-accent/20 transition-all duration-500 shadow-sm"
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 bg-slate-50 rounded-[24px] text-academic-900 flex items-center justify-center group-hover:bg-academic-900 group-hover:text-white transition-all duration-500 shadow-inner">
                  <FileText size={28} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] uppercase tracking-widest px-4 py-2 rounded-full font-bold border ${
                    project.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    project.status === 'generating' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {project.status === 'completed' ? 'Terminé' :
                     project.status === 'generating' ? 'Rédaction' :
                     project.status === 'plan_validated' ? 'Plan Prêt' : 'Brouillon'}
                  </span>
                </div>
              </div>
              
              <h3 className="text-3xl mb-6 font-serif font-semibold text-academic-900 line-clamp-2 leading-[1.1] flex-1 group-hover:text-accent transition-colors">
                {project.title}
              </h3>

              <div className="flex items-center justify-between mt-4 pt-6 border-t border-slate-50">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-accent font-bold text-xs group-hover:translate-x-1 transition-transform">
                  Consulter <ArrowRight size={14} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Date</span>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Clock size={14} className="text-accent" />
                    {new Date(project.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Niveau</span>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <BookOpen size={14} className="text-accent" />
                    {project.level}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                <span className="text-academic-900 font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-2 group-hover:text-accent transition-colors">
                  Continuer <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </span>
                {project.status === 'completed' && (
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-academic-900 transition-all shadow-sm"
                  >
                    <Download size={20} />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
