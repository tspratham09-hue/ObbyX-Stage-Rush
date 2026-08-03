const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const levelTitleUI = document.getElementById('level-title');
const coinCounterUI = document.getElementById('coin-counter');
const deathCounterUI = document.getElementById('death-counter');
const timerDisplayUI = document.getElementById('timer-display');
const themeNameUI = document.getElementById('theme-name');

const startModal = document.getElementById('start-modal');
const startGameBtn = document.getElementById('start-game-btn');

const shopModal = document.getElementById('shop-modal');
const shopItemsContainer = document.getElementById('shop-items');
const closeShopBtn = document.getElementById('close-shop-btn');

const levelModal = document.getElementById('level-modal');
const levelGridContainer = document.getElementById('level-grid');
const closeLevelBtn = document.getElementById('close-level-btn');

const pauseModal = document.getElementById('pause-modal');
const resumeBtn = document.getElementById('resume-btn');

// Web Audio Synthesizer
let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSFX(type) {
    if (!audioCtx || isMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'coin') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'bounce') {
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'death') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'checkpoint') {
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

// LocalStorage Persistence
function loadProgress() {
    coins = parseInt(localStorage.getItem('obby_coins') || '0');
    maxUnlockedLevel = parseInt(localStorage.getItem('obby_maxLevel') || '1');
    unlockedSkins = JSON.parse(localStorage.getItem('obby_skins') || '["yellow"]');
    const equippedId = localStorage.getItem('obby_equippedSkin') || 'yellow';
    equippedSkin = SKINS.find(s => s.id === equippedId) || SKINS[0];
}

function saveProgress() {
    localStorage.setItem('obby_coins', coins.toString());
    localStorage.setItem('obby_maxLevel', maxUnlockedLevel.toString());
    localStorage.setItem('obby_skins', JSON.stringify(unlockedSkins));
    localStorage.setItem('obby_equippedSkin', equippedSkin.id);
}

// Game State Flags
let isStartMenu = true;
let currentLevel = 1;
let maxUnlockedLevel = 1;
const TOTAL_LEVELS = 20;
let deaths = 0;
let coins = 0;
let startTime = Date.now();
let isGameWon = false;
let isPaused = false;
let screenShake = 0;
let bgTimer = 0;

// Skins
const SKINS = [
    { id: 'yellow', name: 'Yellow', cost: 0, color: '#fde047', dark: '#ca8a04' },
    { id: 'red', name: 'Ruby', cost: 10, color: '#ef4444', dark: '#991b1b' },
    { id: 'green', name: 'Emerald', cost: 25, color: '#10b981', dark: '#065f46' },
    { id: 'purple', name: 'Cyber', cost: 50, color: '#a855f7', dark: '#581c87' },
    { id: 'black', name: 'Shadow', cost: 100, color: '#334155', dark: '#0f172a' }
];
let unlockedSkins = ['yellow'];
let equippedSkin = SKINS[0];

// Player Properties
const player = {
    x: 50, y: 350, width: 28, height: 38,
    vx: 0, vy: 0, speed: 4.8, jumpForce: -11,
    grounded: false, jumpsLeft: 2, maxJumps: 2,
    facingRight: true, scaleX: 1, scaleY: 1
};

let checkpoint = { x: 50, y: 350 };
const GRAVITY = 0.52;
const FRICTION = 0.82;
let keys = {};

// Stage Elements & Particles
let platforms = [];
let hazards = [];
let coinsList = [];
let checkpointsList = [];
let lasers = [];
let particles = [];
let exitDoor = { x: 880, y: 300, w: 45, h: 65 };

const THEMES = [
    { name: "Grassland", sky: ["#0284c7", "#bae6fd"], platform: "#22c55e", base: "#15803d" },
    { name: "Desert Sunset", sky: ["#7c2d12", "#fdba74"], platform: "#f59e0b", base: "#b45309" },
    { name: "Frozen Ice", sky: ["#0f172a", "#38bdf8"], platform: "#06b6d4", base: "#0e7490" },
    { name: "Lava Core", sky: ["#450a0a", "#f87171"], platform: "#dc2626", base: "#7f1d1d" },
    { name: "Cyber Neon", sky: ["#311042", "#c084fc"], platform: "#a855f7", base: "#581c87" }
];
let currentTheme = THEMES[0];

// Particle Spawner
function spawnParticles(x, y, count, color, type = 'dust') {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * (type === 'confetti' ? 6 : 4),
            vy: (Math.random() - 0.5) * (type === 'confetti' ? 6 : 3) - (type === 'dust' ? 1 : 0),
            size: Math.random() * 4 + 2,
            color, life: 1,
            decay: Math.random() * 0.03 + 0.02
        });
    }
}

