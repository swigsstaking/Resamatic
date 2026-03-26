import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Globe, Pencil, Eye, Trash2, Copy, ExternalLink, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { useIsAdmin } from '../stores/authStore';
import { sitesApi, deployApi } from '../services/api';
import PublishButton from '../components/PublishButton';
import { trackEvent } from '../lib/posthog';

const STATUS_BADGES = {
  draft: 'bg-gray-100 text-gray-600',
  building: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { sites, loading, fetchSites, deleteSite } = useSiteStore();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  useEffect(() => { fetchSites(); }, []);

  const filteredSites = sites.filter(site => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      site.name?.toLowerCase().includes(q) ||
      site.domain?.toLowerCase().includes(q) ||
      site.business?.city?.toLowerCase().includes(q) ||
      site.business?.activity?.toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteSite(deleteModal._id);
      trackEvent('site_deleted', { site_id: deleteModal._id, site_name: deleteModal.name });
      toast.success('Site supprimé');
      setDeleteModal(null);
      setDeleteConfirmed(false);
    } catch { toast.error('Erreur lors de la suppression'); }
  };

  const handleDuplicate = async (id) => {
    try {
      const { site } = await sitesApi.duplicate(id);
      trackEvent('site_duplicated', { source_site_id: id, new_site_id: site._id, site_name: site.name });
      fetchSites();
      toast.success(`Site dupliqué : ${site.name}`);
    } catch { toast.error('Erreur lors de la duplication'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Mes sites</h1>
        {isAdmin && (
          <Link
            to="/sites/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-primary rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={18} /> Nouveau site
          </Link>
        )}
      </div>

      {/* Barre de recherche */}
      {sites.length > 0 && (
        <div className="relative mb-6">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un site par nom, ville, domaine..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-accent focus:border-accent text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement...</div>
      ) : sites.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="mx-auto w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Aucun site pour le moment</p>
          <Link to="/sites/new" className="text-accent font-medium hover:underline">Créer votre premier site</Link>
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-16">
          <Search className="mx-auto w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">Aucun site ne correspond à "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSites.map((site) => (
            <div key={site._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={(e) => { if (e.target.closest('button, a')) return; navigate(`/sites/${site._id}/pages`); }}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-lg text-primary">{site.name}</h2>
                    {site.domain && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Globe size={14} /> {site.domain}
                      </p>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[site.status] || STATUS_BADGES.draft}`}>
                    {site.status}
                  </span>
                </div>

                {site.business?.city && (
                  <p className="text-sm text-gray-500 mb-4">{site.business.activity} - {site.business.city}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/sites/${site._id}/pages`} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" onClick={e => e.stopPropagation()}>
                    <Pencil size={14} /> Modifier
                  </Link>
                  <Link to={`/sites/${site._id}/pages`} state={{ preview: true }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" onClick={e => e.stopPropagation()}>
                    <Eye size={14} /> Aperçu
                  </Link>
                  {isAdmin && <PublishButton siteId={site._id} status={site.status} domain={site.domain} compact />}
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-2">
                  {isAdmin && (
                    <button onClick={() => handleDuplicate(site._id)} className="text-gray-400 hover:text-gray-600" aria-label={`Dupliquer ${site.name}`}>
                      <Copy size={16} />
                    </button>
                  )}
                  {site.status === 'published' && site.domain && (
                    <a href={`https://${site.domain}`} target="_blank" rel="noopener" className="text-gray-400 hover:text-accent" aria-label={`Voir ${site.domain}`}>
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
                {isAdmin && (
                  <button onClick={() => setDeleteModal(site)} className="text-gray-400 hover:text-danger" aria-label={`Supprimer ${site.name}`}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setDeleteModal(null); setDeleteConfirmed(false); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-primary text-center mb-2">Supprimer le site</h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              Supprimer <strong>"{deleteModal.name}"</strong> et toutes ses pages et médias ?
            </p>
            {deleteModal.status === 'published' && deleteModal.domain && (
              <p className="text-sm text-red-600 text-center mb-2">
                Le site <strong>{deleteModal.domain}</strong> sera mis hors ligne.
              </p>
            )}
            <p className="text-xs text-gray-400 text-center mb-4">Cette action est irréversible.</p>
            <label className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-lg cursor-pointer select-none border transition-colors ${deleteConfirmed ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${deleteConfirmed ? 'bg-red-600 border-red-600' : 'border-gray-300 bg-white'}`}>
                {deleteConfirmed && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <input type="checkbox" checked={deleteConfirmed} onChange={e => setDeleteConfirmed(e.target.checked)} className="sr-only" />
              <span className={`text-sm font-medium ${deleteConfirmed ? 'text-red-700' : 'text-gray-600'}`}>Je confirme vouloir supprimer définitivement ce site</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteModal(null); setDeleteConfirmed(false); }} className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={!deleteConfirmed}
                className={`flex-1 px-4 py-2.5 text-sm text-white rounded-lg font-medium transition-colors ${deleteConfirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
