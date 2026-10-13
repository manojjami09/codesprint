'use strict';

const express = require('express');
const { db, logActivity } = require('../db');
const { requireTeam } = require('../middleware');
const timer = require('../services/timer');
const scoring = require('../services/scoring');
const realtime = require('../services/realtime');
const executor = require('../services/executor');

const router = express.Router();
router.use(requireTeam);

const JOURNEY = [
  { key: 'gate',   label: 'The Gate',   icon: '🔐', round: 1, stages: ['The Gate'] },
  { key: 'maze',   label: 'The Maze',   icon: '🌀', round: 1, stages: ['The Maze'] },
  { key: 'cipher', label: 'The Cipher', icon: '🔮', round: 1, stages: ['The Cipher'] },
  { key: 'lunch',  label: 'Lunch Lock', icon: '🍽️', round: 0, special: 'lunch' },
  { key: 'arena',  label: 'Code Arena', icon: '⚔️', round: 2, stages: ['Code Arena'] },
  { key: 'debug',  label: 'Debug Lab',  icon: '🐛', round: 3, stages: ['Broken Loop', 'Hidden Bug'] },
  { key: 'boss',   label: 'Final Boss', icon: '👾', round: 3, stages: ['Final Boss'] },
];

function parseExamples(s) { try { return JSON.parse(s); } catch { return []; } }
function parseJSON(s, d) { try { return JSON.parse(s); } catch { return d; } }

function solvedSet(teamId) {
  const rows = db.prepare(`
    SELECT question_id FROM submissions
    WHERE team_id = ? AND mode = 'submit' AND score > 0
    GROUP BY question_id`).all(teamId);
  return new Set(rows.map((r) => r.question_id));
}

function buildJourney(teamId, state) {
  const solved = solvedSet(teamId);
  const allQ = db.prepare('SELECT id, round, stage FROM questions WHERE active = 1').all();
  const items = [];
  let prevActiveRound1 = true;

  for (const j of JOURNEY) {
    if (j.special === 'lunch') {
      let status = 'locked';
      if (state.phase === 'lunch') status = 'active';
      else if (['round2', 'round3', 'finished'].includes(state.phase)) status = 'completed';
      else if (state.rounds[1] === 'active') status = 'locked';
      items.push({ key: j.key, label: j.label, icon: j.icon, status, kind: 'lunch' });
      continue;
    }
    const qs = allQ.filter((q) => q.round === j.round && j.stages.includes(q.stage));
    const total = qs.length;
    const done = qs.filter((q) => solved.has(q.id)).length;
    let status;
    const rstat = state.rounds[j.round];
    if (total > 0 && done === total) status = 'completed';
    else if (rstat === 'active') {
      if (j.round === 1) {
        status = prevActiveRound1 ? 'active' : 'locked';
        if (status === 'completed') status = 'active';
        prevActiveRound1 = done === total;
      } else {
        status = 'active';
      }
    } else status = 'locked';
    items.push({ key: j.key, label: j.label, icon: j.icon, status, done, total, round: j.round });
  }
  return items;
}

router.get('/me', (req, res) => {
  const team = db.prepare('SELECT id, code, name FROM teams WHERE id = ?').get(req.session.teamId);
  const state = timer.getState();
  const summary = scoring.teamSummary(team.id);
  const rank = scoring.teamRank(team.id);
  res.json({
    ok: true,
    team,
    state,
    score: summary.score,
    earned: summary.earned,
    penalty: summary.penalty,
    solvedCount: summary.solvedCount,
    totalMarks: summary.totalMarks,
    rank: rank.rank,
    totalTeams: rank.total,
    roundEarned: summary.roundEarned,
    roundTotal: summary.roundTotal,
    journey: buildJourney(team.id, state),
  });
});

