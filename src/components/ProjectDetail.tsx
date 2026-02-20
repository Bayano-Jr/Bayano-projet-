import React, { useState, useEffect } from 'react';
import { Download, FileText, ArrowLeft, Eye, Edit3 } from 'lucide-react';
import { Project, Chapter } from '../types';
import Markdown from 'react-markdown';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<number>(-1); // -1 for front matter

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProject(data);
        setLoading(false);
      });
  }, [projectId]);

  const handleExport = async () => {
    if (!project) return;
    const response = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: project.title,
        chapters: project.chapters,
        metadata: project
      })
    });
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading || !project) return <div className="p-20 text-center">Chargement...</div>;

  const currentChapter = activeChapter === -1 
    ? project.chapters?.find(c => c.order_index === -1)
    : project.chapters?.find(c => c.order_index === activeChapter);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-academic-100">
        <div className="p-6 border-b border-gray-200">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-academic-900 mb-6 text-sm">
            <ArrowLeft size={16} />
            Retour
          </button>
          <h2 className="text-xl font-serif line-clamp-2">{project.title}</h2>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <button 
            onClick={() => setActiveChapter(-1)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${activeChapter === -1 ? 'bg-white shadow-sm font-bold text-accent' : 'hover:bg-white/50 text-gray-600'}`}
          >
            Éléments Préliminaires
          </button>
          {project.chapters?.filter(c => c.order_index >= 0).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChapter(ch.order_index)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${activeChapter === ch.order_index ? 'bg-white shadow-sm font-bold text-accent' : 'hover:bg-white/50 text-gray-600'}`}
            >
              {ch.title}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-200">
          <button onClick={handleExport} className="btn-primary w-full justify-center">
            <Download size={18} />
            Exporter en DOCX
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-12">
        <div className="max-w-3xl mx-auto bg-white shadow-2xl p-16 min-h-full rounded-sm border border-gray-200">
          {currentChapter ? (
            <div className="prose prose-slate max-w-none markdown-body">
              <h1 className="text-3xl font-serif mb-8 pb-4 border-b border-gray-100">{currentChapter.title}</h1>
              {activeChapter === -1 ? (
                <div className="space-y-12">
                  {/* Render front matter fields */}
                  {(() => {
                    try {
                      const fm = JSON.parse(currentChapter.content);
                      return (
                        <>
                          <section>
                            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Page de Garde</h2>
                            <div className="whitespace-pre-wrap font-serif text-center border p-8 bg-gray-50">{fm.page_de_garde}</div>
                          </section>
                          {fm.dedicace && (
                            <section>
                              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Dédicace</h2>
                              <p className="italic text-right italic">{fm.dedicace}</p>
                            </section>
                          )}
                          {fm.remerciements && (
                            <section>
                              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Remerciements</h2>
                              <p>{fm.remerciements}</p>
                            </section>
                          )}
                          <section>
                            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Résumé</h2>
                            <p>{fm.resume_fr}</p>
                          </section>
                          <section>
                            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Abstract</h2>
                            <p className="italic">{fm.abstract_en}</p>
                          </section>
                          {fm.sigles && fm.sigles.length > 0 && (
                            <section>
                              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4">Liste des Sigles</h2>
                              <ul className="grid grid-cols-2 gap-2">
                                {fm.sigles.map((s: string, i: number) => (
                                  <li key={i} className="text-sm font-mono">{s}</li>
                                ))}
                              </ul>
                            </section>
                          )}
                        </>
                      );
                    } catch {
                      return <p>Erreur de lecture des données.</p>;
                    }
                  })()}
                </div>
              ) : (
                <Markdown>{currentChapter.content}</Markdown>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <FileText size={64} className="mx-auto mb-4 opacity-20" />
              <p>Sélectionnez un chapitre pour l'afficher</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
