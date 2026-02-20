import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ProjectWizard from './components/ProjectWizard';
import PlanEditor from './components/PlanEditor';
import GenerationView from './components/GenerationView';
import ProjectDetail from './components/ProjectDetail';
import { Project, PlanStructure } from './types';
import { generatePlan } from './services/geminiService';
import { storageService } from './services/storageService';
import { BookOpen, Sparkles } from 'lucide-react';

type View = 'dashboard' | 'wizard' | 'plan_editor' | 'generation' | 'detail';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<PlanStructure | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const handleNewProject = () => setView('wizard');

  const handleSelectProject = (id: string) => {
    const data = storageService.getProject(id);
    if (data) {
      setCurrentProject(data);
      setSelectedProjectId(id);
      if (data.status === 'draft') {
        setGeneratedPlan(JSON.parse(data.plan || '{}'));
        setView('plan_editor');
      } else if (data.status === 'plan_validated') {
        setView('generation');
      } else {
        setView('detail');
      }
    }
  };

  const handleWizardComplete = async (data: Partial<Project>) => {
    setIsGeneratingPlan(true);
    const id = Math.random().toString(36).substring(7);
    const newProject = { 
      ...data, 
      id, 
      status: 'draft', 
      created_at: new Date().toISOString() 
    } as Project;
    
    try {
      // 1. Generate Plan with Gemini
      const plan = await generatePlan(newProject);
      setGeneratedPlan(plan);
      
      // 2. Save Project to Storage
      const projectToSave = { ...newProject, plan: JSON.stringify(plan) };
      storageService.saveProject(projectToSave);

      setCurrentProject(projectToSave);
      setSelectedProjectId(id);
      setIsGeneratingPlan(false);
      setView('plan_editor');
    } catch (error) {
      console.error("Error generating plan:", error);
      setIsGeneratingPlan(false);
      alert("Erreur lors de la génération du plan. Veuillez réessayer.");
    }
  };

  const handlePlanValidate = async (updatedPlan: PlanStructure) => {
    if (!selectedProjectId) return;
    
    storageService.updateProjectPlan(selectedProjectId, updatedPlan);

    setCurrentProject(prev => prev ? { ...prev, plan: JSON.stringify(updatedPlan), status: 'plan_validated' } : null);
    setView('generation');
  };

  const handleGenerationComplete = () => {
    setView('detail');
  };

  return (
    <div className="min-h-screen bg-academic-100">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-12 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setView('dashboard')}
        >
          <div className="bg-academic-900 p-2 md:p-2.5 rounded-2xl text-white shadow-lg shadow-academic-900/20 group-hover:scale-110 transition-transform duration-500">
            <BookOpen size={22} className="md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl md:text-2xl font-serif font-bold tracking-tight text-academic-900">Bayano Académie</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent/80 -mt-1">Excellence & IA</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden lg:flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Sparkles size={14} className="text-accent animate-pulse" />
            Propulsé par Gemini 1.5 Pro
          </div>
          <div className="flex items-center gap-3 pl-4 md:pl-8 border-l border-slate-100">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-academic-900">Jean Dupont</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Chercheur</span>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-academic-900 text-white flex items-center justify-center font-serif text-lg shadow-xl shadow-academic-900/10 border border-white/10">
              JD
            </div>
          </div>
        </div>
      </nav>

      <main className="py-4 md:py-8">
        {isGeneratingPlan ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={32} />
            </div>
            <h2 className="text-3xl mb-4">Analyse de votre sujet...</h2>
            <p className="text-gray-500 max-w-md">
              Notre intelligence artificielle structure votre mémoire en respectant les normes académiques internationales.
            </p>
          </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard 
                onNewProject={handleNewProject} 
                onSelectProject={handleSelectProject} 
              />
            )}
            {view === 'wizard' && (
              <ProjectWizard 
                onCancel={() => setView('dashboard')} 
                onComplete={handleWizardComplete} 
              />
            )}
            {view === 'plan_editor' && generatedPlan && currentProject && (
              <PlanEditor 
                project={currentProject}
                plan={generatedPlan} 
                onValidate={handlePlanValidate} 
              />
            )}
            {view === 'generation' && currentProject && (
              <GenerationView 
                project={currentProject} 
                onComplete={handleGenerationComplete} 
              />
            )}
            {view === 'detail' && selectedProjectId && (
              <ProjectDetail 
                projectId={selectedProjectId} 
                onBack={() => setView('dashboard')} 
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
