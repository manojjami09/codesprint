'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logActivity } = require('../db');
const { requireAdmin } = require('../middleware');
const timer = require('../services/timer');
const scoring = require('../services/scoring');
const realtime = require('../services/realtime');

const router = express.Router();
router.use(requireAdmin);

function parseJSON(s, d) { try { return JSON.parse(s); } catch { return d; } }

function serializeQuestion(q) {
  return { ...q, examples: parseJSON(q.examples, []), is_bonus: !!q.is_bonus, active: !!q.active };
}

// ------------------------------------------------------------------ overview
router.get('/overview', (req, res) => {
  const state = timer.getState();
  const teams = db.prepare('SELECT id, code, name, active FROM teams ORDER BY code').all();
  const board = scoring.getLeaderboard();
  const rankMap = new Map(board.map((r) => [r.teamId, r]));
  const rows = teams.map((t) => {
    const s = scoring.teamSummary(t.id);
    const r = rankMap.get(t.id) || {};
    const last = db.prepare('SELECT created_at FROM submissions WHERE team_id = ? ORDER BY id DESC LIMIT 1').get(t.id);
    const subCount = db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE team_id = ?').get(t.id).n;
    const hints = db.prepare('SELECT COUNT(*) AS n FROM hint_usage WHERE team_id = ?').get(t.id).n;
    const flags = db.prepare('SELECT COUNT(*) AS n FROM activity_log WHERE team_id = ? AND flagged = 1').get(t.id).n;
    return {
      id: t.id, code: t.code, name: t.name, active: !!t.active,
      score: s.score, rank: r.rank || null, solved: s.solvedCount, submissions: subCount,
      hints, flags, lastAt: last ? last.created_at : null,
      roundEarned: s.roundEarned,
    };
  });
  const totalSubs = db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;
  const totalFlags = db.prepare('SELECT COUNT(*) AS n FROM activity_log WHERE flagged = 1').get().n;
  res.json({ ok: true, state, teams: rows, stats: { totalTeams: teams.length, totalSubs, totalFlags } });
});

router.get('/team/:id', (req, res) => {
  const id = Number(req.params.id);
  const team = db.prepare('SELECT id, code, name, active FROM teams WHERE id = ?').get(id);
  if (!team) return res.status(404).json({ ok: false, error: 'Team not found' });
  const summary = scoring.teamSummary(id);
  const rank = scoring.teamRank(id);
  const submissions = db.prepare(`
    SELECT s.id, s.question_id, q.title, q.round, s.status, s.score, s.passed, s.total, s.language, s.created_at, s.code
    FROM submissions s JOIN questions q ON q.id = s.question_id
    WHERE s.team_id = ? ORDER BY s.id DESC LIMIT 100`).all(id);
  const hints = db.prepare(`
    SELECT h.question_id, q.title, h.penalty, h.created_at
    FROM hint_usage h JOIN questions q ON q.id = h.question_id WHERE h.team_id = ? ORDER BY h.id DESC`).all(id);
  const activity = db.prepare('SELECT * FROM activity_log WHERE team_id = ? ORDER BY id DESC LIMIT 100').all(id);
  res.json({ ok: true, team, summary, rank, submissions, hints, activity });
});

// ------------------------------------------------------------------ teams mgmt
router.post('/team', (req, res) => {
  const { code, name, password } = req.body || {};
  if (!code || !name || !password) return res.status(400).json({ ok: false, error: 'code, name and password required' });
  try {
    const info = db.prepare('INSERT INTO teams (code, name, password_hash) VALUES (?, ?, ?)')
      .run(String(code).trim(), String(name).trim(), bcrypt.hashSync(String(password), 10));
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'Team ID already exists' });
  }
});

router.post('/teams/bulk', (req, res) => {
  const count = Math.min(200, Math.max(1, Number((req.body || {}).count) || 1));
  const prefix = String((req.body || {}).prefix || 'T').trim();
  const namePrefix = String((req.body || {}).namePrefix || 'Team ').trim();
  const password = String((req.body || {}).password || 'sprint123');
  const existing = db.prepare('SELECT COUNT(*) AS n FROM teams').get().n;
  const ins = db.prepare('INSERT INTO teams (code, name, password_hash) VALUES (?, ?, ?)');
  const hash = bcrypt.hashSync(password, 10);
  let created = 0;
  const tx = db.transaction(() => {
    for (let i = 1; i <= count; i++) {
      const n = existing + i;
      const code = prefix + String(n).padStart(2, '0');
      try { ins.run(code, namePrefix + n, hash); created++; } catch { /* skip dup */ }
    }
  });
  tx();
  res.json({ ok: true, created });
});

