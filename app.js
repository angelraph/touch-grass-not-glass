import * as ollama from './ollama.js';
import { saveRoll, getRoll, listRolls, deleteRoll } from './store.js';

const $ = id => document.getElementById(id);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Used when no model is reachable (e.g. loading a roll on a phone on the trail).
// Easy quests that exist almost anywhere, plus a few that fit the chosen place.
const POCKET_DECK = {
  any: [
    'Find a plant growing somewhere nobody planted it.',
    'Photograph the sky with at least one cloud in it.',
    'Find a leaf with a hole or a bite in it.',
    'Photograph your own shadow on the ground.',
    'Find something green that is smaller than your thumb.',
    'Photograph a bird, or any place a bird might sit.',
    'Find a tree and photograph its bark up close.',
    'Find a flower of any size or colour.',
    'Photograph something the wind is moving.',
    'Find an insect, a spider web, or an ant trail.',
  ],
  // Houses, a road and a few trees: everything here should be findable on an ordinary street.
  'city streets': [
    'Find a weed growing in a crack in the pavement or a wall.',
    'Photograph one of the trees on your street, from the roots up.',
    'Photograph a leaf from a street tree, up close.',
    'Find a plant in a pot, a window, a gate or a balcony.',
    'Photograph the sky above the rooftops.',
    'Photograph your own shadow on the road or a wall.',
    'Find a bird, or a wire, roof or branch where birds sit.',
    'Find something green growing on a wall, a fence or a roof.',
    'Find a flower in a yard or by the side of the road.',
    'Find a fallen leaf lying on the road or the pavement.',
    'Photograph sunlight landing on a wall or the ground.',
    'Find an ant, a fly, a butterfly or any small creature.',
  ],
  'a backyard or garden': ['Find a seed, a pod or a fruit still on its plant.', 'Photograph soil that is wet or freshly dug.', 'Find a leaf bigger than your hand.'],
  'a city park': ['Find the oldest-looking tree in the park.', 'Photograph grass from very close, at ground level.', 'Find a fallen leaf, flower or twig on the path.'],
  'a forest trail': ['Find moss, lichen or a mushroom.', 'Photograph light coming through the leaves.', 'Find a fallen branch or log.'],
  'a beach or riverbank': ['Find water doing something: moving, dripping or reflecting.', 'Photograph a smooth stone or a shell.', 'Find a plant growing right at the water’s edge.'],
};
const pocketQuests = place => place === 'city streets'
  ? shuffle(POCKET_DECK[place]).slice(0, 6)
  : shuffle([...shuffle(POCKET_DECK[place] || []).slice(0, 2), ...shuffle(POCKET_DECK.any).slice(0, 4)]);

const settings = {
  get url() { return localStorage.getItem('ollamaUrl') || 'http://localhost:11434'; },
  set url(v) { localStorage.setItem('ollamaUrl', v); },
  get model() { return localStorage.getItem('model') || 'gemma3:4b'; },
  set model(v) { localStorage.setItem('model', v); },
};

let roll = null;           // the roll currently being loaded, walked or developed
let visibleSince = null;   // when the field screen last became visible
let place = 'a city park';
let modelReady = false;

// ---------- helpers ----------

const QUIET = new Set(['ready', 'field', 'done']);
function show(view) {
  for (const v of ['today', 'ready', 'field', 'done', 'journal', 'settings']) $(v).hidden = v !== view;
  document.body.classList.toggle('quiet', QUIET.has(view));
  document.querySelector('meta[name=theme-color]').content = QUIET.has(view) ? '#0c0d0a' : '#f4efe6';
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === view));
  window.scrollTo(0, 0);
}

const partOfDay = h => h < 5 ? 'night' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night';
const greeting = h => h < 5 ? 'Still up? The stars are outside.' : h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

