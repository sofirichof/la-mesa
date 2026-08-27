/* ============ LA MESA — world engine ============
   One master shot. The camera is a character. Light is the state system. */

(() => {
  const WORLD = { w: 4200, h: 2600 };
  const frame = document.getElementById('frame');
  const world = document.getElementById('world');
  const root  = document.documentElement;

  /* ---------- camera ---------- */
  const cam = { x: 2100, y: 1500, z: 1.0 };          // current
  const tgt = { x: 2100, y: 1500, z: 1.0 };          // target
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LERP = reduced ? 1 : 0.075;

  let vw = innerWidth, vh = innerHeight;
  addEventListener('resize', () => { vw = innerWidth; vh = innerHeight; });

  function clampTarget() {
    const minZ = Math.max(vw / WORLD.w, vh / WORLD.h) * 1.02;
    tgt.z = Math.min(2.2, Math.max(minZ, tgt.z));
    const hw = vw / (2 * tgt.z), hh = vh / (2 * tgt.z);
    tgt.x = Math.min(WORLD.w - hw, Math.max(hw, tgt.x));
    tgt.y = Math.min(WORLD.h - hh, Math.max(hh, tgt.y));
  }

  /* mouse lean — leaning over the table */
  const lean = { x: 0, y: 0 };
  addEventListener('pointermove', e => {
    lean.x = (e.clientX / vw - 0.5) * 10;
    lean.y = (e.clientY / vh - 0.5) * 7;
  }, { passive: true });

  const lObj = document.getElementById('l-obj');
  const lAir = document.getElementById('l-air');
  const lPaper = document.getElementById('l-paper');
  function render() {
    cam.x += (tgt.x - cam.x) * LERP;
    cam.y += (tgt.y - cam.y) * LERP;
    cam.z += (tgt.z - cam.z) * LERP;
    const lx = reduced ? 0 : lean.x, ly = reduced ? 0 : lean.y;
    const tx = vw / 2 - (cam.x + lx) * cam.z;
    const ty = vh / 2 - (cam.y + ly) * cam.z;
    world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${cam.z})`;
    /* depth: papers, objects, and air ride at different rates — the room has thickness */
    if (!reduced) {
      const ox = cam.x - WORLD.w / 2, oy = cam.y - WORLD.h / 2;
      lPaper.style.transform = `translate3d(${-ox * 0.006 - lx * 0.3}px, ${-oy * 0.006 - ly * 0.3}px, 0)`;
      lObj.style.transform   = `translate3d(${-ox * 0.014 - lx * 0.8}px, ${-oy * 0.014 - ly * 0.8}px, 0)`;
      lAir.style.transform   = `translate3d(${-ox * 0.028 - lx * 1.6}px, ${-oy * 0.028 - ly * 1.6}px, 0)`;
    }
  }

  /* ---------- the ride (scroll = composed dolly path) ---------- */
  const PATH = [
    { x: 2100, y: 1500, z: 1.05 },   // la llegada
    { x: 2050, y: 1180, z: 1.0  },   // la mano
    { x: 640,  y: 1180, z: 1.0  },   // el monitor
    { x: 2100, y: 380,  z: 0.95 },   // la tabla completa
    { x: 2850, y: 1800, z: 1.0  },   // la ficción
    { x: 3560, y: 1120, z: 1.0  },   // el cajón
    { x: 2880, y: 2240, z: 1.1  },   // el sobre
  ];
  let t = 0; // 0..PATH.length-1
  function pathAt(u) {
    const i = Math.max(0, Math.min(PATH.length - 2, Math.floor(u)));
    const f = Math.min(1, Math.max(0, u - i));
    const e = f * f * (3 - 2 * f); // smoothstep between waypoints
    const a = PATH[i], b = PATH[i + 1];
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e };
  }
  addEventListener('wheel', e => {
    e.preventDefault();
    t = Math.min(PATH.length - 1, Math.max(0, t + e.deltaY * 0.0016));
    const p = pathAt(t);
    tgt.x = p.x; tgt.y = p.y; tgt.z = p.z * zk();
    clampTarget();
  }, { passive: false });

  /* ---------- the roam (drag = drift) ---------- */
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button, .card, #cajon, #sobre')) return;
    drag = { x: e.clientX, y: e.clientY, cx: tgt.x, cy: tgt.y };
    frame.classList.add('dragging');
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    tgt.x = drag.cx - (e.clientX - drag.x) / cam.z;
    tgt.y = drag.cy - (e.clientY - drag.y) / cam.z;
    clampTarget();
  });
  addEventListener('pointerup', () => { drag = null; frame.classList.remove('dragging'); });

  /* small screens sit closer to the table */
  const zk = () => (vw < 700 ? 0.56 : 1);
  function goTo(x, y, z) { tgt.x = x; tgt.y = y; if (z) tgt.z = z * zk(); clampTarget(); }

  /* double-click: push in on whatever is under the cursor; again to pull back */
  frame.addEventListener('dblclick', e => {
    if (e.target.closest('a, button')) return;
    const wx = cam.x + (e.clientX - vw / 2) / cam.z;
    const wy = cam.y + (e.clientY - vh / 2) / cam.z;
    if (cam.z < 1.35 * zk()) goTo(wx, wy, 1.55); else goTo(wx, wy, 1.0);
  });

  /* ---------- light is the state system ---------- */
  let hourOverride = null;          // null = the visitor's real clock
  function hourNow() {
    if (hourOverride !== null) return hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }
  function applyLight() {
    const h = hourNow();
    // sun: 0 at night, 1 midday — smooth dawn 6–9, dusk 17.5–20.5
    const up = Math.min(1, Math.max(0, (h - 6) / 3));
    const down = Math.min(1, Math.max(0, (20.5 - h) / 3));
    const sun = Math.min(up, down);
    const lamp = 1 - sun;
    // shadow direction swings across the day; at night it shortens toward the lamp
    const ang = ((h - 13) / 12) * Math.PI;
    const len = 8 + 14 * (1 - sun) * sun * 4 * 0.5 + 6 * sun;
    const shx = (Math.sin(ang) * len * sun - 4 * lamp).toFixed(1);
    const shy = (Math.abs(Math.cos(ang)) * len * 0.9 * sun + 6 * lamp).toFixed(1);
    root.style.setProperty('--sun', sun.toFixed(3));
    root.style.setProperty('--lamp', lamp.toFixed(3));
    root.style.setProperty('--shx', shx + 'px');
    root.style.setProperty('--shy', shy + 'px');
    root.style.setProperty('--sha', (0.22 + 0.18 * sun).toFixed(3));
    root.style.setProperty('--grade-a', (lamp * 0.88).toFixed(3));
  }
  applyLight();
  setInterval(applyLight, 30_000);

  /* ---------- el sello: drag scrubs the hour, click flips, hold = lens ---------- */
  const seal = document.getElementById('seal');
  // build the 12 rays
  const rays = seal.querySelector('#rays');
  for (let i = 0; i < 12; i++) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('points', '60,2 65,26 55,26');
    p.setAttribute('transform', `rotate(${i * 30} 60 60)`);
    rays.appendChild(p);
  }
  let holdTimer = null, held = false, sealDrag = null;
  seal.addEventListener('pointerdown', e => {
    sealDrag = { x: e.clientX, h: hourNow(), moved: false };
    holdTimer = setTimeout(() => { held = true; root.classList.add('lens'); }, 350);
    seal.setPointerCapture(e.pointerId);
  });
  seal.addEventListener('pointermove', e => {
    if (!sealDrag) return;
    const dx = e.clientX - sealDrag.x;
    if (Math.abs(dx) > 6) {
      sealDrag.moved = true;
      clearTimeout(holdTimer);
      hourOverride = (sealDrag.h + dx / 12 + 24) % 24;   // ~12px per hour
      applyLight();
    }
  });
  seal.addEventListener('pointerup', () => {
    clearTimeout(holdTimer);
    if (held) { root.classList.remove('lens'); held = false; }
    else if (sealDrag && !sealDrag.moved) {
      // flip: jump between 14h and 23h
      const sun = parseFloat(getComputedStyle(root).getPropertyValue('--sun'));
      hourOverride = sun > 0.5 ? 23 : 14;
      applyLight();
    }
    sealDrag = null;
  });
  addEventListener('keydown', e => {
    if (e.key === 'm') root.classList.toggle('lens');
    if (e.key === 'n') { hourOverride = 23; applyLight(); }
    if (e.key === 'd') { hourOverride = 14; applyLight(); }
    if (e.key === 'ArrowLeft')  { tgt.x -= 240; clampTarget(); }
    if (e.key === 'ArrowRight') { tgt.x += 240; clampTarget(); }
    if (e.key === 'ArrowUp')    { tgt.y -= 240; clampTarget(); }
    if (e.key === 'ArrowDown')  { tgt.y += 240; clampTarget(); }
  });

  /* ---------- el reparto: the deal ---------- */
  const HANDS = {
    recruiter: ['transmision', 'anuncio', 'ficcion', 'corte', 'documental', 'imagen', 'maquina'],
    agencia:   ['anuncio', 'corte', 'maquina', 'imagen', 'ficcion', 'transmision', 'documental'],
    director:  ['ficcion', 'documental', 'corte', 'imagen', 'transmision', 'anuncio', 'maquina'],
    chisme:    ['imagen', 'ficcion', 'documental', 'transmision', 'anuncio', 'corte', 'maquina'],
  };
  const FANS = {
    transmision: { x: 760,  y: 1980 }, anuncio: { x: 1380, y: 560 },
    ficcion:     { x: 2850, y: 1800 }, documental: { x: 3380, y: 2020 },
    corte:       { x: 520,  y: 600 },  imagen:  { x: 3350, y: 520 },
    maquina:     { x: 2380, y: 520 },
  };
  function deal(aud) {
    const order = HANDS[aud];
    order.forEach((name, i) => {
      const c = document.getElementById('c-' + name);
      const arc = (i - 3) * 0.16;                       // fan around the hand
      c.style.setProperty('--x', 2050 + Math.sin(arc) * 620);
      c.style.setProperty('--y', 1210 + Math.abs(i - 3) * 26 - 40);
      c.style.setProperty('--r', (i - 3) * 4);
      c.style.zIndex = 10 - Math.abs(i - 3);
    });
    root.classList.add('dealt');
    if (aud === 'chisme') setTimeout(() => document.getElementById('cajon').classList.add('open'), 900);
    setTimeout(() => { t = 1; goTo(2050, 1180, 1.0); }, 350);
    try { localStorage.setItem('mesa-aud', aud); } catch (_) {}
  }
  document.querySelectorAll('.chip').forEach(ch =>
    ch.addEventListener('click', () => deal(ch.dataset.aud)));

  /* ---------- cards open their fans (a push-in, not a page) ---------- */
  function openDiscipline(name) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('active', c.dataset.card === name));
    document.querySelectorAll('.fan').forEach(f => f.classList.toggle('open', f.id === 'fan-' + name));
    const f = FANS[name];
    goTo(f.x, f.y + 30, 1.18);
  }
  document.querySelectorAll('.card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => openDiscipline(card.dataset.card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDiscipline(card.dataset.card); } });
  });

  /* the index sheet navigates — each row walks to its discipline's fan */
  const DISC = { 'FICCIÓN': 'ficcion', 'DOCUMENTAL': 'documental', 'ANUNCIO': 'anuncio',
                 'TRANSMISIÓN': 'transmision', 'CORTE': 'corte', 'IMAGEN': 'imagen', 'MÁQUINA': 'maquina' };
  document.querySelectorAll('#tabla tr').forEach(tr => {
    const tag = tr.cells[2] ? tr.cells[2].textContent : '';
    const name = Object.keys(DISC).find(k => tag.includes(k));
    if (name) tr.addEventListener('click', () => openDiscipline(DISC[name]));
  });

  /* expedientes: click to lean in and read, click again to sit back */
  let leaned = null;
  document.querySelectorAll('.exp').forEach(exp => {
    exp.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const x = parseFloat(exp.style.getPropertyValue('--x'));
      const y = parseFloat(exp.style.getPropertyValue('--y'));
      if (leaned === exp) { leaned = null; openDiscipline(exp.dataset.card); }
      else { leaned = exp; goTo(x, y, 1.6); }
    });
  });

  /* ---------- el monitor: the reel plays in the room, never leaves it ---------- */
  const monScreen = document.querySelector('.mon-screen');
  const playBtn = document.getElementById('play-reel');
  const offBtn = document.getElementById('off-reel');
  playBtn.addEventListener('click', () => {
    if (monScreen.querySelector('iframe')) return;
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/saYu8WDDYMY?autoplay=1&rel=0&modestbranding=1';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.title = 'Reel 2026';
    monScreen.appendChild(f);
    playBtn.hidden = true; offBtn.hidden = false;
    goTo(640, 1160, 1.5);
  });
  offBtn.addEventListener('click', () => {
    const f = monScreen.querySelector('iframe');
    if (f) f.remove();
    playBtn.hidden = false; offBtn.hidden = true;
    goTo(640, 1180, 1.0);
  });

  /* ---------- drawer & envelope ---------- */
  const cajon = document.getElementById('cajon');
  cajon.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    cajon.classList.toggle('open');
    if (cajon.classList.contains('open')) goTo(3560, 1170, 1.12);
  });
  cajon.addEventListener('keydown', e => { if (e.key === 'Enter') cajon.classList.toggle('open'); });
  const sobre = document.getElementById('sobre');
  sobre.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    sobre.classList.toggle('open');
    if (sobre.classList.contains('open')) goTo(2900, 2280, 1.2);
  });
  sobre.addEventListener('keydown', e => { if (e.key === 'Enter') sobre.classList.toggle('open'); });

  /* ---------- idle physics: the world doesn't need you ---------- */
  const moth = document.getElementById('polilla');
  const LAMP = { x: 3050, y: 830 };
  let mt = Math.random() * 100;
  function idle() {
    if (!reduced) {
      mt += 0.016;
      const r = 70 + Math.sin(mt * 1.7) * 26;
      const mx = LAMP.x + Math.cos(mt * 1.1) * r + Math.sin(mt * 3.7) * 9;
      const my = LAMP.y - 26 + Math.sin(mt * 1.4) * (r * 0.45) + Math.cos(mt * 4.3) * 7;
      moth.style.transform = `translate(${mx}px, ${my}px) rotate(${Math.sin(mt * 5) * 24}deg)`;
      moth.style.opacity = getComputedStyle(root).getPropertyValue('--lamp').trim();
    }
    render();
    requestAnimationFrame(idle);
  }

  /* ---------- boot: the table draws itself, then the ink floods in ---------- */
  addEventListener('load', () => {
    setTimeout(() => root.classList.remove('boot'), reduced ? 0 : 1400);
    tgt.z = 1.05 * zk(); clampTarget();
    // returning visitor with a dealt hand keeps their table as they left it
    try {
      const aud = localStorage.getItem('mesa-aud');
      if (aud && HANDS[aud]) { deal(aud); }
    } catch (_) {}
  });

  clampTarget();
  idle();
})();
