// Two darkrooms, same open model (Gemma 3), same prompts:
// local  = Ollama on your own computer (private, the default when it's there)
// online = Gemma 4 hosted by Google, reached through this site's api/gemma function
import { QUESTS_SCHEMA, VERDICT_SCHEMA, questPrompt, developPrompt } from './prompts.js';

// ---------- local (Ollama) ----------

export async function health(base, model) {
  const res = await fetch(`${base}/api/tags`);
  if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
  const { models = [] } = await res.json();
  return models.some(m => m.name === model || m.model === model);
}

async function chat(base, model, messages, schema, numPredict) {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages, stream: false, format: schema,
      options: { temperature: 0.8, num_predict: numPredict },
    }),
  });
  if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
  const { message } = await res.json();
  return JSON.parse(message.content);
}

export async function writeQuests(base, model, ctx) {
  const { quests } = await chat(base, model, [{ role: 'user', content: questPrompt(ctx) }], QUESTS_SCHEMA, 400);
  return quests.slice(0, 6).map(q => q.trim());
}

// The image is base64 JPEG without the data: prefix.
export async function develop(base, model, quest, imageB64) {
  return chat(base, model, [{ role: 'user', content: developPrompt(quest), images: [imageB64] }], VERDICT_SCHEMA, 260);
}

// ---------- online darkroom ----------

export class Busy extends Error {}

async function online(body) {
  const res = await fetch('api/gemma', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429 || data.error === 'busy') throw new Busy('The online darkroom is busy. Try again in a minute.');
  if (!res.ok) throw new Error(data.error || `Online darkroom answered ${res.status}`);
  return data;
}

export async function onlineHealth() {
  const res = await fetch('api/gemma', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.configured ? data : null;
}

export async function writeQuestsOnline(ctx) {
  const { quests } = await online({ task: 'quests', ...ctx });
  return quests.slice(0, 6).map(q => q.trim());
}

export async function developOnline(quest, imageB64) {
  return online({ task: 'develop', quest, image: imageB64 });
}
