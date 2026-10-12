'use strict';

const $ = (id) => document.getElementById(id);
let lastState = null;
let lastSeconds = null;
let journeyRendered = false;

async function load() {
  let d;
  try { d = await api('/team/me'); }
  catch (e) { location.href = '/'; return; }

  $('navTeam').textContent = d.team.name + ' (' + d.team.code + ')';
  $('teamName').textContent = d.team.name;
  $('teamCode').textContent = d.team.code;
  const newScore = parseInt(d.score, 10) || 0;
  if (parseInt($('score').textContent, 10) !== newScore) countUp($('score'), newScore);
  $('rank').textContent = d.rank ? ('#' + d.rank + ' / ' + d.totalTeams) : '—';
  $('solvedCount').textContent = d.solvedCount + ' questions solved';
  $('penaltyInfo').textContent = d.penalty > 0 ? ('Hint penalty: −' + d.penalty) : 'No hint penalties';

  const pct = d.totalMarks ? Math.round((d.earned / d.totalMarks) * 100) : 0;
  $('progressBar').style.transition = 'width 1s cubic-bezier(.22,.8,.28,1)';
  $('progressBar').style.width = Math.min(100, pct) + '%';
  $('progressText').textContent = d.earned + ' / ' + d.totalMarks + ' marks (' + pct + '%)';

  if (d.state.message) { $('message').classList.remove('hidden'); $('message').textContent = d.state.message; }
  else $('message').classList.add('hidden');

  renderState(d.state);
  renderJourney(d.journey);
  renderRounds(d.state);
}

function renderState(st) {
  lastState = st;
  const t = $('timer');
  const secs = Math.floor((st.remainingMs || 0) / 1000);
  if (lastSeconds !== null && lastSeconds !== secs) tickTimer(t);
  lastSeconds = secs;
  t.textContent = fmtMs(st.remainingMs);
  t.classList.toggle('warn', st.remainingMs > 0 && st.remainingMs < 5 * 60 * 1000);
  $('phase').textContent = st.phaseLabel;
  renderRounds(st);
}

function renderRounds(st) {
  const labels = { 1: '🔐 Round 1 — Logic Quest', 2: '⚔️ Round 2 — Code Arena', 3: '🐛 Round 3 — Debug Lab' };
  $('roundBox').innerHTML = [1, 2, 3].map((r) =>
    `<span class="badge ${st.rounds[r]}">${labels[r]}: ${st.rounds[r]}</span>`).join(' ');

  $('roundButtons').innerHTML = [1, 2, 3].map((r) => {
    const open = st.rounds[r] === 'active';
    return `<a class="btn ${open ? '' : 'ghost'} small" href="${open ? '/question.html?round=' + r : '#'}"
      ${open ? '' : 'style="pointer-events:none;opacity:.45;"'}>${labels[r]}</a>`;
  }).join(' ') + (st.frozen ? '<span class="badge closed">Leaderboard Frozen</span>' : '');
}

function renderJourney(journey) {
  const el = $('journey');
  el.className = journeyRendered ? 'journey' : 'journey stagger';
  journeyRendered = true;
  el.innerHTML = journey.map((j, i) => {
    const parts = [`<div class="stage ${j.status}">
      <span class="icon">${j.icon}</span>
      <span class="name">${escapeHtml(j.label)}</span>
      ${statusBadge(j.status)}
      ${j.total ? `<span class="small-muted" style="font-size:11px">${j.done}/${j.total} solved</span>` : ''}
    </div>`];
    if (i < journey.length - 1) parts.push('<span class="arrow">→</span>');
    return parts.join('');
  }).join('');
}

connectSocket((st) => { if (st) renderState(st); });
load();
setInterval(load, 15000);
