import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Sparkles, ChevronUp, ChevronDown, RefreshCw,
  PanelLeftClose, PanelLeftOpen, ArrowLeft, Loader2,
  Trash2, Plus, Palette, Image as ImageIcon, LayoutTemplate,
  FileText, CheckCircle, Star, Megaphone, Wrench, Shield,
  MessageSquare, HelpCircle, Users, MapPin, ChevronDown as ChevDown,
  Monitor, Tablet, Smartphone, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pagesApi, buildApi, aiApi } from '../services/api';
import useSiteStore from '../stores/siteStore';
import MediaPicker from '../components/MediaPicker';
import RichTextEditor from '../components/RichTextEditor';

const SECTION_META = {
  'hero':             { label: 'Hero',               icon: LayoutTemplate },
  'text-highlight':   { label: 'Accroche',            icon: FileText },
  'description':      { label: 'Description',        icon: FileText },
  'why-us':           { label: 'Pourquoi nous',      icon: CheckCircle },
  'google-reviews':   { label: 'Avis Google',        icon: Star },
  'cta-banner':       { label: 'Bandeau CTA',        icon: Megaphone },
  'services-grid':    { label: 'Services (grille)',   icon: Wrench },
  'services-detail':  { label: 'Services (détail)',  icon: Wrench },
  'guarantee':        { label: 'Garantie',            icon: Shield },
  'testimonials':     { label: 'Témoignages',        icon: MessageSquare },
  'faq':              { label: 'FAQ',                 icon: HelpCircle },
  'team':             { label: 'Équipe',             icon: Users },
  'map':              { label: 'Carte',               icon: MapPin },
};

function getSectionMeta(type) {
  return SECTION_META[type] || { label: type, icon: LayoutTemplate };
}

const VIEWPORT_MODES = [
  { key: 'desktop', icon: Monitor, label: 'Bureau' },
  { key: 'tablet', icon: Tablet, label: 'Tablette' },
  { key: 'mobile', icon: Smartphone, label: 'Mobile' },
];
const VIEWPORT_WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' };

