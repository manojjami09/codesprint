'use strict';

const $ = (id) => document.getElementById(id);
let state = null;
let questionRoundFilter = 1;
let currentQ = null;
let lastSeconds = null;
const tableAnimDone = {};

// ---------------------------------------------------------------- login
$('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('adminLoginErr').textContent = '';
  try {
    await api('/auth/admin-login', { method: 'POST', body: { username: $('adminUser').value, password: $('adminPass').value } });
    boot();
  } catch (err) { $('adminLoginErr').textContent = err.message; }
});

async function boot() {
  let me;
  try { me = await api('/auth/me'); } catch { /* offline */ showLogin(); return; }
  if (me.role === 'admin') {
    $('adminLogin').classList.add('hidden');
    $('adminApp').classList.remove('hidden');
    $('adminRole').textContent = me.admin.role + ' logged in as ' + me.admin.username;
    refreshAll();
    connectSocket(renderState);
    setInterval(refreshAll, 30000);
  } else if (me.role === 'team') {
    location.href = '/dashboard.html';
  } else {
    showLogin();
  }
}

function showLogin() {
  $('adminLogin').classList.remove('hidden');
  $('adminApp').classList.add('hidden');
}

// ---------------------------------------------------------------- tabs
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  t.classList.add('active');
  $('tab-' + t.dataset.tab).classList.remove('hidden');
  if (t.dataset.tab === 'questions') loadQuestions();
  if (t.dataset.tab === 'activity') loadActivity();
  if (t.dataset.tab === 'settings') loadConfig();
}));

function renderState(st) {
  if (!st) return;
  state = st;
  $('stStatus').textContent = st.status;
  $('stStatus').style.color = st.status === 'live' ? 'var(--green)' : st.status === 'finished' ? 'var(--red)' : 'var(--muted)';
  if ($('timerCard')) $('timerCard').classList.toggle('glow-border', st.status === 'live');
  $('stPhase').textContent = st.phaseLabel;
  const t = $('stTimer');
  const secs = Math.floor((st.remainingMs || 0) / 1000);
  if (lastSeconds !== null && lastSeconds !== secs) tickTimer(t);
  lastSeconds = secs;
  t.textContent = fmtMs(st.remainingMs);
  $('stRounds').innerHTML = [1, 2, 3].map((r) => `<span class="badge ${st.rounds[r]}">R${r}: ${st.rounds[r]}</span>`).join(' ');
}

// ---------------------------------------------------------------- overview
async function refreshAll() {
  try {
    const [ov, lb] = await Promise.all([api('/admin/overview'), api('/leaderboard')]);
    state = ov.state;
    renderState(ov.state);
    renderOverview(ov);
    renderTeamsList(ov.teams);
    renderLb(lb);
    $('ovStats').textContent = `${ov.stats.totalTeams} teams • ${ov.stats.totalSubs} submissions • ${ov.stats.totalFlags} flags`;
  } catch (e) { /* not logged in */ }
}

function renderOverview(ov) {
  $('ovBody').innerHTML = ov.teams.map((t) => `
    <tr>
      <td><b>${t.rank != null ? t.rank : '—'}</b></td>
      <td><b>${escapeHtml(t.name)}</b> <span class="small-muted">${escapeHtml(t.code)}</span></td>
      <td><b>${t.score}</b></td>
      <td>${t.solved}</td>
      <td>${t.submissions}</td>
      <td>${t.hints}</td>
      <td>${t.flags ? `<span style="color:var(--red);font-weight:700;">${t.flags} 🚩</span>` : '0'}</td>
      <td class="small-muted">${t.lastAt ? t.lastAt : '—'}</td>
      <td><button class="btn ghost small" onclick="openTeamDetail(${t.id})">View</button></td>
    </tr>`).join('');
  if (!tableAnimDone.ov) { makeTableAnim($('ovBody')); tableAnimDone.ov = true; }
}

