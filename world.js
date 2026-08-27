/* ============ NOCHE Y MEDIA — the day engine ============
   Scroll is the hour. The sky, the sun, the moon, and the clock
   all derive from one number: h (6.2 → 25.5, i.e. 06:12 → 01:30). */

(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DAY_START = 6.2, DAY_END = 25.5;

  /* ---------- sky keyframes: [hour, skyTop, skyBottom, ambientInk?, sunAmount] ---------- */
  const SKY = [
    [6.2,  '#D98A7E', '#F3D9B8', true,  0.35],   // primera luz
    [8.5,  '#E8CFAE', '#FAF5DD', true,  0.85],   // morning paper
    [11.0, '#EADFC0', '#FAF5DD', true,  1.0 ],   // midday — the sky is paper
    [15.0, '#E4D2A8', '#F7EDD2', true,  1.0 ],   // afternoon
    [17.75,'#E8A33D', '#E9C28F', true,  0.9 ],   // hora dorada
    [19.63,'#C36560', '#4A4A7E', false, 0.45],   // el eclipse — dusk
    [21.0, '#2A3260', '#1E2749', false, 0.1 ],   // la función
    [24.0, '#161D3E', '#10142A', false, 0.0 ],   // medianoche
    [25.5, '#0C1024', '#090C1E', false, 0.0 ],   // noche y media
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const hexLerp = (c1, c2, t) => {
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = p(c1), [r2,g2,b2] = p(c2);
    return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;
  };

  /* ---------- fixed instruments ---------- */
  const sol = document.getElementById('sol');
  const luna = document.getElementById('luna');
  const relojH = document.getElementById('reloj-h');
  const relojL = document.getElementById('reloj-l');
  const moth = document.getElementById('polilla');
  const zones = [...document.querySelectorAll('.hora')];

  /* build the nym mark rays */
  const nymRays = document.getElementById('nym-rays');
  if (nymRays) for (let i = 0; i < 12; i++) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('points', '60,2 65,26 55,26');
    p.setAttribute('transform', `rotate(${i * 30} 60 60)`);
    nymRays.appendChild(p);
  }

  function fmtHour(h) {
    const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60) % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  /* ---------- hour anchors: each section's top IS its hour ----------
     Content heights vary by viewport, so the hour is interpolated between
     section offsets rather than mapped uniformly to the scrollbar. */
  let MAP = [];
  function buildMap() {
    const max = document.documentElement.scrollHeight - innerHeight;
    MAP = zones.map(z => ({ y: z.offsetTop, h: parseFloat(z.dataset.hour) }));
    MAP.push({ y: Math.max(max, MAP[MAP.length - 1].y + 1), h: DAY_END });
  }
  addEventListener('load', () => { buildMap(); update(); });
  addEventListener('resize', () => { buildMap(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildMap(); update(); });

  /* ---------- the master update: scroll → hour → world ---------- */
  let ticking = false;
  function update() {
    ticking = false;
    if (!MAP.length) buildMap();
    const y = scrollY;
    let k = 0;
    while (k < MAP.length - 2 && y > MAP[k + 1].y) k++;
    const seg = Math.min(1, Math.max(0, (y - MAP[k].y) / Math.max(1, MAP[k + 1].y - MAP[k].y)));
    const h = lerp(MAP[k].h, MAP[k + 1].h, seg);

    /* sky */
    let i = 0;
    while (i < SKY.length - 2 && h > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
    const sky1 = hexLerp(a[1], b[1], t), sky2 = hexLerp(a[2], b[2], t);
    const sun = lerp(a[4], b[4], t);
    root.style.setProperty('--sky1', sky1);
    root.style.setProperty('--sky2', sky2);
    root.style.setProperty('--sun', sun.toFixed(3));
    root.style.setProperty('--lamp', (1 - sun).toFixed(3));
    root.style.setProperty('--sha', (0.16 + 0.16 * sun).toFixed(3));

    /* ambient text: ink while the sky is bright, paper once it darkens */
    const dayInk = sun > 0.55;
    root.style.setProperty('--amb', dayInk ? '#2A1F1B' : '#F3ECD8');
    root.style.setProperty('--amb-dim', dayInk ? 'rgba(42,31,27,.62)' : 'rgba(243,236,216,.65)');
    document.body.classList.toggle('noche', !dayInk);

    /* the clock */
    relojH.textContent = fmtHour(h);
    let label = zones[0].dataset.label;
    for (const z of zones) if (h >= parseFloat(z.dataset.hour) - 0.9) label = z.dataset.label;
    relojL.textContent = label;

    /* ---------- the sun: rises at 6.2, sets by 20.2 ---------- */
    const sunUp = h >= 6 && h <= 20.4;
    if (sunUp) {
      const sp = (h - 6.2) / (20.2 - 6.2);
      let sx = lerp(10, 90, sp);
      let sy = 78 - Math.sin(Math.PI * Math.min(1, Math.max(0, sp))) * 64;
      /* eclipse convergence: the two bodies meet at (56vw, 34vh) */
      const ec = 1 - Math.min(1, Math.abs(h - 19.63) / 0.55);
      if (ec > 0) { sx = lerp(sx, 56, ec); sy = lerp(sy, 34, ec); }
      sol.style.left = sx + 'vw'; sol.style.top = sy + 'vh';
      sol.style.opacity = h > 19.9 ? Math.max(0, 1 - (h - 19.9) / 0.5) : 1;
    } else sol.style.opacity = 0;

    /* ---------- the moon: rises 18.6, climbs to the nym hour ---------- */
    const moonUp = h >= 18.6;
    if (moonUp) {
      const mp = Math.min(1, (h - 18.6) / (25.5 - 18.6));
      let mx = lerp(96, 50, Math.pow(mp, 0.8));
      let my = lerp(80, 18, Math.sin(mp * Math.PI / 2));
      const ec = 1 - Math.min(1, Math.abs(h - 19.63) / 0.55);
      if (ec > 0) { mx = lerp(mx, 56, ec); my = lerp(my, 34, ec); }
      luna.style.left = mx + 'vw'; luna.style.top = my + 'vh';
      luna.style.opacity = Math.min(1, (h - 18.6) / 0.6);
    } else luna.style.opacity = 0;
    root.classList.toggle('eclipse', Math.abs(h - 19.63) < 0.5);

    /* moth: awake after 21h, orbits near the moon */
    if (!reduced && h > 21) {
      const mt = performance.now() / 1000;
      const lx = parseFloat(luna.style.left) || 50, ly = parseFloat(luna.style.top) || 20;
      moth.style.left = `calc(${lx}vw + ${Math.cos(mt * 1.1) * 90 + Math.sin(mt * 3.7) * 12}px)`;
      moth.style.top = `calc(${ly}vh + ${60 + Math.sin(mt * 1.5) * 40}px)`;
      moth.style.transform = `rotate(${Math.sin(mt * 5) * 22}deg)`;
      moth.style.opacity = Math.min(0.9, (h - 21) / 0.8);
    } else moth.style.opacity = 0;
  }
  addEventListener('scroll', () => {
    if (document.hidden) { update(); return; }   // rAF sleeps in hidden tabs
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('visibilitychange', update);
  addEventListener('resize', update);

  /* keep the moth breathing even without scroll */
  if (!reduced) setInterval(() => { if (parseFloat(moth.style.opacity) > 0) update(); }, 120);

  /* ---------- la otra mitad: hold the seal (or M) ---------- */
  const sello = document.getElementById('sello');
  let holdTimer = null, held = false;
  sello.addEventListener('pointerdown', e => {
    holdTimer = setTimeout(() => { held = true; root.classList.add('lens'); }, 250);
    sello.setPointerCapture(e.pointerId);
  });
  const release = () => {
    clearTimeout(holdTimer);
    if (held) { held = false; root.classList.remove('lens'); }
    else root.classList.toggle('lens');   // quick tap toggles, hold is momentary
  };
  sello.addEventListener('pointerup', release);
  sello.addEventListener('pointercancel', () => {
    clearTimeout(holdTimer);
    if (held) { held = false; root.classList.remove('lens'); }
  });
  addEventListener('keydown', e => { if (e.key === 'm') root.classList.toggle('lens'); });

  /* ---------- reveals ---------- */
  if (!reduced) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.18 });
    document.querySelectorAll('.p, .recibo, .monitor').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.p, .recibo, .monitor').forEach(el => el.classList.add('in'));
  }

  /* ---------- la función: the reel plays in the dark ---------- */
  const monScreen = document.querySelector('.mon-screen');
  const playBtn = document.getElementById('play-reel');
  const offBtn = document.getElementById('off-reel');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (monScreen.querySelector('iframe')) return;
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube.com/embed/saYu8WDDYMY?autoplay=1&rel=0&modestbranding=1';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.title = 'Reel 2026';
      monScreen.appendChild(f);
      playBtn.hidden = true; offBtn.hidden = false;
    });
    offBtn.addEventListener('click', () => {
      const f = monScreen.querySelector('iframe');
      if (f) f.remove();
      playBtn.hidden = false; offBtn.hidden = true;
    });
  }

  update();
})();
