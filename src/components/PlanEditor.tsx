import React, { useState } from 'react';
import { Check, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { PlanStructure } from '../types';

interface PlanEditorProps {
  plan: PlanStructure;
  onValidate: (updatedPlan: PlanStructure) => void;
}

export default function PlanEditor({ plan: initialPlan, onValidate }: PlanEditorProps) {
  const [plan, setPlan] = useState<PlanStructure>(initialPlan);
  const [editingIndex, setEditingIndex] = useState<{chap: number, sec?: number, sub?: number} | null>(null);

  const handleSave = () => {
    onValidate(plan);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-3xl mb-2">Structure du Mémoire</h2>
          <p className="text-gray-500">Vérifiez et ajustez le plan généré par l'IA avant de lancer la rédaction.</p>
        </div>
        <button onClick={handleSave} className="btn-primary bg-green-600 hover:bg-green-700">
          <Check size={20} />
          Valider le plan
        </button>
      </header>

      <div className="space-y-6">
        {/* Intro */}
        <div className="glass-card p-6 border-l-4 border-accent">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-accent">0.</span> Introduction Générale
          </h3>
          <p className="text-gray-600 italic text-sm">{plan.introduction_generale}</p>
        </div>

        {/* Chapters */}
        {plan.chapitres.map((chap, cIdx) => (
          <div key={cIdx} className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="text-accent">Chapitre {cIdx + 1}.</span> {chap.titre}
              </h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Edit2 size={16} /></button>
                <button className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="space-y-4 ml-6">
              {chap.sections.map((sec, sIdx) => (
                <div key={sIdx} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    {cIdx + 1}.{sIdx + 1}. {sec.titre}
                  </h4>
                  <ul className="space-y-2 ml-4">
                    {sec.sous_sections.map((sub, subIdx) => (
                      <li key={subIdx} className="text-sm text-gray-600 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        {sub}
                      </li>
                    ))}
                    <button className="text-xs text-accent flex items-center gap-1 mt-2 hover:underline">
                      <Plus size={12} /> Ajouter une sous-section
                    </button>
                  </ul>
                </div>
              ))}
              <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
                <Plus size={18} /> Ajouter une section
              </button>
            </div>
          </div>
        ))}

        {/* Conclusion */}
        <div className="glass-card p-6 border-l-4 border-accent">
          <h3 className="text-lg font-bold mb-2">Conclusion Générale</h3>
          <p className="text-gray-600 italic text-sm">{plan.conclusion_generale}</p>
        </div>

        {/* Biblio */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4">Bibliographie Indicative</h3>
          <ul className="space-y-2">
            {plan.bibliographie_indicative.map((item, i) => (
              <li key={i} className="text-sm text-gray-500 font-mono">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <button onClick={handleSave} className="btn-primary bg-green-600 hover:bg-green-700 w-full max-w-md justify-center py-4 text-lg">
          <Check size={24} />
          Confirmer la structure et lancer la rédaction
        </button>
      </div>
    </div>
  );
}
