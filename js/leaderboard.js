/* ============================================
   $REPLAY — Leaderboard Data & Rendering
   To connect a real backend later, replace
   LEADERBOARD_DATA with an API fetch and call
   replayRenderLeaderboard() in the callback.
   ============================================ */

var LEADERBOARD_DATA = [
  { rank: 1,  player: '7xKq...9mFd', score: 24891 },
  { rank: 2,  player: '3bNw...2hTp', score: 21344 },
  { rank: 3,  player: '9cRe...5kLm', score: 18720 },
  { rank: 4,  player: '2dYs...8jWn', score: 15603 },
  { rank: 5,  player: '6fAx...1pQr', score: 13287 },
  { rank: 6,  player: '4gHz...7vBc', score: 11042 },
  { rank: 7,  player: '8eTu...3nDk', score:  9856 },
  { rank: 8,  player: '5iLo...6wXa', score:  7431 },
  { rank: 9,  player: '1jMp...4sCf', score:  5219 },
  { rank: 10, player: '0kNr...9tGh', score:  3104 },
];

function replayRenderLeaderboard(tbodyId, limit, highlightScore) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  var data        = limit ? LEADERBOARD_DATA.slice(0, limit) : LEADERBOARD_DATA;
  var displayName = window.replayGetDisplayName ? window.replayGetDisplayName() : null;

  // Find where highlightScore would rank (first entry it beats)
  var wouldRankIdx = -1;
  if (highlightScore !== undefined && highlightScore !== null) {
    for (var i = 0; i < data.length; i++) {
      if (highlightScore > data[i].score) { wouldRankIdx = i; break; }
    }
  }

  tbody.innerHTML = '';

  data.forEach(function (entry, idx) {
    var tr = document.createElement('tr');

    // Medal class
    if (entry.rank === 1) tr.className = 'lb-gold';
    else if (entry.rank === 2) tr.className = 'lb-silver';
    else if (entry.rank === 3) tr.className = 'lb-bronze';

    // Highlight if this is the "would rank" position
    if (idx === wouldRankIdx) tr.classList.add('lb-highlight');

    // Highlight current logged-in player's entry
    if (displayName && entry.player === displayName) tr.classList.add('lb-you');

    var prefix = entry.rank === 1 ? '\u2605 ' : '';  // ★ for #1

    tr.innerHTML =
      '<td>' + prefix + '#' + entry.rank + '</td>' +
      '<td>' + entry.player + '</td>' +
      '<td class="lb-score">' + entry.score.toLocaleString() + '</td>';

    tbody.appendChild(tr);
  });
}

// Expose globally
window.LEADERBOARD_DATA        = LEADERBOARD_DATA;
window.replayRenderLeaderboard = replayRenderLeaderboard;
