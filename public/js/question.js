'use strict';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let current = null;
let editor = null;

const LANG_MAP = { python: 'python', javascript: 'javascript', java: 'java', c: 'c', cpp: 'cpp', text: 'plaintext' };

// -------------------------------------------------------------- editor
function textareaEditor(host, value) {
  host.innerHTML = '';
  const ta = document.createElement('textarea');
  ta.className = 'editor-fallback';
  ta.value = value || '';
  ta.spellcheck = false;
  host.appendChild(ta);
  return {
    kind: 'textarea',
    getValue: () => ta.value,
    setValue: (v) => { ta.value = v; },
    setLang: () => {},
  };
}

function initEditor(host, value, lang) {
  return new Promise((resolve) => {
    if (typeof require === 'undefined' || typeof window.monaco === 'undefined' && !require) {
      return resolve(textareaEditor(host, value));
    }
    let done = false;
    const useFallback = () => { if (!done) { done = true; resolve(textareaEditor(host, value)); } };
    const timer = setTimeout(useFallback, 4000);
    try {
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
      require(['vs/editor/editor.main'], function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        const ed = window.monaco.editor.create(host, {
          value: value || '', language: LANG_MAP[lang] || 'python',
          theme: (window.getTheme && window.getTheme() === 'light') ? 'vs' : 'vs-dark',
          automaticLayout: true, fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false,
        });
        resolve({
          kind: 'monaco',
          getValue: () => ed.getValue(),
          setValue: (v) => ed.setValue(v || ''),
          setLang: (l) => window.monaco.editor.setModelLanguage(ed.getModel(), LANG_MAP[l] || 'python'),
        });
      }, useFallback);
    } catch { useFallback(); }
  });
}

// -------------------------------------------------------------- list view
async function showList(round) {
  $('detailView').classList.add('hidden');
  $('listView').classList.remove('hidden');
  const labels = { 1: 'Round 1 — Logic Quest', 2: 'Round 2 — Code Arena', 3: 'Round 3 — Debug Lab' };
  $('listTitle').textContent = labels[round] || 'Questions';
  let data;
  try { data = await api('/team/round/' + round); }
  catch (e) { $('groups').innerHTML = `<div class="card">${escapeHtml(e.message)}</div>`; return; }

  $('listRoundStatus').className = 'badge ' + data.roundStatus;
  $('listRoundStatus').textContent = data.roundStatus.toUpperCase();

  const names = Object.keys(data.groups);
  if (!names.length) { $('groups').innerHTML = '<div class="card">No questions in this round yet.</div>'; return; }

  $('groups').innerHTML = names.map((g) => `
    <div class="card" style="margin-bottom:16px;">
      <div class="row"><h3>${escapeHtml(g)}</h3>
        <span class="right small-muted">${data.groups[g].length} question(s)</span></div>
      ${data.groups[g].map((q) => `
        <div class="q-item" onclick="openQuestion(${q.id})">
          <div><div class="title">${q.is_bonus ? '⭐ ' : ''}${escapeHtml(q.title)}</div>
            <div class="small-muted">${q.marks} marks${q.best ? ' • best ' + q.best : ''}</div></div>
          <span class="pill ${q.solved ? 'solved' : (q.best ? 'attempted' : 'todo')}">
            ${q.solved ? 'Solved' : (q.best ? 'Attempted' : 'Not started')}</span>
        </div>`).join('')}
    </div>`).join('');
  $('groups').classList.add('stagger');
}

