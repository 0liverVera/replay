/* ============================================
   $REPLAY — Main Site JavaScript
   Handles: nav scroll, fade-in, profile login
            (X username + Solana wallet paste),
            game login gate
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     STORAGE KEY
     ============================================ */
  var PROFILE_KEY = 'replay_profile';
  // Profile shape: { wallet, xUsername, displayName }

  /* ============================================
     DOM REFS
     ============================================ */
  var walletBtn        = document.getElementById('walletBtn');
  var logoutBtn        = document.getElementById('logoutBtn');
  var walletModal      = document.getElementById('walletModal');
  var walletModalClose = document.getElementById('walletModalClose');
  var walletInput      = document.getElementById('walletInput');
  var xUsernameInput   = document.getElementById('xUsernameInput');
  var walletError      = document.getElementById('walletError');
  var walletConfirm    = document.getElementById('walletConfirm');
  var loginGateBtn     = document.getElementById('loginGateBtn');

  /* ============================================
     PROFILE HELPERS
     ============================================ */
  var BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
    catch (e) { return null; }
  }

  function isLoggedIn() {
    var p = getProfile();
    return !!(p && p.wallet);
  }

  function truncateWallet(addr) {
    if (!addr || addr.length < 8) return addr;
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function getDisplayName() {
    var p = getProfile();
    if (!p) return null;
    return p.displayName || null;
  }

  // For backward-compat with game.js
  function getWallet() {
    var p = getProfile();
    return p ? p.wallet : null;
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

    // Reload wallet-specific hi-score in game (if on game page)
    if (window.replayReloadHiScore) window.replayReloadHiScore();
  }

  // Load player's cloud hi-score and sync with local
  async function syncPlayerScore(wallet) {
    if (!wallet || typeof window.replayGetPlayerScore !== 'function') return;
    try {
      var cloudScore = await window.replayGetPlayerScore(wallet);
      var localScore = parseInt(localStorage.getItem('replay_hiscore') || '0', 10);
      var best = Math.max(cloudScore, localScore);
      if (best > 0) {
        localStorage.setItem('replay_hiscore', String(best));
        // Update hi-score display on game page
        var hiScoreEl = document.getElementById('hiScoreDisplay');
        if (hiScoreEl) hiScoreEl.textContent = String(best).padStart(5, '0');
        // Update hi-score on home page arcade preview
        var previewEl = document.querySelector('.arcade-score');
        if (previewEl) previewEl.textContent = 'HI-SCORE: ' + Math.floor(best).toLocaleString();
      }
    } catch (e) {}
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
    if (!loginGate) return;

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
    if (xUsernameInput) { xUsernameInput.value = ''; xUsernameInput.classList.remove('error'); }
    if (walletInput)    { walletInput.value = ''; walletInput.classList.remove('error'); walletInput.focus(); }
    if (walletError)    walletError.classList.add('hidden');
  }

  function closeModal() {
    if (!walletModal) return;
    walletModal.classList.add('hidden');
  }

  function confirmLogin() {
    if (!walletInput) return;

    var addr      = walletInput.value.trim();
    var xHandle   = xUsernameInput ? xUsernameInput.value.trim().replace(/^@/, '') : '';

    if (!BASE58_REGEX.test(addr)) {
      walletInput.classList.add('error');
      if (walletError) {
        walletError.textContent = 'Invalid wallet address';
        walletError.classList.remove('hidden');
      }
      return;
    }

    var displayName = xHandle ? '@' + xHandle : truncateWallet(addr);

    var profile = { wallet: addr, xUsername: xHandle, displayName: displayName };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

    closeModal();
    updateWalletUI();
    syncPlayerScore(addr);
  }

  function logout() {
    localStorage.removeItem(PROFILE_KEY);
    updateWalletUI();
  }

  /* ============================================
     EVENT BINDINGS
     ============================================ */
  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      if (isLoggedIn()) return;
      openModal();
    });
  }

  if (logoutBtn)        logoutBtn.addEventListener('click', logout);
  if (walletModalClose) walletModalClose.addEventListener('click', closeModal);
  if (walletConfirm)    walletConfirm.addEventListener('click', confirmLogin);
  if (loginGateBtn)     loginGateBtn.addEventListener('click', openModal);

  if (walletInput) {
    walletInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirmLogin();
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
     EXPOSE GLOBALS for game.js / leaderboard.js
     ============================================ */
  window.replayGetProfile     = getProfile;
  window.replayGetWallet      = getWallet;
  window.replayIsLoggedIn     = isLoggedIn;
  window.replayGetDisplayName = getDisplayName;
  window.replayTruncateWallet = truncateWallet;

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
  document.querySelectorAll('.terminal-line').forEach(function (line, i) {
    line.style.transitionDelay = (i * 0.15) + 's';
  });

  /* ---- Staggered spec cards ---- */
  document.querySelectorAll('.spec-card').forEach(function (card, i) {
    card.style.transitionDelay = (i * 0.07) + 's';
  });

  /* ---- Smooth anchor scrolling ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = anchor.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  /* ---- Leaderboard refresh button ---- */
  var lbRefreshBtn = document.getElementById('lbRefreshBtn');
  if (lbRefreshBtn && typeof window.replayRenderLeaderboard === 'function') {
    lbRefreshBtn.addEventListener('click', function () {
      window.replayRenderLeaderboard();
    });
  }

  /* ---- High score display on index (wallet-specific) ---- */
  var hiScoreEl = document.querySelector('.arcade-score');
  if (hiScoreEl) {
    var wallet = getWallet();
    var hiKey  = wallet ? 'replay_hiscore_' + wallet : null;
    var stored = hiKey ? localStorage.getItem(hiKey) : null;
    hiScoreEl.textContent = 'HI-SCORE: ' + (stored ? Math.floor(Number(stored)).toLocaleString() : '00000');
  }

  /* ---- Fade-in scroll observer ---- */
  var fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('visible'); });
  }

})();
