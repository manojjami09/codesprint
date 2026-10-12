'use strict';

const $ = (id) => document.getElementById(id);
const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

(async function boot() {
  let d;
  try { d = await api('/results'); }
  catch (e) { $('notPublished').querySelector('.small-muted').textContent = e.message; return; }

  if (!d.published) {
    $('notPublished').classList.remove('hidden');
    $('rsStatus').textContent = 'Competition progress checked at ' + new Date().toLocaleTimeString();
    return;
  }

  $('published').classList.remove('hidden');
  $('notPublished').classList.add('hidden');
  const top = d.leaderboard.slice(0, 3);
  const titles = ['Winner', 'Runner-up', 'Second Runner-up'];
  $('podium').innerHTML = top.map((t, i) => `
    <div class="card tight glow-border" style="min-width:220px; text-align:center; ${i === 0 ? 'background:linear-gradient(180deg,rgba(255,209,102,.12),rgba(20,27,48,.78));' : ''}">
      <div style="font-size:46px; ${i === 0 ? 'filter:drop-shadow(0 6px 18px rgba(255,209,102,.55)); animation: trophyFloat 3s ease-in-out infinite;' : ''}">${medals[t.rank] || t.rank}</div>
      <h3>${escapeHtml(t.name)}</h3>
      <div class="small-muted">${escapeHtml(t.code)}</div>
      <div class="p-score" data-val="${t.score}" style="font-size:30px; font-weight:800; font-family:var(--font-display); color:${i === 0 ? 'var(--amber)' : 'var(--text)'}">0</div>
      <div class="small-muted">${titles[i]}</div>
    </div>`).join('');

  $('rsBody').innerHTML = d.leaderboard.map((r) => `
    <tr class="rank-${r.rank}">
      <td>${medals[r.rank] || r.rank}</td>
      <td><b>${escapeHtml(r.name)}</b> <span class="small-muted">${escapeHtml(r.code)}</span></td>
      <td><b>${r.score}</b></td>
      <td>${(r.roundEarned && r.roundEarned[1]) || 0}</td>
      <td>${(r.roundEarned && r.roundEarned[2]) || 0}</td>
      <td>${(r.roundEarned && r.roundEarned[3]) || 0}</td>
    </tr>`).join('');

  makeTableAnim($('rsBody'));
  setTimeout(() => fireConfetti(180), 350);
  document.querySelectorAll('.p-score').forEach((el, i) => {
    setTimeout(() => countUp(el, parseInt(el.dataset.val, 10) || 0, { duration: 1100 }), 500 + i * 280);
  });
})();