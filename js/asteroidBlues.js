const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const waveScreen = document.getElementById("waveScreen");
const waveMessage = document.getElementById("waveMessage");
const enemyCount = document.getElementById("enemyCount");
const healthBarFill = document.getElementById("healthBarFill");
const healthText = document.getElementById("healthText");
const continueWaveBtn = document.getElementById("continueWaveBtn");

const loreSnippets = [
  "Log 1503: Your ship runs on a remnant AI core from a pre-collapse satellite.",
  "WHAT'S THAT?! NEW RADIO STATION!? The Juno Drift was a smuggler's route before the Trade War.",
  "Log 1259: 4.44AMFM Radio once broadcast signals to deep space colonies. Now it echoes in the void.",
  "Aboard your ship, there’s a locked door you've never opened.",
  "You remember nothing before waking up in orbit around Syntar VI.",
  "Your score isn't just a number. It's a trace of your past decisions.",
  "Red Dust signals originate from an abandoned Martian mining colony.",
  "A blinking light in your cockpit has been blinking since launch day.",
];


// --- Canvas wrapper aspect ratio toggle ---
function updateCanvasWrapper() {
  const wrapper = document.getElementById('canvasWrapper');
  if (window.innerHeight > window.innerWidth) {
    wrapper.classList.add('portrait');
    wrapper.classList.remove('landscape');
  } else {
    wrapper.classList.add('landscape');
    wrapper.classList.remove('portrait');
  }
}

window.addEventListener('resize', () => {
  updateCanvasWrapper();
  resizeCanvas();
});
window.addEventListener('orientationchange', () => {
  updateCanvasWrapper();
  resizeCanvas();
});

updateCanvasWrapper();

function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

resizeCanvas();

// --- Game variables and setup ---

let shakeTimer = 0;
const SHAKE_INTENSITY = 5;





let keys = {};
let pauseKeyDown = false;  // to debounce pause toggle
document.addEventListener("keydown", e => {
  keys[e.code] = true;

  if (e.code === "KeyP" && !pauseKeyDown) {
    isPaused = !isPaused;
    updateHUD();
    pauseKeyDown = true;
  }
});
document.addEventListener("keyup", e => {
  keys[e.code] = false;

  if (e.code === "KeyP") {
    pauseKeyDown = false;
  }
});

const MAX_HP = 1000;
let isPaused = false;

const player = {
  x: 600, y: 400,
  angle: 0, vx: 0, vy: 0,
  radius: 15,
  color: "red",
  canShoot: true,
  cooldown: 300,
  bigLaserActive: false,
  hp: MAX_HP,
  speedBoostActive: false,
  shieldActive: false,
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let debris = [];
let powerUps = [];
let score = 0;

const trackingRadius = 250;

// Touch controls state
let touchStart = null;
let touchCurrent = null;
let isTouchMoving = false;
let shootOnTap = false;

// Threshold for detecting swipe direction (in pixels)
const SWIPE_THRESHOLD = 10;

// Handle touch start
canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 1) {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchCurrent = { ...touchStart };
    isTouchMoving = false;
    shootOnTap = true; // tentatively tap (if no move, shoot)
  }
});

// Handle touch move
canvas.addEventListener("touchmove", e => {
  if (e.touches.length === 1 && touchStart) {
    touchCurrent = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const dx = touchCurrent.x - touchStart.x;
    const dy = touchCurrent.y - touchStart.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
      isTouchMoving = true;
      shootOnTap = false; // it's a swipe, not a tap
    }
  }
});

// Handle touch end
canvas.addEventListener("touchend", e => {
  if (!isTouchMoving && shootOnTap && player.canShoot && !isPaused && !gamePausedForWave) {
    shootBullet(player);
    player.canShoot = false;
    setTimeout(() => player.canShoot = true, player.cooldown);
  }
  touchStart = null;
  touchCurrent = null;
  isTouchMoving = false;
  shootOnTap = false;
});

// --- Existing functions ---

