import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ProjectWizard from './components/ProjectWizard';
import PlanEditor from './components/PlanEditor';
import GenerationView from './components/GenerationView';
import ProjectDetail from './components/ProjectDetail';
import { Project, PlanStructure } from './types';
import { generatePlan } from './services/geminiService';
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
    fetch(`/api/projects/${id}`)
      .then(res => res.json())
      .then(data => {
        setCurrentProject(data);
        setSelectedProjectId(id);
        if (data.status === 'draft') {
          // If it's a draft but has no plan, we might need to regenerate or it shouldn't happen
          // For now, if it's a draft, we assume we need to validate the plan
          setGeneratedPlan(JSON.parse(data.plan || '{}'));
          setView('plan_editor');
        } else if (data.status === 'plan_validated') {
          setView('generation');
        } else {
          setView('detail');
        }
      });
  };

  const handleWizardComplete = async (data: Partial<Project>) => {
    setIsGeneratingPlan(true);
    const id = Math.random().toString(36).substring(7);
    const newProject = { ...data, id } as Project;
    
    try {
      // 1. Generate Plan with Gemini
      const plan = await generatePlan(newProject);
      setGeneratedPlan(plan);
      
      // 2. Save Project to DB
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProject, plan: JSON.stringify(plan) })
      });

      setCurrentProject({ ...newProject, plan: JSON.stringify(plan), status: 'draft', created_at: new Date().toISOString() });
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
    
    await fetch(`/api/projects/${selectedProjectId}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: updatedPlan })
    });

    setCurrentProject(prev => prev ? { ...prev, plan: JSON.stringify(updatedPlan), status: 'plan_validated' } : null);
    setView('generation');
  };

  const handleGenerationComplete = () => {
    setView('detail');
  };

  return (
    <div className="min-h-screen bg-academic-100">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView('dashboard')}
        >
          <div className="bg-academic-900 p-2 rounded-lg text-white">
            <BookOpen size={24} />
          </div>
          <span className="text-2xl font-serif font-bold tracking-tight">AcademiaGen</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <Sparkles size={16} className="text-accent" />
            Propulsé par Gemini 1.5 Pro
          </div>
          <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent">
            JD
          </div>
        </div>
      </nav>

      <main className="py-8">
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
            {view === 'plan_editor' && generatedPlan && (
              <PlanEditor 
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
