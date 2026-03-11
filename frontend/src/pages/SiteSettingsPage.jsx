import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { mediaApi } from '../services/api';
import PublishButton from '../components/PublishButton';

export default function SiteSettingsPage() {
  const { siteId } = useParams();
  const { currentSite, fetchSite, updateSite } = useSiteStore();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const autoSaveTimer = useRef(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (currentSite) {
      setForm(JSON.parse(JSON.stringify(currentSite)));
      setTimeout(() => { initialLoad.current = false; }, 100);
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
      setDirty(true);
      toast.success('Favicon uploadé');
    } catch { toast.error('Erreur upload'); }
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
          <PublishButton siteId={siteId} status={form.status} />
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
              <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent transition-colors">
                <Upload size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">Uploader un logo</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {form.design?.logoMediaId && <p className="text-xs text-green-600 mt-1">Logo configuré</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Favicon</label>
              <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-accent transition-colors">
                <Upload size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">Uploader un favicon</span>
                <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
              </label>
              {form.design?.faviconMediaId && <p className="text-xs text-green-600 mt-1">Favicon configuré</p>}
            </div>
          </div>
        </section>

        {/* Business */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Informations business</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom commercial" value={form.business?.name || ''} onChange={v => u('business.name', v)} />
            <Field label="Activité" value={form.business?.activity || ''} onChange={v => u('business.activity', v)} />
            <Field label="Téléphone" value={form.business?.phone || ''} onChange={v => u('business.phone', v)} />
            <Field label="Email" value={form.business?.email || ''} onChange={v => u('business.email', v)} />
            <Field label="Ville" value={form.business?.city || ''} onChange={v => u('business.city', v)} />
            <Field label="Code postal" value={form.business?.zip || ''} onChange={v => u('business.zip', v)} />
            <div className="col-span-2">
              <Field label="Adresse" value={form.business?.address || ''} onChange={v => u('business.address', v)} />
            </div>
            <Field label="SIRET" value={form.business?.siret || ''} onChange={v => u('business.siret', v)} />
            <Field label="Avis Google (nombre)" value={form.business?.googleReviewCount || ''} onChange={v => u('business.googleReviewCount', Number(v))} />
          </div>
        </section>

        {/* Design */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">Design</h2>
          <div className="grid grid-cols-2 gap-4">
            {['primaryColor', 'accentColor', 'backgroundColor', 'textColor'].map(key => (
              <div key={key}>
                <label className="text-sm font-medium text-gray-700 block mb-1">{key}</label>
                <div className="flex gap-2">
                  <input type="color" value={form.design?.[key] || '#000000'} onChange={e => u(`design.${key}`, e.target.value)} className="w-10 h-10 border rounded cursor-pointer" />
                  <input value={form.design?.[key] || ''} onChange={e => u(`design.${key}`, e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono" />
                </div>
              </div>
            ))}
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

        {/* PostHog */}
        <section className="bg-white rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">PostHog Analytics</h2>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input type="checkbox" checked={form.posthog?.enabled || false} onChange={e => u('posthog.enabled', e.target.checked)} className="w-5 h-5 accent-accent" />
            <span className="text-sm font-medium">Activer PostHog + bandeau cookies RGPD</span>
          </label>
          {form.posthog?.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Clé API" value={form.posthog?.apiKey || ''} onChange={v => u('posthog.apiKey', v)} />
              <Field label="Host" value={form.posthog?.apiHost || 'https://eu.i.posthog.com'} onChange={v => u('posthog.apiHost', v)} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
    </div>
  );
}
