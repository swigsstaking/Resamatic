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
  const jsonStr = match ? match[1] : text;
  return JSON.parse(jsonStr.trim());
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

  const sysPrompt = `Tu es un rédacteur web SEO expert pour entreprises locales françaises. Contenu RICHE et DÉTAILLÉ. Réponds UNIQUEMENT en JSON valide.`;

  const bizContext = `Entreprise: ${name} | Activité: ${biz.activity || ''} | Ville: ${city} | Adresse: ${biz.address || ''} ${biz.zip || ''} ${city} | Mot-clé: ${keyword} | Service: ${serviceFocus || keyword} | Tél: ${phone} | Services: ${biz.services || ''} | Points forts: ${biz.uniqueSellingPoints || ''} | Description: ${biz.description || ''} | Avis Google: ${biz.googleReviewCount || '?'}+ (${biz.googleReviewRating || '5'}/5)`;

  // Call 1: Main content sections (hero, textHighlight, description, whyUs, ctaBanner, seo)
  const prompt1 = `${bizContext}

Génère du contenu RICHE. Le H1 ne doit PAS répéter la ville si elle est déjà dans le mot-clé. JSON:
{"hero":{"headline":"H1 max 70 car","subheadline":"sous-titre 150 car","ctaText":"${cta}","ctaUrl":"${ctaUrl}","bulletPoints":[{"value":"point 1"},{"value":"point 2"},{"value":"point 3"},{"value":"point 4"},{"value":"point 5"},{"value":"point 6"}]},"textHighlight":{"text":"2-3 phrases avec <strong>mots-clés</strong> en gras"},"description":{"title":"Question engageante avec mot-clé ?","body":"<p>3-4 phrases service principal avec <strong>gras</strong></p><p>2-3 phrases qualifications</p><p>2-3 phrases cadre accueil</p><p><em>conclusion</em></p>","bulletPoints":[{"value":"avantage 1"},{"value":"avantage 2"},{"value":"avantage 3"},{"value":"avantage 4"}],"ctaText":"${cta}","ctaUrl":"${ctaUrl}"},"whyUs":{"title":"Pourquoi choisir ${name}${city ? ' à '+city : ''} ?","subtitle":"une phrase expertise","body":"<p>4-5 phrases expertise techniques formations</p><p>prestations adaptées</p><p><strong>protocole précis:</strong></p>","reasons":[{"title":"raison 1","text":"détail"},{"title":"raison 2","text":"détail"},{"title":"raison 3","text":"détail"},{"title":"raison 4","text":"détail"},{"title":"raison 5","text":"détail"}],"ctaText":"${cta}","ctaUrl":"${ctaUrl}"},"ctaBanner":{"text":"accroche forte","ctaText":"Contactez-nous","ctaUrl":"${ctaUrl}","bannerStyle":"dark"},"seo":{"title":"max 60 car SEO","description":"max 150 car STRICT, pas plus","keywords":["5 mots-clés"]}}`;

  // Call 2: Secondary sections (googleReviews, servicesGrid, guarantee, testimonials, faq, team, map)
  const prompt2 = `${bizContext}

Génère du contenu RICHE pour les sections secondaires. JSON:
{"googleReviews":{"title":"titre avis + ville","testimonials":[{"text":"avis 2-3 phrases réaliste","author":"Prénom P.","location":"${city}"},{"text":"avis 2-3 phrases","author":"Prénom M.","location":"Lambersart"},{"text":"avis 2-3 phrases","author":"Prénom D.","location":"Marcq-en-Baroeul"}],"ctaText":"Voir nos avis"},"servicesGrid":{"title":"Nos services${city ? ' à '+city : ''}","subtitle":"2-3 phrases présentation services","services":[{"name":"service 1","description":"description","linkText":"service 1","linkUrl":"#"},{"name":"service 2","description":"desc","linkText":"service 2","linkUrl":"#"},{"name":"service 3","description":"desc","linkText":"service 3","linkUrl":"#"},{"name":"service 4","description":"desc","linkText":"service 4","linkUrl":"#"}]},"guarantee":{"title":"Garantie de satisfaction","text":"3-4 paragraphes engagement qualité certifications satisfaction avis"},"testimonials":{"items":[{"name":"Prénom L.","location":"${city}","rating":5,"text":"avis 3-4 phrases"},{"name":"Prénom M.","location":"ville proche","rating":5,"text":"avis 3-4 phrases"},{"name":"Prénom D.","location":"ville proche","rating":5,"text":"avis 3-4 phrases"}]},"faq":{"items":[{"question":"question 1 mot-clé ville","answer":"réponse 3-5 phrases"},{"question":"question 2","answer":"réponse détaillée"},{"question":"question 3","answer":"réponse détaillée"},{"question":"question 4","answer":"réponse détaillée"},{"question":"question 5","answer":"réponse détaillée"}]},"team":{"title":"équipe experte ${keyword}${city ? ' à '+city : ''}","body":"<p>2-3 phrases équipe</p>","members":[{"name":"point fort 1"},{"name":"point fort 2"},{"name":"point fort 3"},{"name":"point fort 4"},{"name":"point fort 5"}]},"map":{"title":"${city ? 'Présent à '+city+' et environs' : 'Nous trouver'}","body":"2-3 paragraphes localisation accessibilité zones desservies communes proches","hours":"${biz.hours || 'Du lundi au samedi de 10h à 18h'}"}}`;

  // Run both calls in parallel
  const [result1, result2] = await Promise.all([
    chat([{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt1 }], { temperature: 0.7, maxTokens: 4096, timeout: 180000 }),
    chat([{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt2 }], { temperature: 0.7, maxTokens: 4096, timeout: 180000 }),
  ]);

  const part1 = parseJson(result1);
  const part2 = parseJson(result2);

  return { ...part1, ...part2 };
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
