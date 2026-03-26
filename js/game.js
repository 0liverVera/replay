/* ============================================
   $REPLAY — Arcade Game Logic
   Endless runner / obstacle dodger
   Canvas-based, requestAnimationFrame loop
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS & CONFIG
     ============================================ */
  const CONFIG = {
    // Player
    PLAYER_WIDTH:        52,
    PLAYER_HEIGHT:       70,
    PLAYER_SPEED:        6,
    PLAYER_SPEED_MOBILE: 5,

    // Obstacles
    OBSTACLE_WIDTH_MIN:  40,
    OBSTACLE_WIDTH_MAX:  80,
    OBSTACLE_HEIGHT_MIN: 35,
    OBSTACLE_HEIGHT_MAX: 55,
    OBSTACLE_SPEED_BASE: 3.5,
    OBSTACLE_SPEED_MAX:  11,
    OBSTACLE_SPAWN_RATE: 90,   // frames between spawns (decreases over time)
    OBSTACLE_SPAWN_MIN:  30,

    // Quarters (collectibles)
    QUARTER_RADIUS:   10,
    QUARTER_SPEED:    2.5,
    QUARTER_SPAWN_RATE: 150,
    QUARTER_POINTS:   50,

    // RESET power-up
    RESET_RADIUS:       14,
    RESET_SPEED:        2,
    RESET_SPAWN_CHANCE: 0.004,  // per-frame probability

    // Scoring
    SCORE_PER_FRAME:    1,
    SPEED_RAMP_INTERVAL: 600,   // frames between speed increases
    SPEED_RAMP_AMOUNT:   0.4,
    SPAWN_RAMP_INTERVAL: 800,   // frames between spawn rate decrease
    SPAWN_RAMP_AMOUNT:   5,

    // Colors
    COLOR_BG:       '#000000',
    COLOR_BLUE:     '#00d4ff',
    COLOR_PINK:     '#ff0080',
    COLOR_GREEN:    '#00ff41',
    COLOR_YELLOW:   '#ffd700',
    COLOR_WHITE:    '#f0f0f0',
    COLOR_MUTED:    '#444444',
    COLOR_OBSTACLE: '#cc3333',

    // Canvas
    CANVAS_BASE_WIDTH:  420,
    CANVAS_BASE_HEIGHT: 560,
  };

  /* ============================================
     OBSTACLE TYPES
     ============================================ */
  const OBSTACLE_TYPES = [
    { label: 'VC',        color: '#cc3333', accent: '#ff4444' },
    { label: 'INSIDER',   color: '#882200', accent: '#cc3300' },
    { label: 'KOL',       color: '#993366', accent: '#cc4488' },
    { label: 'BRIEF',     color: '#553300', accent: '#885500' },
    { label: 'RUGPULL',   color: '#441144', accent: '#771177' },
  ];

  /* ============================================
     GAME STATE
     ============================================ */
  let state = {
    running:      false,
    started:      false,
    score:        0,
    hiScore:      0,
    frame:        0,
    speed:        CONFIG.OBSTACLE_SPEED_BASE,
    spawnRate:    CONFIG.OBSTACLE_SPAWN_RATE,
    obstacles:    [],
    quarters:     [],
    resetItems:   [],
    particles:    [],
    player:       null,
    keys:         { left: false, right: false },
    touch:        { left: false, right: false },
    flashTimer:   0,          // RESET power-up screen flash
    comboCount:   0,
    comboTimer:   0,
  };

  /* ============================================
     DOM REFS
     ============================================ */
  const canvas         = document.getElementById('gameCanvas');
  const ctx            = canvas ? canvas.getContext('2d') : null;
  const canvasContainer = document.getElementById('canvasContainer');
  const startScreen    = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const scoreDisplay   = document.getElementById('scoreDisplay');
  const hiScoreDisplay = document.getElementById('hiScoreDisplay');
  const finalScore     = document.getElementById('finalScore');
  const newRecordBlock = document.getElementById('newRecordBlock');
  const restartBtn     = document.getElementById('restartBtn');
  const touchLeft      = document.getElementById('touchLeft');
  const touchRight     = document.getElementById('touchRight');

  if (!canvas || !ctx) return; // Guard: not on game page

  /* ============================================
     CANVAS SIZING
     Scales to fit the bezel container
     ============================================ */
  function resizeCanvas() {
    if (!canvasContainer) return;
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width  = rect.width  || CONFIG.CANVAS_BASE_WIDTH;
    canvas.height = rect.height || CONFIG.CANVAS_BASE_HEIGHT;
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  /* ============================================
     HI-SCORE — localStorage
     ============================================ */
  function loadHiScore() {
    const stored = localStorage.getItem('replay_hiscore');
    state.hiScore = stored ? parseInt(stored, 10) : 0;
    updateScoreDisplays();
  }

  function saveHiScore(score) {
    if (score > state.hiScore) {
      state.hiScore = score;
      localStorage.setItem('replay_hiscore', score);
      return true; // new record
    }
    return false;
  }

  function updateScoreDisplays() {
    if (scoreDisplay)   scoreDisplay.textContent   = String(state.score).padStart(5, '0');
    if (hiScoreDisplay) hiScoreDisplay.textContent = String(state.hiScore).padStart(5, '0');
  }

  /* ============================================
     PLAYER
     Drawn as a retro arcade cabinet shape
     ============================================ */
  function createPlayer() {
    return {
      x:      canvas.width / 2 - CONFIG.PLAYER_WIDTH / 2,
      y:      canvas.height - CONFIG.PLAYER_HEIGHT - 24,
      w:      CONFIG.PLAYER_WIDTH,
      h:      CONFIG.PLAYER_HEIGHT,
      speed:  isMobile() ? CONFIG.PLAYER_SPEED_MOBILE : CONFIG.PLAYER_SPEED,
      invincible: 0, // frames of invincibility after RESET
    };
  }

  function isMobile() {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  }

  function drawPlayer(p) {
    const x = p.x, y = p.y, w = p.w, h = p.h;
    ctx.save();

    // Invincibility flash
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Cabinet body
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = CONFIG.COLOR_BLUE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y + 10, w, h - 10, 4);
    ctx.fill();
    ctx.stroke();

    // Top hood
    ctx.fillStyle = '#16213e';
    ctx.beginPath();
    ctx.roundRect(x + 4, y, w - 8, 14, [6, 6, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = CONFIG.COLOR_BLUE;
    ctx.stroke();

    // Screen (glowing)
    const screenPad = 7;
    const screenX = x + screenPad;
    const screenY = y + 14;
    const screenW = w - screenPad * 2;
    const screenH = h * 0.42;

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, 3);
    ctx.fill();

    // Screen glow
    ctx.save();
    ctx.shadowColor = CONFIG.COLOR_BLUE;
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = CONFIG.COLOR_BLUE;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, 3);
    ctx.stroke();
    ctx.restore();

    // "$R" on screen
    ctx.fillStyle  = CONFIG.COLOR_BLUE;
    ctx.font       = `bold ${Math.floor(screenH * 0.45)}px 'Press Start 2P', monospace`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$R', screenX + screenW / 2, screenY + screenH / 2);

    // Coin slot
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(x + w / 2 - 10, y + h - 18, 20, 5);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w / 2 - 10, y + h - 18, 20, 5);

    // Side panel lines (detail)
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.62 + i * 6);
      ctx.lineTo(x + 8, y + h * 0.62 + i * 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w - 3, y + h * 0.62 + i * 6);
      ctx.lineTo(x + w - 8, y + h * 0.62 + i * 6);
      ctx.stroke();
    }

    // Wheels (bottom corners)
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath(); ctx.arc(x + 6, y + h + 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 6, y + h + 2, 5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  /* ============================================
     OBSTACLES
     Geometric shapes with labels
     ============================================ */
  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const w = rand(CONFIG.OBSTACLE_WIDTH_MIN, CONFIG.OBSTACLE_WIDTH_MAX);
    const h = rand(CONFIG.OBSTACLE_HEIGHT_MIN, CONFIG.OBSTACLE_HEIGHT_MAX);
    const x = rand(10, canvas.width - w - 10);
    return {
      x, y: -h - 10,
      w, h,
      type,
      speed: state.speed + rand(-0.5, 0.8),
      wobble: Math.random() * Math.PI * 2,  // wobble phase
    };
  }

  function drawObstacle(ob) {
    ctx.save();

    // Slight wobble
    ob.wobble += 0.04;
    const wx = Math.sin(ob.wobble) * 1.5;

    ctx.translate(ob.x + ob.w / 2 + wx, ob.y + ob.h / 2);

    // Shadow/glow
    ctx.shadowColor = ob.type.color;
    ctx.shadowBlur  = 10;

    // Body
    ctx.fillStyle   = ob.type.color;
    ctx.strokeStyle = ob.type.accent;
    ctx.lineWidth   = 1.5;

    // Draw as suit / briefcase depending on type
    if (ob.type.label === 'BRIEF') {
      // Briefcase shape
      ctx.beginPath();
      ctx.roundRect(-ob.w / 2, -ob.h / 2 + 8, ob.w, ob.h - 8, 3);
      ctx.fill();
      ctx.stroke();
      // Handle
      ctx.fillStyle   = ob.type.accent;
      ctx.beginPath();
      ctx.roundRect(-ob.w / 4, -ob.h / 2, ob.w / 2, 12, [4, 4, 0, 0]);
      ctx.fill();
      ctx.stroke();
      // Clasp
      ctx.fillStyle = '#000';
      ctx.fillRect(-5, -ob.h / 2 + 10, 10, 8);
    } else {
      // Suit tie shape
      ctx.beginPath();
      ctx.roundRect(-ob.w / 2, -ob.h / 2, ob.w, ob.h, 4);
      ctx.fill();
      ctx.stroke();
      // Tie
      ctx.fillStyle = ob.type.accent;
      ctx.beginPath();
      ctx.moveTo(-5, -ob.h / 2 + 6);
      ctx.lineTo(5, -ob.h / 2 + 6);
      ctx.lineTo(8, ob.h / 2 - 6);
      ctx.lineTo(0, ob.h / 2 - 2);
      ctx.lineTo(-8, ob.h / 2 - 6);
      ctx.closePath();
      ctx.fill();
    }

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,255,255,0.85)';
    ctx.font       = `${Math.max(7, ob.h * 0.18)}px 'Press Start 2P', monospace`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ob.type.label, 0, 0);

    ctx.restore();
  }

  /* ============================================
     QUARTERS (collectibles)
     ============================================ */
  function spawnQuarter() {
    const r = CONFIG.QUARTER_RADIUS;
    return {
      x: rand(r + 10, canvas.width - r - 10),
      y: -r * 2,
      r,
      speed: CONFIG.QUARTER_SPEED + Math.random() * 0.8,
      spin:  0,
    };
  }

  function drawQuarter(q) {
    q.spin += 0.06;
    ctx.save();
    ctx.translate(q.x, q.y);

    // Coin
    ctx.shadowColor = CONFIG.COLOR_YELLOW;
    ctx.shadowBlur  = 14;

    ctx.fillStyle   = CONFIG.COLOR_YELLOW;
    ctx.beginPath();
    ctx.ellipse(0, 0, q.r * Math.abs(Math.cos(q.spin)) + 2, q.r, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner detail
    ctx.fillStyle = '#c8a800';
    ctx.beginPath();
    ctx.ellipse(0, 0, (q.r - 3) * Math.abs(Math.cos(q.spin)) + 1, q.r - 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // ¢ symbol
    if (Math.abs(Math.cos(q.spin)) > 0.3) {
      ctx.fillStyle  = CONFIG.COLOR_YELLOW;
      ctx.font       = `bold ${q.r}px 'Space Grotesk', sans-serif`;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¢', 0, 1);
    }

    ctx.restore();
  }

  /* ============================================
     RESET POWER-UP
     ============================================ */
  function spawnResetItem() {
    const r = CONFIG.RESET_RADIUS;
    return {
      x: rand(r + 10, canvas.width - r - 10),
      y: -r * 2,
      r,
      speed: CONFIG.RESET_SPEED,
      pulse: 0,
    };
  }

  function drawResetItem(item) {
    item.pulse += 0.08;
    const glow = 14 + Math.sin(item.pulse) * 8;
    ctx.save();
    ctx.translate(item.x, item.y);

    // Outer ring
    ctx.shadowColor = CONFIG.COLOR_GREEN;
    ctx.shadowBlur  = glow;
    ctx.strokeStyle = CONFIG.COLOR_GREEN;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, item.r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#001a00';
    ctx.beginPath();
    ctx.arc(0, 0, item.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = CONFIG.COLOR_GREEN;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle    = CONFIG.COLOR_GREEN;
    ctx.font         = `${item.r * 0.55}px 'Press Start 2P', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RST', 0, 1);

    ctx.restore();
  }

  /* ============================================
     PARTICLES (juice effects)
     ============================================ */
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(1.5, 5);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: rand(0.02, 0.05),
        r:    rand(2, 5),
        color,
      });
    }
  }

  function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.15; // gravity
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawParticles() {
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /* ============================================
     BACKGROUND
     ============================================ */
  function drawBackground() {
    // Base
    ctx.fillStyle = CONFIG.COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.025)';
    ctx.lineWidth   = 1;
    const gridSize  = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Ground line
    const groundY = canvas.height - 20;
    const grad = ctx.createLinearGradient(0, groundY, canvas.width, groundY);
    grad.addColorStop(0,   'transparent');
    grad.addColorStop(0.3, CONFIG.COLOR_BLUE);
    grad.addColorStop(0.7, CONFIG.COLOR_BLUE);
    grad.addColorStop(1,   'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1;
    ctx.shadowColor = CONFIG.COLOR_BLUE;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ============================================
     SCREEN FLASH (RESET power-up)
     ============================================ */
  function drawScreenFlash() {
    if (state.flashTimer <= 0) return;
    const alpha = state.flashTimer / 20 * 0.35;
    ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    state.flashTimer--;
  }

  /* ============================================
     SCORE / COMBO TEXT
     ============================================ */
  function drawHUD() {
    // Combo display
    if (state.comboCount > 1 && state.comboTimer > 0) {
      const alpha = Math.min(1, state.comboTimer / 40);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = CONFIG.COLOR_YELLOW;
      ctx.shadowColor = CONFIG.COLOR_YELLOW;
      ctx.shadowBlur  = 10;
      ctx.font        = `${Math.floor(canvas.width * 0.04)}px 'Press Start 2P', monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`x${state.comboCount} COMBO!`, canvas.width / 2, 12);
      ctx.restore();
    }
    if (state.comboTimer > 0) state.comboTimer--;
  }

  /* ============================================
     COLLISION DETECTION
     AABB for obstacles, circle for quarters/reset
     ============================================ */
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    // Slightly shrink hitbox for fair play
    const margin = 8;
    return (
      ax + margin        < bx + bw - margin &&
      ax + aw - margin   > bx + margin &&
      ay + margin        < by + bh - margin &&
      ay + ah - margin   > by + margin
    );
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  /* ============================================
     GAME LOOP
     ============================================ */
  let raf = null;

  function gameLoop() {
    if (!state.running) return;

    state.frame++;

    // ---- Input / Player movement ----
    const p = state.player;
    const moving = (state.keys.left || state.touch.left) || (state.keys.right || state.touch.right);

    if ((state.keys.left  || state.touch.left)  && p.x > 0) {
      p.x -= p.speed;
    }
    if ((state.keys.right || state.touch.right) && p.x + p.w < canvas.width) {
      p.x += p.speed;
    }
    if (p.invincible > 0) p.invincible--;

    // ---- Score ----
    state.score += CONFIG.SCORE_PER_FRAME;
    updateScoreDisplays();

    // ---- Speed ramp ----
    if (state.frame % CONFIG.SPEED_RAMP_INTERVAL === 0) {
      state.speed = Math.min(state.speed + CONFIG.SPEED_RAMP_AMOUNT, CONFIG.OBSTACLE_SPEED_MAX);
    }

    // ---- Spawn rate ramp ----
    if (state.frame % CONFIG.SPAWN_RAMP_INTERVAL === 0) {
      state.spawnRate = Math.max(state.spawnRate - CONFIG.SPAWN_RAMP_AMOUNT, CONFIG.OBSTACLE_SPAWN_MIN);
    }

    // ---- Spawn obstacles ----
    if (state.frame % Math.floor(state.spawnRate) === 0) {
      state.obstacles.push(spawnObstacle());
    }

    // ---- Spawn quarters ----
    if (state.frame % CONFIG.QUARTER_SPAWN_RATE === 0) {
      state.quarters.push(spawnQuarter());
    }

    // ---- Spawn RESET (random chance) ----
    if (Math.random() < CONFIG.RESET_SPAWN_CHANCE) {
      state.resetItems.push(spawnResetItem());
    }

    // ---- Update obstacles ----
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const ob = state.obstacles[i];
      ob.y += ob.speed;

      // Off screen
      if (ob.y > canvas.height + 10) {
        state.obstacles.splice(i, 1);
        continue;
      }

      // Collision with player
      if (p.invincible === 0 && rectsOverlap(p.x, p.y, p.w, p.h, ob.x, ob.y, ob.w, ob.h)) {
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, CONFIG.COLOR_PINK, 30);
        gameOver();
        return;
      }
    }

    // ---- Update quarters ----
    for (let i = state.quarters.length - 1; i >= 0; i--) {
      const q = state.quarters[i];
      q.y += q.speed;

      if (q.y > canvas.height + 10) {
        state.quarters.splice(i, 1);
        continue;
      }

      // Collect
      if (circleRect(q.x, q.y, q.r, p.x, p.y, p.w, p.h)) {
        state.quarters.splice(i, 1);
        state.score += CONFIG.QUARTER_POINTS;
        state.comboCount++;
        state.comboTimer = 60;
        spawnParticles(q.x, q.y, CONFIG.COLOR_YELLOW, 12);
        updateScoreDisplays();
      }
    }

    // ---- Update RESET items ----
    for (let i = state.resetItems.length - 1; i >= 0; i--) {
      const ri = state.resetItems[i];
      ri.y += ri.speed;

      if (ri.y > canvas.height + 10) {
        state.resetItems.splice(i, 1);
        continue;
      }

      // Collect
      if (circleRect(ri.x, ri.y, ri.r, p.x, p.y, p.w, p.h)) {
        state.resetItems.splice(i, 1);
        // Clear ALL obstacles — that's the reset!
        state.obstacles.forEach(ob => {
          spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, CONFIG.COLOR_GREEN, 8);
        });
        state.obstacles = [];
        state.flashTimer = 20;
        p.invincible     = 90; // 1.5s invincibility
        state.score     += 200;
        spawnParticles(ri.x, ri.y, CONFIG.COLOR_GREEN, 20);
        updateScoreDisplays();
      }
    }

    // ---- Update particles ----
    updateParticles();

    // ---- DRAW ----
    drawBackground();
    drawScreenFlash();

    // Obstacles
    state.obstacles.forEach(ob  => drawObstacle(ob));
    state.quarters.forEach(q    => drawQuarter(q));
    state.resetItems.forEach(ri => drawResetItem(ri));

    // Particles (above collectibles, below player)
    drawParticles();

    // Player
    drawPlayer(p);

    // HUD
    drawHUD();

    raf = requestAnimationFrame(gameLoop);
  }

  /* ============================================
     GAME START / RESET / OVER
     ============================================ */
  function initGame() {
    state.score      = 0;
    state.frame      = 0;
    state.speed      = CONFIG.OBSTACLE_SPEED_BASE;
    state.spawnRate  = CONFIG.OBSTACLE_SPAWN_RATE;
    state.obstacles  = [];
    state.quarters   = [];
    state.resetItems = [];
    state.particles  = [];
    state.flashTimer = 0;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.player     = createPlayer();
    updateScoreDisplays();
  }

  function startGame() {
    if (state.running) return;
    initGame();
    state.running = true;
    state.started = true;
    hideOverlay(startScreen);
    hideOverlay(gameOverScreen);
    raf = requestAnimationFrame(gameLoop);
  }

  function gameOver() {
    state.running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }

    const isNewRecord = saveHiScore(state.score);

    if (finalScore)     finalScore.textContent = String(state.score).padStart(5, '0');
    if (newRecordBlock) newRecordBlock.style.display = isNewRecord ? 'flex' : 'none';

    updateScoreDisplays();
    showOverlay(gameOverScreen);
  }

  function showOverlay(el)  { if (el) el.classList.remove('hidden'); }
  function hideOverlay(el)  { if (el) el.classList.add('hidden'); }

  /* ============================================
     INPUT — Keyboard
     ============================================ */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') state.keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = true;
    if ((e.key === 'Enter' || e.key === ' ') && !state.running) startGame();
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') state.keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
  });

  /* ============================================
     INPUT — Touch zones
     ============================================ */
  function bindTouchZone(el, side) {
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      state.touch[side] = true;
      if (!state.running && !state.started) startGame();
      else if (!state.running && state.started) startGame();
    }, { passive: false });
    el.addEventListener('touchend',   () => { state.touch[side] = false; });
    el.addEventListener('touchcancel',() => { state.touch[side] = false; });
  }

  bindTouchZone(touchLeft,  'left');
  bindTouchZone(touchRight, 'right');

  /* ============================================
     INPUT — Click / tap to start
     ============================================ */
  if (startScreen) {
    startScreen.addEventListener('click', startGame);
    startScreen.addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, { passive: false });
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', startGame);
  }

  /* ============================================
     CANVAS click starts the game too
     ============================================ */
  canvas.addEventListener('click', () => {
    if (!state.running) startGame();
  });

  /* ============================================
     INIT
     ============================================ */
  loadHiScore();
  resizeCanvas();

  // Draw static start background
  drawBackground();

  /* ============================================
     UTILITIES
     ============================================ */
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

})();
