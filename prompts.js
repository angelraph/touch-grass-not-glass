// The two Gemma prompts, shared by the local darkroom (Ollama) and the online darkroom (api/gemma.js),
// so both run exactly the same instructions.

export const QUESTS_SCHEMA = {
  type: 'object',
  properties: { quests: { type: 'array', items: { type: 'string' }, minItems: 6, maxItems: 6 } },
  required: ['quests'],
};

export function questPrompt({ place, month, partOfDay }) {
  return `You write field quests for a phone camera that only works outdoors.
It is ${month}, in the ${partOfDay}. The walker is heading to ${place}.
Write exactly 6 quests. Each quest:
- is one sentence, at most 14 words, second person, present tense
- asks them to FIND and PHOTOGRAPH one specific real thing that exists in ${place} in ${month}
- rewards slow looking: textures, small living things, signs of the season, light, sounds made visible
- is achievable in under 10 minutes of walking, safe, and leaves nature undisturbed
Vary them: at least one plant, one animal or animal sign, one about light or sky, one about the season.`;
}

export const VERDICT_SCHEMA = {
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

// Observation comes first so the verdict is grounded in what the model actually saw.
export function developPrompt(quest) {
  return `You are a kind, observant naturalist developing a walker's film photo.
Their quest was: "${quest}"
1. observation: describe plainly what is in the photo (1 sentence).
2. matches_quest: true only if the observation reasonably satisfies the quest. Be generous with effort, honest about mismatches.
3. confidence: 0 to 1.
4. title: a 2-5 word specimen label, like a museum card.
5. field_note: 2 sentences in a warm field-journal voice, noting one detail worth looking for next time.
6. species_guess: likely species or "n/a". Say "uncertain" rather than invent.`;
}
