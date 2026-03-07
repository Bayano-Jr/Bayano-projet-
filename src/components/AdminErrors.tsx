import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Search, RefreshCcw } from 'lucide-react';

export default function AdminErrors() {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchErrors();
  }, []);

  const fetchErrors = () => {
    setLoading(true);
    const headers: Record<string, string> = {};
    const sid = localStorage.getItem('bayano_sid');
    if (sid) {
      headers['Authorization'] = `Bearer ${sid}`;
    }
    
    fetch('/api/admin/errors', {
      headers,
      credentials: 'include'
    })
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error("Invalid JSON response:", text.substring(0, 100));
          return [];
        }
      })
      .then(data => {
        if (Array.isArray(data)) {
          setErrors(data);
        } else {
          setErrors([]);
        }
        setLoading(false);
      })
      .catch(console.error);
  };

  const filteredErrors = errors.filter(e => 
    e.error_message.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.user_email && e.user_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement des erreurs...</div>;

  return (
    <div className="glass-card p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-red-50 rounded-xl md:rounded-2xl flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangle size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Journal des Erreurs</h2>
            <p className="text-slate-500 text-xs md:text-sm font-serif italic">Détectez et corrigez les bugs fréquents.</p>
          </div>
        </div>
        <button onClick={fetchErrors} className="p-2 text-slate-400 hover:text-academic-900 transition-colors">
          <RefreshCcw size={20} />
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Rechercher une erreur, un utilisateur..." 
          className="academic-input pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredErrors.map(error => (
          <div key={error.id} className="border border-red-100 bg-red-50/30 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-red-900 text-lg mb-1">{error.error_message}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="font-bold text-slate-700">{new Date(error.created_at).toLocaleString('fr-FR')}</span>
                  {error.user_email && (
                    <>
                      <span>•</span>
                      <span className="text-academic-900">{error.user_email}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {error.context && error.context !== 'null' && (
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contexte</p>
                <pre className="bg-white p-3 rounded-xl text-xs font-mono text-slate-700 overflow-x-auto border border-slate-100">
                  {error.context}
                </pre>
              </div>
            )}

            {error.error_stack && (
              <details className="group">
                <summary className="text-xs font-bold text-red-600 cursor-pointer hover:text-red-700 transition-colors list-none flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center group-open:rotate-90 transition-transform">
                    ▶
                  </span>
                  Voir la Stack Trace
                </summary>
                <pre className="mt-3 bg-slate-900 p-4 rounded-xl text-[10px] font-mono text-red-400 overflow-x-auto leading-relaxed">
                  {error.error_stack}
                </pre>
              </details>
            )}
          </div>
        ))}
        {filteredErrors.length === 0 && (
          <div className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <AlertTriangle size={32} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-serif">Aucune erreur trouvée.</p>
          </div>
        )}
      </div>
    </div>
  );
}
