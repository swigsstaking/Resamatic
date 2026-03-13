import axios from 'axios';

// Provider: 'anthropic' or 'local' (Qwen)
const AI_PROVIDER = process.env.AI_PROVIDER || 'local';

// Local Qwen (Ollama)
const LOCAL_URL = process.env.AI_API_URL || 'http://192.168.110.103:11434';
const LOCAL_MODEL = process.env.AI_MODEL || 'qwen3.5:9b-optimized';

// Anthropic
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

async function chatAnthropic(messages, options = {}) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: ANTHROPIC_MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system,
    messages: userMessages,
    temperature: options.temperature ?? 0.7,
  }, {
    timeout: options.timeout ?? 60000,
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  });

  return response.data.content[0].text;
}

async function chatLocal(messages, options = {}) {
  const response = await axios.post(`${LOCAL_URL}/api/chat`, {
    model: LOCAL_MODEL,
    messages,
    stream: false,
    think: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
  }, { timeout: options.timeout ?? 120000 });

  return response.data.message.content;
}

async function chat(messages, options = {}) {
  if (AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
    try {
      return await chatAnthropic(messages, options);
    } catch (err) {
      console.warn(`[AI] Anthropic failed (${err.message}), falling back to local provider`);
      return await chatLocal(messages, options);
    }
  }

  try {
    return await chatLocal(messages, options);
  } catch (err) {
    if (ANTHROPIC_API_KEY) {
      console.warn(`[AI] Local failed (${err.message}), falling back to Anthropic`);
      return await chatAnthropic(messages, options);
    }
    throw err;
  }
}

