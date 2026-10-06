// Landing page: nav state, reveal-on-scroll, and the real sample roll developed by Gemma.

const nav = document.querySelector('.nav');
const onScroll = () => nav?.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -8% 0px' })
  : null;
function reveal(el) { if (!io) return; el.classList.add('reveal'); io.observe(el); }
document.querySelectorAll('.section-head, .stage, .principle-grid > div, .open-grid > div, .faq-list, .final-cta').forEach(reveal);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function sampleRoll() {
  const box = document.getElementById('sampleRoll');
  if (!box) return;
  try {
    const { model, frames } = await (await fetch('assets/samples/notes.json')).json();
    box.innerHTML = frames.map(f => `
      <article class="specimen-card">
        <img src="assets/samples/${esc(f.id)}.jpg" alt="${esc(f.observation)}" loading="lazy">
        <p class="quest">Quest: ${esc(f.quest)}</p>
        <span class="stamp ${f.matches_quest ? '' : 'no'}">${f.matches_quest ? 'Found' : 'Not quite'}</span>
        <h3>${esc(f.title)}</h3>
        <p class="note">${esc(f.field_note)}</p>
        <p class="meta">Gemma saw: ${esc(f.observation)}${f.species_guess && !/^n\/a$/i.test(f.species_guess) ? ` · species: ${esc(f.species_guess)}` : ''} · ${esc(model)}, ${f.seconds}s on CPU</p>
      </article>`).join('');
    box.querySelectorAll('.specimen-card').forEach(reveal);
    const first = frames[0], cap = document.getElementById('heroCap');
    if (cap && first) {
      cap.querySelector('b').textContent = first.title;
      const st = cap.querySelector('.stamp');
      st.textContent = first.matches_quest ? 'Found' : 'Not quite';
      st.classList.toggle('no', !first.matches_quest);
    }
  } catch {
    box.innerHTML = '<p class="muted">The sample roll is still in the darkroom.</p>';
  }
}
sampleRoll();
