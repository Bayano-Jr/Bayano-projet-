import React, { useState, useEffect } from 'react';
import { Users, Edit2, Save, X, Search, ShieldAlert, Trash2, Ban, AlertOctagon } from 'lucide-react';
import { User } from '../types';
import { useAlert } from '../contexts/AlertContext';

export default function AdminUsers() {
  const { showAlert, showConfirm } = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const headers: Record<string, string> = {};
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      
      const res = await fetch('/api/admin/users', {
        headers,
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erreur réseau');
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
        }
      } catch (e) {
        console.error("Invalid JSON response:", text.substring(0, 100));
        setUsers([]);
      }
    } catch (err) {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (user: User) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = localStorage.getItem('bayano_sid');
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ plan: user.plan, credits: user.credits, status: user.status }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      
      setUsers(users.map(u => u.id === user.id ? user : u));
      setEditingUser(null);
    } catch (err) {
      showAlert({ message: 'Erreur lors de la mise à jour de l\'utilisateur', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm({
      title: 'Supprimer l\'utilisateur',
      message: 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?',
      confirmText: 'Supprimer',
      type: 'error',
      onConfirm: async () => {
        try {
          const headers: Record<string, string> = {};
          const sid = localStorage.getItem('bayano_sid');
          if (sid) {
            headers['Authorization'] = `Bearer ${sid}`;
          }
          
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers,
            credentials: 'include'
          });
          if (!res.ok) throw new Error('Erreur lors de la suppression');
          setUsers(users.filter(u => u.id !== id));
        } catch (err) {
          showAlert({ message: 'Erreur lors de la suppression de l\'utilisateur', type: 'error' });
        }
      }
    });
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement des utilisateurs...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div className="glass-card p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-accent shrink-0">
            <Users size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-academic-900">Utilisateurs & Abonnements</h2>
            <p className="text-slate-500 text-xs md:text-sm font-serif italic">Gérez les plans et les crédits.</p>
          </div>
        </div>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Rechercher un utilisateur (nom, email)..." 
          className="academic-input pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Utilisateur</th>
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Plan</th>
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Crédits</th>
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Statut</th>
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400">Inscription</th>
              <th className="p-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-academic-900">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="p-4">
                  {editingUser?.id === user.id ? (
                    <select 
                      className="academic-input py-1 px-2 h-auto text-sm"
                      value={editingUser.plan}
                      onChange={(e) => setEditingUser({...editingUser, plan: e.target.value as any})}
                    >
                      <option value="free">Gratuit</option>
                      <option value="student">Étudiant Plus</option>
                      <option value="premium">Premium</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      user.plan === 'premium' ? 'bg-academic-900 text-white' : 
                      user.plan === 'student' ? 'bg-accent text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {user.plan === 'premium' ? 'Premium' : user.plan === 'student' ? 'Étudiant' : 'Gratuit'}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {editingUser?.id === user.id ? (
                    <input 
                      type="number" 
                      className="academic-input py-1 px-2 h-auto text-sm w-24"
                      value={editingUser.credits}
                      onChange={(e) => setEditingUser({...editingUser, credits: parseInt(e.target.value) || 0})}
                    />
                  ) : (
                    <span className="font-bold text-slate-700">{user.credits || 0}</span>
                  )}
                </td>
                <td className="p-4">
                  {editingUser?.id === user.id ? (
                    <select 
                      className="academic-input py-1 px-2 h-auto text-sm"
                      value={editingUser.status || 'active'}
                      onChange={(e) => setEditingUser({...editingUser, status: e.target.value as any})}
                    >
                      <option value="active">Actif</option>
                      <option value="restricted">Restreint</option>
                      <option value="banned">Banni</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center w-max gap-1 ${
                      user.status === 'banned' ? 'bg-red-100 text-red-600' : 
                      user.status === 'restricted' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {user.status === 'banned' && <Ban size={12} />}
                      {user.status === 'restricted' && <AlertOctagon size={12} />}
                      {user.status === 'banned' ? 'Banni' : user.status === 'restricted' ? 'Restreint' : 'Actif'}
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {new Date(user.created_at || '').toLocaleDateString('fr-FR')}
                </td>
                <td className="p-4 text-right">
                  {editingUser?.id === user.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleSave(editingUser)} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors">
                        <Save size={16} />
                      </button>
                      <button onClick={() => setEditingUser(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setEditingUser(user)} className="p-2 text-slate-400 hover:text-accent transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Aucun utilisateur trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
