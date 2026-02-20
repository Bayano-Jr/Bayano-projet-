import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Clock, ChevronRight, FileText, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { Project } from '../types';

interface DashboardProps {
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
}

export default function Dashboard({ onNewProject, onSelectProject }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl mb-2">Tableau de Bord</h1>
          <p className="text-gray-500">Gérez vos projets de mémoires académiques</p>
        </div>
        <button onClick={onNewProject} className="btn-primary">
          <Plus size={20} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -5 }}
              className="glass-card p-6 cursor-pointer group"
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-academic-100 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === 'completed' ? 'bg-green-100 text-green-700' :
                  project.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {project.status === 'completed' ? 'Terminé' :
                   project.status === 'generating' ? 'En cours' :
                   project.status === 'plan_validated' ? 'Plan validé' : 'Brouillon'}
                </span>
              </div>
              <h3 className="text-xl mb-2 line-clamp-2 h-14">{project.title}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen size={14} />
                  {project.level}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-accent font-medium flex items-center gap-1">
                  Continuer <ChevronRight size={16} />
                </span>
                {project.status === 'completed' && (
                  <Download size={18} className="text-gray-400 hover:text-academic-900" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
