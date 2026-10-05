import * as ollama from './ollama.js';
import { saveRoll, getRoll, listRolls, deleteRoll } from './store.js';

const $ = id => document.getElementById(id);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Used when no model is reachable (e.g. loading a roll on a phone on the trail).
const POCKET_DECK = [
  'Find a leaf that something has already taken a bite out of.',
  'Photograph the oldest-looking bark you can find.',
  'Find a place where light comes through something green.',
  'Find a sign that an animal passed here today.',
  'Photograph a seed, cone, nut, or berry still on its plant.',
  'Find something growing where nobody planted it.',
  'Photograph the sky through a gap in branches.',
  'Find a color in nature you could not name.',
  'Find a spider web, a nest, or any home that is not human.',
  'Photograph moss, lichen, or something softer than it looks.',
  'Find water doing something: dripping, pooling, reflecting.',
  'Find the smallest flower you can.',
];

const settings = {
  get url() { return localStorage.getItem('ollamaUrl') || 'http://localhost:11434'; },
  set url(v) { localStorage.setItem('ollamaUrl', v); },
  get model() { return localStorage.getItem('model') || 'gemma3:4b'; },
  set model(v) { localStorage.setItem('model', v); },
};

let roll = null;           // the roll currently in the field or on the journal page
let visibleSince = null;   // timestamp when the field screen last became visible

function show(view) {
  for (const v of ['home', 'field', 'journal']) $(v).hidden = v !== view;
  document.body.classList.toggle('in-field', view === 'field');
  window.scrollTo(0, 0);
}

function partOfDay(h) {
  return h < 6 ? 'night' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night';
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function fmtMin(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

// ---------- HOME ----------

async function renderRolls() {
  const rolls = await listRolls();
  const ul = $('rolls');
  ul.innerHTML = rolls.length ? '' : '<li class="muted small">No rolls yet. Go outside first.</li>';
  for (const r of rolls) {
    const shot = r.shots.filter(s => s.image).length;
    const state = !r.endedAt ? 'in camera' : r.developedAt ? 'developed' : 'undeveloped';
    const li = document.createElement('li');
    li.innerHTML = `<span>${new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${r.place}<br><span class="tag">${shot} frames · ${state}</span></span>`;
    const open = document.createElement('button');
    open.textContent = r.endedAt ? 'open' : 'resume';
    open.onclick = () => (r.endedAt ? openJournal(r.id) : resumeField(r.id));
    const del = document.createElement('button');
    del.textContent = '×';
    del.className = 'ghost';
    del.title = 'Delete roll';
    del.onclick = async () => { if (confirm('Delete this roll and its photos?')) { await deleteRoll(r.id); renderRolls(); } };
    const actions = document.createElement('span');
    actions.append(open, ' ', del);
    li.append(actions);
    ul.append(li);
  }
}

async function checkHealth() {
  const el = $('ollamaHealth');
  try {
    const ok = await ollama.health(settings.url, settings.model);
    el.textContent = ok ? `● ${settings.model} ready on this machine` : `○ Ollama is up, but run: ollama pull ${settings.model}`;
    return ok;
  } catch {
    el.textContent = '○ No local model reachable. Field mode still works; develop later at home.';
    return false;
  }
}

$('loadRoll').onclick = async () => {
  const btn = $('loadRoll'), status = $('loadStatus');
  const place = $('place').value, now = new Date();
  btn.disabled = true;
  let quests, author;
  try {
    status.textContent = `Gemma is writing your roll for ${place}… (on a laptop CPU this takes ~30s)`;
    quests = await ollama.writeQuests(settings.url, settings.model, {
      place, month: MONTHS[now.getMonth()], partOfDay: partOfDay(now.getHours()),
    });
    author = settings.model;
  } catch (e) {
    console.warn('Quest model unavailable, using pocket deck', e);
    quests = shuffle(POCKET_DECK).slice(0, 6);
    author = 'pocket deck';
  }
  roll = {
    id: crypto.randomUUID(), place, author, createdAt: Date.now(),
    shots: quests.map(quest => ({ quest })), frame: 0,
    startedAt: Date.now(), endedAt: null, visibleMs: 0, developedAt: null,
  };
  await saveRoll(roll);
  btn.disabled = false;
  status.textContent = '';
  enterField();
};

$('importRoll').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const r = JSON.parse(await file.text());
    if (!r.id || !Array.isArray(r.shots)) throw new Error('not a roll');
    await saveRoll(r);
    openJournal(r.id);
  } catch {
    alert('That file is not a Touch Grass roll.');
  }
  e.target.value = '';
};

$('ollamaUrl').onchange = e => { settings.url = e.target.value.replace(/\/$/, ''); checkHealth(); };
$('model').onchange = e => { settings.model = e.target.value.trim(); checkHealth(); };

// ---------- FIELD ----------

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  speechSynthesis.speak(u);
}

function enterField() {
  show('field');
  visibleSince = Date.now();
  showFrame();
}

async function resumeField(id) {
  roll = await getRoll(id);
  enterField();
}

