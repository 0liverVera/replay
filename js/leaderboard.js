/* ============================================
   $REPLAY — Leaderboard + Score Submission
   Backend: Firebase Realtime Database (free)

   SETUP — 3 steps (~5 min):
   ─────────────────────────────────────────
   1. Go to console.firebase.google.com
      → Add project → give it a name → Continue

   2. In the left sidebar click "Build"
      → Realtime Database → Create database
      → Pick any location → "Start in test mode" → Enable

   3. Copy your database URL (looks like:
      https://replay-xxxxx-default-rtdb.firebaseio.com)
      and paste it into FIREBASE_URL below
   ─────────────────────────────────────────
   ============================================ */

var FIREBASE_URL = '';  // e.g. 'https://replay-12345-default-rtdb.firebaseio.com'

/* ---- Fallback static data (shown until Firebase is configured) ---- */
var LEADERBOARD_DATA = [
  { displayName: '7xKq...9mFd', score: 24891 },
  { displayName: '3bNw...2hTp', score: 21344 },
  { displayName: '9cRe...5kLm', score: 18720 },
  { displayName: '2dYs...8jWn', score: 15603 },
  { displayName: '6fAx...1pQr', score: 13287 },
  { displayName: '4gHz...7vBc', score: 11042 },
  { displayName: '8eTu...3nDk', score:  9856 },
  { displayName: '5iLo...6wXa', score:  7431 },
  { displayName: '1jMp...4sCf', score:  5219 },
  { displayName: '0kNr...9tGh', score:  3104 },
];

/* ============================================
   SCORE SUBMISSION
   Only saves if it's the player's new best
   ============================================ */
function replaySubmitScore(score) {
  if (!score || score <= 0) return;

  var profile = window.replayGetProfile ? window.replayGetProfile() : null;
  if (!profile || !profile.wallet) return;

  if (!FIREBASE_URL) {
    console.info('$REPLAY: Firebase not configured — score not saved.');
    return;
  }

  var url = FIREBASE_URL + '/scores/' + profile.wallet + '.json';

  // Read existing score first — only write if this is a new best
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (existing) {
      if (existing && existing.score >= score) return; // already have a better score

      return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: profile.displayName,
          xUsername:   profile.xUsername || '',
          wallet:      profile.wallet,
          score:       score,
          updatedAt:   new Date().toISOString(),
        }),
      });
    })
    .catch(function (e) { console.warn('$REPLAY: Score submit failed', e); });
}

/* ============================================
   LEADERBOARD FETCH + RENDER
   ============================================ */
function replayLoadLeaderboard(tbodyId, limit, highlightScore) {
  if (!FIREBASE_URL) {
    replayRenderLeaderboard(tbodyId, limit, highlightScore);
    return;
  }

  fetch(FIREBASE_URL + '/scores.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || typeof data !== 'object') {
        replayRenderLeaderboard(tbodyId, limit, highlightScore);
        return;
      }

      var rows = Object.values(data)
        .filter(function (e) { return e && e.score; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, limit || 10);

      renderRows(tbodyId, rows, highlightScore);
    })
    .catch(function () {
      replayRenderLeaderboard(tbodyId, limit, highlightScore);
    });
}

/* ---- Render from static fallback data ---- */
function replayRenderLeaderboard(tbodyId, limit, highlightScore) {
  var rows = limit ? LEADERBOARD_DATA.slice(0, limit) : LEADERBOARD_DATA;
  renderRows(tbodyId, rows, highlightScore);
}

/* ---- Core renderer (used by both live + fallback) ---- */
function renderRows(tbodyId, rows, highlightScore) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  var myName = window.replayGetDisplayName ? window.replayGetDisplayName() : null;

  // Find which row the player's score would displace
  var wouldBeatIdx = -1;
  if (highlightScore > 0) {
    for (var i = 0; i < rows.length; i++) {
      if (highlightScore > (rows[i].score || 0)) { wouldBeatIdx = i; break; }
    }
  }

  tbody.innerHTML = '';

  if (!rows.length) {
    var empty = document.createElement('tr');
    empty.innerHTML = '<td colspan="3" style="text-align:center;color:var(--color-muted);padding:2rem;font-size:0.4rem">BE THE FIRST TO CLAIM A SPOT</td>';
    tbody.appendChild(empty);
    return;
  }

  rows.forEach(function (entry, idx) {
    var rank = idx + 1;
    var tr   = document.createElement('tr');

    if (rank === 1) tr.className = 'lb-gold';
    else if (rank === 2) tr.className = 'lb-silver';
    else if (rank === 3) tr.className = 'lb-bronze';

    if (idx === wouldBeatIdx) tr.classList.add('lb-highlight');
    if (myName && entry.displayName === myName) tr.classList.add('lb-you');

    tr.innerHTML =
      '<td>' + (rank === 1 ? '\u2605 ' : '') + '#' + rank + '</td>' +
      '<td>' + (entry.displayName || '???') + '</td>' +
      '<td class="lb-score">' + (entry.score || 0).toLocaleString() + '</td>';

    tbody.appendChild(tr);
  });
}

/* ---- Expose globals ---- */
window.LEADERBOARD_DATA        = LEADERBOARD_DATA;
window.replaySubmitScore       = replaySubmitScore;
window.replayLoadLeaderboard   = replayLoadLeaderboard;
window.replayRenderLeaderboard = replayRenderLeaderboard;