const walkMs = r => Math.max(0, (r.endedAt || Date.now()) - r.startedAt);
const awayMs = r => Math.max(0, walkMs(r) - r.visibleMs);
const minutes = ms => Math.round(ms / 60000);
const glassFree = r => walkMs(r) ? Math.max(0, 100 - (r.visibleMs / walkMs(r)) * 100) : 100;
const fmtDate = (t, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(t).toLocaleDateString(undefined, opts);
const placeName = p => ({ 'a city park': 'Park', 'a forest trail': 'Trail', 'a backyard or garden': 'Garden', 'city streets': 'Streets', 'a beach or riverbank': 'Water' })[p] || p;

// ---------- TODAY ----------

async function renderToday() {
  $('greeting').textContent = greeting(new Date().getHours());
  const rolls = (await listRolls()).filter(r => r.endedAt && !r.sample);
  const total = rolls.reduce((s, r) => s + awayMs(r), 0);
  $('awayMin').textContent = minutes(total);
  $('awaySub').textContent = rolls.length
    ? `Across ${rolls.length} walk${rolls.length > 1 ? 's' : ''}. That's the only number we keep.`
    : 'Your first walk is waiting.';
  const waiting = rolls.filter(r => !r.developedAt && r.shots.some(s => s.image));
  $('darkroomCard').hidden = !waiting.length;
  if (waiting.length) {
    const frames = waiting.reduce((s, r) => s + r.shots.filter(x => x.image && !x.verdict).length, 0);
    $('darkroomText').textContent = `${waiting.length} roll${waiting.length > 1 ? 's' : ''}, ${frames} frame${frames === 1 ? '' : 's'} waiting to develop.`;
  }
}

async function checkHealth() {
  const pill = $('modelPill'), el = $('ollamaHealth');
  try {
    modelReady = await ollama.health(settings.url, settings.model);
    pill.textContent = modelReady ? settings.model : 'model missing';
    el.textContent = modelReady ? `● ${settings.model} is ready on this machine.` : `Ollama is running. Now run: ollama pull ${settings.model}`;
  } catch {
    modelReady = false;
    pill.textContent = 'pocket mode';
    el.textContent = 'No local AI found. You can still walk; quests come from the pocket deck. Develop later on your computer.';
  }
  pill.classList.toggle('ok', modelReady);
  return modelReady;
}

document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(c => { c.classList.toggle('on', c === chip); c.setAttribute('aria-checked', c === chip); });
  place = chip.dataset.place;
}));

$('loadRoll').onclick = async () => {
  const btn = $('loadRoll'), status = $('loadStatus'), now = new Date();
  btn.disabled = true;
  let quests, author;
  try {
    if (!modelReady) throw new Error('no model');
    status.className = 'status loading';
    status.textContent = `${settings.model} is writing your quests… about 30 seconds on a laptop.`;
    quests = await ollama.writeQuests(settings.url, settings.model, {
      place, month: MONTHS[now.getMonth()], partOfDay: partOfDay(now.getHours()),
    });
    author = settings.model;
  } catch (e) {
    if (e.message !== 'no model') console.warn('Quest model unavailable, using pocket deck', e);
    quests = pocketQuests(place);
    author = 'the pocket deck';
  }
  roll = {
    id: crypto.randomUUID(), place, author, createdAt: Date.now(),
    shots: quests.map(quest => ({ quest })), frame: 0,
    startedAt: null, endedAt: null, visibleMs: 0, developedAt: null,
  };
  await saveRoll(roll);
  btn.disabled = false;
  status.className = 'status';
  status.textContent = '';
  $('readyAuthor').textContent = `Quests written by ${author} for ${placeName(place).toLowerCase()}, ${MONTHS[now.getMonth()]} ${partOfDay(now.getHours())}.`;
  show('ready');
};

$('cancelRoll').onclick = async () => { await deleteRoll(roll.id); roll = null; show('today'); renderToday(); };
$('startWalk').onclick = () => { roll.startedAt = Date.now(); saveRoll(roll); enterField(); };
$('openDarkroom').onclick = () => openJournal();

// ---------- FIELD ----------

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function enterField() {
  show('field');
  visibleSince = Date.now();
  showFrame();
}

async function resumeField(id) {
  roll = await getRoll(id);
  roll.startedAt ??= Date.now();
  enterField();
}

function showFrame() {
  const shot = roll.shots[roll.frame];
  $('frameDots').innerHTML = roll.shots.map((s, i) =>
    `<span class="${i < roll.frame ? 'done' : i === roll.frame ? 'now' : ''}"></span>`).join('');
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

function flash(text) {
  const el = $('saved');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flash.t);
  flash.t = setTimeout(() => el.classList.remove('show'), 1800);
}

async function advance(msg) {
  roll.frame++;
  tallyVisible();
  if (roll.frame >= roll.shots.length) return finishRoll();
  await saveRoll(roll);
  flash(msg);
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
  advance(`Frame ${roll.frame + 1} is on the roll. Phone away.`);
};

