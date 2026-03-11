# Resamatic - Document de Relais Complet

> Ce document est destiné à une nouvelle instance IA qui reprendra le développement de Resamatic.
> Lis-le en entier avant de faire quoi que ce soit.

---

## 1. Qu'est-ce que Resamatic ?

Resamatic est un **générateur de sites web statiques** avec interface d'administration, conçu pour créer rapidement des sites SEO-optimisés pour des entreprises locales (instituts de beauté, consultants, artisans, etc.).

**Workflow** : L'utilisateur crée un site via l'interface → remplit les infos business → l'IA génère le contenu des sections → l'éditeur WYSIWYG permet d'affiner → le SSG compile en HTML/CSS statique → déployable n'importe où.

**Projet indépendant** du CMS SWIGS — code séparé, base de données séparée.

---

## 2. Stack technique

| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Frontend** | React 18 + Vite 6 + Tailwind CSS v4 + Zustand 5 | SPA, port 5173 en dev |
| **Backend** | Node.js + Express 4 + MongoDB + Mongoose 8 | ES modules, port 3005 |
| **SSG** | Handlebars 4.7 | Templates → HTML statique pur |
| **Images** | Sharp | WebP, 3 variants (400w, 800w, 1200w) |
| **IA** | Qwen3-VL-8B (local) + Claude Haiku (Anthropic) | Multi-provider, OpenAI-compatible |
| **Auth** | JWT + bcrypt | Token 7 jours |
| **Icons** | Lucide React | SVG icons |

### Serveurs
- **Production** : `swigs@192.168.110.74` (Ubuntu, SSH key auth, sudo: `AagD2jCusi`)
- **DGX Spark (IA locale)** : `http://192.168.110.103:8000/v1` (SGLang, Qwen3-VL-8B, ~12 tok/s)
- **PM2** : process `resamatic-api` (cluster mode, port 3005)
- **nginx** : port 80, proxy vers 3005 (timeout 60s — problème connu)
- **MongoDB** : localhost:27017, base `resamatic`

### Credentials
- **Admin** : `admin@swigs.ch` / `Resamatic2026`
- **API** : `http://192.168.110.74:3005/api/` (utiliser le port 3005 direct, pas nginx)

---

## 3. Architecture du projet

```
resamatic/
├── backend/
│   ├── server.js                          # Point d'entrée (Express + MongoDB)
│   ├── .env                               # Config (ports, DB, JWT, AI)
│   └── src/
│       ├── routes/                         # auth, sites, pages, media, build, deploy, ai
│       ├── controllers/                    # Logique métier par route
│       ├── models/                         # User, Site, Page, Media (Mongoose)
│       ├── services/
│       │   ├── ai.service.js              # IA multi-provider (Qwen + Haiku)
│       │   ├── ssg.service.js             # Compilateur Handlebars → HTML
│       │   ├── deploy.service.js          # Déploiement SSH/rsync
│       │   └── imageProcessor.js          # Sharp WebP conversion
│       └── middleware/                     # auth JWT, error handler
├── frontend/
│   └── src/
│       ├── pages/                          # Login, Dashboard, SiteCreate, PageEditor, etc.
│       ├── stores/                         # Zustand (siteStore, authStore)
│       ├── components/                     # MediaPicker, Layout, PublishButton
│       └── services/api.js                # Client Axios
├── templates/
│   ├── layouts/base.hbs                   # Layout HTML principal
│   ├── partials/                          # header.hbs, footer.hbs, cookie-consent.hbs
│   ├── sections/                          # 14 templates de sections
│   └── assets/main.css                    # CSS du site généré (responsive)
├── HANDOFF.md                             # Ce fichier
└── PROMPT-STRATICK.md                     # Prompt pour créer le site stratick.ch
```

---

## 4. API REST complète

### Authentification
```
POST /api/auth/login          → {token, user}
POST /api/auth/register       → Créer un utilisateur (auth requise)
GET  /api/auth/me             → User courant
POST /api/auth/change-password
```

