'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { Server } = require('socket.io');

const dbmod = require('./db');
dbmod.init();

const realtime = require('./services/realtime');
const timer = require('./services/timer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
realtime.setIo(io);

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: 'code-sprint-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/team', require('./routes/team'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

io.on('connection', (socket) => {
  socket.emit('state', timer.getState());
  socket.emit('leaderboard', realtime.getLeaderboardCached());
  socket.on('join-admin', () => socket.join('admins'));
});

// Push server state every second so all clients stay in sync.
setInterval(() => realtime.broadcastState(), 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ========================================');
  console.log('   CODE SPRINT server running');
  console.log('   Teams  : http://localhost:' + PORT + '/');
  console.log('   Admin  : http://localhost:' + PORT + '/admin.html');
  console.log('  ========================================');
  console.log('');
});