function shootBullet(source, isEnemy = false) {
  const angle = source.angle !== undefined
    ? source.angle
    : Math.atan2(player.y - source.y, player.x - source.x);
  const isBig = !isEnemy && player.bigLaserActive;
  (isEnemy ? enemyBullets : bullets).push({
    x: source.x,
    y: source.y,
    angle,
    speed: isEnemy ? 3 : 6,
    radius: isBig ? 8 : 4,
    color: isEnemy ? "#ff4444" : (isBig ? "#ffff00" : "#ffff66"),
    isEnemy
  });
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const pos = [
    { x: Math.random() * canvas.width, y: -30 },
    { x: Math.random() * canvas.width, y: canvas.height + 30 },
    { x: -30, y: Math.random() * canvas.height },
    { x: canvas.width + 30, y: Math.random() * canvas.height }
  ][side];
  enemies.push({
    ...pos,
    radius: 15,
    angle: 0,
    speed: 1 + Math.random(),
    color: "steelblue",
    shootCooldown: 1000 + Math.random() * 1000,
    randomAngle: Math.random() * Math.PI * 2,
    opacity: 0,
    hp: 20 * (1 + 0.02 * (wave - 1)), // AI health grows 2% per wave
    showHealthBar: false,
    healthBarTimer: 0
  });
}
function spawnDebris() {
  debris.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    size: 40 + Math.random() * 40,  // bigger: 40 to 80 px radius-ish
    color: "#3399ff",                // adjust base color for vivid blue
    opacity: 0,
    state: "fadingIn",
    lifeTimer: 0,
    rotation: 0,
    rotationSpeed: (Math.random() - 0.5) * 0.05, // rotation speed
    sides: 5 + Math.floor(Math.random() * 6),    // 5 to 10 sides randomly
  });
}
function spawnPowerUp(type) {
  const types = ["bigLaser", "shield", "speedBoost", "healthRestore"];
  const chosenType = type || types[Math.floor(Math.random() * types.length)];
  const colors = {
    bigLaser: "#44ff44",
    shield: "#4488ff",
    speedBoost: "#ffaa00",
    healthRestore: "#33ff33"  // green plus
  };

  powerUps.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 12,
    color: colors[chosenType],
    type: chosenType,
    lifeTimer: 0,
    lifeSpan: 10000
  });
}

setInterval(spawnDebris, 4000);
let powerUpTimer = 0;
const powerUpInterval = 10000; // 10 seconds





function resetGame() {
  Object.assign(player, { x: canvas.width/2, y: canvas.height/2, angle:0, vx:0, vy:0, canShoot:true, bigLaserActive:false, hp:MAX_HP });
  bullets = []; enemyBullets = []; enemies = []; debris = []; powerUps = [];
  score = 0;
  wave = 1; maxEnemiesThisWave = 5;
  enemiesSpawnedThisWave = enemiesKilledThisWave = 0;
  waveInProgress = true; gamePausedForWave = false;
  spawnTimer = waveDelayTimer = 0;
  waveScreen.style.visibility = "hidden";
  hud.style.visibility = "visible";
  updateHUD();
  updateHealthDisplay();
}

let wave = 1, maxEnemiesThisWave = 5, enemiesSpawnedThisWave = 0, enemiesKilledThisWave = 0;
let waveInProgress = true, gamePausedForWave = false;
let spawnTimer = 0, waveDelayTimer = 0;
const spawnInterval = 1500, waveDelayDuration = 2000;

function updateHUD() {
  const enemiesLeft = maxEnemiesThisWave - enemiesKilledThisWave;
  hud.textContent = isPaused
    ? `⏸️ Paused | Wave: ${wave}`
    : `Score: ${score} | Wave: ${wave} | Enemies: ${enemiesLeft > 0 ? enemiesLeft : 0}`;
}

function updateHealthDisplay() {
  const percent = Math.max(player.hp,0)/MAX_HP*100;
  healthBarFill.style.width = percent + "%";
  healthText.textContent = `HP: ${Math.max(player.hp,0)}`;
}

