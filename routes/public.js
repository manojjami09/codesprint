'use strict';

const express = require('express');
const { db } = require('../db');
const timer = require('../services/timer');
const scoring = require('../services/scoring');
const realtime = require('../services/realtime');

const router = express.Router();

router.get('/competition', (req, res) => {
  res.json({ ok: true, state: timer.getState() });
});

router.get('/leaderboard', (req, res) => {
  const state = timer.getState();
  const board = scoring.getLeaderboard().map((r) => ({
    teamId: r.teamId, code: r.code, name: r.name, rank: r.rank, score: r.score, solved: r.solved,
  }));
  res.json({ ok: true, frozen: state.frozen, resultsPublished: state.resultsPublished, leaderboard: board });
});

router.get('/results', (req, res) => {
  const state = timer.getState();
  if (!state.resultsPublished) {
    return res.json({ ok: true, published: false, frozen: state.frozen, state });
  }
  const board = scoring.getLeaderboard().map((r) => ({
    teamId: r.teamId, code: r.code, name: r.name, rank: r.rank, score: r.score,
    roundEarned: r.roundEarned, solved: r.solved,
  }));
  const roundTotals = { 1: 0, 2: 0, 3: 0 };
  for (const q of db.prepare('SELECT round, marks FROM questions WHERE active = 1').all()) {
    roundTotals[q.round] = (roundTotals[q.round] || 0) + q.marks;
  }
  res.json({ ok: true, published: true, leaderboard: board, roundTotals });
});

module.exports = router;
