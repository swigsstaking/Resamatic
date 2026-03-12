import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { pagesApi, aiApi, buildApi } from '../services/api';

const STEPS = ['Informations', 'Design', 'Pages'];

export default function SiteCreatePage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const navigate = useNavigate();
  const { createSite } = useSiteStore();

  const [form, setForm] = useState({
    name: '', domain: '',
    business: { name: '', activity: '', description: '', address: '', city: '', zip: '', country: 'FR', phone: '', email: '', siret: '', services: '', targetAudience: '', uniqueSellingPoints: '', tone: 'professionnel', googleReviewCount: '', googleReviewRating: '', googleReviewUrl: '' },
    design: { primaryColor: '#12203e', accentColor: '#c8a97e', backgroundColor: '#ffffff', textColor: '#333333', fontHeading: 'Playfair Display', fontBody: 'Inter' },
    posthog: { enabled: false, apiKey: '' },
    pages: [{ title: '', keyword: '', serviceFocus: '', isMain: true }],
  });

  const updateField = (path, value) => {
    setForm(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  const addPage = () => {
    setForm(prev => ({
      ...prev,
      pages: [...prev.pages, { title: '', keyword: '', serviceFocus: '', isMain: false }],
    }));
  };

  const removePage = (idx) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async (useAI = false) => {
    setLoading(true);
    if (useAI) setAiLoading(true);
    try {
      const site = await createSite({
        name: form.name,
        domain: form.domain || undefined,
        business: form.business,
        design: form.design,
        posthog: form.posthog,
      });

      // Create pages
      for (const pageConf of form.pages) {
        const page = await pagesApi.create(site._id, {
          title: pageConf.title || pageConf.keyword,
          type: pageConf.isMain ? 'homepage' : 'subpage',
          isMainHomepage: pageConf.isMain,
        });

        // AI generation if requested
        if (useAI && pageConf.keyword) {
          setAiLoading(true);
          const pageIdx = form.pages.indexOf(pageConf);
          setAiProgress(`Page ${pageIdx + 1}/${form.pages.length} : ${pageConf.keyword}`);
          try {
            const { content } = await aiApi.generatePage({
              siteId: site._id,
              keyword: pageConf.keyword,
              serviceFocus: pageConf.serviceFocus || pageConf.keyword,
            });

            // Map AI content to sections
            const sections = page.page.sections.map(s => {
              const sData = { ...s };
              switch (s.type) {
                case 'hero':
                  if (content.hero) sData.data = { ...s.data, ...content.hero };
                  break;
                case 'text-highlight':
                  if (content.textHighlight) sData.data = { ...s.data, ...content.textHighlight };
                  break;
                case 'description':
                  if (content.description) sData.data = { ...s.data, ...content.description };
                  break;
                case 'why-us':
                  if (content.whyUs) sData.data = { ...s.data, ...content.whyUs };
                  break;
                case 'google-reviews':
                  if (content.googleReviews) {
                    sData.data = { ...s.data, ...content.googleReviews };
                    // Keep business-level review count/rating
                    if (site.business?.googleReviewCount) sData.data.reviewCount = parseInt(site.business.googleReviewCount);
                    if (site.business?.googleReviewRating) sData.data.rating = parseFloat(site.business.googleReviewRating);
                    if (site.business?.googleReviewUrl) sData.data.ctaUrl = site.business.googleReviewUrl;
                  }
                  break;
                case 'cta-banner':
                  if (content.ctaBanner) sData.data = { ...s.data, ...content.ctaBanner };
                  break;
                case 'services-grid':
                  if (content.servicesGrid) sData.data = { ...s.data, ...content.servicesGrid };
                  break;
                case 'guarantee':
                  if (content.guarantee) sData.data = { ...s.data, ...content.guarantee };
                  break;
                case 'testimonials':
                  if (content.testimonials?.items) sData.data = { ...s.data, items: content.testimonials.items };
                  else if (Array.isArray(content.testimonials)) sData.data = { ...s.data, items: content.testimonials };
                  break;
                case 'faq':
                  if (content.faq?.items) sData.data = { ...s.data, items: content.faq.items };
                  else if (Array.isArray(content.faq)) sData.data = { ...s.data, items: content.faq };
                  break;
                case 'team':
                  if (content.team) sData.data = { ...s.data, ...content.team };
                  break;
                case 'map':
                  if (content.map) sData.data = { ...s.data, ...content.map, address: s.data.address, phone: s.data.phone, email: s.data.email };
                  break;
              }
              return sData;
            });

            await pagesApi.updateSections(page.page._id, sections);

            // Update SEO if available
            if (content.seo) {
              await pagesApi.update(page.page._id, { seo: content.seo });
            }
          } catch (err) {
            console.error('AI generation error for page:', err);
            toast.error(`IA: erreur pour "${pageConf.keyword}"`);
          }
        }
      }

      setAiLoading(false);
      // Auto-trigger build so preview is available immediately
      try {
        await buildApi.trigger(site._id);
      } catch {}
      toast.success('Site créé avec succès !');
      navigate(`/sites/${site._id}/pages`);
    } catch (err) {
      const msg = err.error || err.message || 'Erreur lors de la création';
      if (msg.includes('duplicate') || msg.includes('E11000') || msg.includes('domain')) {
        toast.error('Ce domaine est déjà utilisé par un autre site', { duration: 5000 });
      } else {
        toast.error(msg, { duration: 5000 });
      }
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-2">Nouveau site</h1>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full mb-1 ${i <= step ? 'bg-accent' : 'bg-gray-200'}`} />
            <p className={`text-xs text-center ${i <= step ? 'text-accent font-medium' : 'text-gray-400'}`}>{s}</p>
          </div>
        ))}
      </div>

      {/* Step 1: Business info */}
      {step === 0 && (
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Informations du business</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site</label>
              <input value={form.name} onChange={e => updateField('name', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Precision Institut" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom commercial</label>
              <input value={form.business.name} onChange={e => updateField('business.name', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activité</label>
              <input value={form.business.activity} onChange={e => updateField('business.activity', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Institut de beauté" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input value={form.business.city} onChange={e => updateField('business.city', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input value={form.business.zip} onChange={e => updateField('business.zip', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input value={form.business.address} onChange={e => updateField('business.address', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={form.business.phone} onChange={e => updateField('business.phone', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={form.business.email} onChange={e => updateField('business.email', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" />
            </div>

            {/* Detailed business info for AI generation */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Informations pour la génération IA</h3>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Décrivez votre activité en détail</label>
              <textarea value={form.business.description} onChange={e => updateField('business.description', e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent resize-none" placeholder="Ex: Institut de beauté spécialisé dans les soins du visage haut de gamme, ouvert depuis 2015..." />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Listez vos services principaux (séparés par des virgules)</label>
              <input value={form.business.services} onChange={e => updateField('business.services', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: Soin visage, Épilation laser, Massage relaxant, Manucure" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre clientèle cible</label>
              <input value={form.business.targetAudience} onChange={e => updateField('business.targetAudience', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: Femmes 25-55 ans, CSP+" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ton de communication</label>
              <select value={form.business.tone} onChange={e => updateField('business.tone', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent">
                <option value="professionnel">Professionnel</option>
                <option value="chaleureux">Chaleureux</option>
                <option value="luxe">Luxe</option>
                <option value="dynamique">Dynamique</option>
                <option value="technique">Technique</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ce qui vous différencie de la concurrence</label>
              <input value={form.business.uniqueSellingPoints} onChange={e => updateField('business.uniqueSellingPoints', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: 10 ans d'expérience, produits bio, résultats garantis" />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Avis Google (optionnel)</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d'avis Google</label>
              <input type="number" value={form.business.googleReviewCount} onChange={e => updateField('business.googleReviewCount', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: 127" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note Google (ex: 4.8)</label>
              <input type="number" step="0.1" min="0" max="5" value={form.business.googleReviewRating} onChange={e => updateField('business.googleReviewRating', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: 4.8" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Lien vers vos avis Google</label>
              <input value={form.business.googleReviewUrl} onChange={e => updateField('business.googleReviewUrl', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="https://g.page/r/..." />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Configuration</h3>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Domaine (optionnel)</label>
              <input value={form.domain} onChange={e => updateField('domain', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="precision-institut.fr" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.posthog.enabled} onChange={e => updateField('posthog.enabled', e.target.checked)} className="w-5 h-5 accent-accent" />
                <span className="text-sm font-medium">Activer PostHog (analytics + cookie consent RGPD)</span>
              </label>
              {form.posthog.enabled && (
                <input value={form.posthog.apiKey} onChange={e => updateField('posthog.apiKey', e.target.value)} className="mt-2 w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Clé API PostHog" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Design */}
      {step === 1 && (
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Design</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['design.primaryColor', 'Couleur principale'],
              ['design.accentColor', 'Couleur accent'],
              ['design.backgroundColor', 'Fond'],
              ['design.textColor', 'Texte'],
            ].map(([path, label]) => (
              <div key={path}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <label className="relative w-10 h-10 rounded-lg border border-gray-300 cursor-pointer overflow-hidden shrink-0" style={{ backgroundColor: form.design[path.split('.')[1]] }}>
                    <input type="color" value={form.design[path.split('.')[1]]} onChange={e => updateField(path, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </label>
                  <input value={form.design[path.split('.')[1]]} onChange={e => updateField(path, e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono" />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Police titres</label>
              <select value={form.design.fontHeading} onChange={e => updateField('design.fontHeading', e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                {['Playfair Display', 'Montserrat', 'Lora', 'Merriweather', 'Poppins', 'Raleway'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Police corps</label>
              <select value={form.design.fontBody} onChange={e => updateField('design.fontBody', e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                {['Inter', 'Open Sans', 'Lato', 'Roboto', 'Source Sans Pro', 'Nunito'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2">Le logo et favicon seront ajoutables dans les paramètres du site après création.</p>
        </div>
      )}

      {/* Step 3: Pages */}
      {step === 2 && (
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Pages du site</h2>
          <p className="text-sm text-gray-500 mb-4">Ajoutez les pages de votre site, chacune ciblant un mot-clé SEO différent.</p>

          {form.pages.map((page, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg space-y-2 relative">
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="radio"
                    name="mainPage"
                    checked={page.isMain}
                    onChange={() => {
                      const pages = form.pages.map((p, i) => ({ ...p, isMain: i === idx }));
                      setForm(prev => ({ ...prev, pages }));
                    }}
                  />
                  Page principale (index)
                </label>
                {form.pages.length > 1 && (
                  <button onClick={() => removePage(idx)} className="text-gray-400 hover:text-danger text-lg leading-none">&times;</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={page.title}
                  onChange={e => {
                    const pages = [...form.pages];
                    pages[idx] = { ...pages[idx], title: e.target.value };
                    setForm(prev => ({ ...prev, pages }));
                  }}
                  className="px-3 py-2 border rounded-lg text-sm"
                  placeholder="Titre de la page"
                />
                <input
                  value={page.keyword}
                  onChange={e => {
                    const pages = [...form.pages];
                    pages[idx] = { ...pages[idx], keyword: e.target.value };
                    setForm(prev => ({ ...prev, pages }));
                  }}
                  className="px-3 py-2 border rounded-lg text-sm"
                  placeholder="Mot-clé cible"
                />
                <input
                  value={page.serviceFocus}
                  onChange={e => {
                    const pages = [...form.pages];
                    pages[idx] = { ...pages[idx], serviceFocus: e.target.value };
                    setForm(prev => ({ ...prev, pages }));
                  }}
                  className="px-3 py-2 border rounded-lg text-sm"
                  placeholder="Focus service (optionnel)"
                />
              </div>
            </div>
          ))}

          <button onClick={addPage} className="text-accent text-sm font-medium hover:underline">
            + Ajouter une page
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-800">
            <ArrowLeft size={18} /> Précédent
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90">
            Suivant <ArrowRight size={18} />
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleCreate(false)}
              disabled={loading}
              className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer sans IA'}
            </button>
            <button
              onClick={() => handleCreate(true)}
              disabled={loading || aiLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles size={18} />
              {aiLoading ? `IA : ${aiProgress || 'Création du site...'}` : loading ? 'Création...' : 'Créer avec IA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