// -------------------------------------------------------------- detail view
async function openQuestion(id) {
  $('listView').classList.add('hidden');
  $('detailView').classList.remove('hidden');
  let data;
  try { data = await api('/team/question/' + id); }
  catch (e) { toast(e.message, 'err'); showList(params.get('round') || 1); return; }
  current = data;
  const q = data.question;

  $('qTitle').textContent = (q.is_bonus ? '⭐ ' : '') + q.title;
  $('qMeta').innerHTML = `<span>Round ${q.round}</span> • <span>${escapeHtml(q.stage || '')}</span>` +
    (q.section ? ` • <span>${escapeHtml(q.section)}</span>` : '') + ` • <span>${q.marks} marks</span>`;
  $('detailBadges').innerHTML = statusBadge(data.roundStatus) +
    (data.acceptsSubmissions ? '' : ' <span class="badge closed">Submissions Closed</span>');
  $('qStatement').textContent = q.statement || '—';
  $('qInput').textContent = q.input_desc || '—';
  $('qOutput').textContent = q.output_desc || '—';
  $('qConstraints').textContent = q.constraints || '—';
  $('qExamples').innerHTML = (q.examples && q.examples.length)
    ? q.examples.map((ex) => `<div class="problem-box" style="margin:6px 0"><b>Input:</b><pre class="out" style="margin:6px 0">${escapeHtml(ex[0])}</pre><b>Output:</b><pre class="out" style="margin:6px 0">${escapeHtml(ex[1])}</pre></div>`).join('')
    : '<span class="small-muted">No examples provided.</span>';

  $('bestInfo').textContent = `Best: ${data.bestScore} / ${q.marks} • ${data.attempts} attempt(s)`;

  // language select
  const langs = data.languages || {};
  const opts = Object.entries(langs).map(([k, v]) =>
    `<option value="${k}" ${v.available ? '' : 'disabled'}>${escapeHtml(v.label)}${v.available ? '' : ' (unavailable)'}</option>`).join('');
  $('language').innerHTML = (q.qtype === 'logic' ? '<option value="text">Text Answer</option>' : '') + opts;
  $('language').value = q.qtype === 'logic' ? 'text' : q.language;

  // hint
  renderHint(q, data);

  // detect MCQ
  const stmt = q.statement || '';
  const hasOptionsBlock = /Options:\s*\n/i.test(stmt) || /\([A-Da-d]\)\s/.test(stmt);
  const isMcq = (q.qtype === 'mcq') || (q.qtype === 'logic' && hasOptionsBlock);

  // editor vs mcq
  const host = $('editorHost');
  const mcqHost = $('mcqHost');
  if (isMcq) {
    host.innerHTML = '';
    if (mcqHost) { mcqHost.innerHTML = ''; mcqHost.style.display = 'flex'; mcqHost.classList.remove('hidden'); }
    const mcqOpts = [];
    const re = /\b([A-Da-d])\)\s+([^\n\r]+?)(?=\s*\b[A-Da-d]\)|$)/g;
    let m; const full = stmt;
    while ((m = re.exec(full))) { mcqOpts.push({ letter: m[1].toUpperCase(), text: m[2].trim() }); }
    let mcqAns = '';
    mcqHost.innerHTML = mcqOpts.map((o) => `
      <label class="card" style="padding:12px 14px;cursor:pointer;display:flex;gap:12px;align-items:center">
        <input type="radio" name="mcq" value="${escapeHtml(o.letter)}" style="transform:scale(1.2)">
        <div style="font-weight:800">${o.letter})</div>
        <div>${escapeHtml(o.text)}</div>
      </label>`).join('');
    mcqHost.querySelectorAll('input[name="mcq"]').forEach((r) => r.addEventListener('change', (e) => { mcqAns = e.target.value; }));
    if (window.__mcqSubmit) { $('submitBtn').removeEventListener('click', window.__mcqSubmit); }
    window.__mcqSubmit = async (ev) => {
      ev.preventDefault();
      if (!current) return;
      if (!mcqAns) { toast('Please select an option', 'err'); return; }
      if (!confirm('Submit this answer?')) return;
      $('resultArea').innerHTML = '<span class="small-muted">Submitting...</span>';
      try {
        const r = await api('/team/submit', { method: 'POST', body: { questionId: current.question.id, code: mcqAns, language: 'text' } });
        renderSubmit(r);
      } catch (e) { $('resultArea').innerHTML = `<span style="color:var(--red)">${escapeHtml(e.message)}</span>`; }
    };
    $('submitBtn').addEventListener('click', window.__mcqSubmit);
  } else {
    if (mcqHost) { mcqHost.innerHTML = ''; mcqHost.style.display = 'none'; mcqHost.classList.add('hidden'); }
    if (window.__mcqSubmit) { $('submitBtn').removeEventListener('click', window.__mcqSubmit); window.__mcqSubmit = null; }
    editor = await initEditor(host, q.starter_code || '', $('language').value);
  }

  $('language').onchange = () => { if (editor && editor.setLang) editor.setLang($('language').value); };

  const isLogic = q.qtype === 'logic' && !isMcq;
  $('runBtn').style.display = (isMcq || isLogic) ? 'none' : '';
  $('stdinLabel').style.display = (isMcq || isLogic) ? 'none' : '';
  $('stdin').style.display = (isMcq || isLogic) ? 'none' : '';

  $('resultArea').innerHTML = '';
  $('stdin').value = (data.samples && data.samples[0]) ? data.samples[0].input : '';
}

function renderHint(q, data) {
  const area = $('hintArea');
  if (!q.hintAvailable) { area.innerHTML = ''; if ($('hintBtn')) $('hintBtn').style.display = 'none'; return; }
  if ($('hintBtn')) $('hintBtn').style.display = '';
  if (q.hintUsed && q.hint) {
    area.innerHTML = `<div class="problem-box" style="border-color:var(--amber)"><h4>💡 Hint</h4><div class="problem">${escapeHtml(q.hint)}</div></div>`;
  } else {
    area.innerHTML = '';
  }
}

// -------------------------------------------------------------- actions
$('runBtn').addEventListener('click', async () => {
  if (!current) return;
  const code = editor.getValue();
  $('resultArea').innerHTML = '<span class="small-muted">Running…</span>';
  try {
    const r = await api('/team/run', { method: 'POST', body: {
      questionId: current.question.id, code, language: $('language').value, input: $('stdin').value } });
    renderRun(r);
  } catch (e) { $('resultArea').innerHTML = `<span style="color:var(--red)">${escapeHtml(e.message)}</span>`; }
});

