(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const ammoEl = document.getElementById('ammo');
  const ammoCountEl = document.getElementById('ammoCount');
  const shieldEl = document.getElementById('shield');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const shootBtn = document.getElementById('shootBtn');

  let W = 400, H = 640;

  function resize() {
    const container = document.getElementById('gameContainer');
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const ratio = 5 / 8;
    let w, h;
    if (cw / ch > ratio) { h = ch * 0.95; w = h * ratio; }
    else { w = cw * 0.95; h = w / ratio; }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    W = 400; H = 640;
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  const GRAVITY = 0.35;
  const JUMP_POWER = -11; 
  const SUPER_JUMP = -19;
  const MOVE_SPEED = 5.5;
  const PLAYER_W = 44, PLAYER_H = 44;
  const BULLET_SPEED = 10;
  const PLATFORM_W = 70, PLATFORM_H = 15;

 
  let player, platforms, bullets, particles; 
  let score, maxHeight, gameOver, running;
  let ammo = 0, shield = 0, rocketTimer = 0;
  let keys = { left: false, right: false, shoot: false };
  let shootCooldown = 0;
  let best = parseInt(localStorage.getItem('doodleBest2') || '0', 10);

  function createPlatform(x, y, type = 'normal') {
    return {
      x, y, w: PLATFORM_W, h: PLATFORM_H, type,
      vx: type === 'moving' ? (Math.random() < 0.5 ? -1.5 : 1.5) : 0,
      broken: false, breakTimer: 0,
      used: false
    };
  }

  function createBullet(x, y) {
    return { x, y, w: 6, h: 14, vy: -BULLET_SPEED };
  }

  function createParticle(x, y, color) {
    return {
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 2,
      life: 30, color
    };
  }

  function initGame() {
    player = {
      x: W / 2 - PLAYER_W / 2,
      y: H - 100,
      w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0,
      dir: 1
    };
    platforms = [];
    bullets = [];
    particles = [];

    platforms.push(createPlatform(W / 2 - PLATFORM_W / 2, H - 50, 'normal'));
    
    let y = H - 120;
    while (y > -200) {
      const x = Math.random() * (W - PLATFORM_W);
      let type = 'normal';
      const r = Math.random();
      if (r < 0.10) type = 'breakable';
      else if (r < 0.20) type = 'moving';
      platforms.push(createPlatform(x, y, type));
      y -= 50 + Math.random() * 30;
    }

    score = 0;
    maxHeight = 0;
    ammo = 0;
    shield = 0;
    rocketTimer = 0;
    gameOver = false;
    running = true;
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    if (ammo > 0) {
      ammoEl.classList.remove('hidden');
      ammoCountEl.textContent = ammo;
      shootBtn.style.display = 'block';
    } else {
      ammoEl.classList.add('hidden');
      shootBtn.style.display = 'none';
    }
    if (shield > 0) shieldEl.classList.remove('hidden');
    else shieldEl.classList.add('hidden');
  }

  function generateContent() {
    let topY = Infinity;
    for (const p of platforms) if (p.y < topY) topY = p.y;
    const difficulty = Math.min(score / 3000, 1.0);

    const baseGap = 50;
    const maxGap = 85;
    const currentGap = baseGap + (maxGap - baseGap) * difficulty;

    while (topY > -250) {
      const newY = topY - (currentGap + Math.random() * 30);
      const x = Math.random() * (W - PLATFORM_W);
      let type = 'normal';
      const r = Math.random();
      if (r < 0.10 + difficulty * 0.15) type = 'breakable';
      else if (r < 0.20 + difficulty * 0.15) type = 'moving';
      
      platforms.push(createPlatform(x, newY, type));
      topY = newY;
    }
    platforms = platforms.filter(p => p.y < H + 50);
  }

  function shoot() {
    if (ammo <= 0 || shootCooldown > 0) return;
    ammo--;
    shootCooldown = 12;
    bullets.push(createBullet(player.x + player.w/2 - 3, player.y - 5));
    updateHUD();
  }

  function update() {
    if (!running) return;
    if (shootCooldown > 0) shootCooldown--;

    if (rocketTimer > 0) {
      player.vy = -8;
      if (keys.left) { player.vx = -MOVE_SPEED; player.dir = -1; }
      else if (keys.right) { player.vx = MOVE_SPEED; player.dir = 1; }
      else player.vx *= 0.85;
      rocketTimer--;
      if (Math.random() < 0.6) {
        particles.push(createParticle(player.x + player.w/2, player.y + player.h, '#ff6b35'));
      }
    } else {
      if (keys.left)  { player.vx = -MOVE_SPEED; player.dir = -1; }
      else if (keys.right) { player.vx = MOVE_SPEED; player.dir = 1; }
      else player.vx *= 0.85;
      player.vy += GRAVITY;
    }

    player.x += player.vx;
    player.y += player.vy;

    if (player.x + player.w < 0) player.x = W;
    else if (player.x > W) player.x = -player.w;

     if (player.vy > 0 && rocketTimer <= 0) {
      for (const p of platforms) {
        if (p.broken) continue;
        const prevBottom = player.y + player.h - player.vy;
        const curBottom = player.y + player.h;
        if (prevBottom <= p.y &&
            curBottom >= p.y &&
            player.x + player.w > p.x + 6 &&
            player.x < p.x + p.w - 6) {
          if (p.type === 'breakable') {
            if (!p.used) {
              player.vy = JUMP_POWER;
              player.y = p.y - player.h;
              p.used = true;
              for (let i = 0; i < 6; i++) {
                particles.push(createParticle(p.x + Math.random() * p.w, p.y, '#8b6f47'));
              }
            } else {
              p.broken = true;
              p.breakTimer = 10;
            }
          } else {
            player.vy = JUMP_POWER;
            player.y = p.y - player.h;
          }
        }
      }
    }

    for (const b of bullets) b.y += b.vy;
    bullets = bullets.filter(b => b.y > -50);


    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);

 for (const p of platforms) {
      if (p.type === 'moving') {
        p.x += p.vx;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x + p.w > W) { p.x = W - p.w; p.vx *= -1; }
      }
      if (p.broken) {
        p.breakTimer--;
        p.y += 3;
      }
    }
    platforms = platforms.filter(p => !(p.broken && p.breakTimer <= 0));

    const mid = H / 2;
    if (player.y < mid) {
      const dy = mid - player.y;
      player.y = mid;
      for (const p of platforms) p.y += dy; 
      for (const b of bullets) b.y += dy;
      for (const p of particles) p.y += dy;
      maxHeight += dy;
      score = Math.floor(maxHeight / 5);
      updateHUD();
    }

    if (player.y > H) endGame();
    generateContent(); 
  }

  function drawBackground() {
    ctx.fillStyle = '#fdfcf6';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawRoundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); }
  }
   function drawPlatform(p) {
    let fill, stroke;
    if (p.type === 'breakable') {
      fill = p.used ? '#a67c52' : '#d4a373';
      stroke = '#6b4423';
    } else if (p.type === 'moving') {
      fill = '#a8d8a8';
      stroke = '#2a7f3d';
    } else {
      fill = '#b8e0b8';
      stroke = '#2a7f3d';
    }
    drawRoundRect(p.x, p.y, p.w, p.h, 6, fill, stroke);

    if (p.type === 'breakable' && p.used) {
      ctx.strokeStyle = '#4a3520';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.3, p.y + 2);
      ctx.lineTo(p.x + p.w * 0.35, p.y + p.h * 0.5);
      ctx.lineTo(p.x + p.w * 0.25, p.y + p.h - 2);
      ctx.moveTo(p.x + p.w * 0.65, p.y + 3);
      ctx.lineTo(p.x + p.w * 0.7, p.y + p.h * 0.6);
      ctx.lineTo(p.x + p.w * 0.75, p.y + p.h - 3);
      ctx.stroke();
    }
  }


  function drawBullet(b) {
    ctx.fillStyle = '#f1c40f';
    ctx.strokeStyle = '#d68910';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w/2, b.y + b.h/2, b.w/2, b.h/2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  function drawPlayer() {
    const x = player.x, y = player.y, w = player.w, h = player.h;
    ctx.save();

    if (shield > 0) {
      ctx.fillStyle = 'rgba(52, 152, 219, 0.25)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2, w/2 + 5, h/2 + 5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    if (rocketTimer > 0) {
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.moveTo(x + w/2 - 8, y + h);
      ctx.lineTo(x + w/2, y + h + 15 + Math.random() * 5);
      ctx.lineTo(x + w/2 + 8, y + h);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(x + w/2 - 4, y + h);
      ctx.lineTo(x + w/2, y + h + 8 + Math.random() * 3);
      ctx.lineTo(x + w/2 + 4, y + h);
      ctx.fill();
    }

    ctx.fillStyle = '#8fd68f';
    ctx.strokeStyle = '#2a7f3d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h/2, w/2 - 2, h/2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#2a7f3d';
    ctx.lineWidth = 3;
    const legSpread = Math.sin(Date.now() / 80) * 3;
    ctx.beginPath();
    ctx.moveTo(x + w/2 - 8, y + h - 4);
    ctx.lineTo(x + w/2 - 10 + legSpread, y + h + 4);
    ctx.moveTo(x + w/2 + 8, y + h - 4);
    ctx.lineTo(x + w/2 + 10 - legSpread, y + h + 4);
    ctx.stroke();

    if (ammo > 0) {
      ctx.fillStyle = '#34495e';
      ctx.fillRect(x + 6, y - 2, w - 12, 8);
      ctx.fillRect(x + w/2 - 4, y - 10, 8, 10);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x + w/2 - 2, y - 14, 4, 6);
    }

    const eyeOffset = player.dir * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w/2 - 7, y + h/2 - 4, 6, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 7, y + h/2 - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + w/2 - 7 + eyeOffset, y + h/2 - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 7 + eyeOffset, y + h/2 - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2a7f3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w/2, y + h/2 + 4);
    ctx.lineTo(x + w/2 + player.dir * 8, y + h/2 + 8);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    for (const p of platforms) drawPlatform(p);
    for (const b of bullets) drawBullet(b);
    drawParticles();
    drawPlayer();
  }

  function loop() {
    update();
    draw();
    if (running) requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > best) {
      best = score;
      localStorage.setItem('doodleBest2', best);
    }
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = best;
    gameOverScreen.classList.remove('hidden');
  }

  function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    initGame();
    loop();
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') keys.right = true;
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); shoot(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') keys.right = false;
  });

  function handleTouches(e) {
    e.preventDefault();
    keys.left = false; keys.right = false;
    const rect = canvas.getBoundingClientRect();
    for (const t of e.touches) {
      const x = t.clientX - rect.left;
      if (x < rect.width / 2) keys.left = true;
      else keys.right = true;
    }
  }
  canvas.addEventListener('touchstart', handleTouches, { passive: false });
  canvas.addEventListener('touchmove', handleTouches, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.touches.length === 0) { keys.left = false; keys.right = false; }
    else handleTouches(e);
  }, { passive: false });

  shootBtn.addEventListener('touchstart', e => { e.preventDefault(); shoot(); }, { passive: false });
  shootBtn.addEventListener('mousedown', e => { e.preventDefault(); shoot(); });

  let mouseDown = false;
  canvas.addEventListener('mousedown', e => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 2) keys.left = true; else keys.right = true;
  });
  canvas.addEventListener('mousemove', e => {
    if (!mouseDown) return;
    const rect = canvas.getBoundingClientRect();
    keys.left = false; keys.right = false;
    if (e.clientX - rect.left < rect.width / 2) keys.left = true; else keys.right = true;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; keys.left = false; keys.right = false; });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  bestScoreEl.textContent = best;
})();