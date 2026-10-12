'use strict';

const { getSetting } = require('../db');

const PHASE_ORDER = ['round1', 'lunch', 'round2', 'round3', 'finished'];

const ROUNDS = {
  1: { key: 'round1', label: 'Round 1 — Logic Quest', durationMin: 120,
       stages: ['The Gate', 'The Maze', 'The Cipher'] },
  2: { key: 'round2', label: 'Round 2 — Code Arena', durationMin: 120,
       sections: ['Predict', 'Fix It', 'Complete It', 'Solve', 'Challenge', 'Bonus'] },
  3: { key: 'round3', label: 'Round 3 — Debug Lab', durationMin: 60,
       stages: ['Broken Loop', 'Hidden Bug', 'Final Boss'] },
};

const PHASE_LABEL = {
  not_started: 'Not Started',
  live: 'Live — awaiting schedule',
  pre_round1: 'Live — Round 1 starts soon',
  round1: 'Round 1 — Logic Quest',
  lunch: 'Lunch Lock',
  round2: 'Round 2 — Code Arena',
  round3: 'Round 3 — Debug Lab',
  finished: 'Finished',
};

function defaultSchedule() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const at = (h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString(); };
  return {
    round1: { start: at(10, 0), end: at(12, 0) },
    lunch:  { start: at(12, 0), end: at(13, 0) },
    round2: { start: at(13, 0), end: at(15, 0) },
    round3: { start: at(15, 0), end: at(16, 0) },
  };
}

function getConfig() {
  return {
    status: getSetting('competition_status', 'not_started'),
    schedule: getSetting('schedule', defaultSchedule()),
    frozen: !!getSetting('leaderboard_frozen', false),
    resultsPublished: !!getSetting('results_published', false),
    message: getSetting('message', '') || '',
  };
}

// Compute the server-authoritative competition state at "now".
function getState(now = new Date()) {
  const cfg = getConfig();
  const t = now.getTime();

  let phase = cfg.status;
  let phaseEnd = null;

  if (cfg.status === 'live') {
    phase = 'finished';
    for (const key of ['round1', 'lunch', 'round2', 'round3']) {
      const slot = cfg.schedule[key];
      if (!slot || !slot.start || !slot.end) continue;
      const s = new Date(slot.start).getTime();
      const e = new Date(slot.end).getTime();
      if (t < s) { phase = key === 'round1' ? 'pre_round1' : 'lunch'; break; }
      if (t >= s && t < e) { phase = key; phaseEnd = e; break; }
    }
  }

  // Round unlocked only during its exact phase window (while live).
  const roundStatus = {};
  for (let r = 1; r <= 3; r++) {
    const key = ROUNDS[r].key;
    const slot = cfg.schedule[key];
    const s = slot ? new Date(slot.start).getTime() : NaN;
    const e = slot ? new Date(slot.end).getTime() : NaN;
    let status = 'locked';
    if (cfg.status === 'not_started') status = 'locked';
    else if (cfg.status === 'finished') status = 'closed';
    else if (!isNaN(s) && t >= e) status = 'closed';
    else if (cfg.status === 'live' && !isNaN(s) && !isNaN(e) && t >= s && t < e) status = 'active';
    else status = 'locked';
    roundStatus[r] = status;
  }

  let remainingMs = 0;
  if (phaseEnd) remainingMs = Math.max(0, phaseEnd - t);
  else if (cfg.status === 'live' && phase === 'pre_round1') {
    const s = cfg.schedule.round1 ? new Date(cfg.schedule.round1.start).getTime() : t;
    remainingMs = Math.max(0, s - t);
  }

  return {
    status: cfg.status,
    phase,
    phaseLabel: PHASE_LABEL[phase] || PHASE_LABEL[cfg.status] || cfg.status,
    serverNow: now.toISOString(),
    phaseEnd: phaseEnd ? new Date(phaseEnd).toISOString() : null,
    remainingMs,
    schedule: cfg.schedule,
    rounds: roundStatus,
    frozen: cfg.frozen,
    resultsPublished: cfg.resultsPublished,
    message: cfg.message,
  };
}

function roundAcceptsSubmissions(round) {
  const st = getState();
  return st.status === 'live' && st.rounds[round] === 'active' && !st.frozen;
}

function anyRoundOpen() {
  const st = getState();
  return st.status === 'live' && Object.values(st.rounds).some((s) => s === 'active');
}

module.exports = {
  ROUNDS, PHASE_ORDER, PHASE_LABEL, defaultSchedule,
  getConfig, getState, roundAcceptsSubmissions, anyRoundOpen,
};