router.put('/team/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, code, active, password } = req.body || {};
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
  if (!team) return res.status(404).json({ ok: false, error: 'Team not found' });
  db.prepare('UPDATE teams SET name = ?, code = ?, active = ? WHERE id = ?')
    .run(name != null ? String(name) : team.name, code != null ? String(code) : team.code,
      active != null ? (active ? 1 : 0) : team.active, id);
  if (password) db.prepare('UPDATE teams SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), id);
  res.json({ ok: true });
});

router.delete('/team/:id', (req, res) => {
  db.prepare('DELETE FROM teams WHERE id = ?').run(Number(req.params.id));
  realtime.broadcastLeaderboard();
  res.json({ ok: true });
});

// ------------------------------------------------------------------ questions
router.get('/questions', (req, res) => {
  const round = req.query.round ? Number(req.query.round) : null;
  const sql = round ? 'SELECT * FROM questions WHERE round = ? ORDER BY round, is_bonus, order_index, id'
    : 'SELECT * FROM questions ORDER BY round, is_bonus, order_index, id';
  const rows = round ? db.prepare(sql).all(round) : db.prepare(sql).all();
  const out = rows.map((q) => ({
    ...serializeQuestion(q),
    test_cases: db.prepare('SELECT * FROM test_cases WHERE question_id = ? ORDER BY order_index').all(q.id),
  }));
  res.json({ ok: true, questions: out });
});

router.post('/question', (req, res) => insertOrUpdate(req, res, null));
router.put('/question/:id', (req, res) => insertOrUpdate(req, res, Number(req.params.id)));

function insertOrUpdate(req, res, id) {
  const b = req.body || {};
  if (!b.title || !b.round) return res.status(400).json({ ok: false, error: 'round and title are required' });
  const row = {
    round: Number(b.round),
    stage: b.stage || (Number(b.round) === 2 ? 'Code Arena' : Number(b.round) === 3 ? 'Debug Lab' : 'The Gate'),
    section: b.section || null,
    qtype: b.qtype || 'code',
    title: String(b.title),
    statement: b.statement || '',
    input_desc: b.input_desc || '',
    output_desc: b.output_desc || '',
    constraints: b.constraints || '',
    examples: JSON.stringify(Array.isArray(b.examples) ? b.examples : parseJSON(b.examples, [])),
    marks: Number(b.marks) || 0,
    hint: b.hint || null,
    hint_penalty: Number(b.hint_penalty) || 0,
    starter_code: b.starter_code || '',
    language: b.language || 'python',
    time_limit_ms: Number(b.time_limit_ms) || 4000,
    order_index: Number(b.order_index) || 0,
    is_bonus: b.is_bonus ? 1 : 0,
    active: b.active === false ? 0 : 1,
  };

  const tx = db.transaction(() => {
    let qid = id;
    if (id) {
      db.prepare(`UPDATE questions SET round=@round, stage=@stage, section=@section, qtype=@qtype,
        title=@title, statement=@statement, input_desc=@input_desc, output_desc=@output_desc,
        constraints=@constraints, examples=@examples, marks=@marks, hint=@hint, hint_penalty=@hint_penalty,
        starter_code=@starter_code, language=@language, time_limit_ms=@time_limit_ms,
        order_index=@order_index, is_bonus=@is_bonus, active=@active WHERE id=@id`)
        .run({ ...row, id });
    } else {
      const info = db.prepare(`INSERT INTO questions
        (round, stage, section, qtype, title, statement, input_desc, output_desc, constraints, examples,
         marks, hint, hint_penalty, starter_code, language, time_limit_ms, order_index, is_bonus, active)
        VALUES (@round, @stage, @section, @qtype, @title, @statement, @input_desc, @output_desc, @constraints, @examples,
         @marks, @hint, @hint_penalty, @starter_code, @language, @time_limit_ms, @order_index, @is_bonus, @active)`).run(row);
      qid = info.lastInsertRowid;
    }
    if (Array.isArray(b.test_cases)) {
      db.prepare('DELETE FROM test_cases WHERE question_id = ?').run(qid);
      const ins = db.prepare('INSERT INTO test_cases (question_id, input, expected_output, is_sample, order_index) VALUES (?, ?, ?, ?, ?)');
      b.test_cases.forEach((tc, i) => ins.run(qid, tc.input ?? '', tc.expected_output ?? tc.expected ?? '', tc.is_sample ? 1 : 0, i));
    }
    return qid;
  });
  const qid = tx();
  res.json({ ok: true, id: qid });
}

