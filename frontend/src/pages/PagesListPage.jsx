import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Plus, Trash2, Eye, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { pagesApi, buildApi } from '../services/api';
import PublishButton from '../components/PublishButton';
import useSiteStore from '../stores/siteStore';

export default function PagesListPage() {
  const { siteId } = useParams();
  const { currentSite } = useSiteStore();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPage, setNewPage] = useState({ title: '', type: 'homepage' });

  const fetchPages = async () => {
    try {
      const { pages } = await pagesApi.getBySite(siteId);
      setPages(pages);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPages(); }, [siteId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await pagesApi.create(siteId, newPage);
      toast.success('Page créée');
      setShowCreate(false);
      setNewPage({ title: '', type: 'homepage' });
      fetchPages();
    } catch { toast.error('Erreur'); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    try {
      await pagesApi.delete(id);
      toast.success('Page supprimée');
      fetchPages();
    } catch { toast.error('Erreur'); }
  };

  const handlePreview = async () => {
    try {
      await buildApi.trigger(siteId);
      toast.success('Build lancé — aperçu dans quelques secondes');
      setTimeout(() => {
        window.open(`/api/build/${siteId}/preview/index.html`, '_blank');
      }, 3000);
    } catch { toast.error('Erreur de build'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Pages</h1>
        <div className="flex gap-3">
          <button onClick={handlePreview} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            <Eye size={16} /> Aperçu
          </button>
          <PublishButton siteId={siteId} status={currentSite?.status} domain={currentSite?.domain} />
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-accent text-primary rounded-lg hover:opacity-90">
            <Plus size={16} /> Nouvelle page
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
            <input value={newPage.title} onChange={e => setNewPage(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={newPage.type} onChange={e => setNewPage(p => ({ ...p, type: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
              <option value="homepage">Page d'accueil</option>
              <option value="subpage">Sous-page</option>
              <option value="contact">Page contact</option>
              <option value="legal">Page légale</option>
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-accent text-primary rounded-lg text-sm">Créer</button>
          <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-500 text-sm">Annuler</button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-10">Chargement...</p>
      ) : pages.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="mx-auto w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500">Aucune page</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <div key={page._id} className="bg-white rounded-lg border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <GripVertical size={16} className="text-gray-300" aria-hidden="true" />
                <div>
                  <Link to={`/sites/${siteId}/pages/${page._id}`} className="font-medium text-primary hover:text-accent">
                    {page.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">/{page.slug}.html</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${page.type === 'homepage' ? 'bg-blue-100 text-blue-600' : page.type === 'contact' ? 'bg-green-100 text-green-600' : page.type === 'legal' ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
                      {page.type}
                    </span>
                    {page.isMainHomepage && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">index</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/sites/${siteId}/pages/${page._id}`} className="text-sm text-accent hover:underline">Éditer</Link>
                <button onClick={() => handleDelete(page._id, page.title)} className="text-gray-400 hover:text-danger" aria-label={`Supprimer ${page.title}`}>
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