router.get('/round/:round', (req, res) => {
  const round = Number(req.params.round);
  const state = timer.getState();
  const solved = solvedSet(req.session.teamId);
  const best = db.prepare(`
    SELECT question_id, MAX(score) AS best FROM submissions
    WHERE team_id = ? AND mode = 'submit' GROUP BY question_id`).all(req.session.teamId);
  const bestMap = new Map(best.map((b) => [b.question_id, b.best]));

  const qs = db.prepare(
    `SELECT id, round, stage, section, qtype, title, marks, is_bonus, order_index
     FROM questions WHERE active = 1 AND round = ? ORDER BY is_bonus, order_index, id`).all(round);

  const groups = {};
  for (const q of qs) {
    const g = q.section || q.stage;
    if (!groups[g]) groups[g] = [];
    groups[g].push({
      id: q.id, title: q.title, marks: q.marks, qtype: q.qtype, is_bonus: !!q.is_bonus,
      solved: solved.has(q.id), best: bestMap.get(q.id) || 0,
    });
  }
  res.json({ ok: true, round, roundStatus: state.rounds[round] || 'locked', groups });
});

router.get('/question/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND active = 1').get(Number(req.params.id));
  if (!q) return res.status(404).json({ ok: false, error: 'Question not found' });
  const state = timer.getState();
  const rstat = state.rounds[q.round];
  if (rstat === 'locked') {
    return res.status(403).json({ ok: false, error: 'This round is locked', roundStatus: rstat });
  }
  const samples = db.prepare(
    'SELECT input, expected_output, is_sample FROM test_cases WHERE question_id = ? AND is_sample = 1 ORDER BY order_index').all(q.id);
  const totalCases = db.prepare('SELECT COUNT(*) AS n FROM test_cases WHERE question_id = ?').get(q.id).n;
  const hintUsed = !!db.prepare('SELECT 1 FROM hint_usage WHERE team_id = ? AND question_id = ?').get(req.session.teamId, q.id);
  const best = db.prepare(`SELECT MAX(score) AS s, COUNT(*) AS n FROM submissions WHERE team_id = ? AND question_id = ? AND mode = 'submit'`).get(req.session.teamId, q.id);

  const allInRound = db.prepare(
    `SELECT id FROM questions WHERE active = 1 AND round = ? ORDER BY is_bonus, order_index, id`
  ).all(q.round).map((x) => x.id);
  const curIdx = allInRound.indexOf(q.id);
  const prevId = curIdx > 0 ? allInRound[curIdx - 1] : null;
  const nextId = (curIdx >= 0 && curIdx < allInRound.length - 1) ? allInRound[curIdx + 1] : null;

  res.json({
    ok: true,
    roundStatus: rstat,
    acceptsSubmissions: timer.roundAcceptsSubmissions(q.round),
    prevId,
    nextId,
    question: {
      id: q.id, round: q.round, stage: q.stage, section: q.section, qtype: q.qtype,
      title: q.title, statement: q.statement, input_desc: q.input_desc, output_desc: q.output_desc,
      constraints: q.constraints, examples: parseExamples(q.examples), marks: q.marks,
      hint: hintUsed ? q.hint : null, hintAvailable: !!q.hint, hintPenalty: q.hint_penalty,
      hintUsed, starter_code: q.starter_code, language: q.language,
      is_bonus: !!q.is_bonus, time_limit_ms: q.time_limit_ms,
    },
    samples,
    totalCases,
    bestScore: best.s || 0,
    attempts: best.n || 0,
    languages: executor.availableLanguages(),
  });
});

router.post('/hint', (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND active = 1').get(Number((req.body || {}).questionId));
  if (!q || !q.hint) return res.status(404).json({ ok: false, error: 'No hint available' });
  const existing = db.prepare('SELECT 1 FROM hint_usage WHERE team_id = ? AND question_id = ?').get(req.session.teamId, q.id);
  if (!existing) {
    db.prepare('INSERT INTO hint_usage (team_id, question_id, penalty) VALUES (?, ?, ?)')
      .run(req.session.teamId, q.id, q.hint_penalty);
    logActivity(req.session.teamId, 'hint', `Used hint on Q${q.id} (-${q.hint_penalty})`);
    realtime.broadcastLeaderboard();
  }
  res.json({ ok: true, hint: q.hint, penalty: q.hint_penalty });
});

