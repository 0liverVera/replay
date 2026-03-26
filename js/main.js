/* ============================================
   $REPLAY — Main Site JavaScript
   Handles: nav scroll, fade-in, wallet login,
            smooth interactions
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     WALLET LOGIN SYSTEM
     Paste Solana address, save to localStorage
     ============================================ */
  const WALLET_KEY = 'replay_wallet';

  const walletBtn      = document.getElementById('walletBtn');
  const logoutBtn      = document.getElementById('logoutBtn');
  const walletModal    = document.getElementById('walletModal');
  const walletModalClose = document.getElementById('walletModalClose');
  const walletInput    = document.getElementById('walletInput');
  const walletError    = document.getElementById('walletError');
  const walletConfirm  = document.getElementById('walletConfirm');

  // Base58 characters (Solana addresses are base58-encoded, 32-44 chars)
  const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function getWallet() {
    return localStorage.getItem(WALLET_KEY) || null;
  }

  function truncateWallet(addr) {
    if (!addr || addr.length < 8) return addr;
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function updateWalletUI() {
    const wallet = getWallet();
    if (!walletBtn) return;

    if (wallet) {
      walletBtn.textContent = truncateWallet(wallet);
      walletBtn.classList.add('connected');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
      walletBtn.textContent = 'LOG IN';
      walletBtn.classList.remove('connected');
      if (logoutBtn) logoutBtn.classList.add('hidden');
    }

    // Update player bar on game page
    updatePlayerBar();
  }

  function updatePlayerBar() {
    const playerBarText = document.getElementById('playerBarText');
    if (!playerBarText) return;
    const wallet = getWallet();
    if (wallet) {
      playerBarText.textContent = 'PLAYER: ' + truncateWallet(wallet);
      playerBarText.classList.add('has-wallet');
    } else {
      playerBarText.textContent = 'GUEST';
      playerBarText.classList.remove('has-wallet');
    }
  }

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
    const addr = walletInput.value.trim();

    if (!BASE58_REGEX.test(addr)) {
      walletInput.classList.add('error');
      if (walletError) walletError.classList.remove('hidden');
      return;
    }

    // Valid address — save and update UI
    localStorage.setItem(WALLET_KEY, addr);
    closeModal();
    updateWalletUI();
  }

  function logoutWallet() {
    localStorage.removeItem(WALLET_KEY);
    updateWalletUI();
  }

  // Bind events
  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      const wallet = getWallet();
      if (wallet) {
        // Already logged in — clicking the address does nothing, use logout button
        return;
      }
      openModal();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutWallet);
  }

  if (walletModalClose) {
    walletModalClose.addEventListener('click', closeModal);
  }

  if (walletConfirm) {
    walletConfirm.addEventListener('click', confirmWallet);
  }

  if (walletInput) {
    walletInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirmWallet();
    });
    // Clear error on input
    walletInput.addEventListener('input', function () {
      walletInput.classList.remove('error');
      if (walletError) walletError.classList.add('hidden');
    });
  }

  // Close modal on backdrop click
  if (walletModal) {
    walletModal.addEventListener('click', function (e) {
      if (e.target === walletModal) closeModal();
    });
  }

  // Close modal on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // Initialize wallet state on load
  updateWalletUI();

  // Expose wallet getter for game.js
  window.replayGetWallet = getWallet;
  window.replayTruncateWallet = truncateWallet;

  /* ---- Nav scroll state ---- */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ---- Intersection Observer — fade-in on scroll ---- */
  const fadeTargets = document.querySelectorAll(
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
      if (href === '#') return; // Skip bare # links
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