$('skip').onclick = () => { roll.shots[roll.frame].skipped = true; advance('Skipped. Next one.'); };
$('endRoll').onclick = () => finishRoll();

async function finishRoll() {
  tallyVisible();
  visibleSince = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  roll.endedAt = Date.now();
  await saveRoll(roll);
  $('doneMin').textContent = Math.max(1, minutes(walkMs(roll)));
  $('doneGlass').textContent = `${glassFree(roll).toFixed(0)}% glass-free`;
  show('done');
}
$('toJournal').onclick = () => openJournal(roll.id);

// ---------- JOURNAL / DARKROOM ----------

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function entryHtml(s, i) {
  const v = s.verdict;
  return `<article class="entry ${v ? '' : 'undeveloped'}" data-i="${i}">
    <img src="${s.image}" alt="${esc(v?.observation || 'Undeveloped frame')}">
    ${v ? `<h3 class="entry-title">${esc(v.title)}</h3>
      <span class="stamp ${v.matches_quest ? '' : 'no'}">${v.matches_quest ? '✓ Found' : 'Not quite'}</span>
      <p class="entry-note">“${esc(v.field_note)}”</p>
      <p class="entry-seen">Seen: ${esc(v.observation)}${v.species_guess && !/^n\/a$/i.test(v.species_guess) ? ` · ${esc(v.species_guess)}` : ''}</p>`
      : `<h3 class="entry-title">Frame ${i + 1}</h3>`}
    <p class="entry-quest">Quest: ${esc(s.quest)}</p>
  </article>`;
}

async function renderJournal(focusId) {
  const rolls = (await listRolls()).filter(r => r.startedAt);
  const walked = rolls.filter(r => r.endedAt && !r.sample);
  $('statRow').innerHTML = walked.length
    ? walked.slice(0, 12).map(r => `<div><b>${Math.max(1, minutes(walkMs(r)))}</b><span>min · ${fmtDate(r.createdAt, { month: 'short', day: 'numeric' })}</span></div>`).join('')
    : '';
  const list = $('rollList');
  if (!rolls.length) {
    list.innerHTML = '<div class="empty"><b>Nothing here yet.</b>Your journal fills up after your first walk.</div>';
    return;
  }
  list.innerHTML = rolls.map(r => {
    const shots = r.shots.map((s, i) => [s, i]).filter(([s]) => s.image);
    const pending = shots.filter(([s]) => !s.verdict).length;
    const meta = r.endedAt
      ? `${Math.max(1, minutes(walkMs(r)))} min outside · ${glassFree(r).toFixed(0)}% glass-free · ${shots.length} frame${shots.length === 1 ? '' : 's'}`
      : 'Walk in progress';
    return `<section class="roll" data-id="${r.id}">
      <div class="roll-head"><span class="roll-date">${fmtDate(r.createdAt)}</span></div>
      <h2 class="roll-place">${esc(placeName(r.place))} roll</h2>
      <p class="roll-meta">${meta}</p>
      ${r.sample ? '<p class="sample-note">A real walk on my street, developed by Gemma 3 on my laptop. Tap Replay to watch the darkroom work, using its real output.</p>' : ''}
      <div class="roll-actions">
        ${!r.endedAt ? '<button class="btn btn-primary" data-act="resume">Resume walk</button>' : ''}
        ${r.sample ? '<button class="btn btn-primary" data-act="replay">Replay development</button>' : ''}
        ${r.endedAt && pending ? `<button class="btn btn-primary" data-act="develop">Develop ${pending} frame${pending === 1 ? '' : 's'}</button><button class="btn btn-ghost" data-act="peek">Show photos</button>` : ''}
        <button class="btn btn-ghost" data-act="export">Export</button>
        <button class="del" data-act="delete" aria-label="Delete roll">Delete</button>
      </div>
      <p class="status" data-status></p>
      ${shots.map(([s, i]) => entryHtml(s, i)).join('')}
    </section>`;
  }).join('');
  if (focusId) list.querySelector(`[data-id="${focusId}"]`)?.scrollIntoView({ block: 'start' });
}

async function openJournal(focusId) {
  show('journal');
  await renderJournal(focusId);
}