// Modified pauseForWave function with lore drop and radio station unlock UI
function pauseForWave() {
  waveScreen.style.visibility = "visible";
  hud.style.visibility = "hidden";
  waveMessage.textContent = `Wave ${wave} Complete!`;
  enemyCount.textContent = `Total Enemies: ${maxEnemiesThisWave}`;
  gamePausedForWave = true;
  waveInProgress = false;
  continueWaveBtn.style.display = "inline-block";

  // Set lore snippet
  if (loreSnippets[wave - 1]) {
    loreDrop.textContent = loreSnippets[wave - 1];
  } else {
    loreDrop.textContent = "The silence between stars is never truly silent.";
  }

  // Check for radio unlock
  if (wave % 3 === 0) {
    const stationToUnlock = wave / 3; // wave 3 unlocks index 1, wave 6 unlocks index 2, etc.
    if (stationToUnlock < audioTracks.length && !audioTracks[stationToUnlock].unlocked) {
      audioTracks[stationToUnlock].unlocked = true;
      radioUnlockMessage.textContent = `📻 NEW STATION UNLOCKED: ${audioTracks[stationToUnlock].name}`;
      updateStationList();
    } else {
      radioUnlockMessage.textContent = "";
    }
  } else {
    radioUnlockMessage.textContent = "";
  }
}

// Make sure to also include these lines in your setup section:
const radioUnlockMessage = document.getElementById("radioUnlockMessage");
const loreDrop = document.getElementById("loreDrop");

continueWaveBtn.addEventListener("click", () => {
  if (gamePausedForWave) {
    startNextWave();
    continueWaveBtn.style.display = "none";
  }
});

