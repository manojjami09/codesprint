'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'codesprint.db');
const RESET = process.argv.includes('--reset');
if (RESET && fs.existsSync(DB_PATH)) {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ignore */ }
  }
  console.log('Removed existing database.');
}

const dbmod = require('./db');
const db = dbmod.db;
const { defaultSchedule } = require('./services/timer');
const QUESTIONS = require('./questions_data');
dbmod.init();

const hash = (p) => bcrypt.hashSync(p, 10);

// ---------------------------------------------------------------- settings
function seedSettings() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n;
  if (count === 0 || RESET) {
    dbmod.setSetting('competition_status', 'not_started');
    dbmod.setSetting('schedule', defaultSchedule());
    dbmod.setSetting('leaderboard_frozen', false);
    dbmod.setSetting('results_published', false);
    dbmod.setSetting('message', '');
    console.log('Settings initialised.');
  }
}

// ---------------------------------------------------------------- accounts
function seedAccounts() {
  const admins = [
    ['admin', 'admin123', 'admin'],
    ['judge', 'judge123', 'judge'],
  ];
  for (const [u, p, role] of admins) {
    db.prepare(
      `INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)
       ON CONFLICT(username) DO NOTHING`
    ).run(u, hash(p), role);
  }

  const teamCount = db.prepare('SELECT COUNT(*) AS n FROM teams').get().n;
  if (teamCount === 0 || RESET) {
    const names = [
      'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
      'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
      'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
      'Yankee', 'Zulu', 'Titan', 'Nova', 'Pixel', 'Byte', 'Rogue', 'Phantom',
      'Cipher', 'Vertex', 'Quantum', 'Matrix',
    ];
    const ins = db.prepare('INSERT INTO teams (code, name, password_hash) VALUES (?, ?, ?)');
    const tx = db.transaction(() => {
      names.forEach((n, i) => {
        const code = 'T' + String(i + 1).padStart(2, '0');
        ins.run(code, `Team ${n}`, hash('sprint123'));
      });
    });
    tx();
    console.log(`Seeded ${names.length} teams (password: sprint123) and admin/judge accounts.`);
  }
}

// ---------------------------------------------------------------- questions
function seedQuestions() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
  if (count > 0 && !RESET) {
    console.log('Questions already exist. Skipping (use --reset to reload).');
    return;
  }

  const insQ = db.prepare(`
    INSERT INTO questions
      (round, stage, section, qtype, title, statement, input_desc, output_desc,
       constraints, examples, marks, hint, hint_penalty, starter_code, language,
       time_limit_ms, order_index, is_bonus)
    VALUES (@round, @stage, @section, @qtype, @title, @statement, @input_desc, @output_desc,
       @constraints, @examples, @marks, @hint, @hint_penalty, @starter_code, @language,
       @time_limit_ms, @order_index, @is_bonus)`);
  const insTC = db.prepare(`
    INSERT INTO test_cases (question_id, input, expected_output, is_sample, order_index)
    VALUES (?, ?, ?, ?, ?)`);

  const orderByRound = { 1: 0, 2: 0, 3: 0 };
  const tx = db.transaction(() => {
    for (const q of QUESTIONS) {
      const row = {
        round: q.round,
        stage: q.stage || r2Stage(q),
        section: q.section || null,
        qtype: q.qtype || 'code',
        title: q.title,
        statement: q.statement || '',
        input_desc: q.input_desc || '',
        output_desc: q.output_desc || '',
        constraints: q.constraints || 'See problem statement',
        examples: JSON.stringify(q.examples || []),
        marks: Number(q.marks) || 0,
        hint: q.hint || null,
        hint_penalty: Number(q.hint_penalty) || 0,
        starter_code: q.starter_code || '',
        language: q.language || (q.qtype === 'logic' ? 'text' : 'python'),
        time_limit_ms: Number(q.time_limit_ms) || 4000,
        order_index: orderByRound[q.round]++,
        is_bonus: q.is_bonus ? 1 : 0,
      };
      const info = insQ.run(row);
      const qid = info.lastInsertRowid;
      (q.test_cases || []).forEach((tc, i) => insTC.run(qid, tc[0], tc[1], tc[2] ? 1 : 0, i));
    }
  });
  tx();
  console.log(`Seeded ${QUESTIONS.length} real questions (${orderByRound[1]} R1, ${orderByRound[2]} R2, ${orderByRound[3]} R3).`);
}

function r2Stage(q) {
  if (q.round === 2) return 'Code Arena';
  if (q.round === 3) return 'Debug Lab';
  return 'The Gate';
}

seedSettings();
seedAccounts();
seedQuestions();
console.log('Seed complete.');