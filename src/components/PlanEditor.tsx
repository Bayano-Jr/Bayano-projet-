import React, { useState, useEffect, useRef } from 'react';
import { Check, Edit2, Save, X, Plus, Trash2, GripVertical, Sparkles, Send, Loader2, Database, Layout } from 'lucide-react';
import { PlanStructure, Project, User as UserType } from '../types';
import { motion, Reorder } from 'motion/react';
import { refinePlan } from '../services/geminiService';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../contexts/AlertContext';

interface PlanEditorProps {
  project: Project;
  plan: PlanStructure;
  onValidate: (updatedPlan: PlanStructure) => void;
  onAutoSave?: (updatedPlan: PlanStructure) => void;
  user: UserType | null;
  onUpdateUser: (user: UserType) => void;
  onShowPricing: () => void;
}

export default function PlanEditor({ project, plan: initialPlan, onValidate, onAutoSave, user, onUpdateUser, onShowPricing }: PlanEditorProps) {
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanStructure>(initialPlan);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefiningLoading, setIsRefiningLoading] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const planRef = useRef(plan);
  const isDirtyRef = useRef(false);
  const onAutoSaveRef = useRef(onAutoSave);
  const lastSavedPlanRef = useRef(initialPlan);

  // Keep refs in sync with state/props
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Mark as dirty when plan changes from last saved
  useEffect(() => {
    if (JSON.stringify(plan) !== JSON.stringify(lastSavedPlanRef.current)) {
      isDirtyRef.current = true;
    }
  }, [plan]);

  // Auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current && onAutoSaveRef.current) {
        setIsAutoSaving(true);
        onAutoSaveRef.current(planRef.current);
        lastSavedPlanRef.current = planRef.current;
        isDirtyRef.current = false;
        
        // Hide auto-saving indicator after a brief moment
        setTimeout(() => setIsAutoSaving(false), 2000);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

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
      titre: t('planEditor.newPart'),
      sections: [{ titre: t('planEditor.newSection'), sous_sections: [t('planEditor.newSubSection')] }]
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
        titre: t('planEditor.newSection'),
        sous_sections: [t('planEditor.newSubSection')]
      });
    } else {
      newPlan.chapitres[cIdx].sections.push({
        titre: t('planEditor.newSection'),
        sous_sections: [t('planEditor.newSubSection')]
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
      newPlan.introduction.sections[sIdx].sous_sections.push(t('planEditor.newSubSection'));
    } else {
      newPlan.chapitres[cIdx].sections[sIdx].sous_sections.push(t('planEditor.newSubSection'));
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
        body: JSON.stringify({ amount: 1, description: `Modification plan IA: ${project.title.substring(0, 20)}...` }),
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

      const newPlan = await refinePlan(project, plan, refinePrompt);
      setPlan(newPlan);
      setIsRefining(false);
      setRefinePrompt("");
    } catch (error) {
      console.error("Plan refinement error:", error);
      showAlert({ message: t('planEditor.refineError'), type: 'error' });
    } finally {
      setIsRefiningLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-12 py-8 md:py-24">
      <header className="mb-12 md:mb-32 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 md:gap-12">
        <div className="max-w-3xl w-full">
          <div className="flex items-center gap-2 md:gap-3 text-accent font-bold uppercase tracking-[0.3em] text-[8px] md:text-[10px] mb-4 md:mb-6">
            <div className="w-6 md:w-8 h-[1px] bg-accent" />
            {t('planEditor.intellectualStructure')}
            {isAutoSaving && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-4 flex items-center gap-1.5 text-slate-400 normal-case tracking-normal"
              >
                <Loader2 size={12} className="animate-spin" />
                Sauvegarde auto...
              </motion.span>
            )}
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-8xl mb-4 md:mb-8 font-serif font-semibold tracking-tight text-academic-900 leading-[0.9] break-words">{t('planEditor.title')}</h2>
          <p className="text-base md:text-xl text-slate-500 font-serif italic leading-relaxed">{t('planEditor.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setIsRefining(!isRefining)} 
            className={`h-14 md:h-16 px-6 md:px-8 w-full sm:w-auto rounded-2xl flex items-center justify-center gap-2 md:gap-3 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-500 ${isRefining ? 'bg-academic-900 text-white shadow-2xl shadow-academic-900/20' : 'bg-white border border-slate-100 text-slate-400 hover:text-academic-900 hover:border-accent/40 shadow-sm'}`}
          >
            <Sparkles size={18} className={isRefining ? 'text-accent' : 'text-slate-300'} />
            {t('planEditor.aiAssistant')}
          </button>
          <button onClick={handleSave} className="h-14 md:h-16 px-6 md:px-10 w-full sm:w-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-600/20 flex items-center justify-center gap-2 md:gap-3 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all border-none">
            <Check size={20} />
            {t('planEditor.validatePlan')}
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
              <Sparkles size={14} /> {t('planEditor.aiOptimization')}
            </h3>
            <button onClick={() => setIsRefining(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('planEditor.aiInstructions')}</p>
            <div className="flex gap-2">
              <textarea 
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                placeholder={t('planEditor.aiPlaceholder')}
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
          className="bg-white rounded-[40px] overflow-hidden border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]"
        >
          <div className="bg-slate-50/50 p-8 md:p-10 border-b border-slate-100 flex justify-between items-center">
            {editingId === `chap--1` ? (
              <div className="flex gap-3 flex-1 mr-4">
                <input 
                  className="academic-input py-3 px-6 text-lg" 
                  value={editValue} 
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                />
                <button onClick={() => updateChapterTitle(-1, editValue)} className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Save size={18}/></button>
                <button onClick={() => setEditingId(null)} className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center"><X size={18}/></button>
              </div>
            ) : (
              <h3 className="text-2xl md:text-3xl font-bold flex items-center gap-4 font-serif text-academic-900">
                <span className="text-accent italic">00.</span> {plan.introduction?.titre || t('planEditor.introduction')}
              </h3>
            )}
            <div className="flex gap-2">
              <button onClick={() => startEditing(`chap--1`, plan.introduction?.titre || t('planEditor.introduction'))} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-xl text-slate-300 hover:text-academic-900 transition-all shadow-sm"><Edit2 size={16} /></button>
            </div>
          </div>

          <div className="p-8 md:p-12 space-y-6">
            {plan.introduction?.sections?.map((sec, sIdx) => (
              <div key={sIdx} className="p-8 bg-slate-50/30 rounded-[32px] border border-slate-100 group hover:bg-white transition-all duration-500">
                <div className="flex justify-between items-center mb-6">
                  {editingId === `sec--1-${sIdx}` ? (
                    <div className="flex gap-3 flex-1 mr-4">
                      <input 
                        className="academic-input py-2 px-4" 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => updateSectionTitle(-1, sIdx, editValue)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10"><Save size={16}/></button>
                    </div>
                  ) : (
                    <h4 className="text-lg font-bold flex items-center gap-3 text-academic-900">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      {sec.titre}
                    </h4>
                  )}
                  <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                    <button onClick={() => startEditing(`sec--1-${sIdx}`, sec.titre)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-300 hover:text-academic-900 shadow-sm transition-all"><Edit2 size={14} /></button>
                    <button onClick={() => removeSection(-1, sIdx)} className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 shadow-sm transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>

                <ul className="space-y-4 ml-5">
                  {sec.sous_sections?.map((sub, subIdx) => (
                    <li key={subIdx} className="text-sm text-slate-600 flex items-center justify-between group/sub">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                        {editingId === `sub--1-${sIdx}-${subIdx}` ? (
                          <input 
                            className="academic-input py-1 px-3 text-sm" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => updateSubSection(-1, sIdx, subIdx, editValue)}
                            onKeyDown={e => e.key === 'Enter' && updateSubSection(-1, sIdx, subIdx, editValue)}
                            autoFocus
                          />
                        ) : (
                          <span onClick={() => startEditing(`sub--1-${sIdx}-${subIdx}`, sub)} className="cursor-pointer hover:text-accent transition-colors font-medium">{sub}</span>
                        )}
                      </div>
                      <button onClick={() => removeSubSection(-1, sIdx, subIdx)} className="w-6 h-6 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-sub/sub:opacity-100 text-slate-300 hover:text-red-500 transition-all"><X size={12} /></button>
                    </li>
                  ))}
                  <button 
                    onClick={() => addSubSection(-1, sIdx)}
                    className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-2 mt-6 hover:bg-accent/5 px-4 py-2 rounded-xl transition-all border border-accent/10"
                  >
                    <Plus size={12} /> {t('planEditor.addSubSection')}
                  </button>
                </ul>
              </div>
            ))}
            <button 
              onClick={() => addSection(-1)}
              className="w-full py-6 border-2 border-dashed border-slate-100 rounded-[32px] text-slate-300 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest"
            >
              <Plus size={20} /> {t('planEditor.addSectionIntro')}
            </button>
          </div>
        </motion.div>

        {/* Chapters */}
        <div className="space-y-12">
          {plan.chapitres?.map((chap, cIdx) => (
            <motion.div 
              key={cIdx} 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] overflow-hidden border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]"
            >
              <div className="bg-slate-50/50 p-8 md:p-10 border-b border-slate-100 flex justify-between items-center">
                {editingId === `chap-${cIdx}` ? (
                  <div className="flex gap-3 flex-1 mr-4">
                    <input 
                      className="academic-input py-3 px-6 text-lg" 
                      value={editValue} 
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => updateChapterTitle(cIdx, editValue)} className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Save size={18}/></button>
                    <button onClick={() => setEditingId(null)} className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center"><X size={18}/></button>
                  </div>
                ) : (
                  <h3 className="text-2xl md:text-3xl font-bold flex items-center gap-4 font-serif text-academic-900">
                    <span className="text-accent italic">{(cIdx + 1).toString().padStart(2, '0')}.</span> {chap.titre}
                  </h3>
                )}
                <div className="flex gap-2">
                  <button onClick={() => startEditing(`chap-${cIdx}`, chap.titre)} className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-xl text-slate-300 hover:text-academic-900 transition-all shadow-sm"><Edit2 size={16} /></button>
                  <button onClick={() => removeChapter(cIdx)} className="w-10 h-10 flex items-center justify-center hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all shadow-sm"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="p-8 md:p-12 space-y-6">
                {chap.sections?.map((sec, sIdx) => (
                  <div key={sIdx} className="p-8 bg-slate-50/30 rounded-[32px] border border-slate-100 group hover:bg-white transition-all duration-500">
                    <div className="flex justify-between items-center mb-6">
                      {editingId === `sec-${cIdx}-${sIdx}` ? (
                        <div className="flex gap-3 flex-1 mr-4">
                          <input 
                            className="academic-input py-2 px-4" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => updateSectionTitle(cIdx, sIdx, editValue)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10"><Save size={16}/></button>
                        </div>
                      ) : (
                        <h4 className="text-lg font-bold flex items-center gap-3 text-academic-900">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          {sec.titre}
                        </h4>
                      )}
                      <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                        <button onClick={() => startEditing(`sec-${cIdx}-${sIdx}`, sec.titre)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-300 hover:text-academic-900 shadow-sm transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => removeSection(cIdx, sIdx)} className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 shadow-sm transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <ul className="space-y-4 ml-5">
                      {sec.sous_sections?.map((sub, subIdx) => (
                        <li key={subIdx} className="text-sm text-slate-600 flex items-center justify-between group/sub">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                            {editingId === `sub-${cIdx}-${sIdx}-${subIdx}` ? (
                              <input 
                                className="academic-input py-1 px-3 text-sm" 
                                value={editValue} 
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => updateSubSection(cIdx, sIdx, subIdx, editValue)}
                                onKeyDown={e => e.key === 'Enter' && updateSubSection(cIdx, sIdx, subIdx, editValue)}
                                autoFocus
                              />
                            ) : (
                              <span onClick={() => startEditing(`sub-${cIdx}-${sIdx}-${subIdx}`, sub)} className="cursor-pointer hover:text-accent transition-colors font-medium">{sub}</span>
                            )}
                          </div>
                          <button onClick={() => removeSubSection(cIdx, sIdx, subIdx)} className="w-6 h-6 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-sub/sub:opacity-100 text-slate-300 hover:text-red-500 transition-all"><X size={12} /></button>
                        </li>
                      ))}
                      <button 
                        onClick={() => addSubSection(cIdx, sIdx)}
                        className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-2 mt-6 hover:bg-accent/5 px-4 py-2 rounded-xl transition-all border border-accent/10"
                      >
                        <Plus size={12} /> {t('planEditor.addSubSection')}
                      </button>
                    </ul>
                  </div>
                ))}
                <button 
                  onClick={() => addSection(cIdx)}
                  className="w-full py-6 border-2 border-dashed border-slate-100 rounded-[32px] text-slate-300 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest"
                >
                  <Plus size={20} /> {t('planEditor.addSectionPart')} {cIdx + 1}
                </button>
              </div>
            </motion.div>
          ))}
          <button 
            onClick={addChapter}
            className="w-full py-12 border-2 border-dashed border-slate-200 rounded-[40px] text-slate-300 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex flex-col items-center justify-center gap-4 group"
          >
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all">
              <Plus size={32} />
            </div>
            <span className="text-xl font-serif font-bold">{t('planEditor.addNewPart')}</span>
          </button>
        </div>

        {/* Conclusion */}
        <div className="bg-academic-900 rounded-[32px] md:rounded-[40px] p-6 md:p-12 text-white shadow-2xl shadow-academic-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-white/5 rounded-full -mr-24 -mt-24 md:-mr-32 md:-mt-32 blur-3xl" />
          <div className="flex justify-between items-start mb-6 md:mb-8 relative z-10">
            <h3 className="text-2xl md:text-3xl font-serif font-bold">{t('planEditor.generalConclusion')}</h3>
            <button 
              onClick={() => startEditing('conclusion', plan.conclusion_generale)}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl text-white transition-all shrink-0 ml-4"
            >
              <Edit2 size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
          {editingId === 'conclusion' ? (
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 relative z-10">
              <textarea 
                className="academic-input flex-1 h-32 md:h-40 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm md:text-base" 
                value={editValue} 
                onChange={e => setEditValue(e.target.value)}
              />
              <button onClick={() => { setPlan({...plan, conclusion_generale: editValue}); setEditingId(null); }} className="w-full sm:w-12 md:w-14 h-12 md:h-14 bg-accent text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl shadow-accent/20 shrink-0"><Save size={20} className="md:w-6 md:h-6"/></button>
            </div>
          ) : (
            <p className="text-white/70 text-base md:text-lg leading-relaxed font-serif italic relative z-10">{plan.conclusion_generale || t('planEditor.noConclusion')}</p>
          )}
        </div>

        {/* Biblio */}
        <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-12 border border-slate-100 shadow-sm">
          <h3 className="text-xl md:text-2xl font-serif font-bold mb-6 md:mb-10 text-academic-900 flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center text-accent shrink-0">
              <Database size={16} className="md:w-5 md:h-5" />
            </div>
            {t('planEditor.indicativeBibliography')}
          </h3>
          <ul className="space-y-3 md:space-y-4">
            {plan.bibliographie_indicative?.map((item, i) => (
              <li key={i} className="text-xs md:text-sm text-slate-500 font-mono flex justify-between items-center group p-3 md:p-4 hover:bg-slate-50 rounded-xl md:rounded-2xl transition-all">
                {editingId === `bib-${i}` ? (
                  <input 
                    className="academic-input py-1.5 md:py-2 px-3 md:px-4 text-[10px] md:text-xs flex-1 mr-2 md:mr-4" 
                    value={editValue} 
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const b = [...plan.bibliographie_indicative]; b[i] = editValue; setPlan({...plan, bibliographie_indicative: b}); setEditingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span onClick={() => startEditing(`bib-${i}`, item)} className="cursor-pointer hover:text-accent flex-1 break-words mr-2">{item}</span>
                )}
                <button onClick={() => { const b = [...plan.bibliographie_indicative]; b.splice(i, 1); setPlan({...plan, bibliographie_indicative: b}); }} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all shrink-0 p-1"><Trash2 size={14} className="md:w-4 md:h-4"/></button>
              </li>
            ))}
            <button 
              onClick={() => setPlan({...plan, bibliographie_indicative: [...plan.bibliographie_indicative, t('planEditor.newReference')]})}
              className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-2 mt-6 md:mt-8 hover:bg-accent/5 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all border border-accent/10 w-fit"
            >
              <Plus size={12} className="md:w-3.5 md:h-3.5" /> {t('planEditor.addReference')}
            </button>
          </ul>
        </div>

        {/* Annexes */}
        <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-12 border border-slate-100 shadow-sm">
          <h3 className="text-xl md:text-2xl font-serif font-bold mb-6 md:mb-10 text-academic-900 flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center text-accent shrink-0">
              <Layout size={16} className="md:w-5 md:h-5" />
            </div>
            {t('planEditor.annexes')}
          </h3>
          <ul className="space-y-3 md:space-y-4">
            {(plan.annexes || []).map((item, i) => (
              <li key={i} className="text-xs md:text-sm text-slate-500 font-mono flex justify-between items-center group p-3 md:p-4 hover:bg-slate-50 rounded-xl md:rounded-2xl transition-all">
                {editingId === `annex-${i}` ? (
                  <input 
                    className="academic-input py-1.5 md:py-2 px-3 md:px-4 text-[10px] md:text-xs flex-1 mr-2 md:mr-4" 
                    value={editValue} 
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const a = [...(plan.annexes || [])]; a[i] = editValue; setPlan({...plan, annexes: a}); setEditingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span onClick={() => startEditing(`annex-${i}`, item)} className="cursor-pointer hover:text-accent flex-1 break-words mr-2">{item}</span>
                )}
                <button onClick={() => { const a = [...(plan.annexes || [])]; a.splice(i, 1); setPlan({...plan, annexes: a}); }} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all shrink-0 p-1"><Trash2 size={14} className="md:w-4 md:h-4"/></button>
              </li>
            ))}
            <button 
              onClick={() => setPlan({...plan, annexes: [...(plan.annexes || []), t('planEditor.newAnnex')]})}
              className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-2 mt-6 md:mt-8 hover:bg-accent/5 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all border border-accent/10 w-fit"
            >
              <Plus size={12} className="md:w-3.5 md:h-3.5" /> {t('planEditor.addAnnex')}
            </button>
          </ul>
        </div>
      </div>

      <div className="mt-20 md:mt-32 flex justify-center pb-20">
        <button onClick={handleSave} className="btn-primary bg-academic-900 hover:bg-academic-800 w-full max-w-2xl justify-center py-6 md:py-8 text-xl md:text-2xl shadow-2xl shadow-academic-900/20 rounded-3xl border-none">
          <Check size={32} className="md:w-10 md:h-10" />
          {t('planEditor.startWriting')}
        </button>
      </div>
    </div>
  );
}
