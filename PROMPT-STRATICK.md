# Prompt pour création du site Stratick.ch sur Resamatic

## Contexte

Tu dois créer 2 versions d'un site web pour **Stratick** (stratick.ch) sur la plateforme Resamatic :
1. **Site IA** : créé via l'interface web avec Chrome MCP (navigateur)
2. **Site Manuel** : créé via l'API REST directement

Le site de référence est https://www.stratick.ch/

## Plateforme Resamatic

### Accès
- **URL interface** : http://192.168.110.74:3005 (port direct, pas le nginx qui timeout)
- **Login** : admin@swigs.ch / Resamatic2026
- **API directe** : http://192.168.110.74:3005/api/

### Architecture
- Backend : Node.js + Express + MongoDB
- Frontend : React + Vite + Tailwind + Zustand  
- SSG : Handlebars → HTML statique
- Serveur : swigs@192.168.110.74, PM2 "resamatic-api"

### Documentation API

#### Authentification
```
POST /api/auth/login
Body: {"email":"admin@swigs.ch","password":"Resamatic2026"}
→ Retourne {token, user}
Header: Authorization: Bearer <token>
```

#### Sites
```
POST /api/sites - Créer un site
GET /api/sites - Lister les sites
GET /api/sites/:id - Détail d'un site
PUT /api/sites/:id - Modifier un site
```

#### Pages
```
POST /api/pages - Créer une page
GET /api/pages/site/:siteId - Lister les pages d'un site
GET /api/pages/:id - Détail d'une page
PATCH /api/pages/:id/sections/:sectionIdx - Modifier une section (merge data)
```

#### Build
```
POST /api/build/:siteId - Lancer un build
GET /api/build/:siteId/preview/* - Voir le site construit
```

### Sections disponibles (dans l'ordre)
1. `hero` - Bannière principale (headline, subheadline, ctaText, ctaUrl, bulletPoints)
2. `text-highlight` - Accroche (text avec HTML, style.backgroundColor, style.textColor)
3. `description` - Description détaillée (title, body HTML, bulletPoints, ctaText, ctaUrl)
4. `why-us` - Pourquoi nous choisir (title, subtitle, body HTML, reasons[{title,text}], ctaText)
5. `google-reviews` - Avis Google (title, testimonials[{text,author,location}], ctaText)
6. `cta-banner` - Bandeau CTA (text, ctaText, ctaUrl, bannerStyle: "dark")
7. `services-grid` - Grille de services (title, subtitle, services[{name,description,linkText,linkUrl,imageMediaId}])
8. `guarantee` - Garantie (title, text)
9. `testimonials` - Témoignages (items[{name,location,rating,text}])
10. `faq` - FAQ (items[{question,answer}])
11. `team` - Équipe (title, body HTML, members[{name}])
12. `map` - Carte (title, body, address, hours, phone, email, embedUrl)

Le footer et header sont générés automatiquement via le layout (pas des sections).

---

## Informations business Stratick

### Identité
- **Nom** : Stratick
- **Activité** : Conseil en stratégie marketing et communication pour indépendants et PME
- **Fondatrice** : Carmen
- **Diplôme** : DAS en Marketing Stratégique et Communication, Université de Lausanne (UNIL)
- **Localisation** : Suisse Romande (Fribourg, Valais, Vaud)
- **Email** : carmen@stratick.ch
- **Slogan** : "Stratégies marketing tous budgets"

### Réseaux sociaux
- Facebook : https://www.facebook.com/stratick/
- LinkedIn : https://www.linkedin.com/company/stratick/
- Instagram : https://www.instagram.com/stratick.ch

