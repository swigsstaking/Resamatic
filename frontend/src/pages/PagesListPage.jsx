import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Plus, Trash2, Eye, GripVertical, Link2 } from 'lucide-react';
import { useIsAdmin } from '../stores/authStore';
import toast from 'react-hot-toast';
import { pagesApi, buildApi } from '../services/api';
import PublishButton from '../components/PublishButton';
import CreatePageModal from '../components/CreatePageModal';
import useSiteStore from '../stores/siteStore';
import { trackSitePreview, trackEvent } from '../lib/posthog';

export default function PagesListPage() {
  const { siteId } = useParams();
  const isAdmin = useIsAdmin();
  const { currentSite } = useSiteStore();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const fetchPages = async () => {
    try {
      const { pages } = await pagesApi.getBySite(siteId);
      setPages(pages);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPages(); }, [siteId]);

  const handleDelete = async () => {
    if (!deleteModal || !deleteConfirmed) return;
    try {
      await pagesApi.delete(deleteModal._id);
      trackEvent('page_deleted', { site_id: siteId, page_title: deleteModal.title });
      toast.success('Page supprimée');
      setDeleteModal(null);
      setDeleteConfirmed(false);
      fetchPages();
    } catch { toast.error('Erreur'); }
  };

  const handlePreview = async () => {
    try {
      await buildApi.trigger(siteId);
      trackSitePreview(siteId);
      toast.success('Build lancé — aperçu dans quelques secondes');
      setTimeout(() => {
        window.open(`/api/build/${siteId}/preview/index.html`, '_blank');
      }, 3000);
    } catch { toast.error('Erreur de build'); }
  };

  const handleCopyPreviewLink = async () => {
    try {
      await buildApi.trigger(siteId);
      const apiBase = import.meta.env.VITE_API_URL || window.location.origin + '/api';
      const previewUrl = `${apiBase}/build/${siteId}/preview/index.html`;
      await navigator.clipboard.writeText(previewUrl);
      toast.success('Lien d\'aperçu copié !');
    } catch { toast.error('Erreur'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Pages</h1>
        <div className="flex gap-3">
          <button onClick={handlePreview} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            <Eye size={16} /> Aperçu
          </button>
          <button onClick={handleCopyPreviewLink} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" title="Copier le lien d'aperçu pour le partager">
            <Link2 size={16} /> Copier le lien
          </button>
          {isAdmin && <PublishButton siteId={siteId} status={currentSite?.status} domain={currentSite?.domain} />}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-accent text-primary rounded-lg hover:opacity-90">
            <Plus size={16} /> Nouvelle page
          </button>
        </div>
      </div>

      {showCreate && (
        <CreatePageModal
          siteId={siteId}
          site={currentSite}
          isAdmin={isAdmin}
          existingPages={pages}
          onCreated={() => { setShowCreate(false); fetchPages(); }}
          onClose={() => setShowCreate(false)}
        />
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${page.type === 'homepage' ? 'bg-blue-100 text-blue-600' : page.type === 'contact' ? 'bg-green-100 text-green-600' : page.type === 'legal' ? 'bg-gray-100 text-gray-500' : page.type === 'city' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                      {page.type === 'city' ? 'ville' : page.type}
                    </span>
                    {page.isMainHomepage && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">index</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/sites/${siteId}/pages/${page._id}`} className="text-sm text-accent hover:underline">Éditer</Link>
                {isAdmin && (
                  <button onClick={() => setDeleteModal(page)} className="text-gray-400 hover:text-danger" aria-label={`Supprimer ${page.title}`}>
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
            <h2 className="text-lg font-bold text-primary text-center mb-2">Supprimer la page</h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              Supprimer <strong>"{deleteModal.title}"</strong> ?
            </p>
            <p className="text-xs text-gray-400 text-center mb-4">Cette action est irréversible.</p>
            <label className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-lg cursor-pointer select-none border transition-colors ${deleteConfirmed ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${deleteConfirmed ? 'bg-red-600 border-red-600' : 'border-gray-300 bg-white'}`}>
                {deleteConfirmed && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <input type="checkbox" checked={deleteConfirmed} onChange={e => setDeleteConfirmed(e.target.checked)} className="sr-only" />
              <span className={`text-sm font-medium ${deleteConfirmed ? 'text-red-700' : 'text-gray-600'}`}>Je confirme vouloir supprimer cette page</span>
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
