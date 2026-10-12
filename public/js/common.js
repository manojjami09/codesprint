'use strict';

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
  return data;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtMs(ms) {
  if (ms == null) return '--:--:--';
  ms = Math.max(0, ms);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function statusBadge(status) {
  const map = { active: 'active', completed: 'completed', locked: 'locked', closed: 'closed' };
  const label = { active: 'Active', completed: 'Completed', locked: 'Locked', closed: 'Closed' };
  return `<span class="badge ${map[status] || 'locked'}">${label[status] || status}</span>`;
}

function connectSocket(onState, onLeaderboard) {
  if (typeof io === 'undefined') return null;
  const socket = io();
  if (onState) socket.on('state', onState);
  if (onLeaderboard) socket.on('leaderboard', onLeaderboard);
  return socket;
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  location.href = '/';
}

/* ===================== THEME MANAGER ===================== */
const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';
const BRAND_SVG = '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 11 8 16l5 5"/><path d="M19 11l5 5-5 5"/><path d="M17.6 9.4 14.4 22.6"/></svg>';
const BURGER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
function updateThemeButtons() {
  const theme = getTheme();
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('aria-label', btn.getAttribute('title'));
  });
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('cs-theme', theme); } catch { /* ignore */ }
  updateThemeButtons();
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
function toggleTheme() {
  document.documentElement.classList.add('theming');
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  setTimeout(() => document.documentElement.classList.remove('theming'), 500);
}

/* ===================== ANIMATION LAYER ===================== */
(function (win, doc) {
  const prefersReduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function injectBackground() {
    if (doc.querySelector('.bgfx')) return;
    const fx = doc.createElement('div');
    fx.className = 'bgfx';
    const grid = doc.createElement('div');
    grid.className = 'bg-grid';
    fx.appendChild(grid);
    ['b1', 'b2', 'b3'].forEach((b) => {
      const el = doc.createElement('div');
      el.className = 'blob ' + b;
      fx.appendChild(el);
    });
    if (!prefersReduced) {
      for (let i = 0; i < 26; i++) {
        const p = doc.createElement('div');
        p.className = 'particle p' + (i % 2 === 0 ? '1' : '2');
        p.style.left = Math.random() * 100 + 'vw';
        p.style.width = (2 + Math.random() * 4) + 'px';
        p.style.height = p.style.width;
        p.style.animationDuration = (9 + Math.random() * 14) + 's';
        p.style.animationDelay = (Math.random() * 12) + 's';
        fx.appendChild(p);
      }
    }
    doc.body.appendChild(fx);
  }

  function bootLoader() {
    if (doc.querySelector('#boot')) return;
    const boot = doc.createElement('div');
    boot.id = 'boot';
    boot.innerHTML = '<div class="ring"></div><div class="b-logo">CODE SPRINT</div><div class="b-sub">Initializing Arena</div>';
    doc.body.appendChild(boot);
    const dismiss = () => { boot.classList.add('out'); setTimeout(() => boot.remove(), 700); };
    if (doc.readyState === 'complete') setTimeout(dismiss, 450);
    else win.addEventListener('load', () => setTimeout(dismiss, 450));
    setTimeout(dismiss, 2200);
  }

  function decorateChrome() {
    doc.querySelectorAll('[data-brand-mark]').forEach((el) => { if (!el.innerHTML.trim()) el.innerHTML = BRAND_SVG; });
    const burger = doc.querySelector('.nav-burger');
    if (burger && !burger.innerHTML.trim()) burger.innerHTML = BURGER_SVG;
    updateThemeButtons();
  }

  function wireNav() {
    const nav = doc.querySelector('.nav');
    const burger = doc.querySelector('.nav-burger');
    if (nav && burger) {
      burger.addEventListener('click', (e) => { e.stopPropagation(); nav.classList.toggle('open'); });
      doc.addEventListener('click', (e) => { if (!nav.contains(e.target)) nav.classList.remove('open'); });
      win.addEventListener('resize', () => { if (win.innerWidth > 900) nav.classList.remove('open'); });
    }
    doc.querySelectorAll('.theme-toggle').forEach((btn) => btn.addEventListener('click', toggleTheme));
  }

  function wireSpotlight() {
    if (prefersReduced || !win.matchMedia('(hover: hover)').matches) return;
    doc.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  function wireRipple() {
    doc.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest && e.target.closest('.btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.1;
      const span = doc.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(span);
      setTimeout(() => span.remove(), 620);
    });
  }

  function wireScroll() {
    const bar = doc.createElement('div');
    bar.id = 'scrollbar';
    const top = doc.createElement('button');
    top.id = 'toTop';
    top.className = 'icon-btn';
    top.setAttribute('aria-label', 'Back to top');
    top.setAttribute('title', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    top.addEventListener('click', () => win.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }));
    doc.body.appendChild(bar);
    doc.body.appendChild(top);
    const onScroll = () => {
      const h = doc.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      top.classList.toggle('show', h.scrollTop > 380);
    };
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onScroll);
    onScroll();
  }

  function fireConfetti(count) {
    if (prefersReduced) return;
    const colors = ['#0bb7f0', '#8b5cf6', '#ef2e88', '#16d18a', '#f5a524', '#ffffff'];
    const n = count || 140;
    for (let i = 0; i < n; i++) {
      const c = doc.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[(Math.random() * colors.length) | 0];
      if (i % 3 === 0) { c.style.borderRadius = '50%'; c.style.width = c.style.height = '8px'; }
      c.style.animationDuration = (1.8 + Math.random() * 2.2) + 's';
      c.style.animationDelay = (Math.random() * 0.7) + 's';
      c.style.setProperty('--drift', (Math.random() * 220 - 110) + 'px');
      c.style.setProperty('--spin', (Math.random() * 900 + 300) + 'deg');
      doc.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  function countUp(el, target, opts) {
    opts = opts || {};
    const dur = opts.duration || 900;
    const dec = opts.decimals || 0;
    const suffix = opts.suffix || '';
    const prefix = opts.prefix || '';
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = prefix + (dec ? val.toFixed(dec) : Math.round(val).toString()) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const revealObserver = win.IntersectionObserver
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); } });
      }, { threshold: 0.12 })
    : null;

  function observeReveal(root) {
    if (!revealObserver) return;
    (root || doc).querySelectorAll('.reveal-ob').forEach((el) => { if (!el.classList.contains('in')) revealObserver.observe(el); });
  }

  function makeTableAnim(tbody) {
    if (prefersReduced || !tbody) return;
    tbody.classList.add('anim');
    setTimeout(() => tbody.classList.remove('anim'), 1400);
  }

  function tickTimer(el) {
    if (prefersReduced || !el) return;
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
  }

  function shake(el) {
    if (!el || prefersReduced) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
  }

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(() => { injectBackground(); bootLoader(); decorateChrome(); wireNav(); wireSpotlight(); wireRipple(); wireScroll(); });

  win.fireConfetti = fireConfetti;
  win.countUp = countUp;
  win.observeReveal = observeReveal;
  win.makeTableAnim = makeTableAnim;
  win.tickTimer = tickTimer;
  win.shake = shake;
  win.getTheme = getTheme;
  win.applyTheme = applyTheme;
  win.toggleTheme = toggleTheme;
})(window, document);