'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'codesprint.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'judge'
    );

    CREATE TABLE IF NOT EXISTS questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      round         INTEGER NOT NULL,
      stage         TEXT NOT NULL,
      section       TEXT,
      qtype         TEXT NOT NULL DEFAULT 'code',
      title         TEXT NOT NULL,
      statement     TEXT NOT NULL DEFAULT '',
      input_desc    TEXT NOT NULL DEFAULT '',
      output_desc   TEXT NOT NULL DEFAULT '',
      constraints   TEXT NOT NULL DEFAULT '',
      examples      TEXT NOT NULL DEFAULT '[]',
      marks         INTEGER NOT NULL DEFAULT 10,
      hint          TEXT,
      hint_penalty  INTEGER NOT NULL DEFAULT 5,
      starter_code  TEXT NOT NULL DEFAULT '',
      language      TEXT NOT NULL DEFAULT 'python',
      time_limit_ms INTEGER NOT NULL DEFAULT 4000,
      order_index   INTEGER NOT NULL DEFAULT 0,
      is_bonus      INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      input           TEXT NOT NULL DEFAULT '',
      expected_output TEXT NOT NULL DEFAULT '',
      is_sample       INTEGER NOT NULL DEFAULT 0,
      order_index     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      code         TEXT NOT NULL DEFAULT '',
      language     TEXT NOT NULL DEFAULT 'python',
      mode         TEXT NOT NULL DEFAULT 'submit',
      status       TEXT NOT NULL DEFAULT 'pending',
      score        INTEGER NOT NULL DEFAULT 0,
      passed       INTEGER NOT NULL DEFAULT 0,
      total        INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL DEFAULT '[]',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hint_usage (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      penalty     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id    INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      detail     TEXT NOT NULL DEFAULT '',
      flagged    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_team ON submissions(team_id);
    CREATE INDEX IF NOT EXISTS idx_sub_q    ON submissions(question_id);
    CREATE INDEX IF NOT EXISTS idx_tc_q     ON test_cases(question_id);
    CREATE INDEX IF NOT EXISTS idx_act_team ON activity_log(team_id);
  `);
}

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  const v = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, v);
  return value;
}

function logActivity(teamId, type, detail = '', flagged = 0) {
  try {
    db.prepare(
      'INSERT INTO activity_log (team_id, type, detail, flagged) VALUES (?, ?, ?, ?)'
    ).run(teamId, type, detail, flagged ? 1 : 0);
  } catch (e) { /* ignore */ }
}

module.exports = { db, init, getSetting, setSetting, logActivity, DB_PATH };