function startNextWave() {
  wave++;0

  if (wave % 3 === 0) {
    const stationToUnlock = wave / 3; // wave 3 unlocks index 1, wave 6 unlocks index 2, etc.
    if (stationToUnlock < audioTracks.length && !audioTracks[stationToUnlock].unlocked) {
      audioTracks[stationToUnlock].unlocked = true;
      updateStationList(); // optional, if station list is visible
      console.log(`Unlocked radio station: ${audioTracks[stationToUnlock].name}`);
    }
  }



  maxEnemiesThisWave = Math.ceil(maxEnemiesThisWave * 1.2);
  enemiesSpawnedThisWave = 0;
  enemiesKilledThisWave = 0;
  waveInProgress = true;
  gamePausedForWave = false;
  spawnTimer = 0;
  waveDelayTimer = 0;
  waveScreen.style.visibility = "hidden";
  hud.style.visibility = "visible";
  updateHUD();
}
function update(deltaTime) {
  if (isPaused || gamePausedForWave) return;

  // ✅ Power-up spawn logic here — only runs if game is active
  powerUpTimer += deltaTime;
  if (powerUpTimer >= powerUpInterval) {
    spawnPowerUp();
    powerUpTimer = 0;
  }

  // Handle touch movement input for player velocity and rotation
  if (touchStart && touchCurrent && isTouchMoving) {
    const dx = touchCurrent.x - touchStart.x;
    const dy = touchCurrent.y - touchStart.y;
    const angle = Math.atan2(dy, dx);

    // Set both movement and rotation to match swipe direction
    const speedMultiplier = player.speedBoostActive ? 0.5 : 0.1;
    player.vx += Math.cos(angle) * speedMultiplier;
    player.vy += Math.sin(angle) * speedMultiplier;

    player.angle = angle;
  }

  // Player Movement - keyboard controls still active
  if (keys["ArrowLeft"]) player.angle -= 0.05;
  if (keys["ArrowRight"]) player.angle += 0.05;
  if (keys["KeyA"]) {
    player.vx += Math.cos(player.angle - Math.PI / 2) * 0.1;
    player.vy += Math.sin(player.angle - Math.PI / 2) * 0.1;
  }
  if (keys["KeyD"]) {
    player.vx += Math.cos(player.angle + Math.PI / 2) * 0.1;
    player.vy += Math.sin(player.angle + Math.PI / 2) * 0.1;
  }
  if (keys["ArrowUp"]) {
    player.vx += Math.cos(player.angle) * 0.1;
    player.vy += Math.sin(player.angle) * 0.1;
  }
  if (keys["ArrowDown"]) {
    player.vx -= Math.cos(player.angle) * 0.1;
    player.vy -= Math.sin(player.angle) * 0.1;
  }

  // Apply friction
  player.vx *= 0.98;
  player.vy *= 0.98;

  // Update player position with wraparound
  player.x = (player.x + player.vx + canvas.width) % canvas.width;
  player.y = (player.y + player.vy + canvas.height) % canvas.height;

  // Shooting logic
  if (keys["Space"] && player.canShoot) {
    shootBullet(player);
    player.canShoot = false;
    setTimeout(() => (player.canShoot = true), player.cooldown);
  }

  // Update bullets positions
  bullets.forEach((b) => {
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
  });
  enemyBullets.forEach((b) => {
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
  });

  // Remove offscreen bullets
  bullets = bullets.filter(
    (b) => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height
  );
  enemyBullets = enemyBullets.filter(
    (b) => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height
  );

  // Update enemies & AI behavior
  enemies.forEach((e) => {
    if (e.opacity < 1) e.opacity += (0.01 * deltaTime) / 16.67;

    const dx = player.x - e.x,
      dy = player.y - e.y,
      dist = Math.hypot(dx, dy);

    if (e.opacity >= 1) {
      if (dist < trackingRadius) {
        const angleToPlayer = Math.atan2(dy, dx);
        let diff = ((angleToPlayer - e.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (Math.abs(diff) < Math.PI / 2) {
          e.angle = angleToPlayer;
          e.x += Math.cos(e.angle) * e.speed;
          e.y += Math.sin(e.angle) * e.speed;
        } else {
          if (Math.random() < 0.01) e.randomAngle = Math.random() * 2 * Math.PI;
          e.angle = e.randomAngle;
          e.x += Math.cos(e.randomAngle) * e.speed * 0.3;
          e.y += Math.sin(e.randomAngle) * e.speed * 0.3;
        }

        e.shootCooldown -= deltaTime;
        if (e.shootCooldown <= 0) {
          shootBullet(e, true);
          e.shootCooldown = 1000 + Math.random() * 1000;
        }
      } else {
        if (Math.random() < 0.01) e.randomAngle = Math.random() * 2 * Math.PI;
        e.angle = e.randomAngle;
        e.x += Math.cos(e.randomAngle) * e.speed * 0.3;
        e.y += Math.sin(e.randomAngle) * e.speed * 0.3;
      }
    }

    e.x = (e.x + canvas.width) % canvas.width;
    e.y = (e.y + canvas.height) % canvas.height;

    // AI health bar timer
    if (e.showHealthBar) {
      e.healthBarTimer -= deltaTime;
      if (e.healthBarTimer <= 0) e.showHealthBar = false;
    }
  });

  // Debris update, collision, splitting
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.x = (d.x + d.vx + canvas.width) % canvas.width;
    d.y = (d.y + d.vy + canvas.height) % canvas.height;

    if (d.state === "fadingIn") {
      d.opacity += 0.01;
      if (d.opacity >= 1) {
        d.opacity = 1;
        d.state = "visible";
        d.lifeTimer = 0;
      }
    } else if (d.state === "visible") {
      d.lifeTimer += deltaTime;
      if (d.lifeTimer > 6000) d.state = "fadingOut";
    } else {
      d.opacity -= 0.01;
      if (d.opacity <= 0) {
        debris.splice(i, 1);
        continue;
      }
    }

    // Debris collision with player
    if (
      d.state === "visible" &&
      Math.hypot(d.x - player.x, d.y - player.y) < player.radius + d.size / 2
    ) {
      if (player.shieldActive) {
        player.shieldActive = false;
      } else {
        player.hp -= 5;
      }
      debris.splice(i, 1);
      updateHealthDisplay();
      if (player.hp <= 0) return resetGame();
    }

    // Debris collision with bullets and splitting
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (Math.hypot(b.x - d.x, b.y - d.y) < d.size / 2 + b.radius) {
        if (d.size > 20 && d.size / 2 >= 12) {
          const angle = Math.atan2(b.y - d.y, b.x - d.x);
          const newSize = d.size / 2;

          [-1, 1].forEach((off) =>
            debris.push({
              x: d.x + Math.cos(angle + off * (Math.PI / 2)) * newSize * 0.5,
              y: d.y + Math.sin(angle + off * (Math.PI / 2)) * newSize * 0.5,
              vx: Math.cos(angle + off * (Math.PI / 2)) * 1.5,
              vy: Math.sin(angle + off * (Math.PI / 2)) * 1.5,
              size: newSize,
              color: d.color,
              opacity: 1,
              state: "visible",
              lifeTimer: 0,
              rotation: d.rotation,
              rotationSpeed: d.rotationSpeed * (Math.random() > 0.5 ? 1 : -1),
              sides: d.sides,
            })
          );
        }
        shakeTimer = 200; // shake for ~200ms
        debris.splice(i, 1);
        bullets.splice(j, 1);
        break;
      }
    }
  }

  // Check bullet hits on enemies (with health bar and health decrease)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    if (en.opacity < 1) continue;
    for (let j = bullets.length - 1; j >= 0; j--) {
      if (
        Math.hypot(bullets[j].x - en.x, bullets[j].y - en.y) <
        en.radius + bullets[j].radius
      ) {
        const damage = player.bigLaserActive ? 25 : 10;
        en.hp -= damage;

        en.showHealthBar = true; // show health bar on hit
        en.healthBarTimer = 2000; // show for 2 seconds

        bullets.splice(j, 1);

        if (en.hp <= 0) {
          enemies.splice(i, 1);
          score += 10;
          enemiesKilledThisWave++;
          updateHUD();
        }
        break;
      }
    }
  }

  // Enemy bullets hitting player
  enemyBullets.forEach((b, i) => {
    if (Math.hypot(b.x - player.x, b.y - player.y) < player.radius + b.radius) {
      if (player.shieldActive) {
        player.shieldActive = false;
      } else {
        player.hp -= 10;
      }
      enemyBullets.splice(i, 1);
      updateHealthDisplay();
      if (player.hp <= 0) return resetGame();
    }
  });

  // Power-up collection
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.lifeTimer += deltaTime;
    if (p.lifeTimer >= p.lifeSpan) {
      powerUps.splice(i, 1);
      continue;
    }
    if (Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) {
      switch (p.type) {
        case "bigLaser":
          player.bigLaserActive = true;
          setTimeout(() => (player.bigLaserActive = false), 5000);
          break;
        case "healthRestore":
          player.hp = Math.min(player.hp + 25, MAX_HP);
          updateHealthDisplay();
          break;
        case "speedBoost":
          player.speedBoostActive = true;
          setTimeout(() => (player.speedBoostActive = false), 5000);
          break;
        case "shield":
          player.shieldActive = true;
          break;
      }
      powerUps.splice(i, 1);
      score += 30;
      updateHUD();
    }
  }

  // Spawn new enemies if wave is in progress
  if (waveInProgress) {
    spawnTimer += deltaTime;
    if (spawnTimer >= spawnInterval && enemiesSpawnedThisWave < maxEnemiesThisWave) {
      spawnEnemy();
      enemiesSpawnedThisWave++;
      spawnTimer = 0;
    }

    // If all enemies spawned and none left alive, pause for wave
    if (enemiesSpawnedThisWave >= maxEnemiesThisWave && enemies.length === 0) {
      pauseForWave();
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(20,0);
  ctx.lineTo(-15,10);
  ctx.lineTo(-15,-10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (player.shieldActive) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(173, 216, 230, 0.6)";
    ctx.lineWidth = 4;
    ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.speedBoostActive) {
    ctx.shadowColor = "rgba(255, 165, 0, 0.8)";
    ctx.shadowBlur = 20;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
  
}

function drawEnemies() {
  enemies.forEach(e => {
    ctx.save();
    ctx.globalAlpha = e.opacity;
    ctx.translate(e.x,e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(15,0);
    ctx.lineTo(-10,8);
    ctx.lineTo(-10,-8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw health bar above enemy if visible
    if (e.showHealthBar) {
      const barWidth = 30;
      const barHeight = 5;
      const healthPercent = e.hp / (20 * (1 + 0.02 * (wave - 1)));
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "black";
      ctx.fillRect(e.x - barWidth/2, e.y - e.radius - 15, barWidth, barHeight);
      ctx.fillStyle = "limegreen";
      ctx.fillRect(e.x - barWidth/2 + 1, e.y - e.radius - 14, (barWidth - 2) * healthPercent, barHeight - 2);
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
}

function drawBullets() {
  bullets.concat(enemyBullets).forEach(b => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);
    ctx.fill();
  });
}
function drawPolygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides + rotation;
    const distortion = Math.sin(rotation * 5 + i) * radius * 0.1;
    const r = radius + distortion;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function drawDebris() {
  debris.forEach(d => {
    d.rotation += d.rotationSpeed;

    ctx.save();
    ctx.globalAlpha = d.opacity;

    // Move and rotate to debris position and rotation
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);

    // Create a radial gradient to simulate light from top-left
    const radius = d.size / 2;
    const gradient = ctx.createRadialGradient(-radius/2, -radius/2, radius/4, 0, 0, radius);
    gradient.addColorStop(0, '#66aaff'); // bright highlight color
    gradient.addColorStop(0.7, d.color); // base color
    gradient.addColorStop(1, '#112244'); // darker shadow color

    ctx.fillStyle = gradient;

    // Draw polygon with gradient fill
    drawPolygon(ctx, 0, 0, radius, d.sides);

    // Optional: draw polygon edges with semi-transparent darker stroke for contrast
    ctx.strokeStyle = 'rgba(0, 0, 50, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  });
  ctx.globalAlpha = 1;
}
function drawPowerUps() {
  powerUps.forEach(p => {
    const rem = p.lifeSpan - p.lifeTimer;
    ctx.globalAlpha = rem<3000 ? rem/3000 : 1;


    if (p.type === "healthRestore") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      const size = 8;
      ctx.fillRect(-size/2, -size*1.5, size, size*3);  // vertical bar
      ctx.fillRect(-size*1.5, -size/2, size*3, size);  // horizontal bar
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

let lastTime = 0;
function gameLoop(timestamp = 0) {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  // Screen shake update BEFORE drawing starts
  let dx = 0, dy = 0;
  if (shakeTimer > 0) {
    shakeTimer -= deltaTime;
    dx = (Math.random() - 0.5) * SHAKE_INTENSITY;
    dy = (Math.random() - 0.5) * SHAKE_INTENSITY;
    ctx.save();
    ctx.translate(dx, dy);
  }

  update(deltaTime);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDebris();
  drawPowerUps();
  // ... rest of draw calls

  function castLight(ctx, lightX, lightY, obstacles) {
    const rayCount = 90; // reduce for performance
    const points = [];
  
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * 2 * Math.PI) / rayCount;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
  
      let closestIntersect = null;
      let minDist = 10000;
  
      const rayEnd = { x: lightX + dx * 1000, y: lightY + dy * 1000 };
  
      obstacles.forEach(obs => {
        for (let j = 0; j < obs.length; j++) {
          const p1 = obs[j];
          const p2 = obs[(j + 1) % obs.length];
          const intersect = getLineIntersection({ x: lightX, y: lightY }, rayEnd, p1, p2);
          if (intersect) {
            const dist = Math.hypot(intersect.x - lightX, intersect.y - lightY);
            if (dist < minDist) {
              minDist = dist;
              closestIntersect = intersect;
            }
          }
        }
      });
  
      points.push(closestIntersect || rayEnd);
    }
  
    // Draw light polygon cut-out from darkness
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  
  // Utility for line intersection — same as previous example
  function getLineIntersection(p0, p1, p2, p3) {
    const s1_x = p1.x - p0.x;
    const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x;
    const s2_y = p3.y - p2.y;
  
    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
  
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      return { x: p0.x + (t * s1_x), y: p0.y + (t * s1_y) };
    }
    return null;
  }
  



  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDebris();
  
  // Prepare obstacles as polygons for shadowcasting
  const obstaclesPolygons = debris.map(d => {
    return [
      { x: d.x - d.size/2, y: d.y - d.size/2 },
      { x: d.x + d.size/2, y: d.y - d.size/2 },
      { x: d.x + d.size/2, y: d.y + d.size/2 },
      { x: d.x - d.size/2, y: d.y + d.size/2 }
    ];
  });
  
  castLight(ctx, player.x, player.y, obstaclesPolygons);
  drawPowerUps();

  drawEnemies();
  drawBullets();
  drawPlayer();

  if (isPaused) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Paused", canvas.width/2, canvas.height/2);
  }

  requestAnimationFrame(gameLoop);
}

resetGame();
requestAnimationFrame(gameLoop);