function showFrame() {
  const shot = roll.shots[roll.frame];
  $('frameNo').textContent = roll.frame + 1;
  $('frameTotal').textContent = roll.shots.length;
  $('questText').textContent = shot.quest;
  speak(shot.quest);
}

function tallyVisible() {
  if (visibleSince) roll.visibleMs += Date.now() - visibleSince;
  visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
}

document.addEventListener('visibilitychange', () => {
  if (!roll || $('field').hidden) return;
  tallyVisible();
  saveRoll(roll);
});

// Shrink to 768px so the roll stays small and the vision model has less to chew on.
function toJpeg(file, max = 768) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function advance() {
  roll.frame++;
  tallyVisible();
  if (roll.frame >= roll.shots.length) return finishRoll();
  await saveRoll(roll);
  showFrame();
}

$('shutter').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const shot = roll.shots[roll.frame];
  shot.image = await toJpeg(file);
  shot.takenAt = Date.now();
  if (navigator.vibrate) navigator.vibrate(40);
  advance();
};

$('skip').onclick = () => { roll.shots[roll.frame].skipped = true; advance(); };
$('endRoll').onclick = () => finishRoll();

async function finishRoll() {
  tallyVisible();
  visibleSince = null;
  speechSynthesis?.cancel();
  roll.endedAt = Date.now();
  await saveRoll(roll);
  openJournal(roll.id);
}

// ---------- DARKROOM / JOURNAL ----------

function glassLine(r) {
  const walk = (r.endedAt || Date.now()) - r.startedAt;
  const pct = walk ? Math.max(0, 100 - (r.visibleMs / walk) * 100) : 100;
  return `walk ${fmtMin(walk)} · screen ${fmtMin(r.visibleMs)} · ${pct.toFixed(0)}% glass-free`;
}

function renderSpecimens() {
  const ol = $('specimens');
  ol.innerHTML = '';
  roll.shots.forEach((s, i) => {
    if (!s.image) return;
    const li = document.createElement('li');
    li.className = 'specimen' + (s.verdict ? '' : ' undeveloped');
    li.dataset.i = i;
    const v = s.verdict;
    li.innerHTML = `
      <img alt="">
      <h3></h3>
      <p class="muted small quest-line"></p>
      ${v ? `<span class="stamp ${v.matches_quest ? 'yes' : 'no'}">${v.matches_quest ? 'found' : 'not quite'}</span>` : ''}
      <p class="note"></p>
      <p class="guess"></p>`;
    li.querySelector('img').src = s.image;
    li.querySelector('h3').textContent = v ? v.title : `Frame ${i + 1}`;
    li.querySelector('.quest-line').textContent = `Quest: ${s.quest}`;
    if (v) {
      li.querySelector('.note').textContent = v.field_note;
      li.querySelector('.guess').textContent =
        `${v.observation}${v.species_guess && v.species_guess !== 'n/a' ? ` · species: ${v.species_guess}` : ''}`;
    }
    ol.append(li);
  });
  if (!ol.children.length) ol.innerHTML = '<li class="muted">No frames on this roll.</li>';
}

async function openJournal(id) {
  roll = await getRoll(id);
  show('journal');
  const d = new Date(roll.createdAt);
  $('rollMeta').textContent = `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${roll.place} · quests by ${roll.author}`;
  $('rollTitle').textContent = roll.developedAt ? 'Field journal' : 'Undeveloped roll';
  $('glassStat').textContent = glassLine(roll);
  $('develop').hidden = !!roll.developedAt;
  $('devStatus').textContent = '';
  renderSpecimens();
}

$('develop').onclick = async () => {
  const btn = $('develop'), status = $('devStatus');
  if (!(await checkHealth())) {
    status.textContent = `No model reachable at ${settings.url}. Develop this roll on the machine running Ollama (Export → Import).`;
    return;
  }
  btn.disabled = true;
  const todo = roll.shots.map((s, i) => [s, i]).filter(([s]) => s.image && !s.verdict);
  for (const [n, [shot, i]] of todo.entries()) {
    const li = document.querySelector(`.specimen[data-i="${i}"]`);
    li?.classList.add('developing');
    li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    status.textContent = `Developing frame ${n + 1} of ${todo.length} with ${settings.model}, locally. On a laptop CPU that's a couple of minutes a frame: put the kettle on.`;
    try {
      shot.verdict = await ollama.develop(settings.url, settings.model, shot.quest, shot.image.split(',')[1]);
      await saveRoll(roll);
    } catch (e) {
      status.textContent = `Frame ${i + 1} failed: ${e.message}`;
    }
    renderSpecimens();
  }
  if (roll.shots.every(s => !s.image || s.verdict)) {
    roll.developedAt = Date.now();
    await saveRoll(roll);
  }
  btn.disabled = false;
  openJournal(roll.id);
};

$('exportRoll').onclick = () => {
  const blob = new Blob([JSON.stringify(roll)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `roll-${new Date(roll.createdAt).toISOString().slice(0, 10)}-${roll.id.slice(0, 4)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('back').onclick = () => { show('home'); renderRolls(); };

// ---------- BOOT ----------

$('ollamaUrl').value = settings.url;
$('model').value = settings.model;
renderRolls();
checkHealth();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
