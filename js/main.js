/* ============================================
   $REPLAY — Main Site JavaScript
   Handles: nav scroll, fade-in, wallet button,
            particles/grid, smooth interactions
   ============================================ */

(function () {
  'use strict';

  /* ---- Nav scroll state ---- */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ---- Wallet Connect (placeholder) ---- */
  const walletBtn = document.getElementById('walletBtn');
  if (walletBtn) {
    let connected = false;
    walletBtn.addEventListener('click', () => {
      connected = !connected;
      if (connected) {
        // Fake wallet address display
        walletBtn.textContent = 'CONNECTED: 7x3...3kF';
        walletBtn.classList.add('connected');
      } else {
        walletBtn.textContent = 'CONNECT WALLET';
        walletBtn.classList.remove('connected');
      }
    });
  }

  /* ---- Intersection Observer — fade-in on scroll ---- */
  const fadeTargets = document.querySelectorAll(
    '.section, .spec-card, .terminal-line, .hero-content, .arcade-preview, .community-links'
  );

  if (fadeTargets.length) {
    fadeTargets.forEach(el => el.classList.add('fade-in'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    fadeTargets.forEach(el => observer.observe(el));
  }

  /* ---- Staggered terminal lines ---- */
  const termLines = document.querySelectorAll('.terminal-line');
  termLines.forEach((line, i) => {
    line.style.transitionDelay = `${i * 0.15}s`;
  });

  /* ---- Staggered spec cards ---- */
  const specCards = document.querySelectorAll('.spec-card');
  specCards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.07}s`;
  });

  /* ---- Smooth anchor scrolling for nav links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---- High score display on index (from localStorage) ---- */
  const hiScoreEl = document.querySelector('.arcade-score');
  if (hiScoreEl) {
    const stored = localStorage.getItem('replay_hiscore');
    if (stored) {
      hiScoreEl.textContent = 'HI-SCORE: ' + String(stored).padStart(5, '0');
    }
  }

})();