$('rollList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const section = btn.closest('.roll');
  const r = await getRoll(section.dataset.id);
  const act = btn.dataset.act;
  if (act === 'resume') { roll = r; resumeField(r.id); }
  if (act === 'export') exportRoll(r);
  if (act === 'delete' && confirm('Delete this roll and its photos?')) { await deleteRoll(r.id); renderJournal(); }
  if (act === 'develop') develop(r, section, btn);
  if (act === 'peek') { const on = section.classList.toggle('peek'); btn.textContent = on ? 'Hide photos' : 'Show photos'; }
  if (act === 'replay') replay(r, section, btn);
});

async function develop(r, section, btn) {
  const status = section.querySelector('[data-status]');
  if (!(await checkHealth())) {
    status.textContent = 'No Gemma on this device yet. Tap Show photos to see them now, or export the roll and develop it on a computer running Ollama (see Docs).';
    return;
  }
  btn.disabled = true;
  const todo = r.shots.map((s, i) => [s, i]).filter(([s]) => s.image && !s.verdict);
  for (const [n, [shot, i]] of todo.entries()) {
    const el = section.querySelector(`.entry[data-i="${i}"]`);
    el?.classList.add('developing');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    status.className = 'status loading';
    status.textContent = `Developing frame ${n + 1} of ${todo.length} with ${settings.model}, on this computer. About 2 minutes each on a CPU.`;
    try {
      shot.verdict = await ollama.develop(settings.url, settings.model, shot.quest, shot.image.split(',')[1]);
      await saveRoll(r);
      if (el) el.outerHTML = entryHtml(shot, i);
    } catch (err) {
      el?.classList.remove('developing');
      status.textContent = `Frame ${i + 1} failed: ${err.message}`;
    }
  }
  if (r.shots.every(s => !s.image || s.verdict)) {
    r.developedAt = Date.now();
    await saveRoll(r);
  }
  status.className = 'status';
  status.textContent = '';
  btn.remove();
}

async function replay(r, section, btn) {
  const status = section.querySelector('[data-status]');
  btn.disabled = true;
  const shots = r.shots.map((s, i) => [s, i]).filter(([s]) => s.image);
  for (const [s, i] of shots) section.querySelector(`.entry[data-i="${i}"]`).outerHTML = entryHtml({ ...s, verdict: null }, i);
  for (const [n, [s, i]] of shots.entries()) {
    const el = section.querySelector(`.entry[data-i="${i}"]`);
    el.classList.add('developing');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    status.className = 'status loading';
    status.textContent = `Replaying frame ${n + 1} of ${shots.length}. On my laptop this took about two minutes; here it's sped up.`;
    await new Promise(res => setTimeout(res, 1900));
    el.outerHTML = entryHtml(s, i);
  }
  status.className = 'status'; status.textContent = '';
  btn.disabled = false;
}

async function openSample() {
  const SAMPLE_ID = 'sample-walk-2026-10-06';
  if (!(await getRoll(SAMPLE_ID))) {
    try { await saveRoll(await (await fetch('assets/samples/walk-roll.json')).json()); }
    catch { alert('Could not load the sample roll. Check your connection and try again.'); return; }
  }
  openJournal(SAMPLE_ID);
}
$('openSample').onclick = openSample;

// first-time guide, shown until dismissed
try { if (!localStorage.getItem('introSeen')) $('intro').hidden = false; } catch {}
$('introOk').onclick = () => { $('intro').hidden = true; try { localStorage.setItem('introSeen', '1'); } catch {} };

function exportRoll(r) {
  const blob = new Blob([JSON.stringify(r)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `roll-${new Date(r.createdAt).toISOString().slice(0, 10)}-${r.id.slice(0, 4)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('importRoll').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = JSON.parse(await file.text());
    if (!r.id || !Array.isArray(r.shots)) throw new Error('not a roll');
    await saveRoll(r);
    openJournal(r.id);
  } catch {
    alert('That file is not a Touch Grass roll.');
  }
};

// ---------- SETTINGS / NAV ----------

$('ollamaUrl').onchange = e => { settings.url = e.target.value.replace(/\/$/, ''); checkHealth(); };
$('model').onchange = e => { settings.model = e.target.value.trim(); checkHealth(); };

document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => {
  const tab = b.dataset.tab;
  if (tab === 'journal') return openJournal();
  show(tab);
  if (tab === 'today') renderToday();
}));

// ---------- BOOT ----------

$('ollamaUrl').value = settings.url;
$('model').value = settings.model;
show('today');
renderToday();
if (location.hash === '#sample') openSample();
addEventListener('hashchange', () => { if (location.hash === '#sample') openSample(); });
checkHealth();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
