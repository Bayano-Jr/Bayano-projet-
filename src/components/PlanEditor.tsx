import React, { useState } from 'react';
import { Check, Edit2, Save, X, Plus, Trash2, GripVertical, Sparkles, Send, Loader2 } from 'lucide-react';
import { PlanStructure, Project } from '../types';
import { motion, Reorder } from 'motion/react';
import { refinePlan } from '../services/geminiService';

interface PlanEditorProps {
  project: Project;
  plan: PlanStructure;
  onValidate: (updatedPlan: PlanStructure) => void;
}

export default function PlanEditor({ project, plan: initialPlan, onValidate }: PlanEditorProps) {
  const [plan, setPlan] = useState<PlanStructure>(initialPlan);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefiningLoading, setIsRefiningLoading] = useState(false);

  const handleSave = () => {
    onValidate(plan);
  };

  const updateChapterTitle = (cIdx: number, title: string) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.titre = title;
    } else {
      newPlan.chapitres[cIdx].titre = title;
    }
    setPlan(newPlan);
    setEditingId(null);
  };

  const addChapter = () => {
    const newPlan = { ...plan };
    newPlan.chapitres.push({
      titre: "Nouveau Chapitre",
      sections: [{ titre: "Nouvelle Section", sous_sections: ["Nouvelle Sous-section"] }]
    });
    setPlan(newPlan);
  };

  const removeChapter = (cIdx: number) => {
    const newPlan = { ...plan };
    newPlan.chapitres.splice(cIdx, 1);
    setPlan(newPlan);
  };

  const addSection = (cIdx: number) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections.push({
        titre: "Nouvelle Section",
        sous_sections: ["Nouvelle Sous-section"]
      });
    } else {
      newPlan.chapitres[cIdx].sections.push({
        titre: "Nouvelle Section",
        sous_sections: ["Nouvelle Sous-section"]
      });
    }
    setPlan(newPlan);
  };

  const removeSection = (cIdx: number, sIdx: number) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections.splice(sIdx, 1);
    } else {
      newPlan.chapitres[cIdx].sections.splice(sIdx, 1);
    }
    setPlan(newPlan);
  };

  const updateSectionTitle = (cIdx: number, sIdx: number, title: string) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections[sIdx].titre = title;
    } else {
      newPlan.chapitres[cIdx].sections[sIdx].titre = title;
    }
    setPlan(newPlan);
    setEditingId(null);
  };

  const addSubSection = (cIdx: number, sIdx: number) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections[sIdx].sous_sections.push("Nouvelle Sous-section");
    } else {
      newPlan.chapitres[cIdx].sections[sIdx].sous_sections.push("Nouvelle Sous-section");
    }
    setPlan(newPlan);
  };

  const removeSubSection = (cIdx: number, sIdx: number, subIdx: number) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections[sIdx].sous_sections.splice(subIdx, 1);
    } else {
      newPlan.chapitres[cIdx].sections[sIdx].sous_sections.splice(subIdx, 1);
    }
    setPlan(newPlan);
  };

  const updateSubSection = (cIdx: number, sIdx: number, subIdx: number, value: string) => {
    const newPlan = { ...plan };
    if (cIdx === -1) {
      newPlan.introduction.sections[sIdx].sous_sections[subIdx] = value;
    } else {
      newPlan.chapitres[cIdx].sections[sIdx].sous_sections[subIdx] = value;
    }
    setPlan(newPlan);
    setEditingId(null);
  };

  const startEditing = (id: string, value: string) => {
    setEditingId(id);
    setEditValue(value);
  };

  const handleRefinePlan = async () => {
    if (!refinePrompt.trim()) return;
    setIsRefiningLoading(true);
    try {
      const newPlan = await refinePlan(project, plan, refinePrompt);
      setPlan(newPlan);
      setIsRefining(false);
      setRefinePrompt("");
    } catch (error) {
      console.error("Plan refinement error:", error);
      alert("Erreur lors de l'amélioration du plan.");
    } finally {
      setIsRefiningLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-12 py-8 md:py-20">
      <header className="mb-12 md:mb-24 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-6xl mb-4 font-serif font-medium tracking-tight">Architecture du Savoir</h2>
          <p className="text-lg text-slate-500 font-serif italic">Affinez la structure de votre pensée avant de lancer la rédaction finale.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setIsRefining(!isRefining)} 
            className={`btn-primary flex-1 sm:flex-none border-none ${isRefining ? 'bg-accent shadow-accent/20' : 'bg-white border border-slate-200 text-academic-900 hover:bg-slate-50'} shadow-xl`}
          >
            <Sparkles size={18} className={isRefining ? 'text-white' : 'text-accent'} />
            Assistant IA
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 border-none">
            <Check size={18} />
            Valider le Plan
          </button>
        </div>
      </header>

      {isRefining && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-8 p-6 bg-accent/5 border border-accent/20 rounded-3xl"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent flex items-center gap-2">
              <Sparkles size={14} /> Optimisation du Plan par l'IA
            </h3>
            <button onClick={() => setIsRefining(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Donnez des instructions à l'IA pour réorganiser ou enrichir votre plan (ex: "Ajoute un chapitre sur l'impact économique", "Détaille davantage le chapitre 2", "Réorganise pour une approche plus sociologique")</p>
            <div className="flex gap-2">
              <textarea 
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                placeholder="Instructions pour l'IA..."
                className="academic-input flex-1 h-20 text-sm"
              />
              <button 
                onClick={handleRefinePlan}
                disabled={isRefiningLoading || !refinePrompt.trim()}
                className="btn-primary h-fit self-end disabled:opacity-50"
              >
                {isRefiningLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-8">
        {/* Intro */}
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden border-l-4 border-accent"
        >
          <div className="bg-accent/5 p-4 md:p-6 border-b border-gray-100 flex justify-between items-center">
            {editingId === `chap--1` ? (
              <div className="flex gap-2 flex-1 mr-2 md:mr-4">
                <input 
                  className="academic-input py-1" 
                  value={editValue} 
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                />
                <button onClick={() => updateChapterTitle(-1, editValue)} className="p-2 bg-green-100 text-green-600 rounded-lg"><Save size={18}/></button>
                <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><X size={18}/></button>
              </div>
            ) : (
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 font-serif">
                <span className="text-accent">Première Partie.</span> {plan.introduction.titre}
              </h3>
            )}
            <div className="flex gap-1">
              <button onClick={() => startEditing(`chap--1`, plan.introduction.titre)} className="p-2 hover:bg-white rounded-lg text-gray-400 transition-colors"><Edit2 size={16} /></button>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            {plan.introduction.sections.map((sec, sIdx) => (
              <div key={sIdx} className="p-4 md:p-5 bg-gray-50/30 rounded-2xl border border-gray-100 group">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  {editingId === `sec--1-${sIdx}` ? (
                    <div className="flex gap-2 flex-1 mr-2 md:mr-4">
                      <input 
                        className="academic-input py-1" 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => updateSectionTitle(-1, sIdx, editValue)} className="p-2 bg-green-100 text-green-600 rounded-lg"><Save size={16}/></button>
                    </div>
                  ) : (
                    <h4 className="font-bold flex items-center gap-2 text-gray-800 text-sm md:text-base">
                      {sec.titre}
                    </h4>
                  )}
                  <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(`sec--1-${sIdx}`, sec.titre)} className="p-1.5 hover:bg-white rounded-lg text-gray-400"><Edit2 size={14} /></button>
                    <button onClick={() => removeSection(-1, sIdx)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>

                <ul className="space-y-2 md:space-y-3 ml-2 md:ml-4">
                  {sec.sous_sections.map((sub, subIdx) => (
                    <li key={subIdx} className="text-xs md:text-sm text-gray-600 flex items-center justify-between group/sub">
                      <div className="flex items-center gap-2 md:gap-3 flex-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent/40 shrink-0" />
                        {editingId === `sub--1-${sIdx}-${subIdx}` ? (
                          <input 
                            className="academic-input py-0.5 text-xs md:text-sm" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => updateSubSection(-1, sIdx, subIdx, editValue)}
                            onKeyDown={e => e.key === 'Enter' && updateSubSection(-1, sIdx, subIdx, editValue)}
                            autoFocus
                          />
                        ) : (
                          <span onClick={() => startEditing(`sub--1-${sIdx}-${subIdx}`, sub)} className="cursor-pointer hover:text-accent transition-colors">{sub}</span>
                        )}
                      </div>
                      <button onClick={() => removeSubSection(-1, sIdx, subIdx)} className="p-1 opacity-100 lg:opacity-0 lg:group-sub/sub:opacity-100 text-gray-300 hover:text-red-400"><X size={12} /></button>
                    </li>
                  ))}
                  <button 
                    onClick={() => addSubSection(-1, sIdx)}
                    className="text-[10px] md:text-xs text-accent font-medium flex items-center gap-1.5 mt-2 md:mt-3 hover:bg-accent/5 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus size={12} /> Ajouter une sous-section
                  </button>
                </ul>
              </div>
            ))}
            <button 
              onClick={() => addSection(-1)}
              className="w-full py-3 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-xs md:text-sm font-medium"
            >
              <Plus size={18} /> Ajouter une section à l'Introduction
            </button>
          </div>
        </motion.div>

        {/* Chapters */}
        <div className="space-y-6">
          {plan.chapitres.map((chap, cIdx) => (
            <motion.div 
              key={cIdx} 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex justify-between items-center">
                {editingId === `chap-${cIdx}` ? (
                  <div className="flex gap-2 flex-1 mr-4">
                    <input 
                      className="academic-input py-1" 
                      value={editValue} 
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => updateChapterTitle(cIdx, editValue)} className="p-2 bg-green-100 text-green-600 rounded-lg"><Save size={18}/></button>
                    <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><X size={18}/></button>
                  </div>
                ) : (
                  <h3 className="text-xl font-bold flex items-center gap-2 font-serif">
                    <span className="text-accent">Chapitre {cIdx + 1}.</span> {chap.titre}
                  </h3>
                )}
                <div className="flex gap-1">
                  <button onClick={() => startEditing(`chap-${cIdx}`, chap.titre)} className="p-2 hover:bg-white rounded-lg text-gray-400 transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => removeChapter(cIdx)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {chap.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="p-5 bg-gray-50/30 rounded-2xl border border-gray-100 group">
                    <div className="flex justify-between items-center mb-4">
                      {editingId === `sec-${cIdx}-${sIdx}` ? (
                        <div className="flex gap-2 flex-1 mr-4">
                          <input 
                            className="academic-input py-1" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => updateSectionTitle(cIdx, sIdx, editValue)} className="p-2 bg-green-100 text-green-600 rounded-lg"><Save size={16}/></button>
                        </div>
                      ) : (
                        <h4 className="font-bold flex items-center gap-2 text-gray-800">
                          {cIdx + 1}.{sIdx + 1}. {sec.titre}
                        </h4>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(`sec-${cIdx}-${sIdx}`, sec.titre)} className="p-1.5 hover:bg-white rounded-lg text-gray-400"><Edit2 size={14} /></button>
                        <button onClick={() => removeSection(cIdx, sIdx)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <ul className="space-y-3 ml-4">
                      {sec.sous_sections.map((sub, subIdx) => (
                        <li key={subIdx} className="text-sm text-gray-600 flex items-center justify-between group/sub">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                            {editingId === `sub-${cIdx}-${sIdx}-${subIdx}` ? (
                              <input 
                                className="academic-input py-0.5 text-sm" 
                                value={editValue} 
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => updateSubSection(cIdx, sIdx, subIdx, editValue)}
                                onKeyDown={e => e.key === 'Enter' && updateSubSection(cIdx, sIdx, subIdx, editValue)}
                                autoFocus
                              />
                            ) : (
                              <span onClick={() => startEditing(`sub-${cIdx}-${sIdx}-${subIdx}`, sub)} className="cursor-pointer hover:text-accent transition-colors">{sub}</span>
                            )}
                          </div>
                          <button onClick={() => removeSubSection(cIdx, sIdx, subIdx)} className="p-1 opacity-0 group-sub/sub:opacity-100 text-gray-300 hover:text-red-400"><X size={12} /></button>
                        </li>
                      ))}
                      <button 
                        onClick={() => addSubSection(cIdx, sIdx)}
                        className="text-xs text-accent font-medium flex items-center gap-1.5 mt-3 hover:bg-accent/5 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Ajouter une sous-section
                      </button>
                    </ul>
                  </div>
                ))}
                <button 
                  onClick={() => addSection(cIdx)}
                  className="w-full py-3 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Plus size={18} /> Ajouter une section au Chapitre {cIdx + 1}
                </button>
              </div>
            </motion.div>
          ))}
          <button 
            onClick={addChapter}
            className="w-full py-6 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex flex-col items-center justify-center gap-2"
          >
            <Plus size={32} />
            <span className="text-lg font-serif">Ajouter un nouveau chapitre</span>
          </button>
        </div>

        {/* Conclusion */}
        <div className="glass-card p-6 border-l-4 border-accent bg-accent/5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold">Conclusion Générale</h3>
            <button 
              onClick={() => startEditing('conclusion', plan.conclusion_generale)}
              className="p-2 hover:bg-white rounded-lg text-gray-400"
            >
              <Edit2 size={16} />
            </button>
          </div>
          {editingId === 'conclusion' ? (
            <div className="flex gap-2">
              <textarea 
                className="academic-input flex-1 h-24" 
                value={editValue} 
                onChange={e => setEditValue(e.target.value)}
              />
              <button onClick={() => { setPlan({...plan, conclusion_generale: editValue}); setEditingId(null); }} className="p-2 bg-green-100 text-green-600 rounded-lg h-fit"><Save size={18}/></button>
            </div>
          ) : (
            <p className="text-gray-600 italic text-sm leading-relaxed">{plan.conclusion_generale}</p>
          )}
        </div>

        {/* Biblio */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4 font-serif">Bibliographie Indicative</h3>
          <ul className="space-y-3">
            {plan.bibliographie_indicative.map((item, i) => (
              <li key={i} className="text-sm text-gray-500 font-mono flex justify-between group">
                {editingId === `bib-${i}` ? (
                  <input 
                    className="academic-input py-0.5 text-xs flex-1 mr-2" 
                    value={editValue} 
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const b = [...plan.bibliographie_indicative]; b[i] = editValue; setPlan({...plan, bibliographie_indicative: b}); setEditingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span onClick={() => startEditing(`bib-${i}`, item)} className="cursor-pointer hover:text-accent">{item}</span>
                )}
                <button onClick={() => { const b = [...plan.bibliographie_indicative]; b.splice(i, 1); setPlan({...plan, bibliographie_indicative: b}); }} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500"><Trash2 size={14}/></button>
              </li>
            ))}
            <button 
              onClick={() => setPlan({...plan, bibliographie_indicative: [...plan.bibliographie_indicative, "Nouvelle référence bibliographique"]})}
              className="text-xs text-accent font-medium flex items-center gap-1.5 mt-2"
            >
              <Plus size={12} /> Ajouter une référence
            </button>
          </ul>
        </div>

        {/* Annexes */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4 font-serif">Annexes</h3>
          <ul className="space-y-3">
            {(plan.annexes || []).map((item, i) => (
              <li key={i} className="text-sm text-gray-500 font-mono flex justify-between group">
                {editingId === `annex-${i}` ? (
                  <input 
                    className="academic-input py-0.5 text-xs flex-1 mr-2" 
                    value={editValue} 
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const a = [...(plan.annexes || [])]; a[i] = editValue; setPlan({...plan, annexes: a}); setEditingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span onClick={() => startEditing(`annex-${i}`, item)} className="cursor-pointer hover:text-accent">{item}</span>
                )}
                <button onClick={() => { const a = [...(plan.annexes || [])]; a.splice(i, 1); setPlan({...plan, annexes: a}); }} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500"><Trash2 size={14}/></button>
              </li>
            ))}
            <button 
              onClick={() => setPlan({...plan, annexes: [...(plan.annexes || []), "Nouvelle annexe"]})}
              className="text-xs text-accent font-medium flex items-center gap-1.5 mt-2"
            >
              <Plus size={12} /> Ajouter une annexe
            </button>
          </ul>
        </div>
      </div>

      <div className="mt-20 md:mt-32 flex justify-center pb-20">
        <button onClick={handleSave} className="btn-primary bg-academic-900 hover:bg-academic-800 w-full max-w-2xl justify-center py-6 md:py-8 text-xl md:text-2xl shadow-2xl shadow-academic-900/20 rounded-3xl border-none">
          <Check size={32} className="md:w-10 md:h-10" />
          Lancer la Rédaction Académique
        </button>
      </div>
    </div>
  );
}
