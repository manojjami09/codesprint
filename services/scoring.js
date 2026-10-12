'use strict';

const { db } = require('../db');

// Marks earned = question.marks * (passed / total), rounded.
function scoreForSubmission(marks, passed, total) {
  if (!total || total <= 0) return 0;
  return Math.round((marks * passed) / total);
}

function teamSummary(teamId) {
  const best = db.prepare(`
    SELECT s.question_id, MAX(s.score) AS best, MIN(s.created_at) AS first_at
    FROM submissions s
    WHERE s.team_id = ? AND s.mode = 'submit'
    GROUP BY s.question_id
  `).all(teamId);

  const qMeta = db.prepare('SELECT id, round, marks FROM questions WHERE active = 1').all();
  const metaById = new Map(qMeta.map((q) => [q.id, q]));

  let earned = 0;
  const roundEarned = { 1: 0, 2: 0, 3: 0 };
  const roundTotal = { 1: 0, 2: 0, 3: 0 };
  for (const q of qMeta) roundTotal[q.round] = (roundTotal[q.round] || 0) + q.marks;

  const solved = new Set();
  let lastAt = null;
  for (const b of best) {
    const m = metaById.get(b.question_id);
    if (!m) continue;
    earned += b.best || 0;
    roundEarned[m.round] = (roundEarned[m.round] || 0) + (b.best || 0);
    if (b.best > 0) solved.add(b.question_id);
    if (!lastAt || b.first_at < lastAt) lastAt = b.first_at;
  }

  const hintRow = db.prepare('SELECT COALESCE(SUM(penalty),0) AS p, COUNT(*) AS n FROM hint_usage WHERE team_id = ?').get(teamId);
  const penalty = hintRow.p || 0;
  const finalScore = Math.max(0, earned - penalty);

  return {
    earned, penalty, score: finalScore,
    solvedCount: solved.size,
    solvedIds: [...solved],
    roundEarned, roundTotal,
    totalMarks: roundTotal[1] + roundTotal[2] + roundTotal[3],
    lastAt,
    hintCount: hintRow.n || 0,
  };
}

function getLeaderboard() {
  const teams = db.prepare('SELECT id, code, name FROM teams WHERE active = 1').all();
  const rows = teams.map((t) => {
    const s = teamSummary(t.id);
    return {
      teamId: t.id, code: t.code, name: t.name,
      score: s.score, solved: s.solvedCount, lastAt: s.lastAt,
      penalty: s.penalty, hintCount: s.hintCount,
      roundEarned: s.roundEarned,
    };
  });
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lastAt && b.lastAt && a.lastAt !== b.lastAt) return a.lastAt < b.lastAt ? -1 : 1;
    if (a.solved !== b.solved) return b.solved - a.solved;
    return a.name.localeCompare(b.name);
  });
  let rank = 0, prev = null, sameRank = 0;
  rows.forEach((r, i) => {
    if (prev !== null && r.score === prev) { r.rank = rank; sameRank++; }
    else { rank = i + 1; r.rank = rank; sameRank = 0; }
    prev = r.score;
  });
  return rows;
}

function teamRank(teamId) {
  const lb = getLeaderboard();
  const row = lb.find((r) => r.teamId === teamId);
  return row ? { rank: row.rank, total: lb.length, score: row.score } : { rank: null, total: lb.length, score: 0 };
}

module.exports = { scoreForSubmission, teamSummary, getLeaderboard, teamRank };
