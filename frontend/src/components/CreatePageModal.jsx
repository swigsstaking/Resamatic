import { useState, useEffect } from 'react';
import { Plus, X, Sparkles, Image, Loader, Check, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { pagesApi, aiApi, mediaApi } from '../services/api';
import { mapAiContentToSections, distributeImagesToSections } from '../lib/aiPageBuilder';

export default function CreatePageModal({ siteId, site, isAdmin, existingPages, onCreated, onClose }) {
  const [pageList, setPageList] = useState([{ title: '', type: 'subpage', keyword: '', serviceFocus: '' }]);
  const [siteMedia, setSiteMedia] = useState([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiStep, setAiStep] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      mediaApi.getBySite(siteId).then(res => {
        setSiteMedia(res.media || []);
        setSelectedMediaIds((res.media || []).map(m => m._id));
      }).catch(() => {});
    }
  }, [siteId, isAdmin]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: files => setNewImages(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]),
  });

  const addPage = () => setPageList(prev => [...prev, { title: '', type: 'subpage', keyword: '', serviceFocus: '' }]);
  const removePage = (i) => setPageList(prev => prev.filter((_, j) => j !== i));
  const updatePage = (i, field, value) => setPageList(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p));

  const toggleMedia = (id) => setSelectedMediaIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleCreateWithoutAI = async () => {
    setLoading(true);
    try {
      for (const p of pageList) {
        if (!p.title.trim()) continue;
        await pagesApi.create(siteId, { title: p.title, keyword: p.keyword || '', type: p.type });
      }
      toast.success(pageList.length > 1 ? `${pageList.length} pages créées` : 'Page créée');
      onCreated();
    } catch { toast.error('Erreur création'); }
    finally { setLoading(false); }
  };

  const handleCreateWithAI = async () => {
    setLoading(true);
    const totalSteps = pageList.length + 3; // create + N pages AI + SEO + done
    let step = 0;
    const advance = (label) => { step++; setAiStep(label); setProgress(Math.round((step / totalSteps) * 100)); };

    try {
      // 1. Create all pages
      advance('Création des pages...');
      const createdPages = [];
      for (const p of pageList) {
        if (!p.title.trim()) continue;
        const result = await pagesApi.create(siteId, { title: p.title, keyword: p.keyword || '', type: p.type });
        createdPages.push({ conf: p, page: result.page });
      }

      // 2. Upload new images if any
      let allMediaIds = [...selectedMediaIds];
      if (newImages.length > 0) {
        for (const img of newImages) {
          try {
            const fd = new FormData();
            fd.append('image', img.file);
            const res = await mediaApi.upload(siteId, fd);
            if (res.media?._id) allMediaIds.push(res.media._id);
          } catch {}
        }
      }

      // 3. Build other pages list (existing + newly created) for services-grid links
      const allPages = [
        ...(existingPages || []).map(p => ({
          title: p.title, keyword: p.seo?.keywords?.[0] || '', serviceFocus: '', href: `${p.slug}.html`,
        })),
        ...createdPages.map(cp => ({
          title: cp.conf.title, keyword: cp.conf.keyword, serviceFocus: cp.conf.serviceFocus, href: `${cp.page.slug}.html`,
        })),
      ];

      // 4. AI generation per page
      for (let i = 0; i < createdPages.length; i++) {
        const { conf, page } = createdPages[i];
        if (!conf.keyword) continue;

        advance(`IA — Page ${i + 1}/${createdPages.length} : ${conf.keyword}`);
        try {
          const { content } = await aiApi.generatePage({
            siteId,
            keyword: conf.keyword,
            serviceFocus: conf.serviceFocus || conf.keyword,
          });

          const otherPages = allPages.filter(p => p.title !== conf.title);
          let sections = mapAiContentToSections(page.sections, content, {
            otherPages,
            currentPageIndex: i,
            siteBusiness: site?.business,
          });
          sections = distributeImagesToSections(sections, allMediaIds, existingPages.length + i);

          // Force keyword as H1 headline (exact text)
          if (conf.keyword) {
            const hero = sections.find(s => s.type === 'hero');
            if (hero) hero.data.headline = conf.keyword;
          }

          await pagesApi.updateSections(page._id, sections);
          if (content.seo) await pagesApi.update(page._id, { seo: content.seo });
        } catch (err) {
          console.error('AI generation error:', err);
          toast.error(`IA erreur : ${conf.keyword}`);
        }
      }

      // 5. Cross-page SEO optimization
      advance('Optimisation SEO inter-pages...');
      try { await aiApi.optimizeSeo(siteId); } catch {}

      setProgress(100);
      setAiStep('Terminé !');
      toast.success(createdPages.length > 1 ? `${createdPages.length} pages générées avec IA` : 'Page générée avec IA');
      setTimeout(() => onCreated(), 1000);
    } catch (err) {
      console.error('Create with AI error:', err);
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const hasKeyword = pageList.some(p => p.keyword.trim());
  const hasTitle = pageList.some(p => p.title.trim());

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-primary">Ajouter des pages</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Loading overlay */}
        {loading && aiStep && (
          <div className="p-6 text-center">
            <Loader size={32} className="animate-spin mx-auto text-accent mb-4" />
            <p className="text-sm font-medium text-primary mb-2">{aiStep}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400">{progress}%</p>
          </div>
        )}

        {/* Form */}
        {!loading && (
          <div className="p-6 space-y-6">
            {/* Pages list */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pages à créer</h3>
              <div className="space-y-4">
                {pageList.map((p, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 relative">
                    {pageList.length > 1 && (
                      <button onClick={() => removePage(i)} className="absolute top-3 right-3 text-gray-400 hover:text-danger">
                        <X size={16} />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Titre *</label>
                        <input value={p.title} onChange={e => updatePage(i, 'title', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: Nos prestations" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Type</label>
                        <select value={p.type} onChange={e => updatePage(i, 'type', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option value="homepage">Page d'accueil</option>
                          <option value="subpage">Sous-page</option>
                          <option value="contact">Page contact</option>
                          <option value="legal">Page légale</option>
                        </select>
                      </div>
                      {isAdmin && (
                        <>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Mot-clé SEO</label>
                            <input value={p.keyword} onChange={e => updatePage(i, 'keyword', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: plombier urgence Lyon" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Service principal</label>
                            <input value={p.serviceFocus} onChange={e => updatePage(i, 'serviceFocus', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: Dépannage plomberie" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addPage} className="mt-3 flex items-center gap-2 text-sm text-accent hover:underline">
                <Plus size={14} /> Ajouter une page
              </button>
            </div>

            {/* Image selection — admin only */}
            {isAdmin && siteMedia.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  <Image size={14} className="inline mr-1" />
                  Images du site ({selectedMediaIds.length} sélectionnées)
                </h3>
                <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                  {siteMedia.map(m => {
                    const thumb = m.variants?.find(v => v.width === 400) || m.variants?.[0];
                    const selected = selectedMediaIds.includes(m._id);
                    return (
                      <button key={m._id} onClick={() => toggleMedia(m._id)}
                        className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-colors ${selected ? 'border-accent' : 'border-transparent opacity-50'}`}>
                        <img src={`/uploads/${thumb?.storagePath || ''}`} alt="" className="w-full h-full object-cover" />
                        {selected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Dropzone for new images */}
                <div {...getRootProps()} className="mt-3 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-accent transition-colors">
                  <input {...getInputProps()} />
                  <p className="text-xs text-gray-400"><Upload size={14} className="inline mr-1" />Ajouter des images</p>
                </div>
                {newImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {newImages.map((img, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden">
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0 right-0 bg-black/50 rounded-bl p-0.5">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Annuler
            </button>
            <button onClick={handleCreateWithoutAI} disabled={!hasTitle}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
              Créer sans IA
            </button>
            {isAdmin && (
              <button onClick={handleCreateWithAI} disabled={!hasKeyword}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50">
                <Sparkles size={14} /> Créer avec IA
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
