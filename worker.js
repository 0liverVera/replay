/**
 * $REPLAY — Cloudflare Worker: X (Twitter) OAuth Token Exchange
 *
 * SETUP:
 *  1. Go to https://developers.cloudflare.com/workers/ and create a new Worker
 *  2. Paste this file's content into the editor
 *  3. Fill in CLIENT_ID and CLIENT_SECRET from developer.twitter.com
 *  4. Set REDIRECT_URI to match your site's /callback.html URL
 *  5. Deploy, then copy the Worker URL into:
 *       - X_CONFIG.WORKER_URL in js/main.js
 *       - WORKER_URL in callback.html
 *
 * TWITTER APP REQUIREMENTS:
 *  - OAuth 2.0 enabled (under "User authentication settings")
 *  - App type: Web App
 *  - Callback URL: https://YOUR_DOMAIN/callback.html
 *  - Scopes: tweet.read, users.read
 */

const CLIENT_ID     = '';   // From developer.twitter.com → Your App → Keys and Tokens
const CLIENT_SECRET = '';   // Same location — needed for confidential client token exchange
const REDIRECT_URI  = '';   // e.g. 'https://0liverVera.github.io/replay/callback.html'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type':                 'application/json',
};

addEventListener('fetch', function (event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  var url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (url.pathname === '/callback') {
    return handleCallback(url);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: CORS_HEADERS,
  });
}

async function handleCallback(url) {
  var code     = url.searchParams.get('code');
  var verifier = url.searchParams.get('verifier');

  if (!code || !verifier) {
    return jsonError('Missing code or verifier', 400);
  }

  // Exchange authorization code for access token
  var tokenBody = new URLSearchParams({
    code:          code,
    grant_type:    'authorization_code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    code_verifier: verifier,
  });

  var tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET),
    },
    body: tokenBody,
  });

  var tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    console.error('Token exchange failed:', JSON.stringify(tokenData));
    return jsonError('Token exchange failed', 400);
  }

  // Fetch X user profile
  var userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', {
    headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
  });

  var userData = await userRes.json();

  if (!userData.data) {
    return jsonError('Failed to fetch user profile', 400);
  }

  var user = userData.data;

  return new Response(JSON.stringify({
    id:                user.id,
    username:          user.username,
    name:              user.name,
    profile_image_url: user.profile_image_url || '',
  }), { headers: CORS_HEADERS });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status:  status,
    headers: CORS_HEADERS,
  });
}