// ---------------------------------------------------------------- teams
let lastTeams = [];
function renderTeamsList(teams) {
  lastTeams = teams;
  $('teamBody').innerHTML = teams.map((t) => `
    <tr>
      <td class="mono">${escapeHtml(t.code)}</td>
      <td><b>${escapeHtml(t.name)}</b></td>
      <td>${t.score}</td>
      <td>${t.active ? '<span class="pill solved">Active</span>' : '<span class="pill todo">Disabled</span>'}</td>
      <td><span class="row">
        <button class="btn ghost small" onclick="openTeamDetail(${t.id})">Detail</button>
        <button class="btn ghost small" onclick="editTeam(${t.id})">Edit</button>
        <button class="btn red small" onclick="delTeam(${t.id})">Delete</button>
      </span></td>
    </tr>`).join('');
  if (!tableAnimDone.teams) { makeTableAnim($('teamBody')); tableAnimDone.teams = true; }
}

async function addTeam() {
  try {
    await api('/admin/team', { method: 'POST', body: {
      code: $('newTeamCode').value, name: $('newTeamName').value, password: $('newTeamPass').value || 'sprint123' } });
    toast('Team added', 'ok'); refreshAll();
  } catch (e) { toast(e.message, 'err'); }
}

async function bulkTeams() {
  try {
    const r = await api('/admin/teams/bulk', { method: 'POST', body: {
      count: Number($('bulkCount').value) || 1, prefix: $('bulkPrefix').value,
      namePrefix: $('bulkNamePrefix').value, password: $('bulkPass').value } });
    toast('Created ' + r.created + ' teams', 'ok'); refreshAll();
  } catch (e) { toast(e.message, 'err'); }
}

async function delTeam(id) {
  if (!confirm('Delete this team and all its data?')) return;
  await api('/admin/team/' + id, { method: 'DELETE' });
  toast('Team deleted', 'ok'); refreshAll();
}

function editTeam(id) {
  const t = lastTeams.find((x) => x.id === id);
  if (!t) return;
  openModal(`
    <h3>Edit Team</h3>
    <label>Team ID</label><input id="m_teamCode" value="${escapeHtml(t.code)}" />
    <label>Team Name</label><input id="m_teamName" value="${escapeHtml(t.name)}" />
    <label>Active</label><select id="m_teamActive"><option value="1" ${t.active ? 'selected' : ''}>Active</option><option value="0" ${t.active ? '' : 'selected'}>Disabled</option></select>
    <label>New Password (leave blank to keep)</label><input id="m_teamPass" type="text" placeholder="••••••" />
    <div style="height:14px"></div>
    <button class="btn block" onclick="saveTeamEdit(${id})">Save</button>`);
}
async function saveTeamEdit(id) {
  await api('/admin/team/' + id, { method: 'PUT', body: {
    code: $('m_teamCode').value, name: $('m_teamName').value,
    active: $('m_teamActive').value === '1', password: $('m_teamPass').value || undefined } });
  closeModal(); toast('Team updated', 'ok'); refreshAll();
}