router.put('/question/:id/testcases', (req, res) => {
  const id = Number(req.params.id);
  const cases = Array.isArray((req.body || {}).test_cases) ? req.body.test_cases : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM test_cases WHERE question_id = ?').run(id);
    const ins = db.prepare('INSERT INTO test_cases (question_id, input, expected_output, is_sample, order_index) VALUES (?, ?, ?, ?, ?)');
    cases.forEach((tc, i) => ins.run(id, tc.input ?? '', tc.expected_output ?? tc.expected ?? '', tc.is_sample ? 1 : 0, i));
  });
  tx();
  res.json({ ok: true });
});

router.delete('/question/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ------------------------------------------------------------------ submissions
router.get('/submissions', (req, res) => {
  const teamId = req.query.team ? Number(req.query.team) : null;
  const sql = `SELECT s.id, s.team_id, t.code AS team_code, t.name AS team_name, s.question_id, q.title,
      s.status, s.score, s.passed, s.total, s.language, s.created_at
    FROM submissions s JOIN teams t ON t.id = s.team_id JOIN questions q ON q.id = s.question_id
    ${teamId ? 'WHERE s.team_id = ?' : ''} ORDER BY s.id DESC LIMIT 200`;
  const rows = teamId ? db.prepare(sql).all(teamId) : db.prepare(sql).all();
  res.json({ ok: true, submissions: rows });
});

// Judge correction: override a submission's score.
router.post('/submission/:id/override', (req, res) => {
  const id = Number(req.params.id);
  const score = Number((req.body || {}).score);
  if (isNaN(score)) return res.status(400).json({ ok: false, error: 'score required' });
  db.prepare('UPDATE submissions SET score = ?, status = ? WHERE id = ?').run(score, 'overridden', id);
  realtime.broadcastLeaderboard();
  logActivity(null, 'judge', `Override submission ${id} -> ${score}`);
  res.json({ ok: true });
});

// ------------------------------------------------------------------ activity
router.get('/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, t.code AS team_code, t.name AS team_name
    FROM activity_log a LEFT JOIN teams t ON t.id = a.team_id
    ORDER BY a.id DESC LIMIT 200`).all();
  res.json({ ok: true, activity: rows });
});

router.post('/activity/:id/flag', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT flagged FROM activity_log WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ ok: false, error: 'Not found' });
  db.prepare('UPDATE activity_log SET flagged = ? WHERE id = ?').run(cur.flagged ? 0 : 1, id);
  res.json({ ok: true, flagged: !cur.flagged });
});

// ------------------------------------------------------------------ config
router.get('/config', (req, res) => {
  res.json({ ok: true, state: timer.getState(), config: timer.getConfig() });
});

router.post('/config', (req, res) => {
  const b = req.body || {};
  const dbm = require('../db');
  if (b.status) dbm.setSetting('competition_status', b.status);
  if (b.schedule) dbm.setSetting('schedule', b.schedule);
  if (b.message !== undefined) dbm.setSetting('message', b.message);
  if (b.frozen !== undefined) dbm.setSetting('leaderboard_frozen', !!b.frozen);
  if (b.resultsPublished !== undefined) dbm.setSetting('results_published', !!b.resultsPublished);
  realtime.broadcastState();
  realtime.broadcastLeaderboard();
  res.json({ ok: true, state: timer.getState() });
});

router.post('/reset-contest', (req, res) => {
  const dbm = require('../db');
  db.transaction(() => {
    db.prepare('DELETE FROM submissions').run();
    db.prepare('DELETE FROM hint_usage').run();
    db.prepare('DELETE FROM activity_log').run();
    dbm.setSetting('competition_status', 'not_started');
    dbm.setSetting('leaderboard_frozen', false);
    dbm.setSetting('results_published', false);
    dbm.setSetting('message', '');
  })();
  realtime.broadcastState();
  realtime.broadcastLeaderboard();
  res.json({ ok: true, message: 'All test submissions and scores have been wiped clean!' });
});

module.exports = router;