// Stage Generator with Easy, Medium & Hard Tier Progression
function loadLevel(levelNum) {
    platforms = []; hazards = []; coinsList = []; checkpointsList = []; lasers = [];
    
    checkpoint = { x: 50, y: 350 };
    respawnPlayer();

    currentTheme = THEMES[(levelNum - 1) % THEMES.length];
    levelTitleUI.innerText = `Stage ${levelNum} / ${TOTAL_LEVELS}`;
    themeNameUI.innerText = `Theme: ${currentTheme.name}`;

    let pWidth, gap, totalObstacles, allowCrumbling, allowConveyor, allowLasers, moveSpeedMult;

    if (levelNum <= 5) {
        // EASY TIER (1 - 5)
        pWidth = 120 - (levelNum * 4);
        gap = 50 + (levelNum * 4);
        totalObstacles = 4 + Math.floor(levelNum * 0.3);
        allowCrumbling = false; allowConveyor = false; allowLasers = false;
        moveSpeedMult = 0.8;
    } else if (levelNum <= 12) {
        // MEDIUM TIER (6 - 12)
        pWidth = 95 - ((levelNum - 5) * 3);
        gap = 75 + ((levelNum - 5) * 4);
        totalObstacles = 6 + Math.floor((levelNum - 5) * 0.5);
        allowCrumbling = true; allowConveyor = true; allowLasers = levelNum >= 9;
        moveSpeedMult = 1.3;
    } else {
        // HARD TIER (13 - 20)
        pWidth = 65 - Math.min((levelNum - 12) * 2, 20);
        gap = 105 + Math.min((levelNum - 12) * 3, 25);
        totalObstacles = 8 + Math.floor((levelNum - 12) * 0.5);
        allowCrumbling = true; allowConveyor = true; allowLasers = true;
        moveSpeedMult = 2.0;
    }

    platforms.push({ x: 20, y: 400, w: 120, h: 140, type: 'normal' });

    let currentX = 150;
    let currentY = 380;

    for (let i = 0; i < totalObstacles; i++) {
        if (i % 3 === 1) currentY -= (levelNum <= 5 ? 25 : 40);
        else if (i % 3 === 2) currentY += (levelNum <= 5 ? 20 : 35);
        currentY = Math.max(180, Math.min(420, currentY));

        currentX += gap;

        let type = 'normal';
        let moveData = null;
        let vanData = null;

        if (i % 4 === 1 && levelNum >= 3) {
            type = 'moving';
            moveData = { dir: 1, range: 40 + levelNum * 2, startX: currentX, speed: 1.0 * moveSpeedMult };
        } else if (i % 4 === 2 && allowCrumbling) {
            type = 'crumbling';
            vanData = { touched: false, timer: levelNum > 12 ? 20 : 35, destroyed: false };
        } else if (i % 4 === 3 && allowConveyor) {
            type = 'conveyor';
        } else if (i % 5 === 0 && levelNum >= 2) {
            type = 'bounce';
        }

        platforms.push({
            x: currentX, y: currentY, w: pWidth, h: 200,
            type, move: moveData, van: vanData
        });

        if (i === Math.floor(totalObstacles / 2)) {
            checkpointsList.push({ x: currentX + pWidth / 2 - 10, y: currentY - 30, w: 20, h: 30, reached: false });
        }

        if ((levelNum >= 3 && i % 2 === 1 && type !== 'crumbling') || (levelNum > 12 && i % 2 === 0)) {
            let spikeW = levelNum <= 5 ? pWidth / 3 : pWidth / 2;
            hazards.push({ x: currentX + (pWidth - spikeW) / 2, y: currentY - 14, w: spikeW, h: 14 });
        }

        if (Math.random() > 0.35) {
            coinsList.push({ x: currentX + pWidth / 2, y: currentY - 35, collected: false });
        }

        if (allowLasers && i % 3 === 0) {
            lasers.push({
                cx: currentX + pWidth / 2,
                cy: currentY - 65,
                length: levelNum > 12 ? 75 : 55,
                angle: 0,
                speed: (0.02 + levelNum * 0.002) * (levelNum > 12 ? 1.4 : 1.0)
            });
        }
    }

    const lastX = currentX + 130;
    platforms.push({ x: lastX, y: currentY, w: 130, h: 200, type: 'normal' });
    exitDoor = { x: lastX + 45, y: currentY - 65, w: 45, h: 65 };
}

