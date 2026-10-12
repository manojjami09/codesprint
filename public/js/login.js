'use strict';

const $ = (id) => document.getElementById(id);
let lastSeconds = null;

async function refreshStatus() {
  try {
    const me = await api('/auth/me');
    if (me.role === 'team') { location.href = '/dashboard.html'; return; }
    if (me.role === 'admin') { location.href = '/admin.html'; return; }
    renderState(me.state);
  } catch (e) { /* ignore */ }
}

function renderState(st) {
  if (!st) return;
  const statusText = { not_started: 'Not Started', live: 'Started / Live', finished: 'Finished' }[st.status] || st.status;
  $('compStatus').textContent = statusText;
  $('compStatus').style.color = st.status === 'live' ? 'var(--green)' : st.status === 'finished' ? 'var(--red)' : 'var(--muted)';
  $('compPhase').textContent = st.phaseLabel;
  const t = $('compTimer');
  const secs = Math.floor((st.remainingMs || 0) / 1000);
  if (lastSeconds !== null && lastSeconds !== secs) tickTimer(t);
  lastSeconds = secs;
  t.textContent = fmtMs(st.remainingMs);
  t.classList.toggle('warn', st.remainingMs > 0 && st.remainingMs < 5 * 60 * 1000);
}

connectSocket(renderState);

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginError').textContent = '';
  try {
    await api('/auth/login', { method: 'POST', body: { teamId: $('teamId').value, password: $('password').value } });
    location.href = '/dashboard.html';
  } catch (err) {
    $('loginError').textContent = err.message;
    shake($('loginForm'));
  }
});

refreshStatus();
