// Thin client for a local Ollama server running an open-weight model (default: Gemma 3).

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

const QUESTS_SCHEMA = {
  type: 'object',
  properties: { quests: { type: 'array', items: { type: 'string' }, minItems: 6, maxItems: 6 } },
  required: ['quests'],
};

export async function writeQuests(base, model, { place, month, partOfDay }) {
  const prompt = `You write field quests for a phone camera that only works outdoors.
It is ${month}, in the ${partOfDay}. The walker is heading to ${place}.
Write exactly 6 quests. Each quest:
- is one sentence, at most 14 words, second person, present tense
- asks them to FIND and PHOTOGRAPH one specific real thing that exists in ${place} in ${month}
- rewards slow looking: textures, small living things, signs of the season, light, sounds made visible
- is achievable in under 10 minutes of walking, safe, and leaves nature undisturbed
Vary them: at least one plant, one animal or animal sign, one about light or sky, one about the season.`;
  const { quests } = await chat(base, model, [{ role: 'user', content: prompt }], QUESTS_SCHEMA, 400);
  return quests.slice(0, 6).map(q => q.trim());
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    observation: { type: 'string' },
    matches_quest: { type: 'boolean' },
    confidence: { type: 'number' },
    title: { type: 'string' },
    field_note: { type: 'string' },
    species_guess: { type: 'string' },
  },
  required: ['observation', 'matches_quest', 'confidence', 'title', 'field_note', 'species_guess'],
};

// The image is base64 JPEG without the data: prefix. Observation comes first so the
// verdict is grounded in what the model actually saw.
export async function develop(base, model, quest, imageB64) {
  const prompt = `You are a kind, observant naturalist developing a walker's film photo.
Their quest was: "${quest}"
1. observation: describe plainly what is in the photo (1 sentence).
2. matches_quest: true only if the observation reasonably satisfies the quest. Be generous with effort, honest about mismatches.
3. confidence: 0 to 1.
4. title: a 2-5 word specimen label, like a museum card.
5. field_note: 2 sentences in a warm field-journal voice, noting one detail worth looking for next time.
6. species_guess: likely species or "n/a". Say "uncertain" rather than invent.`;
  return chat(base, model, [{ role: 'user', content: prompt, images: [imageB64] }], VERDICT_SCHEMA, 260);
}
