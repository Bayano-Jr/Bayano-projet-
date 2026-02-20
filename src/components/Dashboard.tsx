import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Clock, ChevronRight, FileText, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { Project } from '../types';
import { storageService } from '../services/storageService';

interface DashboardProps {
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
}

export default function Dashboard({ onNewProject, onSelectProject }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = storageService.getProjects();
    setProjects(data);
    setLoading(false);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-12 py-8 md:py-16">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12 md:mb-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-6xl mb-4 font-serif font-medium tracking-tight">Vos Travaux Académiques</h1>
          <p className="text-lg text-slate-500 font-serif italic">Gérez et rédigez vos mémoires avec la précision de l'intelligence artificielle.</p>
        </div>
        <button onClick={onNewProject} className="btn-primary w-full lg:w-auto group">
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
          Nouveau Projet
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-academic-900"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl mb-4">Aucun projet pour le moment</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Commencez par créer votre premier projet de mémoire. Notre IA vous accompagnera de la structure à la rédaction finale.
          </p>
          <button onClick={onNewProject} className="btn-primary mx-auto">
            Créer mon premier mémoire
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -8 }}
              className="glass-card p-8 cursor-pointer group flex flex-col h-full"
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl text-accent flex items-center justify-center group-hover:bg-academic-900 group-hover:text-white transition-all duration-500 shadow-inner">
                  <FileText size={24} />
                </div>
                <span className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full font-bold border ${
                  project.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  project.status === 'generating' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-slate-50 text-slate-600 border-slate-100'
                }`}>
                  {project.status === 'completed' ? 'Terminé' :
                   project.status === 'generating' ? 'Rédaction' :
                   project.status === 'plan_validated' ? 'Plan Prêt' : 'Brouillon'}
                </span>
              </div>
              
              <h3 className="text-2xl mb-4 font-serif font-semibold text-academic-900 line-clamp-2 leading-tight flex-1">
                {project.title}
              </h3>
              
              <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-accent/60" />
                  {new Date(project.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-accent/60" />
                  {project.level}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <span className="text-academic-900 font-bold text-sm uppercase tracking-widest flex items-center gap-2 group-hover:text-accent transition-colors">
                  Ouvrir le projet <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
                {project.status === 'completed' && (
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-academic-900 hover:bg-slate-100 transition-all">
                    <Download size={18} />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
