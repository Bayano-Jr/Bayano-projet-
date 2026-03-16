import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, FileText, ArrowLeft, Eye, Edit3, Sparkles, Send, X, Check, RotateCcw, Loader2, Menu, FileDown, Printer, BookOpen, AlertTriangle, Search } from 'lucide-react';
import { Project, Chapter, User as UserType } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ExportModal, { ExportOptions } from './ExportModal';
import AcademicGuide from './AcademicGuide';
import CitationManager from './CitationManager';
import { storageService } from '../services/storageService';
import { refineContent, verifySource } from '../services/geminiService';
import { exportToDOCX, exportToPDF, downloadDOCX } from '../services/exportService';
import { useTranslation } from 'react-i18next';
import { convertDocxToHtml } from '../utils/docxUtils';
import { useAlert } from '../contexts/AlertContext';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onSessionError?: () => void;
  user: UserType | null;
  onUpdateUser: (user: UserType) => void;
  onShowPricing: () => void;
}

export default function ProjectDetail({ projectId, onBack, onSessionError, user, onUpdateUser, onShowPricing }: ProjectDetailProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [project, setProject] = useState<(Project & { chapters: Chapter[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<number>(0); // 0 for introduction, -1 for front matter
  
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefiningLoading, setIsRefiningLoading] = useState(false);
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCitationManagerOpen, setIsCitationManagerOpen] = useState(false);
  const [selectedFootnote, setSelectedFootnote] = useState<{id: string, text: string} | null>(null);
  const [isVerifyingFootnote, setIsVerifyingFootnote] = useState(false);
  const [footnoteVerification, setFootnoteVerification] = useState<any>(null);
  const [wordPreviewHtml, setWordPreviewHtml] = useState<string | null>(null);
  const [isWordPreviewLoading, setIsWordPreviewLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [isEditingWordPreview, setIsEditingWordPreview] = useState(false);
  const [isSavingWordPreview, setIsSavingWordPreview] = useState(false);
  const wordPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsEditing(false);
    setIsEditingWordPreview(false);
  }, [activeChapter]);

  useEffect(() => {
    const loadProject = async (retries = 0) => {
      try {
        setLoading(true);
        setError(null);
        const data = await storageService.getProject(projectId);
        if (data) {
          setProject(data);
          // Default view logic
          if (!data.chapters || data.chapters.length === 0) {
            setActiveChapter(-3); // Plan view if empty
          } else if (activeChapter === 0) {
            setActiveChapter(-2); // Default to "All" view if chapters exist
          }
        } else {
          setError(t('projectDetail.notFound'));
        }
      } catch (err: any) {
        console.error("ProjectDetail load error:", err);
        
        if (err.message.includes("Non autorisé") && retries < 2) {
          const delay = retries === 0 ? 1000 : 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return loadProject(retries + 1);
        }

        setError(t('projectDetail.connectionError'));
        if (err.message.includes("Non autorisé") && onSessionError) {
          onSessionError();
        }
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId, onSessionError]);

  const getPlan = () => {
    try {
      return JSON.parse(project.plan || '{}');
    } catch {
      return {};
    }
  };

  const handlePrint = async () => {
    // If not in global view, switch to it temporarily
    const wasGlobal = activeChapter === -2;
    if (!wasGlobal) {
      setActiveChapter(-2);
      // Wait for React to render the global view
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    window.print();
    
    // Restore previous view if we changed it
    if (!wasGlobal) {
      setActiveChapter(activeChapter);
    }
  };

  useEffect(() => {
    let interval: any;
    if (project?.status === 'generating') {
      interval = setInterval(async () => {
        const data = await storageService.getProject(projectId);
        if (data) {
          setProject(data);
        }
      }, 3000); // Faster polling
    }
    return () => clearInterval(interval);
  }, [project?.status, projectId]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Small delay to show user something is happening
      await new Promise(resolve => setTimeout(resolve, 500));
      const data = await storageService.getProject(projectId);
      if (data) {
        setProject(data);
        // Default view logic
        if (!data.chapters || data.chapters.length === 0) {
          setActiveChapter(-3); // Plan view if empty
        } else if (activeChapter === 0) {
          setActiveChapter(-2); // Default to "All" view if chapters exist
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (options: ExportOptions = {
    includeTitlePage: true,
    includeTableOfContents: true,
    includeBibliography: true,
    includeAnnexes: true
  }) => {
    if (!project) return;
    
    if (!project.chapters || project.chapters.length === 0) {
      showAlert({ message: t('projectDetail.noChaptersExport'), type: 'warning' });
      return;
    }
    
    await downloadDOCX(project, options);
  };

  const handleDownloadStoredWord = () => {
    if (!project?.docx_data) {
      showAlert({ message: t('projectDetail.noStoredWord'), type: 'warning' });
      return;
    }

    try {
      const byteCharacters = atob(project.docx_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_Final.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading stored Word:", err);
      showAlert({ message: t('projectDetail.downloadError'), type: 'error' });
    }
  };

  const handlePreviewWord = async () => {
    if (!project?.docx_data) {
      showAlert({ message: t('projectDetail.noWordPreview'), type: 'warning' });
      return;
    }

    setIsWordPreviewLoading(true);
    try {
      const byteCharacters = atob(project.docx_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const arrayBuffer = byteArray.buffer;

      try {
        const html = await convertDocxToHtml(arrayBuffer);
        setWordPreviewHtml(html);
        setActiveChapter(-4); // -4 for Word Preview
      } catch (docxErr: any) {
        console.error("Docx error:", docxErr);
        throw new Error("Erreur lors de la lecture du fichier DOCX.");
      }
    } catch (err) {
      console.error("Mammoth conversion error:", err);
      showAlert({ message: t('projectDetail.previewError'), type: 'error' });
    } finally {
      setIsWordPreviewLoading(false);
    }
  };

  const handleExportPDF = async (options: ExportOptions = {
    includeTitlePage: true,
    includeTableOfContents: true,
    includeBibliography: true,
    includeAnnexes: true
  }) => {
    if (!project) return;
    
    // If not in global view, switch to it temporarily
    const wasGlobal = activeChapter === -2;
    if (!wasGlobal) {
      setActiveChapter(-2);
      // Wait for React to render the global view
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      await exportToPDF(project, 'manuscript-content');
    } catch (err: any) {
      showAlert({ message: err.message || "L'exportation PDF a échoué.", type: 'error' });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <div className="w-16 h-16 border-4 border-academic-900/20 border-t-academic-900 rounded-full animate-spin mb-6"></div>
      <p className="text-xl font-serif italic text-slate-400">{t('projectDetail.projectLoading')}</p>
    </div>
  );

  if (error || !project) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-10 text-center">
      <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 max-w-md">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
          <X size={40} />
        </div>
        <h2 className="text-3xl font-serif font-bold mb-4 text-academic-900">{t('projectDetail.projectError')}</h2>
        <p className="text-slate-500 mb-10 leading-relaxed">{error || t('projectDetail.notFound')}</p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary w-full justify-center py-5 rounded-2xl flex items-center gap-2"
          >
            <RotateCcw size={18} />
            {t('projectDetail.refresh')}
          </button>
          <button onClick={onBack} className="text-slate-400 hover:text-academic-900 font-bold uppercase tracking-widest text-[10px] py-2">
            {t('projectDetail.backToDashboard')}
          </button>
        </div>
      </div>
    </div>
  );

  const currentChapter = activeChapter === -1 
    ? project.chapters?.find(c => c.order_index === -1)
    : project.chapters?.find(c => c.order_index === activeChapter);

  const handleRefine = async () => {
    if (!project || !currentChapter || !refinePrompt.trim()) return;
    if (!user) return;

    if (user.credits < 1) {
      onShowPricing();
      return;
    }
    
    setIsRefiningLoading(true);
    try {
      // Deduct credits
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      const deductRes = await fetch('/api/saas/deduct', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: 1, description: `Modification contenu IA: ${project.title.substring(0, 20)}...` }),
        credentials: 'include'
      });
      
      if (deductRes.ok) {
        const deductData = await deductRes.json();
        onUpdateUser({ ...user, credits: deductData.remainingCredits });
      } else {
        console.error("Erreur de déduction de crédits");
        showAlert({ message: "Erreur de déduction de crédits", type: 'error' });
        setIsRefiningLoading(false);
        return;
      }

      const result = await refineContent(project, currentChapter.content, refinePrompt);
      setRefinedContent(result);
    } catch (error) {
      console.error("Refinement error:", error);
      showAlert({ message: t('projectDetail.refineError'), type: 'error' });
    } finally {
      setIsRefiningLoading(false);
    }
  };

  const applyRefinement = async () => {
    if (!project || !currentChapter || !refinedContent) return;
    
    const updatedChapter = { ...currentChapter, content: refinedContent };
    await storageService.saveChapter(updatedChapter);
    
    // Update local state
    setProject({
      ...project,
      chapters: project.chapters.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch)
    });
    
    cancelRefinement();
  };

  const cancelRefinement = () => {
    setIsRefining(false);
    setRefinePrompt("");
    setRefinedContent(null);
  };

  const handleSaveEdit = async () => {
    if (!project || !currentChapter) return;
    setIsSavingEdit(true);
    try {
      const updatedChapter = { ...currentChapter, content: editContent };
      await storageService.saveChapter(updatedChapter);
      setProject({
        ...project,
        chapters: project.chapters.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch)
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving edit:", err);
      showAlert({ message: t('projectDetail.saveError'), type: 'error' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleFootnoteClick = async (href: string) => {
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      // Extract text content, removing the return link character (usually ↩)
      const text = element.innerText.replace('↩', '').trim();
      setSelectedFootnote({ id, text });
      setFootnoteVerification(null);
      setIsVerifyingFootnote(true);
      
      try {
        const projectContext = project ? `Sujet: ${project.title}, Domaine: ${project.field}, Type: ${project.documentType}` : '';
        const result = await verifySource(text, projectContext);
        setFootnoteVerification(result);
      } catch (error) {
        console.error("Error verifying footnote:", error);
      } finally {
        setIsVerifyingFootnote(false);
      }
    }
  };

  const handleSaveWordPreview = async () => {
    if (!project || !wordPreviewRef.current) return;
    setIsSavingWordPreview(true);
    try {
      const html = wordPreviewRef.current.innerHTML;
      const newDocxData = await storageService.saveWordPreview(project.id, html);
      setProject({ ...project, docx_data: newDocxData });
      setWordPreviewHtml(html);
      setIsEditingWordPreview(false);
    } catch (err) {
      console.error("Error saving word preview:", err);
      showAlert({ message: t('projectDetail.saveError'), type: 'error' });
    } finally {
      setIsSavingWordPreview(false);
    }
  };

  return (
    <div className="flex h-screen bg-white relative overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 w-80 border-r border-slate-100 flex flex-col bg-white z-50 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-10 border-b border-slate-50">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="flex items-center gap-3 text-slate-400 hover:text-academic-900 text-[10px] font-bold uppercase tracking-[0.2em] group transition-all">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                {t('projectDetail.backToDashboard')}
              </button>
              <button 
                onClick={handleRefresh}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-accent transition-all"
                title={t('projectDetail.refresh')}
              >
                <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-50 rounded-xl text-slate-400">
              <X size={20} />
            </button>
          </div>
          <h2 className="text-2xl font-serif font-bold leading-[1.1] text-academic-900 line-clamp-3">{project.title}</h2>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('projectDetail.status')}: {project.status === 'completed' ? t('projectDetail.completed') : project.status === 'generating' ? t('projectDetail.generating') : t('projectDetail.draft')}
          </div>
          
          {project.docx_data && (
            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={handlePreviewWord}
                disabled={isWordPreviewLoading}
                className={`w-full py-3 rounded-xl text-[10px] transition-all duration-500 flex items-center justify-center gap-2 ${activeChapter === -4 ? 'bg-accent text-white shadow-lg font-bold' : 'bg-accent/10 hover:bg-accent/20 text-accent font-bold border border-accent/20'}`}
              >
                {isWordPreviewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                {t('projectDetail.wordPreview')}
              </button>
              <button 
                onClick={handleDownloadStoredWord}
                className="w-full py-3 rounded-xl text-[10px] transition-all duration-500 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase tracking-widest shadow-lg"
              >
                <FileDown size={14} />
                {t('projectDetail.downloadStoredWord')}
              </button>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto p-8 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-300 mb-6 px-4">{t('projectDetail.planTitle')}</div>
          
          <button 
            onClick={() => { setActiveChapter(-2); setIsSidebarOpen(false); }}
            className={`w-full text-left px-6 py-5 rounded-2xl text-sm transition-all duration-500 flex items-center gap-4 mb-4 ${activeChapter === -2 ? 'bg-academic-900 shadow-2xl shadow-academic-900/20 font-bold text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-100'}`}
          >
            <Eye size={18} className={activeChapter === -2 ? 'text-accent' : 'text-emerald-500'} />
            {t('projectDetail.globalView')}
          </button>

          <button 
            onClick={() => { setActiveChapter(-3); setIsSidebarOpen(false); }}
            className={`w-full text-left px-6 py-5 rounded-2xl text-sm transition-all duration-500 flex items-center gap-4 ${activeChapter === -3 ? 'bg-academic-900 shadow-2xl shadow-academic-900/20 font-bold text-white' : 'hover:bg-slate-50 text-slate-500 font-medium'}`}
          >
            <div className={`w-2 h-2 rounded-full ${activeChapter === -3 ? 'bg-accent' : 'bg-slate-200'}`} />
            {t('projectDetail.planView')}
          </button>
          <button 
            onClick={() => { setActiveChapter(-1); setIsSidebarOpen(false); }}
            className={`w-full text-left px-6 py-5 rounded-2xl text-sm transition-all duration-500 flex items-center gap-4 ${activeChapter === -1 ? 'bg-academic-900 shadow-2xl shadow-academic-900/20 font-bold text-white' : 'hover:bg-slate-50 text-slate-500 font-medium'}`}
          >
            <div className={`w-2 h-2 rounded-full ${activeChapter === -1 ? 'bg-accent' : 'bg-slate-200'}`} />
            {t('projectDetail.frontMatter')}
          </button>
          {project.chapters?.filter(c => c.order_index >= 0).sort((a, b) => a.order_index - b.order_index).map((ch) => (
            <button
              key={ch.id}
              onClick={() => { setActiveChapter(ch.order_index); setIsSidebarOpen(false); }}
              className={`w-full text-left px-6 py-5 rounded-2xl text-sm transition-all duration-500 flex items-center gap-4 ${activeChapter === ch.order_index ? 'bg-academic-900 shadow-2xl shadow-academic-900/20 font-bold text-white' : 'hover:bg-slate-50 text-slate-500 font-medium'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeChapter === ch.order_index ? 'bg-accent' : 'bg-slate-200'}`} />
              {ch.title}
            </button>
          ))}
          <div className="h-px bg-slate-100 my-4"></div>
        </nav>

        <div className="p-10 border-t border-slate-50 bg-slate-50/30 space-y-3">
          <button 
            onClick={() => setIsGuideOpen(true)}
            className="bg-accent/10 hover:bg-accent/20 text-accent w-full justify-center py-4 rounded-2xl border-none flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-all mb-4"
          >
            <BookOpen size={16} />
            {t('projectDetail.academicGuide')}
          </button>
          
          <button 
            onClick={() => setIsCitationManagerOpen(true)}
            className="bg-academic-900/10 hover:bg-academic-900/20 text-academic-900 w-full justify-center py-4 rounded-2xl border-none flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-all mb-4"
          >
            <FileText size={16} />
            Citations & Sources
          </button>
          
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-academic-900 hover:bg-academic-800 text-white w-full justify-center py-5 rounded-2xl shadow-2xl shadow-academic-900/20 border-none flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-all"
          >
            <Download size={18} />
            {t('projectDetail.exportDocument')}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleExportPDF()} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 justify-center py-4 rounded-2xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all">
              <FileDown size={14} />
              PDF Rapide
            </button>
            <button onClick={handlePrint} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 justify-center py-4 rounded-2xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all">
              <Printer size={14} />
              {t('projectDetail.print')}
            </button>
          </div>
          <button 
            onClick={() => {
              const count = project.chapters?.length || 0;
              const words = project.chapters?.reduce((acc, c) => acc + (c.content?.length || 0), 0) || 0;
              showAlert({ 
                title: 'Diagnostic', 
                message: `- Chapitres trouvés: ${count}\n- Volume total: ${words} caractères\n- Status: ${project.status}\n\nSi vous ne voyez rien, essayez le bouton 'Actualiser' en haut.`,
                type: 'info'
              });
            }}
            className="w-full py-2 text-[9px] text-slate-300 hover:text-slate-500 uppercase tracking-widest font-bold transition-colors"
          >
            Diagnostic des données
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExportModalOpen && (
          <ExportModal 
            key="export-modal"
            project={project}
            onClose={() => setIsExportModalOpen(false)}
            onExportDOCX={handleExport}
            onExportPDF={handleExportPDF}
            onDownloadStored={handleDownloadStoredWord}
          />
        )}
      </AnimatePresence>

      <AcademicGuide 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />

      <CitationManager
        isOpen={isCitationManagerOpen}
        onClose={() => setIsCitationManagerOpen(false)}
      />

      <AnimatePresence>
        {selectedFootnote && (
          <div key="footnote-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFootnote(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-lg shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif font-bold text-academic-900">Note de bas de page</h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-medium mt-1">Détails de la source</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFootnote(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto">
                <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4 sm:mb-6">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{selectedFootnote.text}</p>
                </div>

                {isVerifyingFootnote ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-4 text-accent" />
                    <p className="text-xs sm:text-sm font-medium uppercase tracking-widest text-center">Analyse de la source en cours...</p>
                  </div>
                ) : footnoteVerification ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 sm:p-5 rounded-xl border ${footnoteVerification.isReliable ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                      <div className={`p-2 sm:p-3 rounded-full shrink-0 self-start ${footnoteVerification.isReliable ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {footnoteVerification.isReliable ? <Check size={20} className="sm:w-6 sm:h-6" /> : <AlertTriangle size={20} className="sm:w-6 sm:h-6" />}
                      </div>
                      <div className="space-y-3 sm:space-y-4 w-full">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                            <h3 className={`font-bold text-sm sm:text-base ${footnoteVerification.isReliable ? 'text-emerald-800' : 'text-amber-800'}`}>
                              {footnoteVerification.isReliable ? 'Source Fiable' : 'Source Douteuse ou Non Académique'}
                            </h3>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${footnoteVerification.isReliable ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                              Score: {footnoteVerification.score}/100
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">Type: {footnoteVerification.type}</p>
                        </div>
                        
                        <div>
                          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Évaluation</p>
                          <p className={`text-xs sm:text-sm ${footnoteVerification.isReliable ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {footnoteVerification.explanation}
                          </p>
                        </div>
                        
                        {footnoteVerification.provenance && footnoteVerification.provenance !== "Inconnue" && (
                          <div>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Provenance</p>
                            <p className="text-xs sm:text-sm text-slate-700">
                              {footnoteVerification.provenance}
                            </p>
                          </div>
                        )}

                        {footnoteVerification.relevance && footnoteVerification.relevance !== "Inconnue" && footnoteVerification.relevance !== "Non applicable" && (
                          <div>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Pertinence avec le sujet</p>
                            <p className="text-xs sm:text-sm text-slate-700">
                              {footnoteVerification.relevance}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
            <Menu size={24} />
          </button>
          <span className="font-serif font-bold truncate max-w-[120px]">{project.title}</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsGuideOpen(true)}
              className="p-2 text-slate-400 hover:text-accent rounded-lg"
              title={t('projectDetail.academicGuide')}
            >
              <BookOpen size={20} />
            </button>
            <button 
              onClick={() => setActiveChapter(-3)}
              className={`p-2 rounded-lg transition-colors ${activeChapter === -3 ? 'text-accent bg-accent/5' : 'text-slate-400'}`}
              title={t('projectDetail.planView')}
            >
              <Sparkles size={20} />
            </button>
            <button 
              onClick={() => setActiveChapter(-2)}
              className={`p-2 rounded-lg transition-colors ${activeChapter === -2 ? 'text-accent bg-accent/5' : 'text-slate-400'}`}
              title={t('projectDetail.globalView')}
            >
              <Eye size={20} />
            </button>
            <button 
              onClick={handleRefresh}
              className="p-2 text-slate-400 hover:text-accent"
              title={t('projectDetail.refresh')}
            >
              <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-accent hover:bg-accent/5 rounded-lg">
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-16 flex-1">
          {project.status === 'generating' && (
            <div className="max-w-4xl mx-auto mb-8 bg-accent/10 border border-accent/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent rounded-xl sm:rounded-2xl flex items-center justify-center text-white shrink-0">
                  <Loader2 className="animate-spin" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-academic-900 text-sm sm:text-base">{t('projectDetail.generating')}</h4>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 sm:mt-1">Le manuscrit s'enrichit automatiquement. Vous pouvez déjà consulter les parties terminées.</p>
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-accent/10 pt-3 sm:pt-0 mt-2 sm:mt-0">
                <div className="text-[10px] sm:text-xs font-bold text-accent uppercase tracking-widest mb-1">Volume actuel</div>
                <div className="text-lg sm:text-xl font-serif text-academic-900">
                  {project.chapters.reduce((acc, c) => acc + (c.word_count || 0), 0).toLocaleString()} <span className="text-xs sm:text-sm text-slate-400">mots</span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Quick Nav */}
          <div className="lg:hidden mb-8 flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {project.docx_data && (
              <>
                <button 
                  onClick={handlePreviewWord}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${activeChapter === -4 ? 'bg-accent text-white shadow-lg' : 'bg-accent/10 text-accent border border-accent/20'}`}
                >
                  <Eye size={12} /> {t('projectDetail.wordPreview')}
                </button>
                <button 
                  onClick={handleDownloadStoredWord}
                  className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 bg-slate-800 text-white shadow-lg"
                >
                  <FileDown size={12} /> {t('projectDetail.downloadStoredWord')}
                </button>
              </>
            )}
            <button 
              onClick={() => setActiveChapter(-3)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeChapter === -3 ? 'bg-academic-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
              {t('projectDetail.planView')}
            </button>
            <button 
              onClick={() => setActiveChapter(-2)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeChapter === -2 ? 'bg-academic-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
              {t('projectDetail.globalView')}
            </button>
            {project.chapters?.sort((a, b) => a.order_index - b.order_index).map(ch => (
              <button 
                key={ch.id}
                onClick={() => setActiveChapter(ch.order_index)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeChapter === ch.order_index ? 'bg-academic-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
              >
                {ch.title.split(':')[0]}
              </button>
            ))}
          </div>

          <div className="max-w-4xl mx-auto bg-white shadow-[0_40px_120px_rgba(0,0,0,0.08)] p-6 sm:p-10 md:p-28 min-h-full rounded-[4px] border border-slate-100 relative" id="manuscript-content">
            {/* Page number indicator */}
            <div className="absolute top-6 right-6 md:top-10 md:right-10 text-[10px] font-bold text-slate-300 uppercase tracking-widest hidden print:block">
              Folio {activeChapter === -1 ? 'i' : activeChapter === -2 ? 'Tout' : activeChapter + 1}
            </div>
            
            {activeChapter === -4 && wordPreviewHtml ? (
              <div className="prose prose-slate max-w-none">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 border-b border-slate-100 pb-6 md:pb-8 gap-4">
                  <div className="text-left w-full md:w-auto">
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-accent mb-2">{t('projectDetail.wordPreview')}</h2>
                    <p className="text-slate-400 text-[10px] uppercase tracking-widest">Version enregistrée en base de données</p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {isEditingWordPreview ? (
                      <>
                        <button 
                          onClick={() => setIsEditingWordPreview(false)}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors text-center"
                        >
                          {t('projectDetail.cancel')}
                        </button>
                        <button 
                          onClick={handleSaveWordPreview}
                          disabled={isSavingWordPreview}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-accent text-white hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                          {isSavingWordPreview ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          {t('projectDetail.saveWord')}
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => setIsEditingWordPreview(true)}
                        className="w-full md:w-auto px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit3 size={14} />
                        {t('projectDetail.editWord')}
                      </button>
                    )}
                  </div>
                </div>
                {isEditingWordPreview && (
                  <div className="flex flex-wrap gap-1 md:gap-2 mb-4 p-2 bg-slate-100 rounded-xl border border-slate-200 sticky top-4 z-10 shadow-sm overflow-x-auto no-scrollbar">
                    <button onClick={() => document.execCommand('bold')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors shrink-0" title="Gras"><strong className="font-serif">B</strong></button>
                    <button onClick={() => document.execCommand('italic')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors shrink-0" title="Italique"><em className="font-serif">I</em></button>
                    <button onClick={() => document.execCommand('underline')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors shrink-0" title="Souligné"><u className="font-serif">U</u></button>
                    <div className="w-px h-6 bg-slate-300 self-center mx-1 shrink-0"></div>
                    <button onClick={() => document.execCommand('formatBlock', false, 'H1')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors text-xs font-bold shrink-0" title="Titre 1">H1</button>
                    <button onClick={() => document.execCommand('formatBlock', false, 'H2')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors text-xs font-bold shrink-0" title="Titre 2">H2</button>
                    <button onClick={() => document.execCommand('formatBlock', false, 'H3')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors text-xs font-bold shrink-0" title="Titre 3">H3</button>
                    <div className="w-px h-6 bg-slate-300 self-center mx-1 shrink-0 hidden sm:block"></div>
                    <button onClick={() => document.execCommand('insertUnorderedList')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors text-xs font-bold shrink-0" title="Liste à puces">• Liste</button>
                    <button onClick={() => document.execCommand('insertOrderedList')} className="p-2 hover:bg-white rounded-lg text-slate-700 transition-colors text-xs font-bold shrink-0" title="Liste numérotée">1. Liste</button>
                  </div>
                )}
                <div 
                  ref={wordPreviewRef}
                  className={`word-content font-serif leading-relaxed text-academic-900 ${isEditingWordPreview ? 'p-4 md:p-8 border-2 border-accent/30 rounded-2xl bg-slate-50/50 shadow-inner focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[500px]' : ''}`}
                  contentEditable={isEditingWordPreview}
                  suppressContentEditableWarning={true}
                  dangerouslySetInnerHTML={{ __html: wordPreviewHtml }} 
                />
              </div>
            ) : activeChapter === -3 ? (
              <div className="prose prose-slate max-w-none markdown-body">
                <div className="text-center mb-12 md:mb-20">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-academic-900 mb-4">{t('projectDetail.planTitle')}</h1>
                  <p className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">{t('projectDetail.planSubtitle')}</p>
                </div>
                
                <div className="max-w-2xl mx-auto space-y-8 md:space-y-12">
                  <div className="p-6 md:p-10 bg-slate-50 rounded-[32px] md:rounded-[40px] border border-slate-100">
                    <h3 className="text-base md:text-lg font-serif font-bold text-academic-900 mb-6 md:mb-8 border-b border-slate-200 pb-4">Introduction</h3>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-accent font-bold text-xs shrink-0">I</div>
                      <span className="font-medium text-sm md:text-base">{getPlan().introduction?.titre || t('projectDetail.generalIntro')}</span>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 bg-slate-50 rounded-[32px] md:rounded-[40px] border border-slate-100">
                    <h3 className="text-base md:text-lg font-serif font-bold text-academic-900 mb-6 md:mb-8 border-b border-slate-200 pb-4">Corps du Document</h3>
                    <div className="space-y-4 md:space-y-6">
                      {getPlan().chapitres?.map((chap: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 text-slate-600">
                          <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">{i + 1}</div>
                          <span className="font-medium text-sm md:text-base">{chap.titre}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 md:p-10 bg-slate-50 rounded-[32px] md:rounded-[40px] border border-slate-100">
                    <h3 className="text-base md:text-lg font-serif font-bold text-academic-900 mb-6 md:mb-8 border-b border-slate-200 pb-4">Conclusion & Annexes</h3>
                    <div className="space-y-4 md:space-y-6">
                      <div className="flex items-center gap-4 text-slate-600">
                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-accent font-bold text-xs">C</div>
                        <span className="font-medium">{t('projectDetail.generalConclusion')}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-600">
                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 font-bold text-xs">B</div>
                        <span className="font-medium">{t('projectDetail.indicativeBibliography')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeChapter === -2 ? (
              <div className="prose prose-slate max-w-none markdown-body">
                <div className="text-center mb-20">
                  <h1 className="text-4xl md:text-6xl font-serif font-semibold m-0 leading-[1.1] text-academic-900 mb-8">{project.title}</h1>
                  <p className="text-xl text-slate-500 font-serif italic">{project.university}</p>
                </div>
                
                {(!project.chapters || project.chapters.length === 0) ? (
                  <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[40px]">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <FileText size={40} />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-slate-400">{t('projectDetail.noContent')}</h3>
                    <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2">
                      Le contenu de ce manuscrit n'a pas pu être récupéré. 
                      Essayez d'actualiser la page.
                    </p>
                    <button 
                      onClick={handleRefresh}
                      className="mt-8 px-8 py-3 bg-academic-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-academic-800 transition-all shadow-lg shadow-academic-900/10"
                    >
                      {t('projectDetail.refresh')}
                    </button>
                  </div>
                ) : project.chapters.sort((a, b) => a.order_index - b.order_index).map((ch, idx) => (
                  <div key={ch.id} className="mb-24 pb-12 border-b border-slate-100 last:border-0 break-after-page">
                    {ch.order_index === -1 ? (
                      <div className="space-y-12">
                        {(() => {
                          try {
                            const fm = JSON.parse(ch.content);
                            return (
                              <>
                                <section>
                                  <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10 text-center">Page de Garde</h2>
                                  <div className="whitespace-pre-wrap font-serif text-center border border-slate-100 p-12 md:p-20 bg-slate-50/50 rounded-sm shadow-inner text-academic-900 leading-relaxed">{fm.page_de_garde}</div>
                                </section>
                                {fm.dedicace && (
                                  <section className="py-12">
                                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10 text-center">Dédicace</h2>
                                    <p className="italic text-right italic font-serif text-xl text-slate-600 max-w-md ml-auto leading-relaxed">"{fm.dedicace}"</p>
                                  </section>
                                )}
                                {fm.remerciements && (
                                  <section>
                                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Remerciements</h2>
                                    <p className="text-slate-700 leading-relaxed">{fm.remerciements}</p>
                                  </section>
                                )}
                                <section>
                                  <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Résumé</h2>
                                  <p className="text-slate-700 leading-relaxed">{fm.resume_fr}</p>
                                </section>
                                <section>
                                  <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Abstract</h2>
                                  <p className="italic text-slate-600 leading-relaxed font-serif text-lg">{fm.abstract_en}</p>
                                </section>
                                {fm.sigles && fm.sigles.length > 0 && (
                                  <section>
                                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Liste des Sigles</h2>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                                      {fm.sigles.map((s: string, i: number) => (
                                        <li key={i} className="text-sm font-mono border-b border-slate-50 pb-2 text-slate-600">{s}</li>
                                      ))}
                                    </ul>
                                  </section>
                                )}
                              </>
                            );
                          } catch {
                            return <p className="text-slate-400 italic">Éléments préliminaires en cours de préparation...</p>;
                          }
                        })()}
                      </div>
                    ) : (
                      <div className="min-h-[200px]">
                        <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-12 text-academic-900">{ch.title}</h1>
                        {ch.content ? (
                          <Markdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({node, ...props}) => {
                                if (props.href?.startsWith('#user-content-fn-')) {
                                  return (
                                    <a 
                                      {...props} 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleFootnoteClick(props.href!);
                                      }}
                                      className="text-accent hover:underline cursor-pointer"
                                    />
                                  );
                                }
                                return <a {...props} />;
                              }
                            }}
                          >
                            {ch.content}
                          </Markdown>
                        ) : (
                          <div className="p-12 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                            <Loader2 className="animate-spin mx-auto mb-4 text-slate-200" size={32} />
                            <p className="text-slate-400 font-serif italic">{t('projectDetail.generating')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : currentChapter ? (
              <div className="prose prose-slate max-w-none markdown-body">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 md:gap-8 mb-10 md:mb-28 pb-8 md:pb-10 border-b border-slate-50">

                  <h1 className="text-3xl sm:text-4xl md:text-6xl font-serif font-semibold m-0 leading-[1.1] text-academic-900 break-words w-full">{currentChapter.title}</h1>
                  {activeChapter !== -1 && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                      <button 
                        onClick={() => {
                          setEditContent(currentChapter.content || "");
                          setIsEditing(true);
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-2xl transition-all shrink-0 border border-slate-200 shadow-sm"
                      >
                        <Edit3 size={14} />
                        {t('projectDetail.editContent')}
                      </button>
                      <button 
                        onClick={() => setIsRefining(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent hover:bg-accent/5 px-4 py-3 rounded-2xl transition-all shrink-0 border border-accent/10 shadow-sm"
                      >
                        <Sparkles size={14} />
                        {t('projectDetail.aiOptimization')}
                      </button>
                    </div>
                  )}
                </div>

                {isRefining && (
                  <div className="mb-10 md:mb-16 p-6 md:p-8 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-accent flex items-center gap-3">
                        <Sparkles size={14} className="animate-pulse" /> {t('projectDetail.aiAssistant')}
                      </h3>
                      <button onClick={cancelRefinement} className="text-slate-300 hover:text-academic-900 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                    
                    {!refinedContent ? (
                      <div className="space-y-4">
                        <p className="text-xs md:text-sm text-gray-600">{t('projectDetail.aiInstructions')}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <textarea 
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder={t('projectDetail.aiPlaceholder')}
                            className="academic-input flex-1 h-20 text-sm"
                          />
                          <button 
                            onClick={handleRefine}
                            disabled={isRefiningLoading || !refinePrompt.trim()}
                            className="btn-primary h-fit sm:self-end disabled:opacity-50"
                          >
                            {isRefiningLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-xs md:text-sm font-medium text-green-600 flex items-center gap-1">
                            <Check size={14} /> Proposition générée
                          </p>
                          <button 
                            onClick={() => setRefinedContent(null)}
                            className="text-[10px] md:text-xs text-gray-500 hover:text-accent flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> Recommencer
                          </button>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 max-h-48 md:max-h-60 overflow-y-auto text-xs md:text-sm text-gray-600 whitespace-pre-wrap">
                          {refinedContent}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                          <button onClick={cancelRefinement} className="px-4 py-2 text-xs md:text-sm font-medium text-gray-500 hover:text-gray-700 order-2 sm:order-1">
                            Annuler
                          </button>
                          <button onClick={applyRefinement} className="btn-primary bg-green-600 hover:bg-green-700 text-xs md:text-sm order-1 sm:order-2">
                            Appliquer les modifications
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeChapter === -1 ? (
                  <div className="space-y-12">
                    {(() => {
                      try {
                        const fm = JSON.parse(currentChapter.content);
                        return (
                          <>
                            <section>
                              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10 text-center">Page de Garde</h2>
                              <div className="whitespace-pre-wrap font-serif text-center border border-slate-100 p-12 md:p-20 bg-slate-50/50 rounded-sm shadow-inner text-academic-900 leading-relaxed">{fm.page_de_garde}</div>
                            </section>
                            {fm.dedicace && (
                              <section className="py-12">
                                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10 text-center">Dédicace</h2>
                                <p className="italic text-right italic font-serif text-xl text-slate-600 max-w-md ml-auto leading-relaxed">"{fm.dedicace}"</p>
                              </section>
                            )}
                            {fm.remerciements && (
                              <section>
                                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Remerciements</h2>
                                <p className="text-slate-700 leading-relaxed">{fm.remerciements}</p>
                              </section>
                            )}
                            <section>
                              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Résumé</h2>
                              <p className="text-slate-700 leading-relaxed">{fm.resume_fr}</p>
                            </section>
                            <section>
                              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Abstract</h2>
                              <p className="italic text-slate-600 leading-relaxed font-serif text-lg">{fm.abstract_en}</p>
                            </section>
                            {fm.sigles && fm.sigles.length > 0 && (
                              <section>
                                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mb-10">Liste des Sigles</h2>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                                  {fm.sigles.map((s: string, i: number) => (
                                    <li key={i} className="text-sm font-mono border-b border-slate-50 pb-2 text-slate-600">{s}</li>
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
                  <div className="min-h-[400px]">
                    {isEditing ? (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-bold text-academic-900 flex items-center gap-2">
                            <Edit3 size={16} /> Mode Édition
                          </h3>
                          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Format Markdown supporté</span>
                        </div>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-[600px] p-6 text-sm font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-accent focus:border-transparent resize-y shadow-inner"
                          placeholder="Saisissez votre contenu en Markdown..."
                        />
                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors text-center"
                          >
                            {t('projectDetail.cancel')}
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-academic-900 text-white hover:bg-academic-800 transition-colors flex items-center justify-center gap-2 shadow-lg"
                          >
                            {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            {t('projectDetail.saveChanges')}
                          </button>
                        </div>
                      </div>
                    ) : currentChapter.content ? (
                      <Markdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({node, ...props}) => {
                            if (props.href?.startsWith('#user-content-fn-')) {
                              return (
                                <a 
                                  {...props} 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleFootnoteClick(props.href!);
                                  }}
                                  className="text-accent hover:underline cursor-pointer"
                                />
                              );
                            }
                            return <a {...props} />;
                          }
                        }}
                      >
                        {currentChapter.content}
                      </Markdown>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
                        <p className="font-serif italic mb-6">Le contenu de cette partie est en cours de chargement ou vide...</p>
                        <button 
                          onClick={handleRefresh}
                          className="px-6 py-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border border-slate-100"
                        >
                          {t('projectDetail.refresh')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <FileText size={64} className="mx-auto mb-4 opacity-20" />
                <p>Sélectionnez une partie pour l'afficher</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
