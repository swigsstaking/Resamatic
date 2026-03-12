import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles, Search, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { pagesApi, aiApi } from '../services/api';
import useSiteStore from '../stores/siteStore';

export default function SeoPage() {
  const { siteId } = useParams();
  const { currentSite } = useSiteStore();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [seo, setSeo] = useState({ title: '', description: '', keywords: [] });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const autoSaveTimer = useRef(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    (async () => {
      const { pages } = await pagesApi.getBySite(siteId);
      setPages(pages);
      if (pages.length) {
        setSelectedPageId(pages[0]._id);
        setSeo(pages[0].seo || { title: '', description: '', keywords: [] });
      }
      setLoading(false);
      setTimeout(() => { initialLoad.current = false; }, 100);
    })();
  }, [siteId]);

  const selectPage = (pageId) => {
    const page = pages.find(p => p._id === pageId);
    setSelectedPageId(pageId);
    setSeo(page?.seo || { title: '', description: '', keywords: [] });
    setDirty(false);
    setSaved(false);
    initialLoad.current = true;
    setTimeout(() => { initialLoad.current = false; }, 100);
  };

  const handleSave = useCallback(async () => {
    if (!selectedPageId) return;
    setSaving(true);
    try {
      await pagesApi.update(selectedPageId, { seo });
      setPages(prev => prev.map(p => p._id === selectedPageId ? { ...p, seo } : p));
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { toast.error('Erreur de sauvegarde'); }
    finally { setSaving(false); }
  }, [selectedPageId, seo]);

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!dirty || initialLoad.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { handleSave(); }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, seo, handleSave]);

  // Mark dirty on seo changes (skip initial load)
  const updateSeo = (updater) => {
    setSeo(updater);
    if (!initialLoad.current) setDirty(true);
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const page = pages.find(p => p._id === selectedPageId);
      const { seo: generated } = await aiApi.generateSeo({
        siteId,
        pageContent: { title: page.title, sections: page.sections },
      });
      updateSeo(prev => ({ ...prev, ...generated }));
      toast.success('SEO généré par l\'IA');
    } catch { toast.error('Erreur IA'); }
    finally { setAiGenerating(false); }
  };

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Search size={24} /> SEO
        </h1>
        <span className="text-sm text-gray-400 flex items-center gap-1.5" aria-live="polite">
          {saving && <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</>}
          {saved && !saving && <><CheckCircle size={14} className="text-green-500" /> Sauvegardé</>}
          {dirty && !saving && !saved && <span className="text-amber-500">Modifications non sauvegardées</span>}
        </span>
      </div>

      {/* Page selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" role="tablist" aria-label="Sélecteur de page">
        {pages.map(page => (
          <button
            key={page._id}
            onClick={() => selectPage(page._id)}
            role="tab"
            aria-selected={selectedPageId === page._id}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedPageId === page._id ? 'bg-accent text-primary' : 'bg-white border hover:border-accent'
            }`}
          >
            {page.title}
          </button>
        ))}
      </div>

      {selectedPageId && (
        <div className="bg-white rounded-xl p-6 space-y-6">
          {/* AI Button */}
          <button
            onClick={handleAIGenerate}
            disabled={aiGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 disabled:opacity-50"
          >
            <Sparkles size={16} /> {aiGenerating ? 'Génération...' : 'Générer avec l\'IA'}
          </button>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Title tag</label>
              <span className={`text-xs ${(seo.title?.length || 0) > 60 ? 'text-danger' : 'text-gray-400'}`}>{seo.title?.length || 0}/60</span>
            </div>
            <input
              value={seo.title || ''}
              onChange={e => updateSeo(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Title tag optimisé SEO"
            />
            {/* Preview */}
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-blue-700 text-lg font-medium truncate">{seo.title || 'Titre de la page'}</p>
              <p className="text-green-700 text-sm">{currentSite?.domain ? `https://${currentSite.domain}` : 'https://example.com'}</p>
              <p className="text-gray-600 text-sm line-clamp-2">{seo.description || 'Meta description de la page...'}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Meta description</label>
              <span className={`text-xs ${(seo.description?.length || 0) > 155 ? 'text-danger' : 'text-gray-400'}`}>{seo.description?.length || 0}/155</span>
            </div>
            <textarea
              value={seo.description || ''}
              onChange={e => updateSeo(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg resize-y"
              placeholder="Description engageante avec mots-clés"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Mots-clés (séparés par des virgules)</label>
            <input
              value={(seo.keywords || []).join(', ')}
              onChange={e => updateSeo(prev => ({
                ...prev,
                keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
              }))}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="mot-clé 1, mot-clé 2, mot-clé 3"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {(seo.keywords || []).map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">{kw}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
