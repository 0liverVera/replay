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
  var CONFIG = {
    // Player
    PLAYER_WIDTH:        52,
    PLAYER_HEIGHT:       70,
    PLAYER_SPEED:        6.5,
    PLAYER_SPEED_MOBILE: 5.5,
    PLAYER_ACCEL:        0.6,    // acceleration for smoother movement
    PLAYER_DECEL:        0.75,   // deceleration multiplier (friction)

    // Obstacles
    OBSTACLE_WIDTH_MIN:  40,
    OBSTACLE_WIDTH_MAX:  80,
    OBSTACLE_HEIGHT_MIN: 35,
    OBSTACLE_HEIGHT_MAX: 55,
    OBSTACLE_SPEED_BASE: 5.0,   // start fast
    OBSTACLE_SPEED_MAX:  14,    // max speed — fast but readable
    OBSTACLE_SPAWN_RATE: 140,   // start moderate
    OBSTACLE_SPAWN_MIN:  28,    // end dense but not overwhelming

    // Quarters (collectibles)
    QUARTER_RADIUS:   10,
    QUARTER_SPEED:    1.0,      // slow at start, scales with game speed
    QUARTER_SPAWN_RATE: 180,
    QUARTER_POINTS:   50,

    // RESET power-up
    RESET_RADIUS:       14,
    RESET_SPEED:        1.0,
    RESET_SPAWN_CHANCE: 0.003,

    // Scoring
    SCORE_PER_FRAME:    1,
    SPEED_RAMP_INTERVAL: 480,   // ramp every ~8s
    SPEED_RAMP_AMOUNT:   0.7,   // noticeable jumps
    SPAWN_RAMP_INTERVAL: 600,
    SPAWN_RAMP_AMOUNT:   8,

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
  var OBSTACLE_TYPES = [
    { label: 'VC',        color: '#cc3333', accent: '#ff4444' },
    { label: 'INSIDER',   color: '#882200', accent: '#cc3300' },
    { label: 'KOL',       color: '#993366', accent: '#cc4488' },
    { label: 'BRIEF',     color: '#553300', accent: '#885500' },
    { label: 'RUGPULL',   color: '#441144', accent: '#771177' },
  ];

  /* ============================================
     GAME STATE
     ============================================ */
  var state = {
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
    scorePopups:  [],
    player:       null,
    keys:         { left: false, right: false },
    touch:        { left: false, right: false },
    flashTimer:   0,
    comboCount:   0,
    comboTimer:   0,
    shakeTimer:   0,
    shakeIntensity: 0,
    speedUpTimer:   0,
    speedLevel:     0,
    milestoneTimer: 0,
    milestoneText:  '',
    deathAnimating: false,
    deathFrame:     0,
    isNewRecord:    false,

    // Delta-time tracking
    lastTime:       0,        // last RAF timestamp
    spawnAccum:     0,        // obstacle spawn accumulator
    quarterAccum:   0,        // quarter spawn accumulator
    speedAccum:     0,        // speed ramp accumulator
    spawnRampAccum: 0,        // spawn-rate ramp accumulator
  };

  /* ============================================
     DOM REFS
     ============================================ */
  var canvas          = document.getElementById('gameCanvas');
  var ctx             = canvas ? canvas.getContext('2d') : null;
  var canvasContainer = document.getElementById('canvasContainer');
  var startScreen     = document.getElementById('startScreen');
  var gameOverScreen  = document.getElementById('gameOverScreen');
  var scoreDisplay    = document.getElementById('scoreDisplay');
  var hiScoreDisplay  = document.getElementById('hiScoreDisplay');
  var finalScore      = document.getElementById('finalScore');
  var newRecordBlock  = document.getElementById('newRecordBlock');
  var restartBtn      = document.getElementById('restartBtn');
  var touchLeft       = document.getElementById('touchLeft');
  var touchRight      = document.getElementById('touchRight');

  if (!canvas || !ctx) return; // Guard: not on game page

  /* ============================================
     CANVAS SIZING
     Scales to fit the bezel container
     ============================================ */
  function resizeCanvas() {
    if (!canvasContainer) return;
    var rect = canvasContainer.getBoundingClientRect();
    var w = Math.floor(rect.width)  || CONFIG.CANVAS_BASE_WIDTH;
    var h = Math.floor(rect.height) || CONFIG.CANVAS_BASE_HEIGHT;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  /* ============================================
     HI-SCORE — localStorage
     ============================================ */
  function loadHiScore() {
    var stored = localStorage.getItem('replay_hiscore');
    state.hiScore = stored ? parseInt(stored, 10) : 0;
    updateScoreDisplays();
  }

  function saveHiScore(score) {
    if (score > state.hiScore) {
      state.hiScore = score;
      localStorage.setItem('replay_hiscore', String(score));
      return true; // new record
    }
    return false;
  }

  function updateScoreDisplays() {
    if (scoreDisplay)   scoreDisplay.textContent   = String(Math.floor(state.score)).padStart(5, '0');
    if (hiScoreDisplay) hiScoreDisplay.textContent = String(Math.floor(state.hiScore)).padStart(5, '0');
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
      maxSpeed: isMobile() ? CONFIG.PLAYER_SPEED_MOBILE : CONFIG.PLAYER_SPEED,
      vx:     0,
      invincible: 0, // frames of invincibility after RESET
    };
  }

  function isMobile() {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  }

  // On mobile, skip shadowBlur — it's the #1 canvas perf killer on phones
  var lowPerf = isMobile();

  function glow(color, blur) {
    if (lowPerf) { ctx.shadowBlur = 0; return; }
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
  }

  function noGlow() { ctx.shadowBlur = 0; }

  function drawPlayer(p) {
    var x = p.x, y = p.y, w = p.w, h = p.h;
    ctx.save();

    // Invincibility flash
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Slight tilt based on velocity for game feel
    var tilt = p.vx * 0.015;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(tilt);
    ctx.translate(-(x + w / 2), -(y + h / 2));

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
    var screenPad = 7;
    var screenX = x + screenPad;
    var screenY = y + 14;
    var screenW = w - screenPad * 2;
    var screenH = h * 0.42;

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, 3);
    ctx.fill();

    // Screen glow
    ctx.save();
    glow(CONFIG.COLOR_BLUE, 12);
    ctx.strokeStyle = CONFIG.COLOR_BLUE;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, 3);
    ctx.stroke();
    ctx.restore();

    // "$R" on screen
    ctx.fillStyle  = CONFIG.COLOR_BLUE;
    ctx.font       = 'bold ' + Math.floor(screenH * 0.45) + "px 'Press Start 2P', monospace";
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
    for (var i = 0; i < 3; i++) {
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
    var type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    var w = rand(CONFIG.OBSTACLE_WIDTH_MIN, CONFIG.OBSTACLE_WIDTH_MAX);
    var h = rand(CONFIG.OBSTACLE_HEIGHT_MIN, CONFIG.OBSTACLE_HEIGHT_MAX);
    var x = rand(10, canvas.width - w - 10);
    return {
      x: x, y: -h - 10,
      w: w, h: h,
      type: type,
      speed: state.speed + rand(-0.5, 0.8),
      wobble: Math.random() * Math.PI * 2,
      rotation: 0,
    };
  }

  function drawObstacle(ob) {
    ctx.save();

    // Slight wobble
    ob.wobble += 0.04;
    var wx = Math.sin(ob.wobble) * 1.5;

    ctx.translate(ob.x + ob.w / 2 + wx, ob.y + ob.h / 2);

    // Shadow/glow
    glow(ob.type.color, 10);

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
    noGlow();
    ctx.fillStyle  = 'rgba(255,255,255,0.85)';
    ctx.font       = Math.max(7, ob.h * 0.18) + "px 'Press Start 2P', monospace";
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ob.type.label, 0, 0);

    ctx.restore();
  }

  /* ============================================
     QUARTERS (collectibles)
     ============================================ */
  function spawnQuarter() {
    var r = CONFIG.QUARTER_RADIUS;
    // Quarter speed scales with current game speed so they stay catchable
    var qs = CONFIG.QUARTER_SPEED + state.speed * 0.35 + Math.random() * 0.5;
    return {
      x: rand(r + 10, canvas.width - r - 10),
      y: -r * 2,
      r: r,
      speed: qs,
      spin:  0,
    };
  }

  function drawQuarter(q) {
    q.spin += 0.06;
    ctx.save();
    ctx.translate(q.x, q.y);

    // Coin
    glow(CONFIG.COLOR_YELLOW, 14);

    ctx.fillStyle   = CONFIG.COLOR_YELLOW;
    ctx.beginPath();
    ctx.ellipse(0, 0, q.r * Math.abs(Math.cos(q.spin)) + 2, q.r, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner detail
    ctx.fillStyle = '#c8a800';
    ctx.beginPath();
    ctx.ellipse(0, 0, (q.r - 3) * Math.abs(Math.cos(q.spin)) + 1, q.r - 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Symbol
    if (Math.abs(Math.cos(q.spin)) > 0.3) {
      ctx.fillStyle  = CONFIG.COLOR_YELLOW;
      ctx.font       = 'bold ' + q.r + "px 'Space Grotesk', sans-serif";
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u00A2', 0, 1);
    }

    ctx.restore();
  }

  /* ============================================
     RESET POWER-UP
     ============================================ */
  function spawnResetItem() {
    var r = CONFIG.RESET_RADIUS;
    return {
      x: rand(r + 10, canvas.width - r - 10),
      y: -r * 2,
      r: r,
      speed: CONFIG.RESET_SPEED + state.speed * 0.2,
      pulse: 0,
    };
  }

  function drawResetItem(item) {
    item.pulse += 0.08;
    var glowAmt = 14 + Math.sin(item.pulse) * 8;
    ctx.save();
    ctx.translate(item.x, item.y);

    // Outer ring
    glow(CONFIG.COLOR_GREEN, glowAmt);
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
    ctx.font         = (item.r * 0.55) + "px 'Press Start 2P', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RST', 0, 1);

    ctx.restore();
  }

  /* ============================================
     PARTICLES (juice effects)
     ============================================ */
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = rand(1.5, 5);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: rand(0.02, 0.05),
        r:    rand(2, 5),
        color: color,
      });
    }
  }

  function updateParticles(dt) {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 0.15 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      glow(p.color, 4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ============================================
     SCORE POPUPS (floating text)
     ============================================ */
  function spawnScorePopup(x, y, text, color) {
    state.scorePopups.push({
      x: x, y: y,
      text: text,
      color: color,
      life: 1,
      decay: 0.025,
    });
  }

  function updateScorePopups(dt) {
    for (var i = state.scorePopups.length - 1; i >= 0; i--) {
      var sp = state.scorePopups[i];
      sp.y    -= 1.5 * dt;
      sp.life -= sp.decay * dt;
      if (sp.life <= 0) state.scorePopups.splice(i, 1);
    }
  }

  function drawScorePopups() {
    for (var i = 0; i < state.scorePopups.length; i++) {
      var sp = state.scorePopups[i];
      ctx.save();
      ctx.globalAlpha = sp.life;
      ctx.fillStyle   = sp.color;
      ctx.font        = "bold 10px 'Press Start 2P', monospace";
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      glow(sp.color, 6);
      ctx.fillText(sp.text, sp.x, sp.y);
      ctx.restore();
    }
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
    var gridSize  = 40;
    for (var x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (var y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Side danger lane indicators (very subtle)
    var grad = ctx.createLinearGradient(0, 0, 20, 0);
    grad.addColorStop(0, 'rgba(255, 0, 128, 0.04)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 20, canvas.height);

    var grad2 = ctx.createLinearGradient(canvas.width, 0, canvas.width - 20, 0);
    grad2.addColorStop(0, 'rgba(255, 0, 128, 0.04)');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);

    // Ground line
    var groundY = canvas.height - 20;
    var gGrad = ctx.createLinearGradient(0, groundY, canvas.width, groundY);
    gGrad.addColorStop(0,   'transparent');
    gGrad.addColorStop(0.3, CONFIG.COLOR_BLUE);
    gGrad.addColorStop(0.7, CONFIG.COLOR_BLUE);
    gGrad.addColorStop(1,   'transparent');
    ctx.strokeStyle = gGrad;
    ctx.lineWidth   = 1;
    glow(CONFIG.COLOR_BLUE, 6);
    ctx.beginPath();
    ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY);
    ctx.stroke();
    noGlow();
  }

  /* ============================================
     SCREEN FLASH (RESET power-up)
     ============================================ */
  function drawScreenFlash() {
    if (state.flashTimer <= 0) return;
    var alpha = (state.flashTimer / 20) * 0.35;
    ctx.fillStyle = 'rgba(0, 255, 65, ' + alpha + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /* ============================================
     SCREEN SHAKE
     ============================================ */
  function applyScreenShake() {
    if (state.shakeTimer > 0) {
      var sx = (Math.random() - 0.5) * state.shakeIntensity;
      var sy = (Math.random() - 0.5) * state.shakeIntensity;
      ctx.translate(sx, sy);
      state.shakeTimer--;
      state.shakeIntensity *= 0.9;
    }
  }

  /* ============================================
     SCORE / COMBO TEXT
     ============================================ */
  function drawHUD() {
    if (state.comboCount > 1 && state.comboTimer > 0) {
      var alpha = Math.min(1, state.comboTimer / 40);
      var scale = 1 + Math.max(0, 60 - state.comboTimer) * 0.003;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = CONFIG.COLOR_YELLOW;
      glow(CONFIG.COLOR_YELLOW, 10);
      ctx.font      = Math.floor(canvas.width * 0.04 * scale) + "px 'Press Start 2P', monospace";
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('x' + state.comboCount + ' COMBO!', canvas.width / 2, 12);
      ctx.restore();
    }
  }

  /* ============================================
     SPEED UP ALERT
     ============================================ */
  function drawSpeedUpAlert() {
    if (state.speedUpTimer <= 0) return;

    var t = state.speedUpTimer;

    // Fade in fast, hold, fade out
    var alpha;
    if (t > 80)       alpha = (100 - t) / 20;        // fade in
    else if (t > 30)  alpha = 1;                      // hold
    else              alpha = t / 30;                 // fade out

    // Scale: pop in large, settle down
    var scale = t > 80 ? 0.5 + (100 - t) / 40 : 1.0;

    var cx = canvas.width / 2;
    var cy = canvas.height / 2;

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Background pill
    var label = 'SPEED UP!';
    ctx.font = Math.floor(canvas.width * 0.055) + "px 'Press Start 2P', monospace";
    var tw = ctx.measureText(label).width;
    var pw = tw + 40, ph = 44;

    ctx.fillStyle   = 'rgba(0,0,0,0.75)';
    ctx.strokeStyle = CONFIG.COLOR_PINK;
    ctx.lineWidth   = 2;
    glow(CONFIG.COLOR_PINK, 20);
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.stroke();

    // Text
    glow(CONFIG.COLOR_PINK, 12);
    ctx.fillStyle   = CONFIG.COLOR_PINK;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);

    // Speed level indicator dots
    glow(CONFIG.COLOR_PINK, 6);
    for (var d = 0; d < Math.min(state.speedLevel, 10); d++) {
      var dotX = (d - Math.min(state.speedLevel, 10) / 2 + 0.5) * 14;
      ctx.fillStyle = d < state.speedLevel ? CONFIG.COLOR_PINK : CONFIG.COLOR_MUTED;
      ctx.beginPath();
      ctx.arc(dotX, ph / 2 + 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ============================================
     MILESTONE NOTIFICATION
     ============================================ */
  function drawMilestone() {
    if (state.milestoneTimer <= 0) return;

    var t = state.milestoneTimer;

    var alpha;
    if (t > 100)      alpha = (120 - t) / 20;
    else if (t > 30)  alpha = 1;
    else              alpha = t / 30;

    var cy = canvas.height * 0.3;
    var cx = canvas.width / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.font        = Math.floor(canvas.width * 0.045) + "px 'Press Start 2P', monospace";
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.COLOR_YELLOW;
    glow(CONFIG.COLOR_YELLOW, 18);
    ctx.fillText('★ ' + state.milestoneText + ' ★', cx, cy);

    ctx.restore();
  }

  /* ============================================
     COLLISION DETECTION
     AABB for obstacles, circle for quarters/reset
     ============================================ */
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    // Slightly shrink hitbox for fair play
    var margin = 8;
    return (
      ax + margin        < bx + bw - margin &&
      ax + aw - margin   > bx + margin &&
      ay + margin        < by + bh - margin &&
      ay + ah - margin   > by + margin
    );
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    var closestX = clamp(cx, rx, rx + rw);
    var closestY = clamp(cy, ry, ry + rh);
    var dx = cx - closestX;
    var dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  /* ============================================
     GAME LOOP
     ============================================ */
  var raf = null;

  function gameLoop(timestamp) {
    if (!state.running) return;

    // ---- Delta time (normalized: 1.0 = one 60fps frame) ----
    // Clamp to max 2.5x to prevent huge jumps after tab switch / pause
    var dt = state.lastTime === 0 ? 1 : clamp((timestamp - state.lastTime) / 16.667, 0.1, 2.5);
    state.lastTime = timestamp;

    state.frame += dt;

    // ---- Input / Player movement (smooth acceleration, scaled by dt) ----
    var p = state.player;
    var wantLeft  = state.keys.left  || state.touch.left;
    var wantRight = state.keys.right || state.touch.right;

    if (wantLeft && !wantRight) {
      p.vx -= CONFIG.PLAYER_ACCEL * dt;
      if (p.vx < -p.maxSpeed) p.vx = -p.maxSpeed;
    } else if (wantRight && !wantLeft) {
      p.vx += CONFIG.PLAYER_ACCEL * dt;
      if (p.vx > p.maxSpeed) p.vx = p.maxSpeed;
    } else {
      p.vx *= Math.pow(CONFIG.PLAYER_DECEL, dt);
      if (Math.abs(p.vx) < 0.1) p.vx = 0;
    }

    p.x += p.vx * dt;

    // Clamp to canvas bounds
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.w > canvas.width) { p.x = canvas.width - p.w; p.vx = 0; }

    if (p.invincible > 0) p.invincible -= dt;

    // ---- Score ----
    var prevScore = Math.floor(state.score);
    state.score += CONFIG.SCORE_PER_FRAME * dt;
    updateScoreDisplays();

    // ---- Speed ramp (accumulator-based, frame-rate independent) ----
    state.speedAccum += dt;
    if (state.speedAccum >= CONFIG.SPEED_RAMP_INTERVAL) {
      state.speedAccum -= CONFIG.SPEED_RAMP_INTERVAL;
      var newSpeed = Math.min(state.speed + CONFIG.SPEED_RAMP_AMOUNT, CONFIG.OBSTACLE_SPEED_MAX);
      if (newSpeed !== state.speed) {
        state.speed = newSpeed;
        state.speedLevel++;
        state.speedUpTimer = 100;
      }
    }

    // ---- Spawn rate ramp ----
    state.spawnRampAccum += dt;
    if (state.spawnRampAccum >= CONFIG.SPAWN_RAMP_INTERVAL) {
      state.spawnRampAccum -= CONFIG.SPAWN_RAMP_INTERVAL;
      state.spawnRate = Math.max(state.spawnRate - CONFIG.SPAWN_RAMP_AMOUNT, CONFIG.OBSTACLE_SPAWN_MIN);
    }

    // ---- Score milestones ----
    var milestones = [500, 1000, 2500, 5000, 10000];
    for (var mi = 0; mi < milestones.length; mi++) {
      var ms = milestones[mi];
      if (prevScore < ms && Math.floor(state.score) >= ms) {
        state.milestoneText = ms.toLocaleString() + ' PTS!';
        state.milestoneTimer = 120;
      }
    }

    // ---- Spawn obstacles (accumulator) ----
    state.spawnAccum += dt;
    if (state.spawnAccum >= state.spawnRate) {
      state.spawnAccum -= state.spawnRate;
      state.obstacles.push(spawnObstacle());
    }

    // ---- Spawn quarters (accumulator) ----
    state.quarterAccum += dt;
    if (state.quarterAccum >= CONFIG.QUARTER_SPAWN_RATE) {
      state.quarterAccum -= CONFIG.QUARTER_SPAWN_RATE;
      state.quarters.push(spawnQuarter());
    }

    // ---- Spawn RESET (random chance, scaled by dt) ----
    if (Math.random() < CONFIG.RESET_SPAWN_CHANCE * dt) {
      state.resetItems.push(spawnResetItem());
    }

    // ---- Timers (all scaled by dt) ----
    if (state.comboTimer > 0)   { state.comboTimer   -= dt; if (state.comboTimer <= 0) { state.comboTimer = 0; state.comboCount = 0; } }
    if (state.speedUpTimer > 0)   state.speedUpTimer  -= dt;
    if (state.milestoneTimer > 0) state.milestoneTimer -= dt;
    if (state.flashTimer > 0)     state.flashTimer     -= dt;
    if (state.shakeTimer > 0)   { state.shakeTimer    -= dt; state.shakeIntensity *= Math.pow(0.9, dt); }

    // ---- Update obstacles ----
    for (var i = state.obstacles.length - 1; i >= 0; i--) {
      var ob = state.obstacles[i];
      ob.y += ob.speed * dt;

      // Off screen
      if (ob.y > canvas.height + 10) {
        state.obstacles.splice(i, 1);
        continue;
      }

      // Collision with player
      if (p.invincible <= 0 && rectsOverlap(p.x, p.y, p.w, p.h, ob.x, ob.y, ob.w, ob.h)) {
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, CONFIG.COLOR_PINK, 30);
        state.shakeTimer = 12;
        state.shakeIntensity = 10;
        gameOver();
        return;
      }
    }

    // ---- Update quarters ----
    for (var j = state.quarters.length - 1; j >= 0; j--) {
      var q = state.quarters[j];
      q.y += q.speed * dt;

      if (q.y > canvas.height + 10) {
        state.quarters.splice(j, 1);
        state.comboCount = 0;
        state.comboTimer = 0;
        continue;
      }

      // Collect
      if (circleRect(q.x, q.y, q.r, p.x, p.y, p.w, p.h)) {
        state.quarters.splice(j, 1);
        var bonus = CONFIG.QUARTER_POINTS;
        state.comboCount++;
        state.comboTimer = 90;
        if (state.comboCount > 1) {
          bonus = Math.floor(bonus * (1 + state.comboCount * 0.25));
        }
        state.score += bonus;
        spawnParticles(q.x, q.y, CONFIG.COLOR_YELLOW, 12);
        spawnScorePopup(q.x, q.y - 10, '+' + bonus, CONFIG.COLOR_YELLOW);
        updateScoreDisplays();
      }
    }

    // ---- Update RESET items ----
    for (var k = state.resetItems.length - 1; k >= 0; k--) {
      var ri = state.resetItems[k];
      ri.y += ri.speed * dt;

      if (ri.y > canvas.height + 10) {
        state.resetItems.splice(k, 1);
        continue;
      }

      // Collect
      if (circleRect(ri.x, ri.y, ri.r, p.x, p.y, p.w, p.h)) {
        state.resetItems.splice(k, 1);
        // Clear ALL obstacles
        for (var m = 0; m < state.obstacles.length; m++) {
          var o = state.obstacles[m];
          spawnParticles(o.x + o.w / 2, o.y + o.h / 2, CONFIG.COLOR_GREEN, 8);
        }
        state.obstacles = [];
        state.flashTimer = 20;
        state.shakeTimer = 8;
        state.shakeIntensity = 6;
        p.invincible     = 90; // 1.5s invincibility
        state.score     += 200;
        spawnParticles(ri.x, ri.y, CONFIG.COLOR_GREEN, 20);
        spawnScorePopup(ri.x, ri.y - 10, '+200 RESET!', CONFIG.COLOR_GREEN);
        updateScoreDisplays();
      }
    }

    // ---- Update particles & popups ----
    updateParticles(dt);
    updateScorePopups(dt);

    // ---- DRAW ----
    ctx.save();
    applyScreenShake();

    drawBackground();
    drawScreenFlash();

    // Obstacles
    for (var a = 0; a < state.obstacles.length; a++) drawObstacle(state.obstacles[a]);
    for (var b = 0; b < state.quarters.length; b++)  drawQuarter(state.quarters[b]);
    for (var c = 0; c < state.resetItems.length; c++) drawResetItem(state.resetItems[c]);

    // Particles (above collectibles, below player)
    drawParticles();

    // Score popups
    drawScorePopups();

    // Player
    drawPlayer(p);

    // HUD
    drawHUD();

    // Alerts (above everything)
    drawSpeedUpAlert();
    drawMilestone();

    ctx.restore();

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
    state.scorePopups = [];
    state.flashTimer = 0;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.shakeTimer     = 0;
    state.shakeIntensity = 0;
    state.speedUpTimer   = 0;
    state.speedLevel     = 0;
    state.milestoneTimer = 0;
    state.milestoneText  = '';
    state.deathAnimating = false;
    state.deathFrame     = 0;
    state.isNewRecord    = false;
    state.lastTime       = 0;
    state.spawnAccum     = 0;
    state.quarterAccum   = 0;
    state.speedAccum     = 0;
    state.spawnRampAccum = 0;
    state.player         = createPlayer();
    updateScoreDisplays();
  }

  function startGame() {
    if (state.running || state.deathAnimating) return;
    resizeCanvas(); // re-measure in case layout changed
    initGame();
    state.running = true;
    state.started = true;
    hideOverlay(startScreen);
    hideOverlay(gameOverScreen);
    raf = requestAnimationFrame(gameLoop);
  }

  function gameOver() {
    state.running      = false;
    state.deathAnimating = true;
    state.deathFrame   = 0;
    if (raf) { cancelAnimationFrame(raf); raf = null; }

    // Big death explosion: lots of particles, hard shake
    var p = state.player;
    state.shakeIntensity = 18;
    state.shakeTimer     = 40;
    spawnParticles(p.x + p.w / 2, p.y + p.h / 2, CONFIG.COLOR_PINK,   50);
    spawnParticles(p.x + p.w / 2, p.y + p.h / 2, CONFIG.COLOR_WHITE,  20);
    spawnParticles(p.x + p.w / 2, p.y + p.h / 2, CONFIG.COLOR_BLUE,   15);

    // Red screen flash
    state.flashTimer = 0; // repurpose for red death flash
    var deathFlash = 30;

    state.isNewRecord = saveHiScore(state.score);

    // Run death animation loop for ~60 frames then show overlay
    function deathLoop() {
      state.deathFrame++;

      ctx.save();

      // Screen shake
      if (state.shakeTimer > 0) {
        var sx = (Math.random() - 0.5) * state.shakeIntensity;
        var sy = (Math.random() - 0.5) * state.shakeIntensity;
        ctx.translate(sx, sy);
        state.shakeTimer--;
        state.shakeIntensity *= 0.88;
      }

      drawBackground();

      // Red death flash overlay (fades out)
      if (deathFlash > 0) {
        var fa = (deathFlash / 30) * 0.55;
        ctx.fillStyle = 'rgba(255, 0, 80, ' + fa + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        deathFlash--;
      }

      // Keep drawing obstacles (frozen in place)
      for (var a = 0; a < state.obstacles.length; a++) drawObstacle(state.obstacles[a]);

      updateParticles();
      drawParticles();
      updateScorePopups();
      drawScorePopups();

      ctx.restore();

      if (state.deathFrame < 65) {
        raf = requestAnimationFrame(deathLoop);
      } else {
        // Animation done — show game over overlay
        state.deathAnimating = false;
        raf = null;

        if (finalScore)     finalScore.textContent = String(Math.floor(state.score)).padStart(5, '0');
        if (newRecordBlock) newRecordBlock.style.display = state.isNewRecord ? 'flex' : 'none';

        updateScoreDisplays();

        // Trigger CSS celebration class if new record
        if (gameOverScreen) {
          if (state.isNewRecord) {
            gameOverScreen.classList.add('new-record-screen');
            spawnConfetti(gameOverScreen);
          } else {
            gameOverScreen.classList.remove('new-record-screen');
            removeConfetti(gameOverScreen);
          }
        }

        showOverlay(gameOverScreen);
      }
    }

    raf = requestAnimationFrame(deathLoop);
  }

  function showOverlay(el)  { if (el) el.classList.remove('hidden'); }
  function hideOverlay(el)  { if (el) el.classList.add('hidden'); }

  /* ============================================
     CONFETTI — HTML overlay celebration
     ============================================ */
  var CONFETTI_COLORS = ['#ffd700','#00d4ff','#ff0080','#00ff41','#ffffff','#ff6600'];

  function spawnConfetti(container) {
    // Remove any existing confetti first
    removeConfetti(container);

    var el = document.createElement('div');
    el.className = 'confetti-container';

    for (var i = 0; i < 28; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left         = (Math.random() * 100) + '%';
      piece.style.background   = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.width        = (5 + Math.random() * 7) + 'px';
      piece.style.height       = (5 + Math.random() * 7) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.animationDuration  = (1.2 + Math.random() * 2) + 's';
      piece.style.animationDelay     = (Math.random() * 1.5) + 's';
      piece.style.animationIterationCount = 'infinite';
      el.appendChild(piece);
    }

    container.insertBefore(el, container.firstChild);
  }

  function removeConfetti(container) {
    var existing = container.querySelector('.confetti-container');
    if (existing) existing.parentNode.removeChild(existing);
  }

  /* ============================================
     INPUT — Keyboard
     ============================================ */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      state.keys.left  = true;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      state.keys.right = true;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !state.running) {
      e.preventDefault();
      startGame();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') state.keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
  });

  /* ============================================
     INPUT — Touch zones
     ============================================ */
  function bindTouchZone(el, side) {
    if (!el) return;
    el.addEventListener('touchstart', function (e) {
      e.preventDefault();
      state.touch[side] = true;
      if (!state.running) startGame();
    }, { passive: false });
    el.addEventListener('touchend', function () { state.touch[side] = false; });
    el.addEventListener('touchcancel', function () { state.touch[side] = false; });
  }

  bindTouchZone(touchLeft,  'left');
  bindTouchZone(touchRight, 'right');

  /* ============================================
     INPUT — Click / tap to start
     ============================================ */
  if (startScreen) {
    startScreen.addEventListener('click', startGame);
    startScreen.addEventListener('touchstart', function (e) { e.preventDefault(); startGame(); }, { passive: false });
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startGame();
    });
  }

  /* ============================================
     SHARE SCORE
     ============================================ */
  var shareBtn     = document.getElementById('shareBtn');
  var shareTooltip = document.getElementById('shareTooltip');

  if (shareBtn) {
    shareBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var score    = Math.floor(state.score);
      var siteUrl  = window.location.origin + (window.location.pathname.replace(/[^/]+$/, '') || '/');
      var gameUrl  = siteUrl + 'game.html';
      var text     = '$REPLAY ARCADE \uD83D\uDD79\uFE0F I scored ' + score + '! Can you beat it? Play now \u2192 ' + gameUrl;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(showCopied);
      } else {
        // Fallback for older browsers
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta);
        showCopied();
      }
    });
  }

  function showCopied() {
    if (!shareTooltip) return;
    shareTooltip.classList.remove('hidden');
    // Re-trigger animation by cloning
    var clone = shareTooltip.cloneNode(true);
    clone.classList.remove('hidden');
    shareTooltip.parentNode.replaceChild(clone, shareTooltip);
    shareTooltip = clone; // update reference
    setTimeout(function () {
      if (shareTooltip) shareTooltip.classList.add('hidden');
    }, 1600);
  }

  /* ============================================
     CANVAS click starts the game too
     ============================================ */
  canvas.addEventListener('click', function () {
    if (!state.running) startGame();
  });

  /* ============================================
     Prevent default on game body to stop scrolling on mobile
     ============================================ */
  document.body.addEventListener('touchmove', function (e) {
    if (document.body.classList.contains('game-body')) {
      e.preventDefault();
    }
  }, { passive: false });

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
