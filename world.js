/* ============ NOCHE Y MEDIA — the day engine ============
   Scroll is the hour. Sky, light, clock, sun, and moon all derive
   from one number: h (06:12 → 01:30). English by default; the seal
   switches the whole site to Spanish — one language at a time. */

(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DAY_START = 6.2, DAY_END = 25.5;

  /* ---------- sky keyframes: [hour, skyTop, skyBottom, sunAmount] ---------- */
  const SKY = [
    [6.2,  '#D98A7E', '#F3D9B8', 0.35],
    [8.5,  '#E8CFAE', '#FAF5DD', 0.85],
    [11.0, '#EADFC0', '#FAF5DD', 1.0 ],
    [15.0, '#E4D2A8', '#F7EDD2', 1.0 ],
    [17.75,'#E8A33D', '#E9C28F', 0.9 ],
    [19.63,'#C36560', '#4A4A7E', 0.45],
    [21.0, '#2A3260', '#1E2749', 0.1 ],
    [24.0, '#161D3E', '#10142A', 0.0 ],
    [25.5, '#0C1024', '#090C1E', 0.0 ],
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const hexLerp = (c1, c2, t) => {
    const p = x => [parseInt(x.slice(1,3),16), parseInt(x.slice(3,5),16), parseInt(x.slice(5,7),16)];
    const [r1,g1,b1] = p(c1), [r2,g2,b2] = p(c2);
    return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;
  };

  const sol = document.getElementById('sol');
  const luna = document.getElementById('luna');
  const relojH = document.getElementById('reloj-h');
  const relojL = document.getElementById('reloj-l');
  const moth = document.getElementById('polilla');
  const zones = [...document.querySelectorAll('.hora')];

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
  const esOn = () => root.classList.contains('es');

  /* ---------- hour anchors: each section's top IS its hour ---------- */
  let MAP = [];
  function buildMap() {
    const max = document.documentElement.scrollHeight - innerHeight;
    MAP = zones.map(z => ({ y: z.offsetTop, h: parseFloat(z.dataset.hour) }));
    MAP.push({ y: Math.max(max, MAP[MAP.length - 1].y + 1), h: DAY_END });
  }
  addEventListener('load', () => { buildMap(); update(); });
  addEventListener('resize', () => { buildMap(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildMap(); update(); });

  /* ---------- the master update ---------- */
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
    const sun = lerp(a[3], b[3], t);
    root.style.setProperty('--sky1', hexLerp(a[1], b[1], t));
    root.style.setProperty('--sky2', hexLerp(a[2], b[2], t));
    root.style.setProperty('--sun', sun.toFixed(3));
    root.style.setProperty('--lamp', (1 - sun).toFixed(3));
    root.style.setProperty('--sha', (0.16 + 0.16 * sun).toFixed(3));
    root.style.setProperty('--stars', Math.max(0, ((1 - sun) - 0.75) / 0.25).toFixed(3));

    const dayInk = sun > 0.55;
    root.style.setProperty('--amb', dayInk ? '#2A1F1B' : '#F3ECD8');
    root.style.setProperty('--amb-dim', dayInk ? 'rgba(42,31,27,.62)' : 'rgba(243,236,216,.65)');
    document.body.classList.toggle('noche', !dayInk);

    /* the clock */
    relojH.textContent = fmtHour(h);
    const zc = zones[Math.min(k, zones.length - 1)];
    relojL.textContent = zc.dataset[esOn() ? 'labelEs' : 'labelEn'] || zc.dataset.labelEn;

    /* the sun */
    const sunUp = h >= 6 && h <= 20.4;
    if (sunUp) {
      const sp = (h - 6.2) / (20.2 - 6.2);
      let sx = lerp(10, 90, sp);
      let sy = 78 - Math.sin(Math.PI * Math.min(1, Math.max(0, sp))) * 64;
      const ec = ease(1 - Math.min(1, Math.abs(h - 19.63) / 0.55));
      if (ec > 0) { sx = lerp(sx, 50, ec); sy = lerp(sy, 38, ec); }
      sol.style.left = sx + 'vw'; sol.style.top = sy + 'vh';
      sol.style.opacity = h > 19.9 ? Math.max(0, 1 - (h - 19.9) / 0.5) : 1;
    } else sol.style.opacity = 0;

    /* the moon */
    const moonUp = h >= 18.6;
    if (moonUp) {
      const mp = Math.min(1, (h - 18.6) / (25.5 - 18.6));
      let mx = lerp(96, 50, Math.pow(mp, 0.8));
      let my = lerp(80, 18, Math.sin(mp * Math.PI / 2));
      const ec = ease(1 - Math.min(1, Math.abs(h - 19.63) / 0.55));
      if (ec > 0) { mx = lerp(mx, 50, ec); my = lerp(my, 38, ec); }
      luna.style.left = mx + 'vw'; luna.style.top = my + 'vh';
      luna.style.opacity = Math.min(1, (h - 18.6) / 0.6);
    } else luna.style.opacity = 0;
    root.classList.toggle('eclipse', Math.abs(h - 19.63) < 0.5);

    /* moth: awake after 21h */
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
    if (document.hidden) { update(); return; }
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('visibilitychange', update);
  if (!reduced) setInterval(() => { if (parseFloat(moth.style.opacity) > 0) update(); }, 120);

  /* ---------- language: one language at a time ---------- */
  const sello = document.getElementById('sello');
  const selloLang = document.getElementById('sello-lang');
  function setLang(es) {
    root.classList.toggle('es', es);
    root.lang = es ? 'es' : 'en';
    selloLang.textContent = es ? 'EN' : 'ES';   // the seal offers the other language
    try { localStorage.setItem('nym-lang', es ? 'es' : 'en'); } catch (_) {}
    buildMap(); update();
  }
  sello.addEventListener('click', () => setLang(!esOn()));
  try { if (localStorage.getItem('nym-lang') === 'es') setLang(true); } catch (_) {}

  /* ---------- call sheet: hover a row, see the work ---------- */
  const stillLayer = document.getElementById('still-layer');
  document.querySelectorAll('.callsheet a[data-still], .sheet tr[data-still]').forEach(row => {
    const show = () => {
      stillLayer.style.backgroundImage = `url("${row.dataset.still}")`;
      stillLayer.classList.add('show');
    };
    const hide = () => stillLayer.classList.remove('show');
    row.addEventListener('mouseenter', show);
    row.addEventListener('mouseleave', hide);
    row.addEventListener('focus', show);
    row.addEventListener('blur', hide);
  });

  /* ---------- the screening: tonight's program ---------- */
  const monScreen = document.querySelector('.mon-screen');
  const hintBtn = document.getElementById('play-hint');
  const offBtn = document.getElementById('off-reel');
  function clearScreen() {
    monScreen.querySelectorAll('iframe, video').forEach(el => el.remove());
  }
  function play(src) {
    clearScreen();
    let el;
    if (src.startsWith('yt:')) {
      el = document.createElement('iframe');
      el.src = `https://www.youtube.com/embed/${src.slice(3)}?autoplay=1&rel=0&modestbranding=1`;
      el.allow = 'autoplay; encrypted-media; picture-in-picture';
      el.title = 'Reel';
    } else {
      el = document.createElement('video');
      el.src = src;
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
    }
    monScreen.appendChild(el);
    hintBtn.hidden = true; offBtn.hidden = false;
  }
  document.querySelectorAll('.programa button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.programa button').forEach(x => x.classList.toggle('on', x === btn));
      play(btn.dataset.src);
    });
  });
  offBtn.addEventListener('click', () => {
    clearScreen();
    hintBtn.hidden = false; offBtn.hidden = true;
    document.querySelectorAll('.programa button').forEach(x => x.classList.remove('on'));
  });

  /* ---------- reveals ---------- */
  if (!reduced) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.18 });
    document.querySelectorAll('.p, .recibo, .monitor, .cutouts').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.p, .recibo, .monitor, .cutouts').forEach(el => el.classList.add('in'));
  }

  update();
})();
