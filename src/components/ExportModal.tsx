import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Download, Check, Settings, FileDown, Loader2 } from 'lucide-react';
import { Project } from '../types';
import { useAlert } from '../contexts/AlertContext';

interface ExportModalProps {
  project: Project;
  onClose: () => void;
  onExportDOCX: (options: ExportOptions) => Promise<void>;
  onExportPDF: (options: ExportOptions) => Promise<void>;
  onDownloadStored?: () => void;
}

export interface ExportOptions {
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeBibliography: boolean;
  includeAnnexes: boolean;
}

export default function ExportModal({ project, onClose, onExportDOCX, onExportPDF, onDownloadStored }: ExportModalProps) {
  const { showAlert } = useAlert();
  const [options, setOptions] = useState<ExportOptions>({
    includeTitlePage: true,
    includeTableOfContents: true,
    includeBibliography: true,
    includeAnnexes: true,
  });
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async (type: 'docx' | 'pdf') => {
    setIsExporting(type);
    try {
      if (type === 'docx') {
        await onExportDOCX(options);
      } else {
        await onExportPDF(options);
      }
    } catch (error) {
      console.error(`Export ${type} failed:`, error);
      showAlert({ message: `L'exportation en ${type.toUpperCase()} a échoué.`, type: 'error' });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-academic-900/40 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-[30px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-12 border-b border-slate-50 flex justify-between items-center bg-white z-10 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-academic-900 mb-1 md:mb-2">Options d'Exportation</h2>
            <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Configurez votre manuscrit final</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 ml-4"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-6 md:p-12 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">Éléments à inclure</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'includeTitlePage', label: 'Page de Garde', icon: FileText },
                { id: 'includeTableOfContents', label: 'Table des Matières', icon: Settings },
                { id: 'includeBibliography', label: 'Bibliographie', icon: Check },
                { id: 'includeAnnexes', label: 'Annexes', icon: FileDown },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id as keyof ExportOptions)}
                  className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${
                    options[opt.id as keyof ExportOptions] 
                      ? 'border-academic-900 bg-academic-900/5 text-academic-900' 
                      : 'border-slate-50 bg-white text-slate-400'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    options[opt.id as keyof ExportOptions] ? 'bg-academic-900 text-white' : 'bg-slate-50 text-slate-300'
                  }`}>
                    <opt.icon size={20} />
                  </div>
                  <span className="text-sm font-bold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed italic">
              Note: L'exportation DOCX est optimisée pour Microsoft Word et respecte les normes de mise en page académiques (Police Times New Roman 12pt, interligne 1.5).
            </p>
          </div>
        </div>

        <div className="p-6 md:p-12 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button 
              onClick={() => handleExport('docx')}
              disabled={!!isExporting}
              className="flex-1 btn-primary bg-academic-900 hover:bg-academic-800 py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 shadow-xl shadow-academic-900/10 disabled:opacity-50 text-xs md:text-sm"
            >
              {isExporting === 'docx' ? (
                <Loader2 size={18} className="animate-spin md:w-5 md:h-5" />
              ) : (
                <Download size={18} className="md:w-5 md:h-5" />
              )}
              Générer DOCX
            </button>
            <button 
              onClick={() => handleExport('pdf')}
              disabled={!!isExporting}
              className="flex-1 btn-secondary border-slate-200 text-slate-600 hover:bg-white py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 text-xs md:text-sm"
            >
              {isExporting === 'pdf' ? (
                <Loader2 size={18} className="animate-spin md:w-5 md:h-5" />
              ) : (
                <FileDown size={18} className="md:w-5 md:h-5" />
              )}
              Générer PDF
            </button>
          </div>

          {project.docx_data && (
            <button 
              onClick={() => {
                onDownloadStored?.();
              }}
              className="w-full py-3 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest text-accent hover:bg-accent/5 rounded-xl md:rounded-2xl border border-accent/20 transition-all flex items-center justify-center gap-2 md:gap-3"
            >
              <FileDown size={14} className="md:w-4 md:h-4" />
              Télécharger la version Word enregistrée
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
