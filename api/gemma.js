// The online darkroom: the same Gemma 3 prompts the local app sends to Ollama,
// sent to Gemma 3 hosted by Google (Gemini API). The API key stays on the server.
// Photos are passed straight through for developing and never stored here.
import { questPrompt, developPrompt } from '../prompts.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = (process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it,gemma-4-31b-it,gemma-3-4b-it').split(',');
const MAX_IMAGE = 1_500_000; // base64 chars, about 1.1 MB: the app sends 768px JPEGs
const WINDOW_MS = 10 * 60 * 1000, PER_WINDOW = 30;
const hits = new Map(); // best-effort per-IP limit (per warm instance)

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > PER_WINDOW;
}

function firstJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

async function gemma(parts, maxTokens) {
  let last;
  for (const model of MODELS) {
    const call = config => fetch(`${API}/${model.trim()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMMA_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: config }),
    });
    // Ask for JSON only; Gemma 4 thinks before it answers, so leave room for that.
    let res = await call({ temperature: 0.8, maxOutputTokens: maxTokens + 3000, responseMimeType: 'application/json' });
    if (res.status === 400) res = await call({ temperature: 0.8, maxOutputTokens: maxTokens + 3000 });
    if (res.status === 429) { const e = new Error('busy'); e.status = 429; throw e; }
    if (res.status === 404) { last = new Error(`${model} not available`); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemma answered ${res.status}`);
    // Skip the model's thinking parts; the answer is in the remaining text.
    const answer = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    try {
      return { json: firstJson(answer), model: model.trim() };
    } catch {
      const c = data.candidates?.[0] || {};
      throw new Error(`unreadable reply (${c.finishReason || 'no candidate'}, ${(c.content?.parts || []).length} parts, usage ${JSON.stringify(data.usageMetadata || {})}): ${answer.slice(-200)}`);
    }
  }
  throw last || new Error('no Gemma model available');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = Boolean(process.env.GEMMA_API_KEY);
  if (req.method === 'GET' && configured && /[?&]list=1/.test(req.url || '')) {
    // Which Gemma models this key can reach (names only).
    const r = await fetch(`${API}?pageSize=1000`, { headers: { 'x-goog-api-key': process.env.GEMMA_API_KEY } });
    const data = await r.json();
    const models = (data.models || []).map(m => ({ name: m.name.replace('models/', ''), methods: m.supportedGenerationMethods }))
      .filter(m => /gemma/i.test(m.name));
    return res.status(200).json({ models, error: data.error?.message });
  }
  if (req.method === 'GET') return res.status(200).json({ configured, model: MODELS[0] });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!configured) return res.status(503).json({ error: 'The online darkroom is not set up yet.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'busy' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  try {
    if (body.task === 'quests') {
      const ctx = { place: String(body.place || 'a city park').slice(0, 60), month: String(body.month || '').slice(0, 20), partOfDay: String(body.partOfDay || '').slice(0, 20) };
      const prompt = `${questPrompt(ctx)}\nReply with only a JSON object: {"quests": ["...", "...", "...", "...", "...", "..."]}`;
      const { json, model } = await gemma([{ text: prompt }], 500);
      const quests = (json.quests || []).filter(q => typeof q === 'string' && q.trim()).slice(0, 6);
      if (quests.length < 6) throw new Error('Gemma returned too few quests');
      return res.status(200).json({ quests, model });
    }
    if (body.task === 'develop') {
      const image = String(body.image || '');
      if (!image || image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=]+$/.test(image)) return res.status(400).json({ error: 'bad image' });
      const quest = String(body.quest || '').slice(0, 300);
      const prompt = `${developPrompt(quest)}\nReply with only a JSON object with the keys observation, matches_quest, confidence, title, field_note, species_guess, in that order.`;
      const { json: v, model } = await gemma([{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: image } }], 400);
      return res.status(200).json({
        observation: String(v.observation || ''),
        matches_quest: v.matches_quest === true || v.matches_quest === 'true',
        confidence: Math.max(0, Math.min(1, Number(v.confidence) || 0)),
        title: String(v.title || 'Untitled frame'),
        field_note: String(v.field_note || ''),
        species_guess: String(v.species_guess || 'n/a'),
        model,
      });
    }
    return res.status(400).json({ error: 'unknown task' });
  } catch (e) {
    if (e.status === 429) return res.status(429).json({ error: 'busy' });
    return res.status(502).json({ error: e.message });
  }
}
