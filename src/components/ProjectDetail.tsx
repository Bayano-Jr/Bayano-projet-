import React, { useState, useEffect } from 'react';
import { Download, FileText, ArrowLeft, Eye, Edit3, Sparkles, Send, X, Check, RotateCcw, Loader2, Menu } from 'lucide-react';
import { Project, Chapter } from '../types';
import Markdown from 'react-markdown';
import { storageService } from '../services/storageService';
import { refineContent } from '../services/geminiService';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Header, 
  Footer, 
  PageNumber, 
  PageBreak,
  FootnoteReferenceRun,
} from "docx";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [project, setProject] = useState<(Project & { chapters: Chapter[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<number>(-1); // -1 for front matter
  
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefiningLoading, setIsRefiningLoading] = useState(false);
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const data = storageService.getProject(projectId);
    setProject(data);
    setLoading(false);
  }, [projectId]);

  const handleExport = async () => {
    if (!project) return;
    
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: {
              font: "Times New Roman",
              size: 24, // 12pt
            },
            paragraph: {
              spacing: { line: 360, before: 120, after: 120 }, // 1.5 line spacing
              alignment: AlignmentType.JUSTIFIED,
            },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            run: {
              font: "Times New Roman",
              size: 32, // 16pt
              bold: true,
              color: "000000",
            },
            paragraph: {
              spacing: { before: 480, after: 240 },
              alignment: AlignmentType.LEFT,
            },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            run: {
              font: "Times New Roman",
              size: 28, // 14pt
              bold: true,
            },
            paragraph: {
              spacing: { before: 360, after: 180 },
            },
          },
        ],
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: project.title,
                    size: 18,
                    color: "888888",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: ["Page ", PageNumber.CURRENT],
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Title Page
          new Paragraph({
            text: project.university.toUpperCase(),
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: project.field,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n\n\n" }),
          new Paragraph({
            text: "MÉMOIRE DE FIN D'ÉTUDES",
            alignment: AlignmentType.CENTER,
            run: { size: 28, bold: true },
          }),
          new Paragraph({ text: "\n" }),
          new Paragraph({
            text: project.title,
            alignment: AlignmentType.CENTER,
            run: { size: 48, bold: true, font: "Times New Roman" },
          }),
          new Paragraph({ text: "\n\n\n\n\n" }),
          new Paragraph({
            text: `Présenté par: [VOTRE NOM]`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Niveau: ${project.level}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n" }),
          new Paragraph({
            text: `Sous la direction de: [NOM DU DIRECTEUR]`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "\n\n\n\n" }),
          new Paragraph({
            text: `${project.country}, ${new Date().getFullYear()}`,
            alignment: AlignmentType.CENTER,
          }),
          
          new PageBreak(),

          // Chapters
          ...(project.chapters || []).sort((a,b) => a.order_index - b.order_index).flatMap((ch: any) => {
            if (ch.order_index === -1) {
              // Front matter parsing
              try {
                const fm = JSON.parse(ch.content);
                return [
                  new Paragraph({ text: "RÉSUMÉ", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                  new Paragraph({ text: fm.resume_fr }),
                  new PageBreak(),
                  new Paragraph({ text: "ABSTRACT", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: fm.abstract_en, italics: true })] }),
                  new PageBreak(),
                  new Paragraph({ text: "REMERCIEMENTS", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                  new Paragraph({ text: fm.remerciements }),
                  new PageBreak(),
                  ...(fm.sigles && fm.sigles.length > 0 ? [
                    new Paragraph({ text: "LISTE DES SIGLES", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                    ...fm.sigles.map((s: string) => new Paragraph({ text: s, bullet: { level: 0 } })),
                    new PageBreak(),
                  ] : []),
                ];
              } catch {
                return [];
              }
            }

            // Parse footnotes in chapter content
            const footnoteMap = new Map<string, string>();
            const contentLines = ch.content.split('\n');
            const cleanContentLines: string[] = [];
            
            contentLines.forEach((line: string) => {
              const footnoteDefMatch = line.match(/^\[\^(\d+)\]:\s*(.*)/);
              if (footnoteDefMatch) {
                footnoteMap.set(footnoteDefMatch[1], footnoteDefMatch[2]);
              } else {
                cleanContentLines.push(line);
              }
            });

            const chapterParagraphs = cleanContentLines.filter(line => line.trim() !== '').map((line: string) => {
              const isHeading = line.startsWith('#');
              const level = line.match(/^#+/)?.[0].length || 0;
              const text = line.replace(/^#+\s*/, '');
              
              // Handle inline footnotes
              const parts: (TextRun | FootnoteReferenceRun)[] = [];
              let lastIndex = 0;
              const footnoteRegex = /\[\^(\d+)\]/g;
              let match;

              while ((match = footnoteRegex.exec(text)) !== null) {
                // Add text before footnote
                if (match.index > lastIndex) {
                  parts.push(new TextRun(text.substring(lastIndex, match.index)));
                }
                
                const footnoteId = match[1];
                const footnoteContent = footnoteMap.get(footnoteId) || "Note non définie";
                
                // Add footnote reference
                parts.push(new FootnoteReferenceRun(parseInt(footnoteId)));
                
                // We need to register the footnote in the document. 
                // In docx library, footnotes are added to the Document object.
                // But wait, FootnoteReferenceRun needs the footnote to be defined in the document's footnotes property.
                
                lastIndex = footnoteRegex.lastIndex;
              }

              if (lastIndex < text.length) {
                parts.push(new TextRun(text.substring(lastIndex)));
              }

              return new Paragraph({
                children: parts.length > 0 ? parts : [new TextRun(text)],
                heading: isHeading ? (level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3) : undefined,
                alignment: isHeading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
              });
            });

            return [
              new Paragraph({
                text: ch.title.toUpperCase(),
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 400 },
              }),
              ...chapterParagraphs,
              new PageBreak(),
            ];
          }),

          // Annexes
          ...(JSON.parse(project.plan || '{}').annexes || []).length > 0 ? [
            new Paragraph({ text: "ANNEXES", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            ...(JSON.parse(project.plan || '{}').annexes || []).map((a: string) => 
              new Paragraph({ text: a, bullet: { level: 0 } })
            ),
          ] : [],
        ],
      }],
      // Add footnotes to the document
      footnotes: (() => {
        const allFootnotes: Record<number, { children: Paragraph[] }> = {};
        project.chapters?.forEach(ch => {
          const contentLines = ch.content.split('\n');
          contentLines.forEach(line => {
            const footnoteDefMatch = line.match(/^\[\^(\d+)\]:\s*(.*)/);
            if (footnoteDefMatch) {
              const id = parseInt(footnoteDefMatch[1]);
              allFootnotes[id] = {
                children: [new Paragraph({ text: footnoteDefMatch[2] })]
              };
            }
          });
        });
        return allFootnotes;
      })()
    });

    const blob = await Packer.toBlob(doc);
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

  const handleRefine = async () => {
    if (!project || !currentChapter || !refinePrompt.trim()) return;
    
    setIsRefiningLoading(true);
    try {
      const result = await refineContent(project, currentChapter.content, refinePrompt);
      setRefinedContent(result);
    } catch (error) {
      console.error("Refinement error:", error);
      alert("Erreur lors de l'amélioration par l'IA.");
    } finally {
      setIsRefiningLoading(false);
    }
  };

  const applyRefinement = () => {
    if (!project || !currentChapter || !refinedContent) return;
    
    const updatedChapter = { ...currentChapter, content: refinedContent };
    storageService.saveChapter(updatedChapter);
    
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
        <div className="p-8 border-b border-slate-50">
          <div className="flex justify-between items-center mb-8">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-academic-900 text-[10px] font-bold uppercase tracking-widest group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Tableau de bord
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-50 rounded-xl text-slate-400">
              <X size={20} />
            </button>
          </div>
          <h2 className="text-2xl font-serif font-medium leading-tight text-academic-900 line-clamp-3">{project.title}</h2>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-6 space-y-2">
          <button 
            onClick={() => { setActiveChapter(-1); setIsSidebarOpen(false); }}
            className={`w-full text-left px-5 py-4 rounded-2xl text-sm transition-all duration-300 ${activeChapter === -1 ? 'bg-academic-900 shadow-xl shadow-academic-900/10 font-bold text-white' : 'hover:bg-slate-50 text-slate-500 font-medium'}`}
          >
            Éléments Préliminaires
          </button>
          {project.chapters?.filter(c => c.order_index >= 0).map((ch) => (
            <button
              key={ch.id}
              onClick={() => { setActiveChapter(ch.order_index); setIsSidebarOpen(false); }}
              className={`w-full text-left px-5 py-4 rounded-2xl text-sm transition-all duration-300 ${activeChapter === ch.order_index ? 'bg-academic-900 shadow-xl shadow-academic-900/10 font-bold text-white' : 'hover:bg-slate-50 text-slate-500 font-medium'}`}
            >
              {ch.title}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-slate-50">
          <button onClick={handleExport} className="btn-primary w-full justify-center shadow-xl shadow-academic-900/10 border-none">
            <Download size={18} />
            Exporter DOCX
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
            <Menu size={24} />
          </button>
          <span className="font-serif font-bold truncate max-w-[200px]">{project.title}</span>
          <button onClick={handleExport} className="p-2 text-accent hover:bg-accent/5 rounded-lg">
            <Download size={20} />
          </button>
        </div>

        <div className="p-4 md:p-16 flex-1">
          <div className="max-w-4xl mx-auto bg-white shadow-[0_20px_80px_rgb(0,0,0,0.06)] p-8 md:p-24 min-h-full rounded-sm border border-slate-100">
            {currentChapter ? (
              <div className="prose prose-slate max-w-none markdown-body">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12 md:mb-20 pb-8 border-b border-slate-50">
                  <h1 className="text-3xl md:text-5xl font-serif font-semibold m-0 leading-tight text-academic-900">{currentChapter.title}</h1>
                  {activeChapter !== -1 && (
                    <button 
                      onClick={() => setIsRefining(true)}
                      className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-accent hover:bg-accent/5 px-4 py-2 rounded-xl transition-all shrink-0 border border-accent/10"
                    >
                      <Sparkles size={14} />
                      Améliorer
                    </button>
                  )}
                </div>

              {isRefining && (
                <div className="mb-16 p-8 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-accent flex items-center gap-3">
                      <Sparkles size={14} className="animate-pulse" /> Assistant de Rédaction Bayano
                    </h3>
                    <button onClick={cancelRefinement} className="text-slate-300 hover:text-academic-900 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  
                  {!refinedContent ? (
                    <div className="space-y-4">
                      <p className="text-xs md:text-sm text-gray-600">Que souhaitez-vous modifier dans ce chapitre ? (ex: "Rends le style plus formel", "Développe la partie sur la méthodologie")</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea 
                          value={refinePrompt}
                          onChange={(e) => setRefinePrompt(e.target.value)}
                          placeholder="Instructions pour l'IA..."
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
                  {/* Render front matter fields */}
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
  </div>
  );
}
