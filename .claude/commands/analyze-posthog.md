# Analyse PostHog — Recommandations Template

Analyse les données PostHog agrégées de tous les sites clients Resamatic pour générer des recommandations d'amélioration du template Handlebars.

## Instructions

1. **Récupérer la config PostHog** :
   - Lire le `.env` serveur via SSH pour obtenir `POSTHOG_CLIENT_KEY` et `POSTHOG_CLIENT_HOST`
   - Lire aussi les sites avec PostHog activé dans la base MongoDB

2. **Collecter les données PostHog** via l'API PostHog (https://eu.posthog.com/api/) :
   - **Pageviews** par page/section (quelles pages sont les plus visitées)
   - **Bounce rate** par page d'entrée
   - **Scroll depth** moyen (jusqu'où les visiteurs scrollent)
   - **Clicks CTA** (taux de clic sur les boutons d'action)
   - **Temps passé** par section (via session recordings si dispo)
   - **Appareils** : répartition mobile/desktop/tablet
   - **Sources de trafic** : direct, organic, social, referral

3. **Analyser les métriques** avec ces questions :
   - Quelles sections ont le meilleur engagement ?
   - Quelles sections sont ignorées (scroll-past) ?
   - Le CTA principal est-il cliqué ? Quel taux ?
   - Y a-t-il un "point de drop-off" commun dans le scroll ?
   - Les performances sont-elles bonnes sur mobile ?
   - Quel est le parcours type visiteur (pages vues par session) ?

4. **Lire le template actuel** :
   - `templates/layouts/base.hbs`
   - `templates/assets/main.css`
   - Tous les templates de sections dans `templates/sections/`
   - Les partials dans `templates/partials/`

5. **Générer des recommandations concrètes** :
   - Ordre optimal des sections (basé sur l'engagement)
   - Améliorations CSS (taille des CTA, espacement, contraste)
   - Sections à mettre en avant / déprioriser
   - Suggestions de A/B tests à lancer
   - Améliorations mobile spécifiques

6. **Produire un rapport** dans `tasks/posthog-analysis-YYYY-MM.md` avec :
   - Résumé des données (tableaux)
   - Top 5 recommandations priorisées
   - Modifications de code suggérées (avec diffs)
   - Comparaison avec l'analyse précédente (si existante)

## API PostHog

L'API PostHog est documentée sur https://posthog.com/docs/api.
- Auth : Header `Authorization: Bearer $POSTHOG_PERSONAL_API_KEY` (stored in server .env)
- Base URL : `https://eu.posthog.com/api/`
- Project API Key (ingestion) : stored in server .env as `POSTHOG_CLIENT_KEY`
- Endpoints utiles :
  - `GET /api/projects/@current/insights/` — insights sauvegardés
  - `POST /api/projects/@current/query/` — HogQL queries
  - `GET /api/projects/@current/events/` — événements bruts
  - `GET /api/projects/@current/persons/` — visiteurs

## Events custom trackés

- `section_viewed` — properties: `section_type`, `section_index`, `page`
- `cta_clicked` — properties: `text`, `href`, `section_type`, `page`
- `$pageview` — automatique PostHog

## Notes

- Ce skill est prévu pour être exécuté **2 fois par an**
- Les sites **Standard** (sans PostHog) ne sont PAS analysés
- Seuls les sites avec `posthog.enabled = true` sont inclus dans l'analyse
- Les recommandations s'appliquent au template **global** (pas par site)
