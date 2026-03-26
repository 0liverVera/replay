/* ============================================
   $REPLAY — Main Site JavaScript
   Handles: nav scroll, fade-in, wallet login,
            X (Twitter) OAuth 2.0 + PKCE,
            game login gate
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     X OAUTH CONFIG
     1. Create a Twitter app at developer.twitter.com
     2. Enable OAuth 2.0, set Type to "Web App"
     3. Add callback URL: https://YOUR_DOMAIN/callback.html
     4. Paste your Client ID below
     5. Deploy worker.js to Cloudflare Workers and paste the URL below
     ============================================ */
  var X_CONFIG = {
    CLIENT_ID:   '',   // e.g. 'abc123XYZ...'
    WORKER_URL:  '',   // e.g. 'https://replay-auth.yourname.workers.dev'
  };

  /* ============================================
     STORAGE KEYS
     ============================================ */
  var WALLET_KEY = 'replay_wallet';
  var X_KEY      = 'replay_x_user';

  /* ============================================
     DOM REFS
     ============================================ */
  var walletBtn        = document.getElementById('walletBtn');
  var logoutBtn        = document.getElementById('logoutBtn');
  var walletModal      = document.getElementById('walletModal');
  var walletModalClose = document.getElementById('walletModalClose');
  var walletInput      = document.getElementById('walletInput');
  var walletError      = document.getElementById('walletError');
  var walletConfirm    = document.getElementById('walletConfirm');
  var xLoginBtn        = document.getElementById('xLoginBtn');
  var loginGateBtn     = document.getElementById('loginGateBtn');

  /* ============================================
     AUTH STATE HELPERS
     ============================================ */
  var BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function getWallet() {
    return localStorage.getItem(WALLET_KEY) || null;
  }

  function getXUser() {
    try { return JSON.parse(localStorage.getItem(X_KEY)) || null; }
    catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!(getWallet() || getXUser());
  }

  function truncateWallet(addr) {
    if (!addr || addr.length < 8) return addr;
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function getDisplayName() {
    var xUser = getXUser();
    if (xUser && xUser.username) return '@' + xUser.username;
    var wallet = getWallet();
    if (wallet) return truncateWallet(wallet);
    return null;
  }

  /* ============================================
     UI UPDATES
     ============================================ */
  function updateWalletUI() {
    if (!walletBtn) return;
    var displayName = getDisplayName();

    if (displayName) {
      walletBtn.textContent = displayName;
      walletBtn.classList.add('connected');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
      walletBtn.textContent = 'LOG IN';
      walletBtn.classList.remove('connected');
      if (logoutBtn) logoutBtn.classList.add('hidden');
    }

    updatePlayerBar();
    updateLoginGate();
  }

  function updatePlayerBar() {
    var playerBarText = document.getElementById('playerBarText');
    if (!playerBarText) return;
    var displayName = getDisplayName();
    if (displayName) {
      playerBarText.textContent = 'PLAYER: ' + displayName;
      playerBarText.classList.add('has-wallet');
    } else {
      playerBarText.textContent = 'GUEST';
      playerBarText.classList.remove('has-wallet');
    }
  }

  function updateLoginGate() {
    var loginGate   = document.getElementById('loginGate');
    var startScreen = document.getElementById('startScreen');
    if (!loginGate) return; // not on game page

    if (isLoggedIn()) {
      loginGate.classList.add('hidden');
      if (startScreen) startScreen.classList.remove('hidden');
    } else {
      loginGate.classList.remove('hidden');
      if (startScreen) startScreen.classList.add('hidden');
    }
  }

  /* ============================================
     MODAL
     ============================================ */
  function openModal() {
    if (!walletModal) return;
    walletModal.classList.remove('hidden');
    if (walletInput) {
      walletInput.value = '';
      walletInput.classList.remove('error');
      walletInput.focus();
    }
    if (walletError) walletError.classList.add('hidden');
  }

  function closeModal() {
    if (!walletModal) return;
    walletModal.classList.add('hidden');
  }

  function confirmWallet() {
    if (!walletInput) return;
    var addr = walletInput.value.trim();

    if (!BASE58_REGEX.test(addr)) {
      walletInput.classList.add('error');
      if (walletError) walletError.classList.remove('hidden');
      return;
    }

    localStorage.setItem(WALLET_KEY, addr);
    closeModal();
    updateWalletUI();
  }

  function logout() {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(X_KEY);
    updateWalletUI();
  }

  /* ============================================
     EVENT BINDINGS — wallet modal
     ============================================ */
  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      if (isLoggedIn()) return; // clicking display name does nothing — use logout
      openModal();
    });
  }

  if (logoutBtn)        logoutBtn.addEventListener('click', logout);
  if (walletModalClose) walletModalClose.addEventListener('click', closeModal);
  if (walletConfirm)    walletConfirm.addEventListener('click', confirmWallet);
  if (loginGateBtn)     loginGateBtn.addEventListener('click', openModal);

  if (walletInput) {
    walletInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirmWallet();
    });
    walletInput.addEventListener('input', function () {
      walletInput.classList.remove('error');
      if (walletError) walletError.classList.add('hidden');
    });
  }

  if (walletModal) {
    walletModal.addEventListener('click', function (e) {
      if (e.target === walletModal) closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ============================================
     X (TWITTER) OAUTH 2.0 + PKCE
     ============================================ */
  function generateCodeVerifier() {
    var array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function generateCodeChallenge(verifier) {
    var data = new TextEncoder().encode(verifier);
    return window.crypto.subtle.digest('SHA-256', data).then(function (digest) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    });
  }

  function getCallbackUrl() {
    var parts = window.location.pathname.split('/');
    parts[parts.length - 1] = 'callback.html';
    return window.location.origin + parts.join('/');
  }

  function loginWithX() {
    if (!X_CONFIG.CLIENT_ID) {
      alert('X login is not configured yet. Please connect a Solana wallet to continue.');
      return;
    }

    var verifier = generateCodeVerifier();
    generateCodeChallenge(verifier).then(function (challenge) {
      var state = Math.random().toString(36).slice(2);

      sessionStorage.setItem('replay_pkce_verifier', verifier);
      sessionStorage.setItem('replay_oauth_state', state);
      sessionStorage.setItem('replay_return_url', window.location.href);

      var params = new URLSearchParams({
        response_type:         'code',
        client_id:             X_CONFIG.CLIENT_ID,
        redirect_uri:          getCallbackUrl(),
        scope:                 'tweet.read users.read',
        state:                 state,
        code_challenge:        challenge,
        code_challenge_method: 'S256',
      });

      window.location.href = 'https://twitter.com/i/oauth2/authorize?' + params.toString();
    });
  }

  if (xLoginBtn) xLoginBtn.addEventListener('click', loginWithX);

  /* ============================================
     EXPOSE GLOBALS for game.js
     ============================================ */
  window.replayGetWallet       = getWallet;
  window.replayTruncateWallet  = truncateWallet;
  window.replayIsLoggedIn      = isLoggedIn;
  window.replayGetDisplayName  = getDisplayName;

  /* ============================================
     INIT
     ============================================ */
  updateWalletUI();

  /* ---- Nav scroll state ---- */
  var nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ---- Intersection Observer — fade-in on scroll ---- */
  var fadeTargets = document.querySelectorAll(
    '.section, .spec-card, .terminal-line, .hero-content, .arcade-preview, .community-links'
  );

  if (fadeTargets.length) {
    fadeTargets.forEach(function (el) { el.classList.add('fade-in'); });

    var observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    fadeTargets.forEach(function (el) { observer.observe(el); });
  }

  /* ---- Staggered terminal lines ---- */
  var termLines = document.querySelectorAll('.terminal-line');
  termLines.forEach(function (line, i) {
    line.style.transitionDelay = (i * 0.15) + 's';
  });

  /* ---- Staggered spec cards ---- */
  var specCards = document.querySelectorAll('.spec-card');
  specCards.forEach(function (card, i) {
    card.style.transitionDelay = (i * 0.07) + 's';
  });

  /* ---- Smooth anchor scrolling for nav links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = anchor.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---- High score display on index (from localStorage) ---- */
  var hiScoreEl = document.querySelector('.arcade-score');
  if (hiScoreEl) {
    var stored = localStorage.getItem('replay_hiscore');
    if (stored) {
      hiScoreEl.textContent = 'HI-SCORE: ' + String(stored).padStart(5, '0');
    }
  }

})();