### Sites
```
GET    /api/sites              → Liste tous les sites
POST   /api/sites              → Créer un site
GET    /api/sites/:id          → Détail d'un site (populate logoMediaId)
PUT    /api/sites/:id          → Modifier un site
DELETE /api/sites/:id          → Supprimer un site
POST   /api/sites/:id/duplicate → Dupliquer un site
```

### Pages
```
GET    /api/pages/site/:siteId          → Pages d'un site
POST   /api/pages/site/:siteId          → Créer une page (sections par défaut auto-générées)
GET    /api/pages/:id                   → Détail d'une page
PUT    /api/pages/:id                   → Modifier une page
DELETE /api/pages/:id                   → Supprimer
PATCH  /api/pages/:id/sections          → Modifier toutes les sections
PATCH  /api/pages/:id/sections/:idx     → Modifier UNE section (merge data)
```

### Media
```
POST   /api/media/site/:siteId/upload   → Upload image (multipart, max 20MB)
GET    /api/media/site/:siteId          → Lister les médias
GET    /api/media/:id                   → Détail
PATCH  /api/media/:id                   → Modifier (alt, folder)
DELETE /api/media/:id                   → Supprimer
```

### Build & Deploy
```
POST /api/build/:siteId                 → Lancer un build
GET  /api/build/:siteId/status          → Statut du build
GET  /api/build/:siteId/preview/*       → Servir le site construit (PUBLIC, pas d'auth)
POST /api/deploy/:siteId/publish        → Publier en production
POST /api/deploy/:siteId/unpublish      → Dépublier
GET  /api/deploy/:siteId/status         → Statut déploiement
```

### IA
```
POST /api/ai/generate-page              → Générer le contenu d'une page
POST /api/ai/generate-seo               → Générer les métadonnées SEO
POST /api/ai/rewrite                    → Réécrire du texte
POST /api/ai/generate-alt               → Générer un texte alt pour une image
```

---

## 5. Modèles de données (MongoDB)

### Site
```javascript
{
  name, slug (unique), domain, status: 'draft'|'building'|'published'|'error',
  business: { name, activity, description, address, city, zip, phone, email, siret,
              socialLinks: {facebook, instagram, tiktok, youtube, linkedin},
              openingHours: [{day, hours}],
              googleMapsEmbed, googleReviewCount, googleReviewRating },
  design: { primaryColor:'#12203e', accentColor:'#c8a97e', backgroundColor:'#ffffff',
            textColor:'#333333', fontHeading:'Playfair Display', fontBody:'Inter',
            logoMediaId (ref Media), faviconMediaId (ref Media) },
  headerCtaText, headerCtaUrl,
  seoDefaults: { titleSuffix, defaultDescription, defaultKeywords },
  posthog: { enabled, apiKey, apiHost },
  lastBuiltAt, lastPublishedAt, buildError
}
```

### Page
```javascript
{
  siteId (ref Site), title, slug, type: 'homepage'|'subpage'|'legal',
  isMainHomepage: false, sortOrder: 0,
  seo: { title, description, keywords[], canonicalUrl, ogImageMediaId, jsonLd },
  sections: [{
    type: enum['hero','text-highlight','description','why-us','google-reviews',
               'cta-banner','services-grid','services-detail','guarantee',
               'testimonials','faq','team','map','footer'],
    order: Number,
    visible: true,
    data: Mixed  // Contenu libre selon le type de section
  }]
}
```

### Media
```javascript
{
  siteId, filename, originalName, storagePath, mimeType, size, width, height,
  alt: '', folder: '/',
  variants: [{ suffix, storagePath, width, height, size }]
}
```

---

## 6. Sections de template (14 types)

Chaque page est composée de sections ordonnées. Le SSG compile chaque section avec son template Handlebars.