function respawnPlayer() {
    player.x = checkpoint.x;
    player.y = checkpoint.y;
    player.vx = 0; player.vy = 0;
}

// Start Game Handler
startGameBtn.onclick = () => {
    isStartMenu = false;
    startModal.classList.add('hidden');
    startTime = Date.now();
};

// Controls
window.addEventListener('keydown', (e) => {
    initAudio();
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (e.code === 'Space' || k === 'w' || e.code === 'ArrowUp') {
        if (player.jumpsLeft > 0 && !isPaused && !isStartMenu) {
            player.vy = player.jumpForce;
            player.jumpsLeft--;
            player.grounded = false;
            player.scaleX = 0.7; player.scaleY = 1.3;
            playSFX('jump');
            spawnParticles(player.x + 14, player.y + 35, 6, '#cbd5e1', 'dust');
        }
    }
    if (k === 'r') respawnPlayer();
    if (k === 's') toggleModal(shopModal, renderShop);
    if (k === 'l') toggleModal(levelModal, renderLevelGrid);
    if (k === 'm') isMuted = !isMuted;
    if (e.key === 'Escape') togglePause();
});

window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Modal Interface Controllers
function toggleModal(modal, renderFunc) {
    if (isStartMenu) return;
    const isHidden = modal.classList.contains('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    if (isHidden) {
        if (renderFunc) renderFunc();
        modal.classList.remove('hidden');
        isPaused = true;
    } else {
        isPaused = false;
    }
}

function togglePause() {
    if (isStartMenu) return;
    isPaused = !isPaused;
    if (isPaused) pauseModal.classList.remove('hidden');
    else pauseModal.classList.add('hidden');
}

closeShopBtn.onclick = () => toggleModal(shopModal);
closeLevelBtn.onclick = () => toggleModal(levelModal);
resumeBtn.onclick = togglePause;

function renderShop() {
    shopItemsContainer.innerHTML = '';
    SKINS.forEach(skin => {
        const isUnlocked = unlockedSkins.includes(skin.id);
        const isEquipped = equippedSkin.id === skin.id;

        const card = document.createElement('div');
        card.className = `shop-card ${isEquipped ? 'selected' : ''}`;
        card.innerHTML = `
            <h4>${skin.name}</h4>
            <div class="shop-preview" style="background: ${skin.color}"></div>
            <p>${isUnlocked ? 'Owned' : '🪙 ' + skin.cost}</p>
            <button ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : 'Buy'}</button>
        `;

        card.querySelector('button').onclick = () => {
            if (isUnlocked) {
                equippedSkin = skin;
            } else if (coins >= skin.cost) {
                coins -= skin.cost;
                unlockedSkins.push(skin.id);
                equippedSkin = skin;
                coinCounterUI.innerText = `🪙 ${coins}`;
            }
            saveProgress();
            renderShop();
        };
        shopItemsContainer.appendChild(card);
    });
}

function renderLevelGrid() {
    levelGridContainer.innerHTML = '';
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
        const btn = document.createElement('button');
        const isUnlocked = i <= maxUnlockedLevel;
        btn.className = `level-btn ${isUnlocked ? 'unlocked' : 'locked'}`;
        btn.innerText = i;
        if (isUnlocked) {
            btn.onclick = () => {
                currentLevel = i;
                loadLevel(currentLevel);
                toggleModal(levelModal);
            };
        }
        levelGridContainer.appendChild(btn);
    }
}