function parseJson(text) {
  // Extract JSON from markdown code blocks if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = (match ? match[1] : text).trim();

  try {
    return JSON.parse(jsonStr);
  } catch (firstErr) {
    // Try to repair truncated JSON by closing open braces/brackets
    let repaired = jsonStr;
    // Remove trailing comma before closing
    repaired = repaired.replace(/,\s*$/, '');
    // Count open/close braces and brackets
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    // Close unclosed brackets then braces
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
    try {
      const result = JSON.parse(repaired);
      console.warn('[AI] JSON was truncated but successfully repaired');
      return result;
    } catch {
      // Try extracting the largest valid JSON object
      const objMatch = jsonStr.match(/^\{[\s\S]*/);
      if (objMatch) {
        // Progressively trim from end until valid
        let str = objMatch[0];
        for (let i = str.length; i > 10; i--) {
          const candidate = str.slice(0, i);
          const ob = (candidate.match(/{/g) || []).length;
          const cb = (candidate.match(/}/g) || []).length;
          const oB = (candidate.match(/\[/g) || []).length;
          const cB = (candidate.match(/]/g) || []).length;
          let fixed = candidate.replace(/,\s*$/, '');
          for (let j = 0; j < oB - cB; j++) fixed += ']';
          for (let j = 0; j < ob - cb; j++) fixed += '}';
          try {
            const result = JSON.parse(fixed);
            console.warn(`[AI] JSON repaired by trimming (lost ${str.length - i} chars)`);
            return result;
          } catch { continue; }
        }
      }
      console.error('[AI] JSON repair failed, raw text:', jsonStr.slice(0, 500));
      throw firstErr;
    }
  }
}

export async function generatePageContent(site, pageConfig) {
  const { keyword, serviceFocus, tone = 'professionnel et chaleureux' } = pageConfig;
  const biz = site.business || {};
  const name = biz.name || site.name;
  const city = biz.city || '';
  const phone = biz.phone || '';
  const phoneDisplay = phone ? phone.replace(/(\d{2})(?=\d)/g, '$1 ') : '';
  const cta = phone ? `Contactez-nous au ${phoneDisplay} >` : 'Contactez-nous >';
  const ctaUrl = 'contact.html';

  const sysPrompt = `Tu es un rédacteur web SEO expert pour entreprises locales françaises. Style fluide et engageant. Paragraphes de 3-4 phrases. Chaque phrase apporte de la valeur. Pas de remplissage. Réponds UNIQUEMENT en JSON valide.`;

  const bizContext = `Entreprise: ${name} | Activité: ${biz.activity || ''} | Ville: ${city} | Adresse: ${biz.address || ''} ${biz.zip || ''} ${city} | Mot-clé: ${keyword} | Service: ${serviceFocus || keyword} | Tél: ${phone} | Services: ${biz.services || ''} | Points forts: ${biz.uniqueSellingPoints || ''} | Description: ${biz.description || ''} | Avis Google: ${biz.googleReviewCount || '?'}+ (${biz.googleReviewRating || '5'}/5)`;

  // Call 1: Main content sections (hero, textHighlight, description, whyUs, ctaBanner, seo)
  const prompt1 = `${bizContext}

Génère du contenu engageant et SEO. Le H1 ne doit PAS répéter la ville si elle est déjà dans le mot-clé. JSON:
{"hero":{"headline":"H1 max 70 car","subheadline":"sous-titre 120 car","ctaText":"${cta}","ctaUrl":"${ctaUrl}","bulletPoints":[{"value":"point 1"},{"value":"point 2"},{"value":"point 3"},{"value":"point 4"},{"value":"point 5"}]},"textHighlight":{"text":"2 phrases avec <strong>mots-clés</strong> en gras"},"description":{"title":"Question engageante avec mot-clé ?","body":"<p>3-4 phrases service principal avec <strong>gras</strong></p><p>2-3 phrases qualifications et cadre</p>","bulletPoints":[{"value":"avantage 1"},{"value":"avantage 2"},{"value":"avantage 3"},{"value":"avantage 4"}],"ctaText":"${cta}","ctaUrl":"${ctaUrl}"},"whyUs":{"title":"Pourquoi choisir ${name}${city ? ' à '+city : ''} ?","subtitle":"une phrase expertise","body":"<p>3-4 phrases expertise et méthode</p>","reasons":[{"title":"raison 1","text":"1-2 phrases"},{"title":"raison 2","text":"1-2 phrases"},{"title":"raison 3","text":"1-2 phrases"},{"title":"raison 4","text":"1-2 phrases"}],"ctaText":"${cta}","ctaUrl":"${ctaUrl}"},"ctaBanner":{"text":"accroche forte courte","ctaText":"Contactez-nous","ctaUrl":"${ctaUrl}","bannerStyle":"dark"},"seo":{"title":"max 60 car SEO","description":"max 150 car STRICT, pas plus","keywords":["5 mots-clés"]}}`;

  // Call 2: Secondary sections (googleReviews, servicesGrid, guarantee, testimonials, faq, team, map)
  const prompt2 = `${bizContext}

Génère du contenu engageant pour les sections secondaires. Avis naturels et détaillés. Réponses FAQ utiles. JSON:
{"googleReviews":{"title":"titre avis + ville","testimonials":[{"text":"avis 2-3 phrases réaliste et détaillé","author":"Prénom P.","location":"${city}"},{"text":"avis 2-3 phrases","author":"Prénom M.","location":"Lambersart"},{"text":"avis 2-3 phrases","author":"Prénom D.","location":"Marcq-en-Baroeul"}],"ctaText":"Voir nos avis"},"servicesGrid":{"title":"Nos services${city ? ' à '+city : ''}","subtitle":"1-2 phrases présentation services","services":[{"name":"service 1","shortDescription":"2-3 phrases"},{"name":"service 2","shortDescription":"2-3 phrases"},{"name":"service 3","shortDescription":"2-3 phrases"},{"name":"service 4","shortDescription":"2-3 phrases"}]},"guarantee":{"title":"Garantie de satisfaction","text":"2-3 phrases engagement qualité"},"testimonials":{"items":[{"name":"Prénom L.","location":"${city}","rating":5,"text":"avis 2-3 phrases"},{"name":"Prénom M.","location":"ville proche","rating":5,"text":"avis 2-3 phrases"},{"name":"Prénom D.","location":"ville proche","rating":5,"text":"avis 2-3 phrases"}]},"faq":{"items":[{"question":"question 1 mot-clé ville","answer":"réponse 3-4 phrases"},{"question":"question 2","answer":"réponse 3-4 phrases"},{"question":"question 3","answer":"réponse 3-4 phrases"},{"question":"question 4","answer":"réponse 3-4 phrases"},{"question":"question 5","answer":"réponse 3-4 phrases"}]},"team":{"title":"équipe experte ${keyword}${city ? ' à '+city : ''}","body":"<p>2-3 phrases équipe</p>","members":[{"name":"point fort 1"},{"name":"point fort 2"},{"name":"point fort 3"},{"name":"point fort 4"}]},"map":{"title":"${city ? 'Présent à '+city+' et environs' : 'Nous trouver'}","body":"3-4 phrases localisation accessibilité zones desservies","hours":"${biz.hours || 'Du lundi au samedi de 10h à 18h'}"}}`;

  // Chat + parse with retry on failure
  async function chatAndParse(messages, opts, label) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await chat(messages, opts);
        return parseJson(raw);
      } catch (err) {
        if (attempt === 1) {
          console.warn(`[AI] ${label} attempt 1 failed (${err.message}), retrying...`);
        } else {
          console.error(`[AI] ${label} attempt 2 failed, giving up`);
          throw err;
        }
      }
    }
  }

  const chatOpts = { temperature: 0.7, maxTokens: 6000, timeout: 180000 };

  // Run both calls in parallel with retry
  const [part1, part2] = await Promise.all([
    chatAndParse([{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt1 }], chatOpts, 'main-sections'),
    chatAndParse([{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt2 }], chatOpts, 'secondary-sections'),
  ]);

  return { ...part1, ...part2 };
}

