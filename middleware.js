'use strict';

function requireTeam(req, res, next) {
  if (req.session && req.session.teamId) return next();
  return res.status(401).json({ ok: false, error: 'Team login required' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ ok: false, error: 'Admin login required' });
}

module.exports = { requireTeam, requireAdmin };
