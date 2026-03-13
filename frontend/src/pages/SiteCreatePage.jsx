import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, Trash2, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import useSiteStore from '../stores/siteStore';
import { pagesApi, aiApi, buildApi, mediaApi } from '../services/api';

const STEPS = ['1. Entreprise & contact', '2. Design & couleurs', '3. Pages & mots-clés'];

export default function SiteCreatePage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { createSite } = useSiteStore();

  const [images, setImages] = useState([]); // { file: File, preview: string }[]

  const onDropImages = useCallback((files) => {
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...newImages]);
  }, []);
  const removeImage = (idx) => {
    setImages(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  };
  const { getRootProps: getImgRootProps, getInputProps: getImgInputProps, isDragActive: isImgDragActive } = useDropzone({
    onDrop: onDropImages,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const [form, setForm] = useState({
    name: '', domain: '',
    business: { name: '', activity: '', description: '', address: '', city: '', zip: '', country: 'CH', phone: '', email: '', siret: '', services: '', targetAudience: '', uniqueSellingPoints: '', tone: 'professionnel', googleReviewCount: '', googleReviewRating: '', googleReviewUrl: '' },
    design: { primaryColor: '#12203e', accentColor: '#c8a97e', backgroundColor: '#ffffff', textColor: '#333333', fontHeading: 'Playfair Display', fontBody: 'Inter', borderRadius: 'rounded' },
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
    // Clear error for this field
    if (errors[path]) setErrors(prev => { const e = { ...prev }; delete e[path]; return e; });
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

  // Validation per step
  const validateStep = (s) => {
    const errs = {};
    if (s === 0) {
      if (!form.name.trim()) errs.name = 'Requis';
      if (!form.business.name.trim()) errs['business.name'] = 'Requis';
      if (!form.business.activity.trim()) errs['business.activity'] = 'Requis';
      if (!form.business.city.trim()) errs['business.city'] = 'Requis';
    }
    if (s === 2) {
      form.pages.forEach((p, i) => {
        if (!p.title.trim() && !p.keyword.trim()) errs[`page.${i}`] = 'Titre ou mot-clé requis';
      });
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Veuillez remplir les champs obligatoires');
      return false;
    }
    return true;
  };

  const goToStep = (target) => {
    // Can only go to completed steps or next step
    if (target > step) {
      if (!validateStep(step)) return;
    }
    setStep(target);
  };

  const handleCreate = async (useAI = false) => {
    if (!validateStep(2)) return;
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

      // Upload images if any
      const uploadedMediaIds = [];
      if (images.length > 0) {
        setAiProgress('Upload des images...');
        for (const img of images) {
          try {
            const formData = new FormData();
            formData.append('file', img.file);
            const { media } = await mediaApi.upload(site._id, formData);
            uploadedMediaIds.push(media._id);
          } catch (err) {
            console.error('Image upload error:', err);
          }
        }
      }

      // Create pages
      const totalPages = form.pages.length + 1; // +1 for contact page

      // Step 1: Create all pages first to get real slugs from backend
      const createdPages = [];
      for (const pageConf of form.pages) {
        const page = await pagesApi.create(site._id, {
          title: pageConf.title || pageConf.keyword,
          type: pageConf.isMain ? 'homepage' : 'subpage',
          isMainHomepage: pageConf.isMain,
        });
        const realSlug = page.page.slug;
        createdPages.push({
          conf: pageConf,
          page: page.page,
          slug: realSlug,
          href: page.page.isMainHomepage ? 'index.html' : `${realSlug}.html`,
        });
      }

      // Step 2: AI generation with correct links
      for (const created of createdPages) {
        const pageConf = created.conf;
        if (useAI && pageConf.keyword) {
          setAiLoading(true);
          const pageIdx = createdPages.indexOf(created);
          setAiProgress(`Page ${pageIdx + 1}/${totalPages} : ${pageConf.keyword}`);
          try {
            const { content } = await aiApi.generatePage({
              siteId: site._id,
              keyword: pageConf.keyword,
              serviceFocus: pageConf.serviceFocus || pageConf.keyword,
            });

            // Map AI content to sections
            const sections = created.page.sections.map(s => {
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
                  // Override services with actual pages (correct links)
                  {
                    const otherPages = createdPages.filter((_, j) => j !== createdPages.indexOf(created));
                    sData.data.services = otherPages.map((op) => ({
                      name: op.conf.serviceFocus || op.conf.keyword || op.conf.title,
                      shortDescription: '',
                      linkUrl: op.href,
                    }));
                  }
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

            // Assign uploaded images to sections
            if (uploadedMediaIds.length > 0) {
              const pageIdx = createdPages.indexOf(created);
              const heroImgId = uploadedMediaIds[pageIdx * 2]; // 0, 2, 4...
              const descImgId = uploadedMediaIds[pageIdx * 2 + 1]; // 1, 3, 5...
              for (const s of sections) {
                if (s.type === 'hero' && heroImgId && !s.data.backgroundMediaId) {
                  s.data.backgroundMediaId = heroImgId;
                }
                if (s.type === 'description' && descImgId && !s.data.imageMediaId) {
                  s.data.imageMediaId = descImgId;
                }
              }
            }

            await pagesApi.updateSections(created.page._id, sections);

            if (content.seo) {
              await pagesApi.update(created.page._id, { seo: content.seo });
            }
          } catch (err) {
            console.error('AI generation error for page:', err);
            toast.error(`IA: erreur pour "${pageConf.keyword}"`);
          }
        } else if (uploadedMediaIds.length > 0) {
          // No AI but images uploaded — assign images to sections directly
          const pageIdx = createdPages.indexOf(created);
          const heroImgId = uploadedMediaIds[pageIdx * 2];
          const descImgId = uploadedMediaIds[pageIdx * 2 + 1];
          if (heroImgId || descImgId) {
            const sections = created.page.sections.map(s => {
              const sData = { ...s };
              if (s.type === 'hero' && heroImgId) sData.data = { ...s.data, backgroundMediaId: heroImgId };
              if (s.type === 'description' && descImgId) sData.data = { ...s.data, imageMediaId: descImgId };
              return sData;
            });
            await pagesApi.updateSections(created.page._id, sections);
          }
        }
      }

      // Auto-create contact page + AI generation
      setAiProgress(`Page ${totalPages}/${totalPages} : Contact`);
      try {
        const contactPage = await pagesApi.create(site._id, {
          title: 'Contact',
          slug: 'contact',
          type: 'contact',
        });

        if (useAI) {
          try {
            const { content } = await aiApi.generateContact({ siteId: site._id });

            const contactSections = contactPage.page.sections.map(s => {
              const sData = { ...s };
              switch (s.type) {
                case 'hero':
                  if (content.hero) {
                    sData.data = { ...s.data, ...content.hero };
                    // Preserve business CTA (phone/email link)
                    if (s.data.ctaUrl) sData.data.ctaUrl = s.data.ctaUrl;
                    if (s.data.ctaText) sData.data.ctaText = s.data.ctaText;
                  }
                  break;
                case 'testimonials':
                  if (content.testimonials?.items) sData.data = { ...s.data, items: content.testimonials.items };
                  break;
                case 'map':
                  if (content.map) sData.data = { ...s.data, ...content.map, address: s.data.address, phone: s.data.phone, email: s.data.email };
                  break;
              }
              return sData;
            });

            await pagesApi.updateSections(contactPage.page._id, contactSections);

            if (content.seo) {
              await pagesApi.update(contactPage.page._id, { seo: content.seo });
            }
          } catch (err) {
            console.error('AI contact generation error:', err);
          }
        }
      } catch (err) {
        console.error('Contact page creation error:', err);
      }

      setAiLoading(false);
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

  const RequiredMark = () => <span className="text-red-400 ml-0.5">*</span>;
  const fieldError = (key) => errors[key] ? 'border-red-400 ring-1 ring-red-200' : '';

  return (
    <div className="p-8 max-w-3xl mx-auto pb-28">
      <h1 className="text-2xl font-bold text-primary mb-2">Nouveau site</h1>

      {/* Progress — clickable steps */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex-1 ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => i <= step && goToStep(i)}
          >
            <div className={`h-1.5 rounded-full mb-1 transition-colors ${i <= step ? 'bg-accent' : 'bg-gray-200'}`} />
            <p className={`text-xs text-center transition-colors ${i <= step ? 'text-accent font-medium' : 'text-gray-400'} ${i < step ? 'hover:text-accent/70' : ''}`}>{s}</p>
          </div>
        ))}
      </div>

      {/* Step 1: Business info */}
      {step === 0 && (
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Informations de l'entreprise</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site <RequiredMark /></label>
              <input value={form.name} onChange={e => updateField('name', e.target.value)} className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent ${fieldError('name')}`} placeholder="Mon entreprise" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom commercial <RequiredMark /></label>
              <input value={form.business.name} onChange={e => updateField('business.name', e.target.value)} className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent ${fieldError('business.name')}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activité <RequiredMark /></label>
              <input value={form.business.activity} onChange={e => updateField('business.activity', e.target.value)} className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent ${fieldError('business.activity')}`} placeholder="Institut de beauté" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville <RequiredMark /></label>
              <input value={form.business.city} onChange={e => updateField('business.city', e.target.value)} className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent ${fieldError('business.city')}`} />
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
              <textarea value={form.business.services} onChange={e => updateField('business.services', e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent resize-y" placeholder="Ex: Soin visage, Épilation laser, Massage relaxant, Manucure" />
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
              <textarea value={form.business.uniqueSellingPoints} onChange={e => updateField('business.uniqueSellingPoints', e.target.value)} rows={2} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent resize-y" placeholder="Ex: 10 ans d'expérience, produits bio, résultats garantis" />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Avis Google (optionnel)</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d'avis Google</label>
              <input type="number" min="0" value={form.business.googleReviewCount} onChange={e => updateField('business.googleReviewCount', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="Ex: 127" />
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
              <input value={form.domain} onChange={e => updateField('domain', e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent" placeholder="monsite.ch" />
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
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-600">Angles</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button type="button" onClick={() => updateField('design.borderRadius', 'square')} className={`p-1.5 rounded-md transition-colors ${form.design.borderRadius === 'square' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Angles carrés">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </button>
              <button type="button" onClick={() => updateField('design.borderRadius', 'rounded')} className={`p-1.5 rounded-md transition-colors ${form.design.borderRadius === 'rounded' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Angles arrondis">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2">Le logo et favicon seront ajoutables dans les paramètres du site après création.</p>

          {/* Image import zone */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Images du site (optionnel)</h3>
            <p className="text-xs text-gray-400 mb-3">Importez vos images maintenant, elles seront automatiquement placées dans les sections hero et description de vos pages.</p>
            <div {...getImgRootProps()} className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${isImgDragActive ? 'border-accent bg-accent/5' : 'border-gray-300 hover:border-accent'}`}>
              <input {...getImgInputProps()} />
              <Upload className="mx-auto w-6 h-6 text-gray-400 mb-1" />
              <p className="text-sm text-gray-500">
                {isImgDragActive ? 'Déposez ici' : 'Glissez des images ou cliquez pour importer'}
              </p>
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                      {idx === 0 ? 'Hero page 1' : idx === 1 ? 'Description page 1' : `Hero page ${Math.ceil(idx / 2) + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Pages */}
      {step === 2 && (
        <div className="bg-white rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-4">Pages du site</h2>
          <p className="text-sm text-gray-500 mb-4">Ajoutez les pages de votre site, chacune ciblant un mot-clé SEO différent. Recommandé : 3 à 7 pages.</p>

          {form.pages.map((page, idx) => (
            <div key={idx} className={`p-4 bg-gray-50 rounded-lg space-y-2 relative ${errors[`page.${idx}`] ? 'ring-1 ring-red-300' : ''}`}>
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
                  <button onClick={() => removePage(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer cette page">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-0.5">Titre de la page</label>
                  <input
                    value={page.title}
                    onChange={e => {
                      const pages = [...form.pages];
                      pages[idx] = { ...pages[idx], title: e.target.value };
                      setForm(prev => ({ ...prev, pages }));
                      if (errors[`page.${idx}`]) setErrors(prev => { const e = { ...prev }; delete e[`page.${idx}`]; return e; });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ex: Stratégies marketing pour indépendants et PME"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Mot-clé cible</label>
                    <textarea
                      value={page.keyword}
                      onChange={e => {
                        const pages = [...form.pages];
                        pages[idx] = { ...pages[idx], keyword: e.target.value };
                        setForm(prev => ({ ...prev, pages }));
                        if (errors[`page.${idx}`]) setErrors(prev => { const e = { ...prev }; delete e[`page.${idx}`]; return e; });
                      }}
                      rows={1}
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none field-autogrow"
                      placeholder="Ex: consultant marketing Lausanne"
                      onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Service principal (optionnel)</label>
                    <textarea
                      value={page.serviceFocus}
                      onChange={e => {
                        const pages = [...form.pages];
                        pages[idx] = { ...pages[idx], serviceFocus: e.target.value };
                        setForm(prev => ({ ...prev, pages }));
                      }}
                      rows={1}
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none field-autogrow"
                      placeholder="Ex: Conseil en stratégie marketing"
                      onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button onClick={addPage} className="text-accent text-sm font-medium hover:underline">
            + Ajouter une page
          </button>
        </div>
      )}

      {/* Navigation — sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-8 py-4 z-40">
        <div className="max-w-3xl mx-auto flex justify-between">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-800">
              <ArrowLeft size={18} /> Précédent
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button onClick={() => goToStep(step + 1)} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-primary rounded-lg font-medium hover:opacity-90">
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
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-primary rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles size={18} />
                {aiLoading ? `IA : ${aiProgress || 'Création du site...'}` : loading ? 'Création...' : 'Créer avec IA'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
