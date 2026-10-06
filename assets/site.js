// Landing page motion: a meadow that sways, a phone that dims as you scroll,
// a page that goes to night for "Outside", and photos that develop like film.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nav = document.querySelector('.nav');
const phone = document.getElementById('heroPhone');

// ---------- the meadow ----------
const GREENS = ['#4a5d3a', '#5d7247', '#6f8456', '#3d4f30', '#7d9160'];
function drawMeadow(svg, count) {
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < count; i++) {
    const x = (i / count) * 1440 + Math.random() * 12;
    const h = 55 + Math.random() * 62;
    const w = 5 + Math.random() * 7;
    const bend = (Math.random() - .5) * 34;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M${x - w / 2} 120 Q${x + bend * .4} ${120 - h * .55} ${x + bend} ${120 - h} Q${x + bend * .3} ${120 - h * .5} ${x + w / 2} 120 Z`);
    p.setAttribute('fill', GREENS[i % GREENS.length]);
    p.setAttribute('opacity', (.7 + Math.random() * .3).toFixed(2));
    p.style.setProperty('--t', `${4 + Math.random() * 3}s`);
    p.style.setProperty('--delay', `${-Math.random() * 6}s`);
    svg.append(p);
  }
}
document.querySelectorAll('.meadow').forEach(svg => drawMeadow(svg, innerWidth < 600 ? 110 : 280));

// grass leans away from the pointer
if (!reduced) {
  const hero = document.querySelector('.hero');
  hero?.addEventListener('pointermove', e => {
    const lean = ((e.clientX / innerWidth) - .5) * -10;
    hero.querySelector('.meadow')?.style.setProperty('--lean', `${lean.toFixed(1)}deg`);
  });
}

// ---------- scroll: nav border + the phone screen dims ----------
function onScroll() {
  nav?.classList.toggle('scrolled', scrollY > 8);
  if (phone) phone.style.setProperty('--dim', Math.min(1, scrollY / (innerHeight * .7)).toFixed(3));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- the page goes to night for "Outside" ----------
const chapters = [...document.querySelectorAll('.chapter')];
if (chapters.length) {
  const moodIO = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) document.body.dataset.mood = e.target.dataset.mood;
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach(c => moodIO.observe(c));
  // back to day once past the story
  const after = document.getElementById('journal');
  if (after) new IntersectionObserver(([e]) => { if (e.isIntersecting) document.body.dataset.mood = 'day'; }, { rootMargin: '-40% 0px -55% 0px' }).observe(after);
  const hero = document.querySelector('.hero');
  if (hero) new IntersectionObserver(([e]) => { if (e.isIntersecting) document.body.dataset.mood = 'day'; }, { rootMargin: '-40% 0px -55% 0px' }).observe(hero);
}

// ---------- reveal on scroll ----------
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -12% 0px' });
const watch = el => { if (!el.classList.contains('chapter') && !el.classList.contains('specimen-card')) el.classList.add('reveal'); io.observe(el); };
document.querySelectorAll('.chapter, .section-head, .film-frame, .why-list li, .faq-list, .honest, .final-cta h2').forEach(watch);

// ---------- sample roll: three real Gemma frames ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
async function sampleRoll() {
  const box = document.getElementById('sampleRoll');
  if (!box) return;
  try {
    const { model, frames } = await (await fetch('assets/samples/notes.json')).json();
    const pick = ['1-maple', '4-slug', '6-sky'].map(id => frames.find(f => f.id === id)).filter(Boolean);
    box.innerHTML = pick.map(f => `
      <article class="specimen-card">
        <div class="img"><img src="assets/samples/${esc(f.id)}.jpg" alt="${esc(f.observation)}" loading="lazy"></div>
        <span class="stamp ${f.matches_quest ? '' : 'no'}">${f.matches_quest ? '✓ Found' : 'Not quite'}</span>
        <h3>${esc(f.title)}</h3>
        <p class="note">“${esc(f.field_note.split(/(?<=\.)\s/)[0])}”</p>
        <p class="meta">Quest: ${esc(f.quest)}<br>Gemma saw: ${esc(f.observation)} · ${esc(model)}, ${f.seconds}s on CPU</p>
      </article>`).join('');
    box.querySelectorAll('.specimen-card').forEach((c, i) => { c.querySelector('img').style.transitionDelay = `${i * .35}s`; io.observe(c); });
  } catch {
    box.innerHTML = '<p class="muted">The sample roll is still in the darkroom.</p>';
  }
}
sampleRoll();