function openTeamDetail(id) {
  openModal(`<h3>Loading team…</h3><span class="small-muted">Fetching submissions, hints and activity.</span>`, true);
  api('/admin/team/' + id).then((d) => {
    const subs = d.submissions.map((s) => `
      <tr><td class="mono">#${s.id}</td><td class="mono">Q${s.question_id}</td><td>${escapeHtml(s.title)}</td>
      <td><span class="badge ${s.status === 'accepted' ? 'completed' : s.status === 'overridden' ? 'warn' : 'closed'}">${s.status}</span></td>
      <td>${s.score}</td><td>${s.passed}/${s.total}</td><td class="mono">${s.language}</td><td class="small-muted">${s.created_at}</td></tr>`).join('') ||
      '<tr><td colspan="8" class="small-muted">No submissions.</td></tr>';
    const hints = d.hints.map((h) => `<li class="small-muted">${escapeHtml(h.title)} — −${h.penalty} @ ${h.created_at}</li>`).join('') || '<li class="small-muted">None</li>';
    const act = d.activity.map((a) => `<li class="small-muted" ${a.flagged ? 'style="color:var(--red)"' : ''}>${escapeHtml(a.created_at)} — ${escapeHtml(a.type)}${a.flagged ? ' 🚩' : ''}: ${escapeHtml(a.detail)}</li>`).join('') || '<li class="small-muted">None</li>';
    openModal(`
      <div class="row"><h3>${escapeHtml(d.team.name)} <span class="small-muted">${escapeHtml(d.team.code)}</span></h3>
        <span class="right"><span class="badge warn">Rank #${d.rank.rank || '—'}</span>
        <span class="badge completed">Score ${d.summary.score}</span></span></div>
      <div class="cols-4 grid" style="margin:12px 0;">
        <div class="stat"><span class="label">Earned</span><span class="value small">${d.summary.earned}</span></div>
        <div class="stat"><span class="label">Penalty</span><span class="value small" style="color:var(--red)">−${d.summary.penalty}</span></div>
        <div class="stat"><span class="label">Solved</span><span class="value small">${d.summary.solvedCount}</span></div>
        <div class="stat"><span class="label">Hints Used</span><span class="value small">${d.summary.hintCount}</span></div>
      </div>
      <h4>Submissions</h4>
      <div style="max-height:260px;overflow:auto;">${subsTable(subs)}</div>
      <div class="grid cols-2">
        <div><h4>Hints</h4><ul>${hints}</ul></div>
        <div><h4>Activity</h4><ul>${act}</ul></div>
      </div>`, true);
  }).catch((e) => { openModal('<div class="err">' + esc(e.message) + '</div>'); });
}
function subsTable(rows) {
  return `<table class="table"><thead><tr><th>ID</th><th>Q</th><th>Title</th><th>Status</th><th>Score</th><th>Passed</th><th>Lang</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------------------------------------------------------------- questions
function loadQuestions() {
  $('qFilterBtn').innerHTML = [1, 2, 3].map((r) =>
    `<button class="tab ${r === questionRoundFilter ? 'active' : ''}" onclick="setQFilter(${r})">Round ${r}</button>`).join(' ');
  api('/admin/questions?round=' + questionRoundFilter).then((d) => {
    $('qList').innerHTML = d.questions.map((q) => `
      <div class="q-item">
        <div><div class="title">${q.is_bonus ? '⭐ ' : ''}${escapeHtml(q.title)}</div>
          <div class="small-muted">${escapeHtml(q.stage)}${q.section ? ' • ' + escapeHtml(q.section) : ''} • ${q.marks} marks • ${q.test_cases.length} test cases • ${q.active ? '' : '<span style=color:var(--red)>disabled</span>'}</div></div>
        <span class="row">
          <button class="btn ghost small" onclick="openQuestionForm(${q.id})">Edit</button>
          <button class="btn ghost small" onclick="duplicateQuestion(${q.id})">Copy</button>
          <button class="btn red small" onclick="delQuestion(${q.id})">Delete</button>
        </span>
      </div>`).join('') || '<div class="card small-muted">No questions in this round.</div>';
  }).catch((e) => toast(e.message, 'err'));
}
window.setQFilter = (r) => { questionRoundFilter = r; loadQuestions(); };

function openQuestionForm(id) {
  const promise = id
    ? api('/admin/questions').then((d) => d.questions.find((q) => q.id === id))
    : Promise.resolve(null);
  promise.then((q) => {
    currentQ = q || { test_cases: [], examples: [] };
    openModal(`
      <div class="row"><h3>${q ? 'Edit Question' : 'New Question'}</h3><span class="right small-muted">${q ? '#' + q.id : ''}</span></div>
      <div class="cols-3 grid">
        <div><label>Round</label><select id="f_round">
          <option value="1" ${currentQ.round === 1 ? 'selected' : ''}>Round 1 — Logic Quest</option>
          <option value="2" ${currentQ.round === 2 ? 'selected' : ''}>Round 2 — Code Arena</option>
          <option value="3" ${currentQ.round === 3 ? 'selected' : ''}>Round 3 — Debug Lab</option></select></div>
        <div><label>Type</label><select id="f_qtype">
          <option value="code" ${currentQ.qtype !== 'logic' ? 'selected' : ''}>Code / Program</option>
          <option value="logic" ${currentQ.qtype === 'logic' ? 'selected' : ''}>Logic / Text answer</option></select></div>
        <div><label>Language</label><select id="f_language">
          <option value="python" ${currentQ.language === 'python' ? 'selected' : ''}>Python</option>
          <option value="javascript" ${currentQ.language === 'javascript' ? 'selected' : ''}>JavaScript</option>
          <option value="java" ${currentQ.language === 'java' ? 'selected' : ''}>Java</option>
          <option value="c" ${currentQ.language === 'c' ? 'selected' : ''}>C (GCC)</option>
          <option value="cpp" ${currentQ.language === 'cpp' ? 'selected' : ''}>C++ (G++)</option></select></div>
        <div><label>Stage / Level</label><input id="f_stage" value="${escapeHtml(currentQ.stage || '')}" placeholder="e.g. The Gate / Code Arena / Broken Loop" /></div>
        <div><label>Section (Round 2)</label><input id="f_section" value="${escapeHtml(currentQ.section || '')}" placeholder="e.g. Predict / Fix It / Solve" /></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px">
          <div><label>Marks</label><input id="f_marks" type="number" value="${currentQ.marks || 0}" /></div>
          <div><label>Order</label><input id="f_order" type="number" value="${currentQ.order_index || 0}" /></div>
          <div style="display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:11px">
            <label style="margin:0" class="row"><input type="checkbox" id="f_bonus" style="width:auto" ${currentQ.is_bonus ? 'checked' : ''} /> Bonus</label>
            <label style="margin:0" class="row"><input type="checkbox" id="f_active" style="width:auto" ${currentQ.active === false ? '' : 'checked'} /> Active</label></div>
        </div>
      </div>
      <label>Title</label><input id="f_title" value="${escapeHtml(currentQ.title || '')}" required />
      <label>Problem Statement</label><textarea id="f_statement">${escapeHtml(currentQ.statement || '')}</textarea>
      <div class="cols-3 grid">
        <div><label>Input Description</label><textarea id="f_input">${escapeHtml(currentQ.input_desc || '')}</textarea></div>
        <div><label>Output Description</label><textarea id="f_output">${escapeHtml(currentQ.output_desc || '')}</textarea></div>
        <div><label>Constraints</label><textarea id="f_constraints">${escapeHtml(currentQ.constraints || '')}</textarea></div>
      </div>
      <label>Starter Code (shown in editor)</label><textarea id="f_starter" style="min-height:120px;font-family:monospace">${escapeHtml(currentQ.starter_code || '')}</textarea>
      <hr class="hr" />
      <div class="cols-2 grid">
        <div>
          <h4>Examples (shown to teams)</h4>
          <div id="f_examples"></div>
          <button class="btn ghost small" onclick="addExRow()">＋ Example</button>
        </div>
        <div>
          <h4>Test Cases <span class="small-muted">(checked automatically, sample = visible)</span></h4>
          <div id="f_testcases"></div>
          <button class="btn ghost small" onclick="addTcRow()">＋ Test Case</button>
        </div>
      </div>
      <hr class="hr" />
      <div class="cols-2 grid">
        <div><label>Hint Text (optional)</label><textarea id="f_hint">${escapeHtml(currentQ.hint || '')}</textarea></div>
        <div><label>Hint Penalty (marks)</label><input id="f_hint_penalty" type="number" value="${currentQ.hint_penalty || 0}" /></div>
      </div>
      <div style="height:14px"></div>
      <div class="row">
        <button class="btn" onclick="saveQuestion(${id || 'null'})">${id ? 'Save Changes' : 'Create Question'}</button>
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
      </div>`, true);
    const exs = currentQ.examples || [];
    exs.forEach((ex, i) => addExRow(ex[0] || '', ex[1] || ''));
    if (!exs.length) addExRow();
    const tcs = currentQ.test_cases || [];
    tcs.forEach((tc) => addTcRow(tc));
    if (!tcs.length) addTcRow();
  });
}

function addExRow(input, output) {
  const div = document.createElement('div');
  div.className = 'row';
  div.style.cssText = 'margin-bottom:6px;';
  div.innerHTML = `<input placeholder="Input" value="${escapeHtml(input || '')}" style="flex:1" />
    <span class="small-muted">→</span>
    <input placeholder="Output" value="${escapeHtml(output || '')}" style="flex:1" />
    <button class="btn red small" onclick="this.parentElement.remove()">✕</button>`;
  $('f_examples').appendChild(div);
}

function addTcRow(tc) {
  const div = document.createElement('div');
  div.className = 'card tight';
  div.style.cssText = 'margin-bottom:8px; color:#fff;';
  div.innerHTML = `
    <div class="row"><span class="small-muted">Sample (visible to teams)</span>
      <input type="checkbox" ${tc && tc.is_sample ? 'checked' : ''} style="width:auto" class="tc_sample" />
      <button class="btn red small right" onclick="this.parentElement.parentElement.remove()">✕</button></div>
    <div class="cols-2 grid">
      <div><label style="margin:4px 0 2px">Input</label><textarea class="tc_input" style="min-height:50px">${escapeHtml((tc && tc.input) || '')}</textarea></div>
      <div><label style="margin:4px 0 2px">Expected Output</label><textarea class="tc_output" style="min-height:50px">${escapeHtml((tc && tc.expected_output) || '')}</textarea></div>
    </div>`;
  $('f_testcases').appendChild(div);
}

function collectExamples() {
  return [...$('f_examples').querySelectorAll('.row')].map((r) => {
    const inputs = r.querySelectorAll('input[type=text], input:not([type])');
    const vals = [...r.querySelectorAll('input')].filter((i) => i.type === 'text' || !i.type);
    return { input: vals[0].value, output: vals[1].value };
  }).filter((e) => e.input || e.output);
}

function collectTestCases() {
  return [...$('f_testcases').querySelectorAll('.card')].map((row) => ({
    input: row.querySelector('.tc_input').value,
    expected_output: row.querySelector('.tc_output').value,
    is_sample: row.querySelector('.tc_sample').checked,
  }));
}

async function saveQuestion(id) {
  const examples = collectExamples().map((e) => [e.input, e.output]);
  const body = {
    round: Number($('f_round').value),
    qtype: $('f_qtype').value,
    language: $('f_language').value,
    stage: $('f_stage').value,
    section: $('f_section').value || null,
    title: $('f_title').value,
    statement: $('f_statement').value,
    input_desc: $('f_input').value,
    output_desc: $('f_output').value,
    constraints: $('f_constraints').value,
    starter_code: $('f_starter').value,
    marks: Number($('f_marks').value) || 0,
    order_index: Number($('f_order').value) || 0,
    is_bonus: $('f_bonus').checked,
    active: $('f_active').checked,
    hint: $('f_hint').value || null,
    hint_penalty: Number($('f_hint_penalty').value) || 0,
    examples,
    test_cases: collectTestCases(),
  };
  try {
    await api('/admin/question' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
    closeModal(); toast(id ? 'Question updated' : 'Question created', 'ok'); loadQuestions();
  } catch (e) { toast(e.message, 'err'); }
}

async function duplicateQuestion(id) {
  const d = await api('/admin/questions');
  const q = d.questions.find((x) => x.id === id);
  if (!q) return;
  const body = { ...q, title: q.title + ' (copy)', test_cases: q.test_cases, examples: q.examples, is_bonus: q.is_bonus, active: true };
  delete body.id; delete body.created_at;
  await api('/admin/question', { method: 'POST', body });
  toast('Duplicated', 'ok'); loadQuestions();
}
async function delQuestion(id) {
  if (!confirm('Delete this question and all its test cases/submissions?')) return;
  await api('/admin/question/' + id, { method: 'DELETE' });
  toast('Deleted', 'ok'); loadQuestions();
}

// ---------------------------------------------------------------- leaderboard
function renderLb(lb) {
  $('lbBody').innerHTML = lb.leaderboard.map((r) => `
    <tr class="rank-${r.rank}"><td>${r.rank}</td><td><b>${escapeHtml(r.name)}</b></td>
    <td><b>${r.score}</b></td><td>${r.solved}</td>
    <td>${(r.roundEarned && r.roundEarned[1]) || 0}</td>
    <td>${(r.roundEarned && r.roundEarned[2]) || 0}</td>
    <td>${(r.roundEarned && r.roundEarned[3]) || 0}</td></tr>`).join('');
  if (!tableAnimDone.lb) { makeTableAnim($('lbBody')); tableAnimDone.lb = true; }
  $('lbHint').textContent = (lb.frozen ? 'FROZEN — ' : '') + 'scores auto-update on submissions';
}
async function toggleFreeze() {
  const cur = state ? state.frozen : false;
  await api('/admin/config', { method: 'POST', body: { frozen: !cur } });
  toast('Freeze set to ' + (!cur ? 'ON' : 'OFF'), 'ok'); refreshAll();
}
async function togglePublish() {
  const cur = state ? state.resultsPublished : false;
  await api('/admin/config', { method: 'POST', body: { resultsPublished: !cur } });
  toast('Results published = ' + (!cur ? 'YES' : 'NO'), 'ok');
  if (!cur) { fireConfetti(160); setTimeout(fireConfetti, 900, 120); }
  refreshAll();
}

// ---------------------------------------------------------------- activity
async function loadActivity() {
  try {
    const d = await api('/admin/activity');
    $('actBody').innerHTML = d.activity.map((a) => `
      <tr>
        <td class="small-muted">${escapeHtml(a.created_at)}</td>
        <td>${escapeHtml(a.team_code || '—')}</td>
        <td><span class="pill ${a.flagged ? 'attempted' : 'todo'}">${escapeHtml(a.type)}</span></td>
        <td class="small-muted">${escapeHtml(a.detail)}</td>
        <td><button class="btn ghost small" onclick="flagAct(${a.id}, ${a.flagged ? 1 : 0})">${a.flagged ? '🚩 Unflag' : 'Flag'}</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="small-muted">No activity yet.</td></tr>';
  } catch (e) { /* ignore */ }
}
async function flagAct(id, cur) {
  await api('/admin/activity/' + id + '/flag', { method: 'POST' });
  loadActivity();
}