export default function PageEditorPage() {
  const { siteId, pageId } = useParams();
  const navigate = useNavigate();
  const { currentSite, fetchSite, updateSite } = useSiteStore();
  const [page, setPage] = useState(null);
  const [allPages, setAllPages] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaCallback, setMediaCallback] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [viewport, setViewport] = useState('desktop');
  const [editingHeader, setEditingHeader] = useState(false);
  const iframeRef = useRef(null);
  const pageRef = useRef(null);
  const allPagesRef = useRef([]);
  const autoSaveTimer = useRef(null);
  const savingRef = useRef(false);
  const needsFullReload = useRef(false);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { allPagesRef.current = allPages; }, [allPages]);
  useEffect(() => { if (siteId) fetchSite(siteId); }, [siteId]);

  // Fetch all pages for nav link matching
  useEffect(() => {
    (async () => {
      try {
        const { pages } = await pagesApi.getBySite(siteId);
        setAllPages(pages);
      } catch {}
    })();
  }, [siteId]);

  // --- Data fetching ---
  const fetchPage = async () => {
    try {
      const { page: p } = await pagesApi.getOne(pageId);
      setPage(p);
      setDirty(false);
      if (p.sections?.length) setSelectedSection(0);
    } catch {
      toast.error('Impossible de charger la page');
      navigate(`/sites/${siteId}/pages`);
    }
  };
  useEffect(() => { fetchPage(); }, [pageId]);

  // --- PostMessage to iframe ---
  const postToIframe = useCallback((msg) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    }
  }, []);

  // --- Update section data ---
  const updateSectionData = useCallback((sectionIdx, field, value) => {
    setPage(prev => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      const data = { ...sections[sectionIdx].data };
      const keys = field.split('.');
      if (keys.length === 1) {
        data[field] = value;
      } else {
        let obj = data;
        for (let i = 0; i < keys.length - 1; i++) {
          if (Array.isArray(obj[keys[i]])) {
            obj[keys[i]] = [...obj[keys[i]]];
            obj = obj[keys[i]];
          } else {
            obj[keys[i]] = { ...obj[keys[i]] };
            obj = obj[keys[i]];
          }
        }
        obj[keys[keys.length - 1]] = value;
      }
      sections[sectionIdx] = { ...sections[sectionIdx], data };

      const sectionType = sections[sectionIdx].type;
      if (keys.length === 1 && typeof value === 'string' && !field.endsWith('MediaId') && field !== 'style') {
        postToIframe({ type: 'resamatic:updateField', sectionType, field, value });
      } else if (field !== 'style') {
        // Image changes, list changes, etc. need a full rebuild+reload
        needsFullReload.current = true;
      }
      if (field === 'style' && typeof value === 'object') {
        postToIframe({
          type: 'resamatic:updateStyle',
          sectionType,
          backgroundColor: value.backgroundColor || '',
          textColor: value.textColor || '',
        });
      }

      return { ...prev, sections };
    });
    setDirty(true);
  }, [postToIframe]);

  // --- Toggle visibility ---
  const toggleVisibility = (idx) => {
    setPage(prev => {
      const sections = [...prev.sections];
      const newVisible = !sections[idx].visible;
      sections[idx] = { ...sections[idx], visible: newVisible };
      postToIframe({
        type: 'resamatic:toggleSection',
        sectionType: sections[idx].type,
        visible: newVisible,
      });
      return { ...prev, sections };
    });
    needsFullReload.current = true;
    setDirty(true);
  };

  const moveSection = (idx, dir) => {
    setPage(prev => {
      const sections = [...prev.sections];
      const target = idx + dir;
      if (target < 0 || target >= sections.length) return prev;
      [sections[idx], sections[target]] = [sections[target], sections[idx]];
      sections.forEach((s, i) => s.order = i);
      return { ...prev, sections };
    });
    if (selectedSection === idx) setSelectedSection(idx + dir);
    needsFullReload.current = true;
    setDirty(true);
  };

  // --- Select section ---
  const selectSection = (idx) => {
    setSelectedSection(idx);
    setEditingHeader(false);
    const section = pageRef.current?.sections?.[idx];
    if (section) {
      postToIframe({ type: 'resamatic:selectSection', sectionType: section.type });
    }
  };

  // --- Save + rebuild ---
  const handleSave = useCallback(async (forceReload = false) => {
    const currentPage = pageRef.current;
    if (!currentPage || savingRef.current) return;
    const shouldReload = forceReload || needsFullReload.current;
    needsFullReload.current = false;
    savingRef.current = true;
    setSaving(true);
    try {
      await pagesApi.update(pageId, {
        title: currentPage.title,
        seo: currentPage.seo,
        sections: currentPage.sections,
      });
      setDirty(false);
      if (shouldReload) {
        setBuilding(true);
        // Save iframe scroll position before rebuild
        let savedScrollY = 0;
        try { savedScrollY = iframeRef.current?.contentWindow?.scrollY || 0; } catch {}
        await buildApi.trigger(siteId);
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const { status } = await buildApi.status(siteId);
            if (status !== 'building' || attempts > 20) {
              clearInterval(poll);
              setBuilding(false);
              if (iframeRef.current) {
                setIframeReady(false);
                const restoreScroll = () => {
                  try { iframeRef.current.contentWindow.scrollTo(0, savedScrollY); } catch {}
                  iframeRef.current.removeEventListener('load', restoreScroll);
                };
                iframeRef.current.addEventListener('load', restoreScroll);
                iframeRef.current.src = iframeRef.current.src;
              }
            }
          } catch {
            clearInterval(poll);
            setBuilding(false);
          }
        }, 800);
      }
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [pageId, siteId]);

  // --- Auto-save ---
  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, page, handleSave]);

  // --- AI rewrite ---
  const handleAIRewrite = async (field, currentText) => {
    const instruction = prompt('Instruction pour l\'IA (ex: "rendre plus persuasif", "raccourcir") :');
    if (!instruction) return;
    try {
      const { text } = await aiApi.rewrite({ text: currentText, instruction });
      if (selectedSection !== null) {
        updateSectionData(selectedSection, field, text);
      }
      toast.success('Texte réécrit');
    } catch {
      toast.error('Erreur IA');
    }
  };

  // --- Media picker ---
  const openMediaPicker = useCallback((callback) => {
    setMediaCallback(() => callback);
    setShowMediaPicker(true);
  }, []);

  const openMediaPickerRef = useRef(openMediaPicker);
  const updateSectionDataRef = useRef(updateSectionData);
  useEffect(() => { openMediaPickerRef.current = openMediaPicker; });
  useEffect(() => { updateSectionDataRef.current = updateSectionData; });

  // --- PostMessage from iframe (click-to-edit + navigation) ---
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'resamatic:ready') {
        setIframeReady(true);
        return;
      }
      // Navigation: user clicked a nav link in the preview
      if (e.data?.type === 'resamatic:navigate') {
        const href = e.data.href;
        const pages = allPagesRef.current;
        const target = pages.find(p =>
          (href === 'index.html' && p.isMainHomepage) ||
          p.slug + '.html' === href
        );
        if (target && target._id !== pageId) {
          navigate(`/sites/${siteId}/pages/${target._id}`);
        }
        return;
      }
      if (e.data?.type === 'resamatic:edit') {
        const currentPage = pageRef.current;
        if (!currentPage?.sections) return;
        const sIdx = currentPage.sections.findIndex(s => s.type === e.data.sectionType);
        if (sIdx < 0) return;
        setSelectedSection(sIdx);
        setEditingHeader(false);
        setPanelOpen(true);
        if (e.data.isMedia) {
          openMediaPickerRef.current((mediaId) => {
            updateSectionDataRef.current(sIdx, e.data.field, mediaId);
          });
        }
        if (e.data.field) {
          setTimeout(() => {
            const fieldEl = document.querySelector(`[data-editor-field="${e.data.field}"]`);
            if (fieldEl) fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
      // Inline text editing from preview
      if (e.data?.type === 'resamatic:inlineEdit') {
        const currentPage = pageRef.current;
        if (!currentPage?.sections) return;
        const sIdx = currentPage.sections.findIndex(s => s.type === e.data.sectionType);
        if (sIdx >= 0) {
          updateSectionDataRef.current(sIdx, e.data.field, e.data.value);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [pageId, siteId, navigate]);

  // --- Warn before leaving with unsaved changes ---
  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const confirmLeave = useCallback(() => {
    if (!dirty) return true;
    return window.confirm('Vous avez des modifications non sauvegardées. Quitter sans sauvegarder ?');
  }, [dirty]);

  // --- Ctrl+S ---
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  if (!page) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const section = selectedSection !== null ? page.sections[selectedSection] : null;
  const previewUrl = `/api/build/${siteId}/preview/${page.isMainHomepage ? 'index.html' : page.slug + '.html'}`;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Panneau d'édition */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200 ${
          panelOpen ? 'w-[360px] min-w-[360px]' : 'w-0 min-w-0'
        }`}
      >
        {panelOpen && (
          <>
            {/* En-tête */}
            <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 shrink-0">
              <button
                onClick={() => confirmLeave() && navigate(`/sites/${siteId}/pages`)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                aria-label="Retour aux pages"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="font-semibold text-primary text-sm truncate flex-1" title={page.title}>{page.title}</h2>
              <StatusBadge saving={saving} building={building} dirty={dirty} />
            </div>

            {/* Sélecteur de page */}
            {allPages.length > 1 && (
              <div className="px-3 py-2 border-b border-gray-200 shrink-0">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-1">Page</label>
                <select
                  value={pageId}
                  onChange={(e) => navigate(`/sites/${siteId}/pages/${e.target.value}`)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none bg-white"
                >
                  {allPages.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title}{p.isMainHomepage ? ' (Accueil)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Header + Liste des sections */}
            <div className="border-b border-gray-200 overflow-y-auto shrink-0" style={{ maxHeight: '30vh' }}>
              {/* Header item */}
              <div
                onClick={() => { setEditingHeader(true); setSelectedSection(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-l-[3px] transition-all ${
                  editingHeader ? 'border-l-accent bg-accent/5 font-medium' : 'border-l-transparent hover:bg-gray-50'
                }`}
              >
                <LayoutTemplate size={13} className="shrink-0 text-gray-400" />
                <span className="flex-1 truncate">Header</span>
              </div>
              {page.sections.map((s, idx) => {
                const meta = getSectionMeta(s.type);
                const Icon = meta.icon;
                return (
                  <div
                    key={s._id || idx}
                    onClick={() => selectSection(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-l-[3px] transition-all ${
                      selectedSection === idx
                        ? 'border-l-accent bg-accent/5 font-medium'
                        : 'border-l-transparent hover:bg-gray-50'
                    } ${!s.visible ? 'opacity-40' : ''}`}
                  >
                    <Icon size={13} className="shrink-0 text-gray-400" />
                    <span className="flex-1 truncate">{meta.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleVisibility(idx); }}
                      className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                      aria-label={s.visible ? `Masquer ${meta.label}` : `Afficher ${meta.label}`}
                      aria-pressed={s.visible}
                    >
                      {s.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }}
                      disabled={idx === page.sections.length - 1}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Éditeur de la section sélectionnée */}
            <div className="flex-1 overflow-y-auto">
              {editingHeader && currentSite ? (
                <div className="p-3">
                  <HeaderEditor site={currentSite} onSave={async (data) => { await updateSite(siteId, data); setDirty(true); needsFullReload.current = true; }} postToIframe={postToIframe} />
                </div>
              ) : section ? (
                <div className="p-3">
                  <SectionEditor
                    section={section}
                    idx={selectedSection}
                    onChange={updateSectionData}
                    onAIRewrite={handleAIRewrite}
                    onMediaPick={openMediaPicker}
                    site={currentSite}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                  Cliquez sur une section dans l'aperçu
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Zone d'aperçu */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center px-2 gap-1.5 shrink-0">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={panelOpen ? 'Fermer le panneau' : 'Ouvrir le panneau'}
          >
            {panelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
          <div className="h-4 w-px bg-gray-200" />

          {/* Sélecteur de viewport */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {VIEWPORT_MODES.map(v => {
              const VIcon = v.icon;
              return (
                <button
                  key={v.key}
                  onClick={() => setViewport(v.key)}
                  className={`p-1 rounded transition-colors ${viewport === v.key ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                  aria-label={v.label}
                  aria-pressed={viewport === v.key}
                >
                  <VIcon size={13} />
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px bg-gray-200" />

          <span className="text-[11px] text-gray-400 truncate flex-1 px-1">
            {page.isMainHomepage ? 'index.html' : `${page.slug}.html`}
          </span>
          <button
            onClick={() => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); handleSave(true); }}
            disabled={saving || building}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={building ? 'animate-spin' : ''} />
            {building ? 'Construction...' : 'Reconstruire'}
          </button>
        </div>

        {/* Iframe avec viewport */}
        <div className="flex-1 relative overflow-auto bg-gray-200 flex justify-center">
          {building && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-lg text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin text-accent" />
                Reconstruction...
              </div>
            </div>
          )}
          <div
            className="h-full transition-all duration-300 bg-white"
            style={{
              width: VIEWPORT_WIDTHS[viewport],
              maxWidth: '100%',
              ...(viewport !== 'desktop' ? { boxShadow: '0 0 20px rgba(0,0,0,0.1)' } : {}),
            }}
          >
            <iframe
              ref={iframeRef}
              src={previewUrl}
              onLoad={() => setIframeReady(true)}
              className="w-full h-full border-0"
              title="Aperçu"
            />
          </div>
        </div>
      </div>

      {/* Modal médias */}
      {showMediaPicker && (
        <MediaPicker
          siteId={siteId}
          onSelect={(media) => {
            if (mediaCallback) mediaCallback(media._id);
            setShowMediaPicker(false);
            setDirty(true);
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}

/* --- Status badge --- */
function StatusBadge({ saving, building, dirty }) {
  if (saving) return <span className="text-[10px] text-amber-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Sauvegarde...</span>;
  if (building) return <span className="text-[10px] text-blue-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Construction...</span>;
  if (dirty) return <span className="text-[10px] text-amber-500">Modifié</span>;
  return <span className="text-[10px] text-green-500">Sauvegardé</span>;
}

/* --- StyleColorBar --- */
function StyleColorBar({ section, idx, onChange, site }) {
  const design = site?.design || {};
  const [open, setOpen] = useState(false);
  const styleData = section.data?.style || {};
  const currentBg = styleData.backgroundColor || '';
  const currentText = styleData.textColor || '';

  const swatches = [
    { value: '', transparent: true },
    { value: '#ffffff', border: true },
    { value: '#1f2937' },
    { value: design.primaryColor || '#12203e' },
    { value: design.accentColor || '#c8a97e' },
  ];

  const setStyle = (field, value) => {
    onChange(idx, 'style', { ...styleData, [field]: value });
  };

  return (
    <div className="mb-3 border border-gray-100 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 rounded-lg"
      >
        <Palette size={11} />
        Couleurs
        <span className="ml-auto flex items-center gap-1">
          {currentBg && <span className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ background: currentBg }} />}
          {currentText && <span className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ background: currentText }} />}
          <ChevDown size={9} className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-gray-100">
          <SwatchRow label="Fond" swatches={swatches} current={currentBg} onPick={(v) => setStyle('backgroundColor', v)} />
          <SwatchRow label="Texte" swatches={swatches} current={currentText} onPick={(v) => setStyle('textColor', v)} />
        </div>
      )}
    </div>
  );
}

function SwatchRow({ label, swatches, current, onPick }) {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex gap-1.5 mt-1 items-center">
        {swatches.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.value)}
            className={`w-6 h-6 rounded-full transition-all ${
              current === s.value ? 'ring-2 ring-accent ring-offset-1 scale-110' : 'hover:scale-110'
            } ${s.border ? 'border border-gray-300' : ''}`}
            style={{
              background: s.transparent
                ? 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%) 50%/6px 6px'
                : s.value,
            }}
          />
        ))}
        <label className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-accent relative overflow-hidden">
          <Plus size={8} className="text-gray-400" />
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={current || '#ffffff'} onChange={(e) => onPick(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

/* --- SectionEditor ---
   IMPORTANT: text/image/select/list are render HELPERS (called as functions),
   NOT React components. This prevents React from unmounting/remounting inputs
   on every re-render, which was causing focus loss after each keystroke.
*/
function SectionEditor({ section, idx, onChange, onAIRewrite, onMediaPick, site }) {
  const d = section.data || {};

  const text = (label, field, opts = {}) => (
    <div key={field} className="mb-2.5" data-editor-field={field}>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <button
          onClick={() => onAIRewrite(field, d[field] || '')}
          className="text-[9px] text-accent/60 hover:text-accent flex items-center gap-0.5"
        >
          <Sparkles size={8} /> IA
        </button>
      </div>
      <textarea
        value={d[field] || ''}
        onChange={e => onChange(idx, field, e.target.value)}
        placeholder={opts.placeholder}
        rows={1}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs resize-none focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none overflow-hidden"
        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
      />
    </div>
  );

  const richText = (label, field) => (
    <div key={field} className="mb-2.5" data-editor-field={field}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <button
          onClick={() => onAIRewrite(field, d[field] || '')}
          className="text-[9px] text-accent/60 hover:text-accent flex items-center gap-0.5"
        >
          <Sparkles size={8} /> IA
        </button>
      </div>
      <RichTextEditor value={d[field] || ''} onChange={val => onChange(idx, field, val)} />
    </div>
  );

  const image = (label, field) => (
    <div key={field} className="mb-2.5" data-editor-field={field}>
      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">{label}</label>
      <div className="flex gap-1.5">
        <button
          onClick={() => onMediaPick((mediaId) => onChange(idx, field, mediaId))}
          className={`flex-1 h-10 border-2 border-dashed rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
            d[field]
              ? 'border-green-300 text-green-600 bg-green-50'
              : 'border-gray-200 text-gray-400 hover:border-accent hover:text-accent'
          }`}
        >
          <ImageIcon size={12} />
          {d[field] ? 'Changer l\'image' : 'Choisir une image'}
        </button>
        {d[field] && (
          <button
            onClick={() => onChange(idx, field, null)}
            className="h-10 w-10 shrink-0 border-2 border-dashed border-red-200 rounded-lg text-red-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
            aria-label="Supprimer l'image"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );

  const select = (label, field, options) => (
    <div key={field} className="mb-2.5" data-editor-field={field}>
      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">{label}</label>
      <select
        value={d[field] || options[0]?.value || ''}
        onChange={e => onChange(idx, field, e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-accent outline-none bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const list = (label, field, itemFields, addLabel) => {
    const items = d[field] || [];
    return (
      <div key={field} className="mb-2.5" data-editor-field={field}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            {label} ({items.length})
          </label>
          <button
            onClick={() => {
              const empty = {};
              itemFields.forEach(f => empty[f.key] = '');
              onChange(idx, field, [...items, empty]);
            }}
            className="text-[9px] text-accent hover:text-accent/80 flex items-center gap-0.5 font-medium"
          >
            <Plus size={9} /> {addLabel || 'Ajouter'}
          </button>
        </div>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="p-2 bg-gray-50 rounded border border-gray-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-400">#{i + 1}</span>
                <button onClick={() => onChange(idx, field, items.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                  <Trash2 size={10} />
                </button>
              </div>
              {itemFields.map(({ key, label: fl, multiline, placeholder, type: fType }) => (
                <div key={key}>
                  <label className="text-[9px] text-gray-400">{fl}</label>
                  {fType === 'image' ? (
                    <button
                      onClick={() => onMediaPick((mediaId) => onChange(idx, `${field}.${i}.${key}`, mediaId))}
                      className={`w-full h-8 border-2 border-dashed rounded text-[10px] flex items-center justify-center gap-1 transition-all ${
                        item[key]
                          ? 'border-green-300 text-green-600 bg-green-50'
                          : 'border-gray-200 text-gray-400 hover:border-accent hover:text-accent'
                      }`}
                    >
                      <ImageIcon size={10} />
                      {item[key] ? 'Changer' : 'Image'}
                    </button>
                  ) : (
                    <textarea value={item[key] || ''} onChange={e => onChange(idx, `${field}.${i}.${key}`, e.target.value)} placeholder={placeholder} rows={1} className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] resize-none overflow-hidden focus:border-accent outline-none" onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const colorBar = <StyleColorBar section={section} idx={idx} onChange={onChange} site={site} />;

  switch (section.type) {
    case 'hero': return <>{colorBar}{text("Titre H1", "headline")}{text("Sous-titre", "subheadline")}{list("Points clés", "bulletPoints", [{key:'value',label:'Point'}], "Point")}{text("Texte du bouton", "ctaText")}{text("Lien du bouton", "ctaUrl")}{image("Image", "backgroundMediaId")}</>;
    case 'text-highlight': return <>{colorBar}{richText("Texte", "text")}</>;
    case 'description': return <>{colorBar}{text("Titre", "title")}{richText("Contenu", "body")}{list("Points clés", "bulletPoints", [{key:'value',label:'Point'}], "Point")}{text("Texte du bouton", "ctaText")}{text("Lien du bouton", "ctaUrl")}{image("Image", "imageMediaId")}{select("Position image", "imagePosition", [{value:'right',label:'Droite'},{value:'left',label:'Gauche'}])}</>;
    case 'why-us': return <>{colorBar}{text("Titre", "title")}{text("Sous-titre", "subtitle")}{richText("Contenu", "body")}{image("Image", "imageMediaId")}{list("Points clés", "reasons", [{key:'title',label:'Titre'},{key:'text',label:'Description'}], "Point")}{text("Texte du bouton", "ctaText")}{text("Lien du bouton", "ctaUrl")}</>;
    case 'google-reviews': return <>{colorBar}{text("Titre", "title")}{text("Nombre d'avis", "reviewCount")}{text("Note", "rating")}{list("Témoignages", "testimonials", [{key:'text',label:'Témoignage',multiline:true},{key:'name',label:'Nom'},{key:'location',label:'Ville'}], "Témoignage")}{text("Texte du bouton", "ctaText")}{text("Lien des avis", "ctaUrl")}</>;
    case 'cta-banner': return <>{colorBar}{text("Texte", "text")}{text("Texte du bouton", "ctaText")}{text("Lien", "ctaUrl")}{select("Style", "bannerStyle", [{value:'dark',label:'Sombre'},{value:'light',label:'Clair'},{value:'accent',label:'Accent'}])}</>;
    case 'services-grid': return <>{colorBar}{text("Titre", "title")}{text("Sous-titre", "subtitle")}{list("Services", "services", [{key:'imageMediaId',label:'Image',type:'image'},{key:'name',label:'Nom'},{key:'shortDescription',label:'Description courte'},{key:'linkUrl',label:'Lien (URL page)'}], "Service")}</>;
    case 'services-detail': return <>{colorBar}{text("Titre", "title")}{list("Services", "services", [{key:'imageMediaId',label:'Image',type:'image'},{key:'name',label:'Nom'},{key:'description',label:'Description',multiline:true},{key:'price',label:'Prix'}], "Service")}</>;
    case 'guarantee': return <>{colorBar}{text("Titre", "title")}{richText("Texte", "text")}</>;
    case 'testimonials': return <>{colorBar}{text("Titre", "title")}{list("Témoignages", "items", [{key:'name',label:'Nom'},{key:'location',label:'Ville'},{key:'rating',label:'Note'},{key:'text',label:'Témoignage',multiline:true}], "Témoignage")}</>;
    case 'faq': return <>{colorBar}{text("Titre", "title")}{list("Questions", "items", [{key:'question',label:'Question'},{key:'answer',label:'Réponse',multiline:true}], "Question")}</>;
    case 'team': return <>{colorBar}{text("Titre", "title")}{richText("Contenu", "body")}{list("Membres", "members", [{key:'name',label:'Nom'},{key:'role',label:'Rôle'},{key:'bio',label:'Bio',multiline:true}], "Membre")}</>;
    case 'map': return <>{colorBar}{text("Titre", "title")}{text("Adresse", "address")}{text("Horaires", "hours")}{text("Téléphone", "phone")}{text("Email", "email")}{text("URL Google Maps", "embedUrl", { multiline: true })}</>;
    default: return <p className="text-xs text-gray-400 text-center py-4">Section non éditable</p>;
  }
}

function HeaderEditor({ site, onSave, postToIframe }) {
  const [form, setForm] = useState({
    ctaText: site.header?.ctaText || 'Nous contacter',
    ctaUrl: site.header?.ctaUrl || 'contact.html',
    bgColor: site.header?.bgColor || '',
    logoColor: site.header?.logoColor || '',
    ctaBgColor: site.header?.ctaBgColor || '',
    ctaTextColor: site.header?.ctaTextColor || '',
  });
  const [colorsOpen, setColorsOpen] = useState(false);
  const timer = useRef(null);

  const update = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Live preview update
    postToIframe({ type: 'resamatic:updateHeader', ...next });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave({ header: next }), 1000);
  };

  const design = site?.design || {};
  const swatches = [
    { value: '', transparent: true },
    { value: '#ffffff', border: true },
    { value: '#1f2937' },
    { value: design.primaryColor || '#12203e' },
    { value: design.accentColor || '#c8a97e' },
  ];

  return (
    <>
      <div className="mb-2.5">
        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">Texte du bouton</label>
        <textarea value={form.ctaText} onChange={e => update('ctaText', e.target.value)} placeholder="Nous contacter" rows={1} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs resize-none focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none overflow-hidden" />
      </div>
      <div className="mb-2.5">
        <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-0.5">Lien du bouton</label>
        <textarea value={form.ctaUrl} onChange={e => update('ctaUrl', e.target.value)} placeholder="contact.html" rows={1} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs resize-none focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none overflow-hidden" />
      </div>
      <div className="mb-3 border border-gray-100 rounded-lg">
        <button
          onClick={() => setColorsOpen(!colorsOpen)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 rounded-lg"
        >
          <Palette size={11} />
          Couleurs
          <span className="ml-auto flex items-center gap-1">
            {form.bgColor && <span className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ background: form.bgColor }} />}
            {form.ctaBgColor && <span className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ background: form.ctaBgColor }} />}
            <ChevDown size={9} className={`text-gray-300 transition-transform ${colorsOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {colorsOpen && (
          <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-gray-100">
            <SwatchRow label="Fond header" swatches={swatches} current={form.bgColor} onPick={v => update('bgColor', v)} />
            {!site.design?.logoMediaId && <SwatchRow label="Logo (texte)" swatches={swatches} current={form.logoColor} onPick={v => update('logoColor', v)} />}
            <SwatchRow label="Fond bouton" swatches={swatches} current={form.ctaBgColor} onPick={v => update('ctaBgColor', v)} />
            <SwatchRow label="Texte bouton" swatches={swatches} current={form.ctaTextColor} onPick={v => update('ctaTextColor', v)} />
          </div>
        )}
      </div>
    </>
  );
}