| # | Type | Template | Champs principaux |
|---|------|----------|-------------------|
| 1 | `hero` | hero.hbs | headline, subheadline, ctaText, ctaUrl, bulletPoints[{value}], imageMediaId |
| 2 | `text-highlight` | text-highlight.hbs | text (HTML), style.backgroundColor, style.textColor |
| 3 | `description` | description.hbs | title, body (HTML), bulletPoints[{value}], ctaText, ctaUrl, imageMediaId |
| 4 | `why-us` | why-us.hbs | title, subtitle, body (HTML), reasons[{title,text}], ctaText, ctaUrl |
| 5 | `google-reviews` | google-reviews.hbs | title, testimonials[{text,author,location}], ctaText, rating, count |
| 6 | `cta-banner` | cta-banner.hbs | text, ctaText, ctaUrl, bannerStyle:'dark' |
| 7 | `services-grid` | services-grid.hbs | title, subtitle, services[{name,description,linkText,linkUrl,imageMediaId}] |
| 8 | `services-detail` | services-detail.hbs | title, body, price, imageMediaId |
| 9 | `guarantee` | guarantee.hbs | title, text |
| 10 | `testimonials` | testimonials.hbs | items[{name,location,rating,text}] |
| 11 | `faq` | faq.hbs | items[{question,answer}] |
| 12 | `team` | team.hbs | title, body (HTML), members[{name}] |
| 13 | `map` | map.hbs | title, body, address, hours, phone, email, embedUrl (Google Maps) |
| 14 | `footer` | footer.hbs (section) | N/A (le footer est un partial dans base.hbs, pas une section) |

**Important** : Le `header` et le `footer` sont des **partials** dans `base.hbs` (`{{> header}}` et `{{> footer}}`), pas des sections de page. Ils sont automatiquement inclus sur toutes les pages.

---

## 7. Service IA (ai.service.js)

### Multi-provider
```
AI_PROVIDER=local     → Qwen3-VL-8B sur DGX Spark (192.168.110.103:8000)
AI_PROVIDER=anthropic → Claude Haiku 4.5 (API Anthropic, nécessite ANTHROPIC_API_KEY)
```

### Génération de contenu
`generatePageContent(site, pageConfig)` split en **2 appels parallèles** :
- **Appel 1** : hero, textHighlight, description, whyUs, ctaBanner, seo
- **Appel 2** : googleReviews, servicesGrid, guarantee, testimonials, faq, team, map

Chaque appel retourne du JSON, les résultats sont mergés. Timeout : 180s.

### Autres fonctions
- `generateSeoMetadata(site, pageContent)` — Métadonnées SEO
- `rewriteText(text, instruction)` — Réécriture de contenu
- `generateAltText(imageDescription)` — Texte alt pour images

---

## 8. SSG (ssg.service.js)

### Processus de build
1. `invalidateTemplates()` — Vide le cache (appelé à chaque build)
2. `loadTemplates()` — Compile tous les templates Handlebars
3. Pour chaque page du site :
   - Itère les sections visibles triées par `order`
   - Compile chaque section avec `sectionTemplates[section.type]`
   - Concatène le HTML des sections
   - Injecte dans `baseTemplate` avec les données du site, page, SEO
4. Copie le `main.css` et les images dans le dossier de build
5. Génère `robots.txt`, `sitemap.xml`, `llms.txt`

### Fichiers générés
```
builds/{slug}/
├── index.html          # Page principale
├── {page-slug}.html    # Pages secondaires
├── main.css            # CSS copié depuis templates/assets/
├── images/             # Images optimisées
├── robots.txt
├── sitemap.xml
├── llms.txt
└── llms-full.txt
```

---

## 9. Ce qui a été construit (historique complet)

### Phase 1 : Backend API
- Express avec sécurité (helmet, rate-limit, mongo-sanitize)
- CRUD complet pour Sites, Pages, Media
- Auth JWT avec bcrypt
- Upload d'images avec Sharp (WebP, 3 tailles)

### Phase 2 : Frontend SPA
- React 18 + Vite + Tailwind + Zustand
- Pages : Login, Dashboard, SiteCreate, SiteSettings, PagesList, PageEditor, MediaLibrary, SEO
- Éditeur de page WYSIWYG avec preview iframe temps réel
- MediaPicker pour sélectionner/uploader des images
- Sélecteur de page (dropdown) pour naviguer entre pages