### Couleurs
- **Primaire** : Beige/crème foncé (#C4A882 ou similaire)
- **Accent** : Doré/caramel
- **Texte** : Gris foncé (#333)
- **Fond** : Blanc/crème clair
- **Footer** : Sombre

### Logo
Le logo est disponible sur le site stratick.ch : "Stratick_LogoBeige_Complet.png"
Tu peux le télécharger et l'uploader via l'API media.

### Points forts
- Expérience terrain (vente + marketing)
- Approche pragmatique "Start small, test, adjust, grow"
- DAS Marketing Stratégique UNIL
- Solutions adaptées aux petits budgets
- Double perspective vente et marketing

### Services principaux
1. **Lancement d'entreprise** - Accompagnement positionnement, branding, distribution, communication
2. **Visibilité & Notoriété** - Solutions pour augmenter la visibilité et acquérir de nouveaux clients
3. **Analyse financière & Actions stratégiques** - Analyse des chiffres pour décisions data-driven
4. **Renouvellement d'offre** - Rafraîchir et dynamiser les offres existantes
5. **Résolution de problèmes** - Diagnostic et solutions opérationnelles
6. **Regard extérieur** - Analyse objective de la situation business
7. **Boîte à outils marketing** - Email marketing, CRM, outils digitaux
8. **Workshops** - Ateliers marketing événementiel et stands

---

## Pages à créer (4-5 pages)

### Page 1 : Accueil - "Stratégie marketing PME Suisse Romande"
Page principale avec vue d'ensemble des services, accroche forte, CTA vers contact.

### Page 2 : "Conseil marketing indépendants Suisse"  
Focus sur l'accompagnement des indépendants et freelances.

### Page 3 : "Stratégie de communication PME"
Focus sur la stratégie de communication et le branding.

### Page 4 : "Consultant marketing Fribourg Vaud Valais"
Focus localisation, expertise locale, workshops.

### Page 5 : Contact
Page contact avec coordonnées, formulaire, map.

---

## Instructions pour le Site IA (via interface Chrome MCP)

1. Ouvrir http://192.168.110.74:3005 dans le navigateur
2. Se connecter avec admin@swigs.ch / Resamatic2026
3. Cliquer "Nouveau site"
4. Remplir les infos business :
   - Nom : Stratick
   - Activité : Conseil en stratégie marketing et communication
   - Ville : Suisse Romande
   - Email : carmen@stratick.ch
   - Description : Stratick met à disposition des stratégies de marketing pour répondre simplement aux problèmes des indépendants et des petites entreprises
   - Services : Stratégie marketing, Communication, Branding, CRM, Marketing digital, Workshops
   - Points forts : DAS UNIL, Expérience terrain, Approche pragmatique, Petits budgets
5. Configurer le design :
   - Couleur primaire : beige/crème foncé
   - Couleur accent : doré/caramel
   - Fonts : élégantes et modernes
6. Ajouter les 4-5 pages avec leurs mots-clés
7. Lancer la génération IA
8. Vérifier et ajuster le contenu dans l'éditeur

**Note** : Le provider IA peut être configuré dans le .env du backend :
- `AI_PROVIDER=local` pour Qwen (défaut)
- `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=xxx` pour Claude Haiku (meilleure qualité)

## Instructions pour le Site Manuel (via API)

1. Authentification : POST /api/auth/login
2. Créer le site : POST /api/sites avec toutes les infos business
3. Créer les 5 pages : POST /api/pages pour chacune
4. Remplir chaque section : PATCH /api/pages/:id/sections/:sectionIdx
5. Uploader le logo si possible : POST /api/media (multipart)
6. Lancer le build : POST /api/build/:siteId
7. Vérifier le rendu : GET /api/build/:siteId/preview/index.html

### Exemple création de site via API
```json
POST /api/sites
{
  "name": "Stratick",
  "slug": "stratick",
  "business": {
    "name": "Stratick",
    "activity": "Conseil en stratégie marketing et communication pour indépendants et PME",
    "city": "Suisse Romande",
    "email": "carmen@stratick.ch",
    "description": "Stratick met à disposition de tout un chacun des stratégies de marketing pour répondre simplement aux problèmes des indépendants et des petites entreprises.",
    "services": "Stratégie marketing, Communication, Branding, CRM, Marketing digital, Workshops événementiels",
    "uniqueSellingPoints": "DAS Marketing Stratégique UNIL, Expérience terrain vente+marketing, Approche pragmatique petits budgets",
    "socialLinks": {
      "facebook": "https://www.facebook.com/stratick/",
      "linkedin": "https://www.linkedin.com/company/stratick/",
      "instagram": "https://www.instagram.com/stratick.ch"
    }
  },
  "design": {
    "colorPrimary": "#5C4A3A",
    "colorAccent": "#C4A882",
    "colorBg": "#FDFBF7",
    "colorText": "#333333",
    "fontHeading": "Playfair Display",
    "fontBody": "Inter"
  },
  "headerCtaText": "Contact",
  "headerCtaUrl": "contact.html"
}
```

### Exemple création de page
```json
POST /api/pages
{
  "siteId": "<SITE_ID>",
  "title": "Stratégie marketing PME Suisse Romande",
  "slug": "index",
  "keyword": "stratégie marketing PME Suisse Romande",
  "isMainHomepage": true
}
```

### Exemple modification de section
```json
PATCH /api/pages/:pageId/sections/0
{
  "data": {
    "headline": "Stratégies marketing pour indépendants et PME",
    "subheadline": "Des solutions pragmatiques et adaptées à votre budget pour développer votre activité en Suisse Romande",
    "ctaText": "Contactez-nous",
    "ctaUrl": "contact.html",
    "bulletPoints": [
      {"value": "Accompagnement personnalisé dès le lancement"},
      {"value": "Stratégies testées et adaptées aux petits budgets"},
      {"value": "Double expertise vente et marketing"},
      {"value": "DAS Marketing Stratégique UNIL"},
      {"value": "Réseau professionnel en Suisse Romande"},
      {"value": "Approche pragmatique : tester, ajuster, grandir"}
    ]
  }
}
```

---

## Sites existants à consulter comme référence

- **Site Manuel v2** (Précision Institut) : http://192.168.110.74/api/build/69b1896f4af5738d77586d4c/preview/index.html
  - C'est le site le plus abouti, toutes les sections sont remplies
  - Utiliser comme modèle de qualité de contenu

- **Site de référence original** : https://www.precision-institut.fr/manucure-russe-lille

## Fichiers clés du projet
- `backend/src/services/ai.service.js` - Service IA (Qwen + Haiku)
- `backend/src/services/ssg.service.js` - Générateur de site statique
- `backend/src/models/Page.js` - Modèle pages (enum des sections)
- `backend/src/controllers/pageController.js` - Contrôleur pages (sections par défaut)
- `frontend/src/pages/PageEditorPage.jsx` - Éditeur de page
- `frontend/src/pages/SiteCreatePage.jsx` - Création de site avec IA
- `templates/` - Templates Handlebars (layouts, partials, sections, CSS)

## Notes importantes
- Utiliser le port 3005 directement (pas le port 80/nginx qui timeout à 60s)
- Le cache de templates est invalidé à chaque build (pas besoin de restart PM2)
- Les sections par défaut sont créées automatiquement lors du POST /api/pages
- Pour modifier une section, utiliser PATCH /api/pages/:id/sections/:sectionIdx qui merge les data
- Le footer et le header sont des partials Handlebars, pas des sections éditables par page