// Engine Update
function update() {
    if (isStartMenu || isGameWon || isPaused) return;

    if (keys['a'] || keys['arrowleft']) { player.vx -= 0.85; player.facingRight = false; }
    if (keys['d'] || keys['arrowright']) { player.vx += 0.85; player.facingRight = true; }

    player.vy += GRAVITY;
    player.vx *= FRICTION;
    player.x += player.vx;
    player.y += player.vy;

    player.scaleX += (1 - player.scaleX) * 0.15;
    player.scaleY += (1 - player.scaleY) * 0.15;

    player.grounded = false;
    platforms.forEach(p => {
        if (p.type === 'moving' && p.move) {
            p.x += p.move.dir * p.move.speed;
            if (p.x > p.move.startX + p.move.range || p.x < p.move.startX - p.move.range) p.move.dir *= -1;
        }

        if (p.type === 'crumbling' && p.van && p.van.touched) {
            p.van.timer--;
            if (p.van.timer <= 0) p.van.destroyed = true;
        }

        if (p.type === 'crumbling' && p.van && p.van.destroyed) return;

        if (player.x + player.width > p.x && player.x < p.x + p.w) {
            if (player.y + player.height >= p.y && player.y + player.height <= p.y + 18 && player.vy >= 0) {
                if (!player.grounded && player.vy > 2) {
                    player.scaleX = 1.3; player.scaleY = 0.7;
                }
                player.y = p.y - player.height;
                player.vy = 0;
                player.grounded = true;
                player.jumpsLeft = player.maxJumps;

                if (p.type === 'moving' && p.move) player.x += p.move.dir * p.move.speed;
                if (p.type === 'conveyor') player.x += 2.2;
                if (p.type === 'bounce') {
                    player.vy = -16.5;
                    playSFX('bounce');
                    spawnParticles(player.x + 14, player.y + 35, 10, '#22c55e', 'spark');
                }
                if (p.type === 'crumbling' && p.van) p.van.touched = true;
            }
        }
    });

    // Hazards
    hazards.forEach(h => {
        if (player.x + player.width > h.x && player.x < h.x + h.w &&
            player.y + player.height > h.y && player.y < h.y + h.h) {
            handleDeath();
        }
    });

    // Checkpoint
    checkpointsList.forEach(cp => {
        if (!cp.reached && player.x + player.width > cp.x && player.x < cp.x + cp.w &&
            player.y + player.height > cp.y && player.y < cp.y + cp.h) {
            cp.reached = true;
            checkpoint = { x: cp.x, y: cp.y - 10 };
            playSFX('checkpoint');
            spawnParticles(cp.x, cp.y, 12, '#fde047', 'spark');
        }
    });

    // Coins
    coinsList.forEach(c => {
        if (!c.collected && Math.hypot((player.x + 14) - c.x, (player.y + 19) - c.y) < 22) {
            c.collected = true;
            coins++;
            saveProgress();
            coinCounterUI.innerText = `🪙 ${coins}`;
            playSFX('coin');
            spawnParticles(c.x, c.y, 8, '#facc15', 'spark');
        }
    });

    // Lasers
    lasers.forEach(l => {
        l.angle += l.speed;
        let lx = l.cx + Math.cos(l.angle) * l.length;
        let ly = l.cy + Math.sin(l.angle) * l.length;
        if (Math.hypot((player.x + 14) - lx, (player.y + 19) - ly) < 18) handleDeath();
    });

    if (player.y > canvas.height + 60) handleDeath();

    // Stage Clear Trigger
    if (player.x + player.width > exitDoor.x && player.x < exitDoor.x + exitDoor.w &&
        player.y + player.height > exitDoor.y && player.y < exitDoor.y + exitDoor.h) {
        if (currentLevel < TOTAL_LEVELS) {
            currentLevel++;
            maxUnlockedLevel = Math.max(maxUnlockedLevel, currentLevel);
            saveProgress();
            spawnParticles(exitDoor.x + 20, exitDoor.y + 30, 25, '#fde047', 'confetti');
            loadLevel(currentLevel);
        } else {
            isGameWon = true;
        }
    }

    particles.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) particles.splice(idx, 1);
    });

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timerDisplayUI.innerText = `⏱️ ${m}:${s}`;

    if (screenShake > 0) screenShake--;
}

function handleDeath() {
    deaths++;
    deathCounterUI.innerText = `☠️ ${deaths}`;
    screenShake = 12;
    playSFX('death');
    spawnParticles(player.x + 14, player.y + 19, 15, '#ef4444', 'spark');
    respawnPlayer();
}

