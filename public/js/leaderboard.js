'use strict';

const $ = (id) => document.getElementById(id);
let lastUpdated = null;
let prevScores = null;
let firstAnimDone = false;
let lastSeconds = null;

function render(board, frozen) {
  $('lgFrozen').classList.toggle('hidden', !frozen);
  $('lgStatusBadge').innerHTML = frozen ? '<span class="badge closed">Frozen</span>' : '<span class="badge active">LIVE</span>';
  if (!board || !board.length) {
    $('lgBody').innerHTML = '<tr><td colspan="4" class="small-muted">No teams on the board yet.</td></tr>';
    return;
  }
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const bumps = {};
  if (prevScores) board.forEach((r) => { if (prevScores[r.code] != null && prevScores[r.code] !== r.score) bumps[r.code] = true; });
  prevScores = {};
  board.forEach((r) => { prevScores[r.code] = r.score; });

  $('lgBody').innerHTML = board.map((r) => `
    <tr class="rank-${r.rank}${bumps[r.code] ? ' bump' : ''}">
      <td>${medals[r.rank] || r.rank}</td>
      <td><b>${escapeHtml(r.name)}</b> <span class="small-muted">${escapeHtml(r.code)}</span></td>
      <td><b>${r.score}</b></td>
      <td>${r.solved}</td>
    </tr>`).join('');
  if (!firstAnimDone) { makeTableAnim($('lgBody')); firstAnimDone = true; }
  lastUpdated = new Date();
  $('lgUpdated').textContent = 'Updated ' + lastUpdated.toLocaleTimeString();
}

connectSocket(
  (st) => {
    if (!st || st.remainingMs == null) return;
    const t = $('lgTimer');
    const secs = Math.floor(st.remainingMs / 1000);
    if (lastSeconds !== null && lastSeconds !== secs) tickTimer(t);
    lastSeconds = secs;
    t.textContent = '⏱ ' + fmtMs(st.remainingMs);
  },
  (board) => {
    const frozen = window.__frozen;
    render(board, frozen);
  }
);

(async function boot() {
  try {
    const d = await api('/leaderboard');
    window.__frozen = d.frozen;
    render(d.leaderboard, d.frozen);
  } catch (e) { $('lgBody').innerHTML = `<tr><td colspan="4" style="color:var(--red)">${escapeHtml(e.message)}</td></tr>`; }
})();