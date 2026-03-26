/* ============================================
   $REPLAY — Leaderboard + Score Submission
   Backend: Supabase (free tier)

   SETUP — 3 steps:
   ─────────────────────────────────────────
   1. Create a free project at supabase.com
   2. Go to SQL Editor and run the SQL block below
   3. Fill in your Project URL and anon key below

   SQL TO RUN IN SUPABASE DASHBOARD:
   ─────────────────────────────────────────
   create table public.scores (
     id uuid default gen_random_uuid() primary key,
     wallet text not null,
     x_username text not null default '',
     display_name text not null,
     score integer not null,
     updated_at timestamptz default now()
   );

   alter table public.scores
     add constraint scores_wallet_unique unique (wallet);

   alter table public.scores enable row level security;

   create policy "public_read"   on public.scores for select using (true);
   create policy "public_insert" on public.scores for insert with check (true);
   create policy "public_update" on public.scores for update using (true);

   create or replace function public.submit_score(
     p_wallet text,
     p_x_username text,
     p_display_name text,
     p_score integer
   ) returns void language plpgsql security definer as $$
   begin
     insert into public.scores (wallet, x_username, display_name, score, updated_at)
     values (p_wallet, p_x_username, p_display_name, p_score, now())
     on conflict (wallet) do update set
       score        = greatest(public.scores.score, excluded.score),
       x_username   = excluded.x_username,
       display_name = excluded.display_name,
       updated_at   = case
                        when excluded.score > public.scores.score then now()
                        else public.scores.updated_at
                      end;
   end;
   $$;
   ─────────────────────────────────────────
   ============================================ */

var SUPABASE_CONFIG = {
  URL: '',   // e.g. 'https://xyzabcdefg.supabase.co'
  KEY: '',   // anon/public key from Project Settings → API
};

/* ---- Fallback static data (shown when Supabase not configured) ---- */
var LEADERBOARD_DATA = [
  { rank: 1,  display_name: '7xKq...9mFd', score: 24891 },
  { rank: 2,  display_name: '3bNw...2hTp', score: 21344 },
  { rank: 3,  display_name: '9cRe...5kLm', score: 18720 },
  { rank: 4,  display_name: '2dYs...8jWn', score: 15603 },
  { rank: 5,  display_name: '6fAx...1pQr', score: 13287 },
  { rank: 6,  display_name: '4gHz...7vBc', score: 11042 },
  { rank: 7,  display_name: '8eTu...3nDk', score:  9856 },
  { rank: 8,  display_name: '5iLo...6wXa', score:  7431 },
  { rank: 9,  display_name: '1jMp...4sCf', score:  5219 },
  { rank: 10, display_name: '0kNr...9tGh', score:  3104 },
];

/* ============================================
   SCORE SUBMISSION
   ============================================ */
function replaySubmitScore(score) {
  if (!score || score <= 0) return;

  var profile = window.replayGetProfile ? window.replayGetProfile() : null;
  if (!profile || !profile.wallet) return;

  if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.KEY) {
    console.info('$REPLAY: Supabase not configured — score not submitted to leaderboard.');
    return;
  }

  fetch(SUPABASE_CONFIG.URL + '/rest/v1/rpc/submit_score', {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_CONFIG.KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.KEY,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      p_wallet:       profile.wallet,
      p_x_username:   profile.xUsername || '',
      p_display_name: profile.displayName,
      p_score:        score,
    }),
  })
  .then(function (res) {
    if (!res.ok) console.warn('$REPLAY: Score submit error', res.status);
  })
  .catch(function (err) {
    console.warn('$REPLAY: Score submit failed', err);
  });
}

/* ============================================
   LEADERBOARD FETCH + RENDER
   ============================================ */
function replayLoadLeaderboard(tbodyId, limit, highlightScore) {
  if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.KEY) {
    replayRenderLeaderboard(tbodyId, limit, highlightScore);
    return;
  }

  var url = SUPABASE_CONFIG.URL +
    '/rest/v1/scores?select=display_name,score&order=score.desc&limit=' + (limit || 10);

  fetch(url, {
    headers: {
      'apikey':        SUPABASE_CONFIG.KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.KEY,
    },
  })
  .then(function (res) { return res.json(); })
  .then(function (rows) {
    renderRows(tbodyId, rows, highlightScore);
  })
  .catch(function () {
    replayRenderLeaderboard(tbodyId, limit, highlightScore);
  });
}

/* ---- Render from static fallback data ---- */
function replayRenderLeaderboard(tbodyId, limit, highlightScore) {
  var data = limit ? LEADERBOARD_DATA.slice(0, limit) : LEADERBOARD_DATA;
  renderRows(tbodyId, data, highlightScore);
}

/* ---- Core row-rendering logic (shared) ---- */
function renderRows(tbodyId, rows, highlightScore) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  var myName = window.replayGetDisplayName ? window.replayGetDisplayName() : null;

  // Find where highlightScore would beat into the list
  var wouldBeatIdx = -1;
  if (highlightScore !== undefined && highlightScore !== null && highlightScore > 0) {
    for (var i = 0; i < rows.length; i++) {
      if (highlightScore > (rows[i].score || 0)) { wouldBeatIdx = i; break; }
    }
  }

  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    var emptyTr = document.createElement('tr');
    emptyTr.innerHTML = '<td colspan="3" style="text-align:center;color:var(--color-muted);padding:2rem 1rem;font-size:0.4rem">BE THE FIRST TO CLAIM A SPOT</td>';
    tbody.appendChild(emptyTr);
    return;
  }

  rows.forEach(function (entry, idx) {
    var rank = (entry.rank || idx + 1);
    var tr   = document.createElement('tr');

    if (rank === 1 || idx === 0) tr.className = 'lb-gold';
    else if (rank === 2 || idx === 1) tr.className = 'lb-silver';
    else if (rank === 3 || idx === 2) tr.className = 'lb-bronze';

    if (idx === wouldBeatIdx) tr.classList.add('lb-highlight');
    if (myName && entry.display_name === myName) tr.classList.add('lb-you');

    var prefix = (idx === 0) ? '\u2605 ' : '';
    var scoreStr = (entry.score || 0).toLocaleString();
    var displayRank = entry.rank || (idx + 1);

    tr.innerHTML =
      '<td>' + prefix + '#' + displayRank + '</td>' +
      '<td>' + (entry.display_name || '???') + '</td>' +
      '<td class="lb-score">' + scoreStr + '</td>';

    tbody.appendChild(tr);
  });
}

/* ---- Expose globals ---- */
window.LEADERBOARD_DATA         = LEADERBOARD_DATA;
window.replaySubmitScore        = replaySubmitScore;
window.replayLoadLeaderboard    = replayLoadLeaderboard;
window.replayRenderLeaderboard  = replayRenderLeaderboard;