router.post('/run', (req, res) => {
  const { questionId, code, language, input } = req.body || {};
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND active = 1').get(Number(questionId));
  if (!q) return res.status(404).json({ ok: false, error: 'Question not found' });
  const state = timer.getState();
  if (state.rounds[q.round] === 'locked') return res.status(403).json({ ok: false, error: 'Round locked' });

  let stdin = input;
  if (stdin === undefined || stdin === null || stdin === '') {
    const s = db.prepare('SELECT input FROM test_cases WHERE question_id = ? ORDER BY is_sample DESC, order_index LIMIT 1').get(q.id);
    stdin = s ? s.input : '';
  }
  if (q.qtype === 'logic' || language === 'text') {
    return res.json({ ok: true, input: stdin || '', status: 'ok', stdout: code || '', stderr: '', timeMs: 0 });
  }
  const result = executor.runQuick({ code: code || '', language: language || q.language, input: stdin, timeLimitMs: q.time_limit_ms });
  res.json({ ok: true, input: stdin, ...result });
});

router.post('/submit', (req, res) => {
  const { questionId, code, language } = req.body || {};
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND active = 1').get(Number(questionId));
  if (!q) return res.status(404).json({ ok: false, error: 'Question not found' });

  if (!timer.roundAcceptsSubmissions(q.round)) {
    return res.status(403).json({ ok: false, error: 'Submissions are closed for this round' });
  }

  const cases = db.prepare('SELECT input, expected_output, is_sample FROM test_cases WHERE question_id = ? ORDER BY order_index').all(q.id);
  if (cases.length === 0) return res.status(400).json({ ok: false, error: 'This question has no test cases configured yet' });

  let result;
  if (q.qtype === 'logic' || language === 'text') {
    const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();
    const given = norm(code);
    let passed = 0;
    const outCases = cases.map((c, i) => {
      // Multiple acceptable answers: each non-empty line of expected_output.
      const accepted = String(c.expected_output || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const ok = accepted.length === 0 ? norm(c.expected_output) === given : accepted.includes(given);
      if (ok) passed++;
      return { index: i, is_sample: !!c.is_sample, status: 'ok', passed: ok, expected: c.is_sample ? accepted.join(' | ') : undefined };
    });
    result = { status: passed === cases.length ? 'accepted' : 'wrong', cases: outCases, passed, total: cases.length };
  } else {
    result = executor.evaluate({ code: code || '', language: language || q.language, testCases: cases, timeLimitMs: q.time_limit_ms });
  }

  const score = scoring.scoreForSubmission(q.marks, result.passed, result.total);
  const info = db.prepare(`
    INSERT INTO submissions (team_id, question_id, code, language, mode, status, score, passed, total, results_json)
    VALUES (?, ?, ?, ?, 'submit', ?, ?, ?, ?, ?)`)
    .run(req.session.teamId, q.id, code || '', language || q.language, result.status, score, result.passed, result.total, JSON.stringify(result.cases || []));

  // Simple suspicious-activity heuristic: very rapid submissions.
  const recent = db.prepare(
    "SELECT COUNT(*) AS n FROM submissions WHERE team_id = ? AND created_at >= datetime('now','-60 seconds')").get(req.session.teamId).n;
  if (recent >= 12) {
    logActivity(req.session.teamId, 'suspicious', `${recent} submissions within 60s`, 1);
  }
  logActivity(req.session.teamId, 'submit', `Q${q.id} ${result.status} ${result.passed}/${result.total} (+${score})`);

  realtime.broadcastLeaderboard();
  res.json({ ok: true, submissionId: info.lastInsertRowid, status: result.status, score, passed: result.passed, total: result.total, cases: result.cases });
});

router.get('/submissions', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.question_id, q.title, s.status, s.score, s.passed, s.total, s.language, s.created_at
    FROM submissions s JOIN questions q ON q.id = s.question_id
    WHERE s.team_id = ? ORDER BY s.id DESC LIMIT 50`).all(req.session.teamId);
  res.json({ ok: true, submissions: rows });
});

module.exports = router;
