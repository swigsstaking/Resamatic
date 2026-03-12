import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Globe, Settings, FileText, Trash2, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { sitesApi, deployApi } from '../services/api';
import PublishButton from '../components/PublishButton';

const STATUS_BADGES = {
  draft: 'bg-gray-100 text-gray-600',
  building: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { sites, loading, fetchSites, deleteSite } = useSiteStore();
  const navigate = useNavigate();

  useEffect(() => { fetchSites(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer le site "${name}" ? Cette action est irréversible.`)) return;
    try {
      await deleteSite(id);
      toast.success('Site supprimé');
    } catch { toast.error('Erreur lors de la suppression'); }
  };

  const handleDuplicate = async (id) => {
    try {
      const { site } = await sitesApi.duplicate(id);
      fetchSites();
      toast.success(`Site dupliqué : ${site.name}`);
    } catch { toast.error('Erreur lors de la duplication'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary">Mes sites</h1>
        <Link
          to="/sites/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={18} /> Nouveau site
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement...</div>
      ) : sites.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="mx-auto w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Aucun site pour le moment</p>
          <Link to="/sites/new" className="text-accent font-medium hover:underline">Créer votre premier site</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <div key={site._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-primary">{site.name}</h3>
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
                  <p className="text-sm text-gray-400 mb-4">{site.business.activity} - {site.business.city}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/sites/${site._id}/pages`} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <FileText size={14} /> Pages
                  </Link>
                  <Link to={`/sites/${site._id}/settings`} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <Settings size={14} /> Paramètres
                  </Link>
                  <PublishButton siteId={site._id} status={site.status} domain={site.domain} compact />
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => handleDuplicate(site._id)} className="text-gray-400 hover:text-gray-600" title="Dupliquer">
                    <Copy size={16} />
                  </button>
                  {site.status === 'published' && site.domain && (
                    <a href={`https://${site.domain}`} target="_blank" rel="noopener" className="text-gray-400 hover:text-accent" title="Voir le site">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
                <button onClick={() => handleDelete(site._id, site.name)} className="text-gray-400 hover:text-danger" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
