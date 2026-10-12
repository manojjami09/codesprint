'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logActivity } = require('../db');
const timer = require('../services/timer');
const router = express.Router();

router.post('/login', (req, res) => {
  const { teamId, password } = req.body || {};
  if (!teamId || !password) return res.status(400).json({ ok: false, error: 'Team ID and password are required' });

  const team = db.prepare('SELECT * FROM teams WHERE UPPER(code) = UPPER(?)').get(String(teamId).trim());
  if (!team) return res.status(401).json({ ok: false, error: 'Invalid Team ID or password' });
  if (!team.active) return res.status(403).json({ ok: false, error: 'This team account is disabled' });
  if (!bcrypt.compareSync(password, team.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid Team ID or password' });
  }

  req.session.teamId = team.id;
  req.session.adminId = null;
  logActivity(team.id, 'login', `Team ${team.code} logged in`);
  res.json({ ok: true, team: { id: team.id, code: team.code, name: team.name } });
});

router.post('/admin-login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password are required' });
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(username).trim());
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid username or password' });
  }
  req.session.adminId = admin.id;
  req.session.teamId = null;
  res.json({ ok: true, admin: { id: admin.id, username: admin.username, role: admin.role } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (req.session && req.session.teamId) {
    const team = db.prepare('SELECT id, code, name FROM teams WHERE id = ?').get(req.session.teamId);
    if (team) return res.json({ ok: true, role: 'team', team, state: timer.getState() });
  }
  if (req.session && req.session.adminId) {
    const admin = db.prepare('SELECT id, username, role FROM admins WHERE id = ?').get(req.session.adminId);
    if (admin) return res.json({ ok: true, role: 'admin', admin, state: timer.getState() });
  }
  return res.json({ ok: true, role: null, state: timer.getState() });
});

module.exports = router;