$('submitBtn').addEventListener('click', async () => {
  if (!current) return;
  if (!confirm('Submit this solution for evaluation?')) return;
  const code = editor.getValue();
  $('resultArea').innerHTML = '<span class="small-muted">Submitting and evaluating all test cases…</span>';
  try {
    const r = await api('/team/submit', { method: 'POST', body: {
      questionId: current.question.id, code, language: $('language').value } });
    renderSubmit(r);
  } catch (e) { $('resultArea').innerHTML = `<span style="color:var(--red)">${escapeHtml(e.message)}</span>`; }
});

$('hintBtn').addEventListener('click', async () => {
  if (!current) return;
  const q = current.question;
  if (q.hintUsed) return;
  if (!confirm('Using this hint will reduce your score by ' + q.hintPenalty + ' marks. Continue?')) return;
  try {
    const r = await api('/team/hint', { method: 'POST', body: { questionId: q.id } });
    q.hintUsed = true; q.hint = r.hint;
    renderHint(q, current);
    toast('Hint revealed. −' + r.penalty + ' marks applied.', 'ok');
  } catch (e) { toast(e.message, 'err'); }
});

$('backList').addEventListener('click', () => {
  const r = current ? current.question.round : (params.get('round') || 1);
  history.replaceState(null, '', '/question.html?round=' + r);
  showList(r);
});

function statusColor(s) {
  return { accepted: 'var(--green)', wrong: 'var(--red)', compile_error: 'var(--red)',
    runtime_error: 'var(--amber)', timeout: 'var(--amber)', ok: 'var(--green)' }[s] || 'var(--muted)';
}

function renderRun(r) {
  $('resultArea').innerHTML = `
    <h4>Run Result <span class="pill" style="background:rgba(56,225,255,.15);color:${statusColor(r.status)}">${escapeHtml(r.status)}</span>
      <span class="small-muted" style="float:right">${r.timeMs != null ? r.timeMs + ' ms' : ''}</span></h4>
    <div class="small-muted">Input:</div><pre class="out">${escapeHtml(r.input || '(none)')}</pre>
    <div class="small-muted">Output:</div><pre class="out">${escapeHtml(r.stdout || '')}</pre>
    ${r.stderr ? `<div class="small-muted">stderr:</div><pre class="out" style="color:var(--red)">${escapeHtml(r.stderr)}</pre>` : ''}`;
}

function renderSubmit(r) {
  const caseHtml = (r.cases || []).map((c, i) => {
    if (c.input !== undefined) {
      return `<div class="result-case ${c.passed ? 'pass' : 'fail'}">
        <b>${c.passed ? '✔ PASS' : '✘ FAIL'}</b> <span class="small-muted">Sample ${i + 1}</span>
        <div style="flex:1"></div><span class="small-muted">${escapeHtml(c.status)}</span></div>
        <div class="small-muted" style="font-size:12px">Input: <code>${escapeHtml(c.input)}</code> • Expected: <code>${escapeHtml(c.expected)}</code> • Got: <code>${escapeHtml(c.actual || '')}</code></div>`;
    }
    return `<span class="pill ${c.passed ? 'solved' : 'todo'}" style="margin-right:6px">Case ${i + 1} ${c.passed ? '✔' : '✘'}</span>`;
  }).join('');
  $('resultArea').innerHTML = `
    <h4>Submission Result <span class="pill verdict-anim" style="background:rgba(56,225,255,.15);color:${statusColor(r.status)}">${escapeHtml(r.status)}</span></h4>
    <div class="row" style="margin:8px 0">
      <span class="badge completed">Test cases passed: ${r.passed}/${r.total}</span>
      <span class="badge warn">Score obtained: ${r.score}</span>
    </div>
    ${caseHtml}`;
  toast('Submitted: ' + r.status + ' (' + r.passed + '/' + r.total + ') • +' + r.score, r.passed === r.total ? 'ok' : 'err');
  if (r.passed === r.total) fireConfetti(130);
  if (current) { current.bestScore = Math.max(current.bestScore, r.score); $('bestInfo').textContent = `Best: ${current.bestScore} / ${current.question.marks} • attempt(s) recorded`; }
}

window.openQuestion = openQuestion;

document.addEventListener('themechange', (e) => {
  if (window.monaco && window.monaco.editor) {
    try { window.monaco.editor.setTheme(e.detail.theme === 'light' ? 'vs' : 'vs-dark'); } catch { /* ignore */ }
  }
});

// -------------------------------------------------------------- boot
(async function boot() {
  const id = params.get('id');
  if (id) { await openQuestion(Number(id)); }
  else { await showList(Number(params.get('round') || 1)); }
})();
