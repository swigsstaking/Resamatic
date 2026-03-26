import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Key, X, Shield, User, RefreshCw, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi, sitesApi } from '../services/api';
import useAuthStore from '../stores/authStore';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [allSites, setAllSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showResetModal, setShowResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const currentUser = useAuthStore(s => s.user);

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'client', assignedSites: [],
  });
  const [copied, setCopied] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const symbols = '!@#$%&*';
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    pw += symbols[Math.floor(Math.random() * symbols.length)];
    pw += Math.floor(Math.random() * 10);
    return pw;
  };

  const handleGenerate = (target) => {
    const pw = generatePassword();
    if (target === 'form') {
      setForm(p => ({ ...p, password: pw }));
    } else {
      setNewPassword(pw);
    }
  };

  const handleCopyPassword = async (pw, target) => {
    await navigator.clipboard.writeText(pw);
    if (target === 'form') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedReset(true); setTimeout(() => setCopiedReset(false), 2000); }
  };

  const fetchData = async () => {
    try {
      const [usersRes, sitesRes] = await Promise.all([usersApi.getAll(), sitesApi.getAll()]);
      setUsers(usersRes.users);
      setAllSites(sitesRes.sites);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'client', assignedSites: [] });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      assignedSites: (user.assignedSites || []).map(s => typeof s === 'object' ? s._id : s),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        const { password, ...data } = form;
        const { user } = await usersApi.update(editingUser._id, data);
        setUsers(prev => prev.map(u => u._id === user._id ? user : u));
        toast.success('Utilisateur modifié');
      } else {
        if (!form.password) { toast.error('Mot de passe requis'); return; }
        const { user } = await usersApi.create(form);
        setUsers(prev => [user, ...prev]);
        toast.success('Utilisateur créé');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.error || 'Erreur');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer l'utilisateur "${name}" ?`)) return;
    try {
      await usersApi.delete(id);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('Utilisateur supprimé');
    } catch (err) {
      toast.error(err.error || 'Erreur');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const { user: updated } = await usersApi.update(user._id, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
      toast.success(updated.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé');
    } catch { toast.error('Erreur'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword) { toast.error('Mot de passe requis'); return; }
    try {
      await usersApi.resetPassword(showResetModal._id, { newPassword });
      toast.success('Mot de passe réinitialisé');
      setShowResetModal(null);
      setNewPassword('');
    } catch { toast.error('Erreur'); }
  };

  const toggleSite = (siteId) => {
    setForm(prev => ({
      ...prev,
      assignedSites: prev.assignedSites.includes(siteId)
        ? prev.assignedSites.filter(id => id !== siteId)
        : [...prev.assignedSites, siteId],
    }));
  };

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Users size={24} /> Gestion des utilisateurs
        </h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-primary rounded-lg font-medium hover:opacity-90 transition-opacity">
          <Plus size={18} /> Nouvel utilisateur
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sites</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                    {user.role === 'admin' ? 'Admin' : 'Client'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.role === 'admin' ? (
                    <span className="text-gray-400">Tous</span>
                  ) : (
                    <span>{(user.assignedSites || []).map(s => typeof s === 'object' ? s.name : s).join(', ') || '—'}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={user._id === currentUser?._id}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    } ${user._id === currentUser?._id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                  >
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(user)} className="text-gray-400 hover:text-gray-600" title="Modifier">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => { setShowResetModal(user); setNewPassword(''); }} className="text-gray-400 hover:text-amber-600" title="Réinitialiser le mot de passe">
                      <Key size={16} />
                    </button>
                    {user._id !== currentUser?._id && (
                      <button onClick={() => handleDelete(user._id, user.name)} className="text-gray-400 hover:text-danger" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400">Aucun utilisateur</div>
        )}
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Header fixe */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-primary">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                  <div className="flex gap-2">
                    <input type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono text-sm" placeholder="Saisir ou générer" />
                    <button type="button" onClick={() => handleGenerate('form')} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="Générer un mot de passe">
                      <RefreshCw size={16} />
                    </button>
                    <button type="button" onClick={() => handleCopyPassword(form.password, 'form')} disabled={!form.password} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-30" title="Copier le mot de passe">
                      {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-white">
                  <option value="admin">Admin</option>
                  <option value="client">Client</option>
                </select>
              </div>

              {form.role === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sites assignés</label>
                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {allSites.map(site => (
                      <label key={site._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.assignedSites.includes(site._id)}
                          onChange={() => toggleSite(site._id)}
                          className="rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{site.name}</p>
                          {site.domain && <p className="text-xs text-gray-400">{site.domain}</p>}
                        </div>
                      </label>
                    ))}
                    {allSites.length === 0 && (
                      <p className="text-sm text-gray-400 p-4 text-center">Aucun site disponible</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer fixe */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Annuler
              </button>
              <button onClick={handleSave} className="px-5 py-2 bg-accent text-primary rounded-lg font-medium text-sm hover:opacity-90">
                {editingUser ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset mot de passe */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowResetModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-500 mb-4">Pour : <strong>{showResetModal.name}</strong> ({showResetModal.email})</p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Saisir ou générer"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono text-sm"
              />
              <button type="button" onClick={() => handleGenerate('reset')} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="Générer">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={() => handleCopyPassword(newPassword, 'reset')} disabled={!newPassword} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-30" title="Copier">
                {copiedReset ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowResetModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Annuler
              </button>
              <button onClick={handleResetPassword} className="px-5 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:opacity-90">
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