### Phase 3 : Templates Handlebars
- Layout base.hbs avec header et footer partials
- 14 templates de sections (voir tableau ci-dessus)
- CSS responsive (desktop, tablette, mobile)
- Header minimal (logo + CTA)
- Footer avec coordonnées et réseaux sociaux
- Edit bridge JavaScript (click-to-edit dans l'iframe preview)

### Phase 4 : IA multi-provider
- Support Qwen local (OpenAI-compatible) et Claude Haiku (Anthropic API)
- Split en 2 appels parallèles pour éviter les timeouts
- Mapping complet des résultats IA vers les sections dans SiteCreatePage
- Fonctions : génération de contenu, SEO, réécriture, alt text

### Phase 5 : Déploiement
- Service deploy.service.js (SSH/rsync)
- Routes /api/deploy pour publish/unpublish
- PM2 en production sur 192.168.110.74

### Phase 6 : Polissage
- Section text-highlight (Accroche) ajoutée
- Header minimal remplace l'ancien navbar
- Map Google avec iframe 450px
- CSS mobile complet (overflow, header, titres, boutons, FAQ)
- Footer comme partial dans base.hbs
- Fix cache templates (invalidateTemplates à chaque build)
- Images dans services-grid

---

## 10. Bugs connus et pièges

| Problème | Cause | Solution |
|----------|-------|----------|
| **nginx 504 sur génération IA** | Timeout nginx 60s | Utiliser port 3005 directement. Ou configurer `proxy_read_timeout 300s` dans nginx (sudo requis) |
| **Section non affichée après ajout** | Cache templates en mémoire | Déjà fixé : `invalidateTemplates()` à chaque build |
| **Nouvelle section non sauvée** | Type non dans l'enum de Page.js | Ajouter le type dans l'enum `sections.type` du modèle Page |
| **PATCH sections format** | Confusion entre /sections et /sections/:idx | `:idx` merge data dans une section, sans `:idx` remplace tout |
| **Footer manquant** | N'était pas inclus dans base.hbs | Fixé : `{{> footer}}` ajouté dans base.hbs |
| **Images pas affichées** | Les sites de démo n'ont pas d'images uploadées | Uploader via POST /api/media/site/:siteId/upload |

---

## 11. Sites existants en base

| Site | ID | Description | URL preview |
|------|----|-------------|-------------|
| Manuel v1 | `69b1742826cd06cadfd40aec` | Premier site test (Précision Institut) | `/api/build/69b1742826cd06cadfd40aec/preview/index.html` |
| Manuel v2 | `69b1896f4af5738d77586d4c` | Site complet calqué sur precision-institut.fr, 6 pages, toutes sections remplies | `/api/build/69b1896f4af5738d77586d4c/preview/index.html` |

---

## 12. Déploiement du code

### Déployer le backend
```bash
scp -r backend/ swigs@192.168.110.74:/home/swigs/resamatic/backend/
scp -r templates/ swigs@192.168.110.74:/home/swigs/resamatic/templates/
ssh swigs@192.168.110.74 "cd /home/swigs/resamatic && pm2 restart resamatic-api"
```

### Déployer le frontend
```bash
cd frontend && npm run build
scp -r dist/ swigs@192.168.110.74:/home/swigs/resamatic/frontend/dist/
```

### Variables d'environnement (.env sur le serveur)
```
NODE_ENV=development
PORT=3005
MONGODB_URI=mongodb://localhost:27017/resamatic
JWT_SECRET=r3s4m4t1c_s3cr3t_k3y_sw1gs_2026
JWT_EXPIRE=7d
CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=./uploads
BUILD_OUTPUT_DIR=./builds
AI_API_URL=http://192.168.110.103:8000/v1
AI_MODEL=Qwen/Qwen3-VL-8B-Instruct
# Pour Claude Haiku (optionnel) :
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 13. Ce qui reste à faire

### Priorité immédiate
1. **Créer le site Stratick** — Voir `PROMPT-STRATICK.md` pour les instructions détaillées. Créer 2 versions : IA (via interface Chrome MCP) et Manuel (via API)
2. **Images réelles** — Aucun site n'a d'images uploadées (que des placeholders). Uploader via media manager
3. **Tester Claude Haiku** — Ajouter la clé API dans .env et comparer la qualité vs Qwen

### Priorité haute
4. **Déploiement automatique des sites** — Actuellement le deploy.service.js existe mais n'est pas connecté au workflow. Objectif : quand on clique "Publier", le site statique est copié vers un dossier nginx servi sur un domaine/sous-domaine configuré. Faut configurer nginx pour servir chaque site sur son domaine.
5. **Gestion des domaines** — Chaque site a un champ `domain` dans le modèle. Il faudrait : auto-configurer nginx vhost + Let's Encrypt SSL via certbot.
6. **Liens entre pages** — Les services-grid ont des liens `#` → les lier aux vraies pages du site. Le footer devrait aussi lister les pages du site.
7. **Page Contact fonctionnelle** — Actuellement juste les coordonnées. Ajouter un formulaire (avec un service d'envoi d'email type Resend, SendGrid, ou simple mailto).
8. **nginx timeout** — Configurer `proxy_read_timeout 300s` pour les appels IA (sudo password: `AagD2jCusi`).

### Priorité moyenne
9. **Favicon** — Pas encore implémenté
10. **Sitemap XML dynamique** — Le SSG génère un sitemap.xml mais il faudrait vérifier qu'il est correct
11. **Schema.org / JSON-LD** — Le code existe dans base.hbs (`{{{jsonLd}}}`) mais vérifier que les données sont bien générées
12. **Animations au scroll** — Le site de référence (precision-institut.fr) a des fade-in. Ajouter avec IntersectionObserver
13. **Éditeur de footer** — Le footer est un partial statique. Permettre de le personnaliser par site
14. **Multi-sites sur un seul serveur** — nginx routing par domaine

### Priorité basse
15. **Tests automatisés** — Aucun test actuellement
16. **Multi-langue** — Tout est en français
17. **Optimisation performance** — Critical CSS inline (déjà fait dans base.hbs), lazy loading images
18. **Historique/versioning** — Sauvegardes des anciennes versions d'une page
19. **Rôles utilisateurs** — Un seul admin pour l'instant

---

## 14. Fichiers clés à lire en priorité

Si tu dois comprendre le projet rapidement, lis ces fichiers dans cet ordre :

1. `backend/server.js` — Point d'entrée, middleware, routes
2. `backend/src/models/Site.js` — Modèle de données principal
3. `backend/src/models/Page.js` — Modèle pages avec sections
4. `backend/src/services/ssg.service.js` — Le coeur du SSG
5. `backend/src/services/ai.service.js` — Service IA multi-provider
6. `backend/src/controllers/buildController.js` — Trigger de build
7. `templates/layouts/base.hbs` — Layout HTML
8. `templates/assets/main.css` — CSS complet du site généré
9. `frontend/src/pages/PageEditorPage.jsx` — Éditeur de sections
10. `frontend/src/pages/SiteCreatePage.jsx` — Création avec IA

---

## 15. Par où commencer

1. **Lis ce document en entier**
2. **Lis `PROMPT-STRATICK.md`** pour la prochaine tâche concrète
3. **Vérifie l'état du serveur** : `ssh swigs@192.168.110.74 "pm2 status"` et teste l'API : `curl http://192.168.110.74:3005/api/health`
4. **Ouvre le site Manuel v2** pour voir l'état actuel : `http://192.168.110.74/api/build/69b1896f4af5738d77586d4c/preview/index.html`
5. **Crée le site Stratick** (IA + Manuel)
6. **Attaque le déploiement automatique** : nginx vhosts + certbot + auto-publish
