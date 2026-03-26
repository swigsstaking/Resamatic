import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { mediaApi, sitesApi } from '../services/api';
import PublishButton from '../components/PublishButton';

// API base for static uploads — strip '/api' suffix if present
const rawBase = import.meta.env.VITE_API_URL || '';
const API_BASE = rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase;

export default function SiteSettingsPage() {
  const { siteId } = useParams();
  const { currentSite, fetchSite, updateSite } = useSiteStore();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const autoSaveTimer = useRef(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (currentSite) {
      setForm(JSON.parse(JSON.stringify(currentSite)));
      setTimeout(() => { initialLoad.current = false; }, 100);
      // Fetch previews for existing logo/favicon
      if (currentSite.design?.logoMediaId) {
        const id = typeof currentSite.design.logoMediaId === 'object' ? currentSite.design.logoMediaId._id : currentSite.design.logoMediaId;
        mediaApi.getOne(id).then(({ media }) => setLogoPreview(media)).catch(() => {});
      }
      if (currentSite.design?.faviconMediaId) {
        const id = typeof currentSite.design.faviconMediaId === 'object' ? currentSite.design.faviconMediaId._id : currentSite.design.faviconMediaId;
        mediaApi.getOne(id).then(({ media }) => setFaviconPreview(media)).catch(() => {});
      }
    }
  }, [currentSite]);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateSite(siteId, form);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { toast.error('Erreur de sauvegarde'); }
    finally { setSaving(false); }
  }, [siteId, form, updateSite]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Auto-save with 2s debounce
  useEffect(() => {
    if (!dirty || initialLoad.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { handleSave(); }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, form, handleSave]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt', `${form.business?.name || form.name} - Logo`);
    try {
      const { media } = await mediaApi.upload(siteId, formData);
      setForm(prev => ({ ...prev, design: { ...prev.design, logoMediaId: media._id } }));
      setLogoPreview(media);
      setDirty(true);
      toast.success('Logo uploadé');
    } catch { toast.error('Erreur upload'); }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt', 'Favicon');
    try {
      const { media } = await mediaApi.upload(siteId, formData);
      setForm(prev => ({ ...prev, design: { ...prev.design, faviconMediaId: media._id } }));
      setFaviconPreview(media);
      setDirty(true);
      toast.success('Favicon uploadé');
    } catch { toast.error('Erreur upload'); }
  };

  const removeLogo = () => {
    setForm(prev => ({ ...prev, design: { ...prev.design, logoMediaId: null } }));
    setLogoPreview(null);
    setDirty(true);
  };

  const removeFavicon = () => {
    setForm(prev => ({ ...prev, design: { ...prev.design, faviconMediaId: null } }));
    setFaviconPreview(null);
    setDirty(true);
  };

  const u = (path, value) => {
    setForm(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
    if (!initialLoad.current) setDirty(true);
  };

  if (!form) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Paramètres</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 flex items-center gap-1.5">
            {saving && <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</>}
            {saved && !saving && <><CheckCircle size={14} className="text-green-500" /> Sauvegardé</>}
            {dirty && !saving && !saved && <span className="text-amber-500">Modifications non sauvegardées</span>}
          </span>
          <PublishButton siteId={siteId} status={form.status} domain={form.domain} />
        </div>
      </div>

      <div className="space-y-6">
        {/* General */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Général</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom du site" value={form.name} onChange={v => u('name', v)} />
            <Field label="Domaine" value={form.domain || ''} onChange={v => u('domain', v)} placeholder="monsite.fr" />
          </div>
        </section>

        {/* Logo & Favicon */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Logo & Favicon</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Logo</label>
              {logoPreview ? (
                <div className="relative group">
                  <div className="border rounded-lg p-3 bg-gray-50 flex items-center justify-center" style={{ minHeight: 80 }}>
                    <img
                      src={`${API_BASE}/uploads/${logoPreview.variants?.[0]?.storagePath || logoPreview.storagePath}`}
                      alt={logoPreview.alt || 'Logo'}
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                  <button onClick={removeLogo} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Supprimer le logo">
                    <X size={14} />
                  </button>
                  <label className="block mt-2 text-center text-xs text-gray-400 cursor-pointer hover:text-accent transition-colors">
                    Changer le logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent transition-colors">
                  <Upload size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Uploader un logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Favicon</label>
              {faviconPreview ? (
                <div className="relative group">
                  <div className="border rounded-lg p-3 bg-gray-50 flex items-center justify-center" style={{ minHeight: 80 }}>
                    <img
                      src={`${API_BASE}/uploads/${faviconPreview.variants?.[0]?.storagePath || faviconPreview.storagePath}`}
                      alt={faviconPreview.alt || 'Favicon'}
                      className="max-h-16 max-w-full object-contain"
                    />
                  </div>
                  <button onClick={removeFavicon} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Supprimer le favicon">
                    <X size={14} />
                  </button>
                  <label className="block mt-2 text-center text-xs text-gray-400 cursor-pointer hover:text-accent transition-colors">
                    Changer le favicon
                    <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent transition-colors">
                  <Upload size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Uploader un favicon</span>
                  <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </section>

        {/* Business */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Informations de l'entreprise</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom commercial" value={form.business?.name || ''} onChange={v => u('business.name', v)} />
            <Field label="Activité" value={form.business?.activity || ''} onChange={v => u('business.activity', v)} full />
            <Field label="Téléphone" value={form.business?.phone || ''} onChange={v => u('business.phone', v)} />
            <Field label="Email" value={form.business?.email || ''} onChange={v => u('business.email', v)} />
            <Field label="Ville" value={form.business?.city || ''} onChange={v => u('business.city', v)} />
            <Field label="Code postal" value={form.business?.zip || ''} onChange={v => u('business.zip', v)} />
            <div className="col-span-2">
              <Field label="Adresse" value={form.business?.address || ''} onChange={v => u('business.address', v)} />
            </div>
            <Field label="N° entreprise (IDE/SIRET)" value={form.business?.siret || ''} onChange={v => u('business.siret', v)} />
            <div className="col-span-2">
              <Field label="Lien Google Maps" value={form.business?.googleMapsUrl || ''} onChange={v => u('business.googleMapsUrl', v)} placeholder="https://maps.google.com/... ou https://g.page/..." />
              <button type="button" className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" disabled={!form.business?.googleMapsUrl || saving} onClick={async () => { try { setSaving(true); await updateSite(siteId, { business: { googleMapsUrl: form.business.googleMapsUrl } }); const res = await sitesApi.fetchGoogleReviews(siteId); u('business.googleReviewCount', res.totalReviews); u('business.googleReviewRating', res.rating); u('business.googleReviewUrl', res.googleMapsUri); toast.success(`${res.reviews.length} avis Google importés (${res.totalReviews} au total, note ${res.rating}/5)`); } catch (err) { toast.error('Erreur: ' + (err.response?.data?.error || err.message)); } finally { setSaving(false); } }}>
                Importer les avis Google
              </button>
            </div>
            <Field label="Avis Google (nombre)" value={form.business?.googleReviewCount || ''} onChange={v => u('business.googleReviewCount', Number(v))} />
            <Field label="Note Google (ex: 4.8)" value={form.business?.googleReviewRating || ''} onChange={v => u('business.googleReviewRating', v)} />
            <div className="col-span-2">
              <Field label="Lien avis Google" value={form.business?.googleReviewUrl || ''} onChange={v => u('business.googleReviewUrl', v)} placeholder="Auto si lien Google Maps renseigné" />
            </div>
          </div>
        </section>

        {/* Design */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Design</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['primaryColor', 'Couleur principale'],
              ['accentColor', 'Couleur d\'accent'],
              ['backgroundColor', 'Fond'],
              ['textColor', 'Texte'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                <div className="flex gap-2 items-center">
                  <label className="relative w-10 h-10 rounded-lg border border-gray-300 cursor-pointer overflow-hidden shrink-0" style={{ backgroundColor: form.design?.[key] || '#000000' }}>
                    <input type="color" value={form.design?.[key] || '#000000'} onChange={e => u(`design.${key}`, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </label>
                  <input value={form.design?.[key] || ''} onChange={e => u(`design.${key}`, e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono" />
                </div>
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Police titres</label>
              <select value={form.design?.fontHeading || 'Playfair Display'} onChange={e => u('design.fontHeading', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {['Playfair Display', 'Montserrat', 'Lora', 'Merriweather', 'Poppins', 'Raleway'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Police corps</label>
              <select value={form.design?.fontBody || 'Inter'} onChange={e => u('design.fontBody', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {['Inter', 'Open Sans', 'Lato', 'Roboto', 'Source Sans Pro', 'Nunito'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-600">Angles</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button type="button" onClick={() => u('design.borderRadius', 'square')} className={`p-1.5 rounded-md transition-colors ${form.design?.borderRadius === 'square' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Angles carrés">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </button>
              <button type="button" onClick={() => u('design.borderRadius', 'rounded')} className={`p-1.5 rounded-md transition-colors ${form.design?.borderRadius === 'rounded' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Angles arrondis">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </button>
            </div>
          </div>
        </section>

        {/* Social Links */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Réseaux sociaux</h2>
          <div className="grid grid-cols-2 gap-4">
            {['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'].map(key => (
              <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={form.business?.socialLinks?.[key] || ''} onChange={v => u(`business.socialLinks.${key}`, v)} placeholder={`https://${key}.com/...`} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Pied de page</h2>
          <div className="space-y-4">
            <Field label="Texte copyright (laisser vide = auto)" value={form.footer?.copyrightText || ''} onChange={v => u('footer.copyrightText', v)} placeholder="© 2026 Mon Entreprise. Tous droits réservés." />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.footer?.showLegalLinks !== false} onChange={e => u('footer.showLegalLinks', e.target.checked)} className="w-5 h-5 accent-accent" />
              <span className="text-sm font-medium">Afficher les liens légaux (Mentions légales, CGV)</span>
            </label>
            {form.footer?.showLegalLinks !== false && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Slug page mentions légales" value={form.footer?.legalPageSlug || 'mentions-legales'} onChange={v => u('footer.legalPageSlug', v)} />
                <Field label="Slug page CGV" value={form.footer?.cgvPageSlug || 'cgv'} onChange={v => u('footer.cgvPageSlug', v)} />
              </div>
            )}
          </div>
        </section>

        {/* PostHog */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Statistiques de visite</h2>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input type="checkbox" checked={form.posthog?.enabled || false} onChange={e => u('posthog.enabled', e.target.checked)} className="w-5 h-5 accent-accent" />
            <span className="text-sm font-medium">Activer PostHog + bandeau cookies RGPD</span>
          </label>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
    </div>
  );
}
