'use strict';

let io = null;
let cachedLeaderboard = [];

function setIo(instance) { io = instance; }
function getIo() { return io; }

function getLeaderboardCached() { return cachedLeaderboard; }

function broadcastLeaderboard() {
  const scoring = require('./scoring');
  cachedLeaderboard = scoring.getLeaderboard();
  if (io) io.emit('leaderboard', cachedLeaderboard);
  return cachedLeaderboard;
}

function broadcastState() {
  const timer = require('./timer');
  if (io) io.emit('state', timer.getState());
}

function logToAdmins(payload) {
  if (io) io.to('admins').emit('activity', payload);
}

module.exports = { setIo, getIo, getLeaderboardCached, broadcastLeaderboard, broadcastState, logToAdmins };