export async function generateContactContent(site) {
  const biz = site.business || {};
  const name = biz.name || site.name;
  const city = biz.city || '';
  const phone = biz.phone || '';
  const phoneDisplay = phone ? phone.replace(/(\d{2})(?=\d)/g, '$1 ') : '';
  const ctaPhone = phone ? `Appelez le ${phoneDisplay}` : '';

  const sysPrompt = `Tu es un rédacteur web expert en conversion pour entreprises locales françaises. Ton objectif : créer une page Contact qui rassure et incite à prendre contact. Réponds UNIQUEMENT en JSON valide.`;

  const bizContext = `Entreprise: ${name} | Activité: ${biz.activity || ''} | Ville: ${city} | Adresse: ${biz.address || ''} ${biz.zip || ''} ${city} | Tél: ${phone} | Email: ${biz.email || ''} | Services: ${biz.services || ''} | Points forts: ${biz.uniqueSellingPoints || ''} | Description: ${biz.description || ''} | Avis Google: ${biz.googleReviewCount || '?'}+ (${biz.googleReviewRating || '5'}/5)`;

  const prompt = `${bizContext}

Génère du contenu pour une page CONTACT axée conversion et confiance. JSON:
{"hero":{"headline":"titre accrocheur contact max 60 car (pas juste 'Contactez-nous')","subheadline":"sous-titre rassurant 120 car mentionnant réactivité/disponibilité","bulletPoints":[{"value":"avantage contact 1 (ex: réponse rapide)"},{"value":"avantage 2 (ex: devis gratuit)"},{"value":"avantage 3 (ex: sans engagement)"}]${ctaPhone ? `,"ctaText":"${ctaPhone}"` : ''}},"testimonials":{"items":[{"name":"Prénom L.","location":"${city}","rating":5,"text":"avis 3-4 phrases sur la qualité d'accueil et la facilité de prise de contact"},{"name":"Prénom M.","location":"ville proche","rating":5,"text":"avis sur la réactivité et le professionnalisme"},{"name":"Prénom D.","location":"ville proche","rating":5,"text":"avis sur l'expérience client et la recommandation"}]},"map":{"title":"${city ? name + ' — ' + city : 'Nous trouver'}","body":"<p>2-3 phrases localisation, accessibilité, parking, transports</p><p>zones desservies et communes proches</p>","hours":"${biz.hours || 'Du lundi au samedi de 10h à 18h'}"},"seo":{"title":"Contact ${name}${city ? ' à ' + city : ''} — Prenez rendez-vous","description":"Contactez ${name}${city ? ' à ' + city : ''}. ${biz.activity || 'Nos services'}, devis gratuit, réponse rapide. ${phone ? 'Tél: ' + phoneDisplay : ''}","keywords":["contact ${name ? name.toLowerCase() : ''}","${biz.activity ? biz.activity.toLowerCase() : ''} ${city.toLowerCase()}","rendez-vous","devis gratuit","${city.toLowerCase()}"]}}`;

  const messages = [{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt }];
  const opts = { temperature: 0.7, maxTokens: 3000, timeout: 120000 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await chat(messages, opts);
      return parseJson(result);
    } catch (err) {
      if (attempt === 1) {
        console.warn(`[AI] Contact generation attempt 1 failed (${err.message}), retrying...`);
      } else throw err;
    }
  }
}

export async function generateSeoMetadata(site, pageContent) {
  const systemPrompt = `Tu es un expert SEO. Génère des métadonnées SEO optimisées. Réponds UNIQUEMENT en JSON.`;

  const userPrompt = `Génère les métadonnées SEO pour cette page :
Entreprise : ${site.business?.name || site.name}
Ville : ${site.business?.city || ''}
Contenu : ${JSON.stringify(pageContent).substring(0, 2000)}

JSON attendu :
{
  "title": "Title tag (max 60 car)",
  "description": "Meta description (max 155 car)",
  "keywords": ["5-10 mots-clés pertinents"]
}`;

  const content = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.5 });

  return parseJson(content);
}

export async function rewriteText(text, instruction) {
  const content = await chat([
    { role: 'system', content: 'Tu es un rédacteur web expert. Réécris le texte selon l\'instruction. Réponds UNIQUEMENT avec le texte réécrit, sans guillemets ni explication.' },
    { role: 'user', content: `Instruction : ${instruction}\n\nTexte : ${text}` },
  ], { temperature: 0.7 });

  return content.trim();
}

export async function generateAltText(imageDescription) {
  const content = await chat([
    { role: 'system', content: 'Génère un texte alt SEO-optimisé pour une image. Réponds uniquement avec le texte alt (max 125 caractères).' },
    { role: 'user', content: `Image : ${imageDescription}` },
  ], { temperature: 0.3 });

  return content.trim().replace(/^["']|["']$/g, '');
}
