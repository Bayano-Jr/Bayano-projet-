import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, FileText, TrendingUp, Activity, Award, CreditCard, Cpu } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers: Record<string, string> = {};
    const sid = localStorage.getItem('bayano_admin_token');
    if (sid) {
      headers['Authorization'] = `Bearer ${sid}`;
    }

    fetch('/api/admin/stats', {
      headers,
      credentials: 'include'
    })
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error("Invalid JSON response:", text.substring(0, 100));
          return { error: "Erreur serveur" };
        }
      })
      .then(data => {
        if (data.error) {
          console.error("Stats error:", data.error);
          setStats(null);
        } else {
          setStats(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setStats(null);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement du tableau de bord...</div>;
  if (!stats) return <div className="p-10 text-center text-red-500">Erreur de chargement</div>;

  const COLORS = ['#0f172a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Utilisateurs</p>
            <p className="text-3xl font-bold text-academic-900">{stats.totalUsers}</p>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Projets Générés</p>
            <p className="text-3xl font-bold text-academic-900">{stats.totalProjects}</p>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Revenus Estimés</p>
            <p className="text-3xl font-bold text-academic-900">{stats.totalRevenue}€</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-academic-900 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-accent" /> Répartition par Plan
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.usersByPlan || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="plan"
                >
                  {(stats.usersByPlan || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-academic-900 mb-6 flex items-center gap-2">
            <Cpu size={20} className="text-accent" /> Modèles IA Utilisés
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.projectsByModel || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="aiModel"
                >
                  {(stats.projectsByModel || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-academic-900 mb-6 flex items-center gap-2">
            <FileText size={20} className="text-accent" /> Types de Documents
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.projectsByType || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="documentType" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-academic-900 mb-6 flex items-center gap-2">
            <Award size={20} className="text-accent" /> Top Utilisateurs (Projets)
          </h3>
          <div className="space-y-4">
            {(stats.topUsers || []).map((user: any, index: number) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-academic-900 text-white rounded-full flex items-center justify-center font-bold text-xs">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-academic-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-accent">{user.project_count}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Projets</p>
                </div>
              </div>
            ))}
            {(stats.topUsers || []).length === 0 && <p className="text-slate-500 text-sm">Aucune donnée.</p>}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-academic-900 mb-6 flex items-center gap-2">
            <CreditCard size={20} className="text-accent" /> Dernières Transactions
          </h3>
          <div className="space-y-4">
            {(stats.recentTransactions || []).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-bold text-sm text-academic-900">{tx.user_name}</p>
                  <p className="text-xs text-slate-500">{tx.type} - {new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">+{tx.amount}€</p>
                </div>
              </div>
            ))}
            {(stats.recentTransactions || []).length === 0 && <p className="text-slate-500 text-sm">Aucune transaction.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