// Visual Background Render
function drawBackground() {
    bgTimer += 0.03;

    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, currentTheme.sky[0]);
    skyGrad.addColorStop(1, currentTheme.sky[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    const offset = player.x * 0.05;
    ctx.beginPath();
    ctx.moveTo(0 - offset, 540);
    ctx.lineTo(120 - offset, 300); ctx.lineTo(320 - offset, 540);
    ctx.lineTo(580 - offset, 220); ctx.lineTo(820 - offset, 540);
    ctx.lineTo(1080 - offset, 260); ctx.lineTo(1300 - offset, 540);
    ctx.fill();
}

function drawSpikes(h) {
    ctx.fillStyle = '#ef4444';
    const spikeWidth = 10;
    const count = Math.floor(h.w / spikeWidth);
    for (let i = 0; i < count; i++) {
        let sx = h.x + i * spikeWidth;
        ctx.beginPath();
        ctx.moveTo(sx, h.y + h.h);
        ctx.lineTo(sx + spikeWidth / 2, h.y);
        ctx.lineTo(sx + spikeWidth, h.y + h.h);
        ctx.fill();
    }
}

function drawTCharacter(x, y) {
    ctx.save();
    ctx.translate(x + 14, y + 38);
    ctx.scale(player.facingRight ? player.scaleX : -player.scaleX, player.scaleY);

    ctx.fillStyle = equippedSkin.color;
    ctx.fillRect(-8, -38, 16, 12);
    ctx.fillRect(-14, -26, 28, 9);
    ctx.fillRect(-7, -17, 14, 17);

    ctx.fillStyle = equippedSkin.dark;
    ctx.fillRect(4, -38, 4, 12);
    ctx.fillRect(9, -26, 5, 9);

    ctx.fillStyle = '#000000';
    ctx.fillRect(-4, -34, 3, 3);
    ctx.fillRect(2, -34, 3, 3);

    ctx.restore();
}

// Main Render Frame
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    drawBackground();

    platforms.forEach(p => {
        if (p.type === 'crumbling' && p.van && p.van.destroyed) return;

        ctx.fillStyle = currentTheme.platform;
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.fillStyle = currentTheme.base;
        ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(p.x, p.y, 2, p.h);
        ctx.fillRect(p.x + p.w - 2, p.y, 2, p.h);

        if (p.type === 'bounce') {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(p.x + 4, p.y - 6, p.w - 8, 6);
        } else if (p.type === 'conveyor') {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(p.x, p.y + 2, p.w, 4);
        }
    });

    checkpointsList.forEach(cp => {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(cp.x, cp.y, 4, cp.h);

        ctx.fillStyle = cp.reached ? '#22c55e' : '#facc15';
        let wave = Math.sin(bgTimer * 4) * 3;
        ctx.beginPath();
        ctx.moveTo(cp.x + 4, cp.y);
        ctx.lineTo(cp.x + 20 + wave, cp.y + 5);
        ctx.lineTo(cp.x + 4, cp.y + 12);
        ctx.fill();
    });

    coinsList.forEach(c => {
        if (!c.collected) {
            let pulse = Math.sin(bgTimer * 5) * 1.5;
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(c.x, c.y, 7 + pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(c.x - 2, c.y - 2, 3, 3);
        }
    });

    hazards.forEach(h => drawSpikes(h));

    lasers.forEach(l => {
        let lx = l.cx + Math.cos(l.angle) * l.length;
        let ly = l.cy + Math.sin(l.angle) * l.length;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(lx, ly); ctx.stroke();
    });

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('EXIT', exitDoor.x + 8, exitDoor.y + 36);

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1.0;
    });

    drawTCharacter(player.x, player.y);

    ctx.restore();

    // Victory Screen
    if (isGameWon) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('OBBYX: STAGE RUSH CLEARED!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Arial';
        ctx.fillText(`Total Deaths: ${deaths} | Time: ${timerDisplayUI.innerText}`, canvas.width / 2, canvas.height / 2 + 20);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

loadProgress();
coinCounterUI.innerText = `🪙 ${coins}`;
loadLevel(currentLevel);
gameLoop();

// --- MOBILE TOUCH CONTROLS ---
window.addEventListener('load', () => {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    if (!btnLeft || !btnRight || !btnJump) return;

    // Simulate Left Key (A or ArrowLeft)
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['a'] = true; keys['ArrowLeft'] = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['a'] = false; keys['ArrowLeft'] = false; });

    // Simulate Right Key (D or ArrowRight)
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['d'] = true; keys['ArrowRight'] = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['d'] = false; keys['ArrowRight'] = false; });

    // Simulate Jump Key (Catch-all for Space, w, W, ArrowUp)
    btnJump.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        keys[' '] = true; 
        keys['w'] = true; 
        keys['W'] = true;
        keys['ArrowUp'] = true; 
        keys['Space'] = true;
    });
    
    btnJump.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        keys[' '] = false; 
        keys['w'] = false; 
        keys['W'] = false;
        keys['ArrowUp'] = false; 
        keys['Space'] = false;
    });
});