// ---------------------------------------------------------------- settings
async function loadConfig() {
  try {
    const d = await api('/admin/config');
    state = d.state;
    renderState(d.state);
    $('setStatus').value = d.config.status;
    $('setMessage').value = d.config.message || '';
    const s = d.config.schedule || {};
    const keys = [['round1', 'Round 1 (start)', 'start'], ['round1', 'Round 1 (end)', 'end'],
      ['lunch', 'Lunch Lock (start)', 'start'], ['lunch', 'Lunch Lock (end)', 'end'],
      ['round2', 'Round 2 (start)', 'start'], ['round2', 'Round 2 (end)', 'end'],
      ['round3', 'Round 3 (start)', 'start'], ['round3', 'Round 3 (end)', 'end']];
    $('scheduleForm').innerHTML = keys.map(([k, label, which]) =>
      `<label>${label}</label><input type="datetime-local" id="sch_${k}_${which}" value="${toLocalInput(s[k][which])}" />`).join('');
    if (!window.__clockInt) window.__clockInt = setInterval(() => { $('serverClock').textContent = new Date().toLocaleTimeString(); }, 1000);
  } catch (e) { /* ignore */ }
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function saveConfig() {
  await api('/admin/config', { method: 'POST', body: { status: $('setStatus').value, message: $('setMessage').value } });
  toast('Saved', 'ok'); refreshAll(); loadConfig();
}

async function saveSchedule() {
  const s = {};
  for (const k of ['round1', 'lunch', 'round2', 'round3']) {
    s[k] = {
      start: new Date($('sch_' + k + '_start').value).toISOString(),
      end: new Date($('sch_' + k + '_end').value).toISOString(),
    };
  }
  await api('/admin/config', { method: 'POST', body: { schedule: s } });
  toast('Schedule saved', 'ok'); refreshAll();
}

function resetDb() {
  alert('To fully reset: stop the server, run "npm run reset", then start again with "npm start".');
}

// ---------------------------------------------------------------- modal helpers
function openModal(html, wide) {
  $('modalHost').innerHTML = `<div class="modal-bg" onclick="if(event.target===this) closeModal()">
    <div class="card modal ${wide ? '' : ''}">${html}</div></div>`;
}
function closeModal() { $('modalHost').innerHTML = ''; }
window.closeModal = closeModal;

boot();