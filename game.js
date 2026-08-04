const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 960;
canvas.height = 540;

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

let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
    } else if (type === 'death') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'coin') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

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

// 🎯 REDUCED STAGES
let isStartMenu = true;
let currentLevel = 1;
let maxUnlockedLevel = 1;
const TOTAL_LEVELS = 15; 
let deaths = 0;
let coins = 0;
let startTime = Date.now();
let isGameWon = false;
let isPaused = false;
let screenShake = 0;
let bgTimer = 0;
let cameraX = 0;

const SKINS = [
    { id: 'yellow', name: 'Yellow', cost: 0, color: '#fde047', dark: '#ca8a04' },
    { id: 'red', name: 'Ruby', cost: 10, color: '#ef4444', dark: '#991b1b' },
    { id: 'green', name: 'Emerald', cost: 25, color: '#10b981', dark: '#065f46' },
    { id: 'purple', name: 'Cyber', cost: 50, color: '#a855f7', dark: '#581c87' },
    { id: 'black', name: 'Shadow', cost: 100, color: '#334155', dark: '#0f172a' }
];
let unlockedSkins = ['yellow'];
let equippedSkin = SKINS[0];

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

let platforms = [];
let hazards = [];
let coinsList = [];
let checkpointsList = [];
let lasers = [];
let particles = [];
let exitDoor = { x: 880, y: 300, w: 45, h: 65 };

// 🎯 DIFFERENT BACKGROUND COLORS PER LEVEL
const THEMES = [
    { name: "Gray Blocks", sky: ["#d1d5db", "#f3f4f6"], platform: "#64748b", base: "#475569" }, // Matches images exactly
    { name: "Lava Cave", sky: ["#450a0a", "#7f1d1d"], platform: "#3f3f46", base: "#27272a" },
    { name: "Sky High", sky: ["#0284c7", "#bae6fd"], platform: "#cbd5e1", base: "#94a3b8" },
    { name: "Neon District", sky: ["#311042", "#c084fc"], platform: "#2dd4bf", base: "#0f766e" },
    { name: "Desert Ruins", sky: ["#7c2d12", "#fdba74"], platform: "#d97706", base: "#b45309" }
];
let currentTheme = THEMES[0];

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

function loadLevel(levelNum) {
    platforms = []; hazards = []; coinsList = []; checkpointsList = []; lasers = [];
    checkpoint = { x: 50, y: 350 };
    respawnPlayer();
    cameraX = 0;

    currentTheme = THEMES[(levelNum - 1) % THEMES.length];
    levelTitleUI.innerText = `Stage ${levelNum} / ${TOTAL_LEVELS}`;
    themeNameUI.innerText = `Theme: ${currentTheme.name}`;

    // 🎯 DIFFICULTY GREATLY REDUCED
    // Wider platforms, closer jumps, fewer obstacles
    let pWidth = 150 - (levelNum * 3);  // Keeps platforms large and easy to land on
    let gap = 50 + (levelNum * 2);      // Jumps are much shorter
    let totalObstacles = 4 + Math.floor(levelNum * 0.4); 
    let moveSpeedMult = 0.5 + (levelNum * 0.05); // Moving platforms move slowly

    platforms.push({ x: 20, y: 400, w: 120, h: 140, type: 'normal' });

    let currentX = 150;
    let currentY = 380;

    for (let i = 0; i < totalObstacles; i++) {
        if (i % 3 === 1) currentY -= 20;
        else if (i % 3 === 2) currentY += 20;
        currentY = Math.max(220, Math.min(420, currentY));

        currentX += gap;

        let type = 'normal';
        let moveData = null;
        let vanData = null;

        // 🎯 DIFFERENT MECHANICS BASED ON LEVEL
        if (levelNum >= 5 && i % 4 === 1) {
            type = 'moving';
            moveData = { dir: 1, range: 40 + levelNum, startX: currentX, speed: 0.8 * moveSpeedMult };
        } else if (levelNum >= 7 && i % 4 === 2) {
            type = 'crumbling';
            vanData = { touched: false, timer: 50, destroyed: false }; // Timer is longer so it doesn't fall too fast
        } else if (levelNum >= 10 && i % 4 === 3) {
            type = 'bounce';
        }

        platforms.push({
            x: currentX, y: currentY, w: pWidth, h: 200,
            type, move: moveData, van: vanData
        });

        if (i === Math.floor(totalObstacles / 2)) {
            checkpointsList.push({ x: currentX + pWidth / 2 - 10, y: currentY - 30, w: 20, h: 30, reached: false });
        }

        // 🎯 LAVA BLOCKS (Introduced steadily)
        if (levelNum >= 4 && i % 2 === 1 && type !== 'crumbling') {
            let lavaSize = 35;
            hazards.push({ x: currentX + (pWidth / 2) - (lavaSize / 2), y: currentY - 40, w: lavaSize, h: lavaSize });
        }

        if (Math.random() > 0.4) {
            coinsList.push({ x: currentX + pWidth / 2, y: currentY - 70, collected: false });
        }

        // 🎯 LASERS ONLY ON FINAL LEVELS
        if (levelNum >= 13 && i % 3 === 0) {
            lasers.push({ cx: currentX + pWidth / 2, cy: currentY - 80, length: 50, angle: 0, speed: 0.015 });
        }
    }

    const lastX = currentX + 150;
    platforms.push({ x: lastX, y: currentY, w: 140, h: 200, type: 'normal' });
    exitDoor = { x: lastX + 50, y: currentY - 65, w: 45, h: 65 };
}

function respawnPlayer() {
    player.x = checkpoint.x;
    player.y = checkpoint.y;
    player.vx = 0; player.vy = 0;
}

function triggerJump() {
    if (player.jumpsLeft > 0 && !isPaused && !isStartMenu) {
        player.vy = player.jumpForce;
        player.jumpsLeft--;
        player.grounded = false;
        player.scaleX = 0.7; player.scaleY = 1.3;
        playSFX('jump');
        spawnParticles(player.x + 14, player.y + 35, 6, '#cbd5e1', 'dust');
    }
}

startGameBtn.onclick = () => { initAudio(); isStartMenu = false; startModal.classList.add('hidden'); startTime = Date.now(); };
window.addEventListener('keydown', (e) => {
    initAudio();
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (e.code === 'Space' || k === 'w' || e.code === 'ArrowUp') triggerJump(); 
    if (k === 'r') respawnPlayer();
    if (k === 's') toggleModal(shopModal, renderShop);
    if (k === 'l') toggleModal(levelModal, renderLevelGrid);
    if (k === 'm') isMuted = !isMuted;
    if (e.key === 'Escape') togglePause();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

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
        card.innerHTML = `<h4>${skin.name}</h4><div class="shop-preview" style="background: ${skin.color}"></div><p>${isUnlocked ? 'Owned' : '🪙 ' + skin.cost}</p><button ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : 'Buy'}</button>`;
        card.querySelector('button').onclick = () => {
            if (isUnlocked) equippedSkin = skin;
            else if (coins >= skin.cost) { coins -= skin.cost; unlockedSkins.push(skin.id); equippedSkin = skin; coinCounterUI.innerText = `🪙 ${coins}`; }
            saveProgress(); renderShop();
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
            btn.onclick = () => { currentLevel = i; loadLevel(currentLevel); toggleModal(levelModal); };
        }
        levelGridContainer.appendChild(btn);
    }
}

function update() {
    if (isStartMenu || isGameWon || isPaused) return;

    if (keys['a'] || keys['arrowleft']) { player.vx -= 0.85; player.facingRight = false; }
    if (keys['d'] || keys['arrowright']) { player.vx += 0.85; player.facingRight = true; }

    player.vy += GRAVITY;
    player.vx *= FRICTION;
    player.x += player.vx;
    player.y += player.vy;

    const maxScrollX = Math.max(0, (exitDoor.x + exitDoor.w + 60) - canvas.width);
    let targetCameraX = player.x - (canvas.width / 3);
    cameraX += (targetCameraX - cameraX) * 0.1;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > maxScrollX) cameraX = maxScrollX;

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
                if (!player.grounded && player.vy > 2) { player.scaleX = 1.3; player.scaleY = 0.7; }
                player.y = p.y - player.height;
                player.vy = 0;
                player.grounded = true;
                player.jumpsLeft = player.maxJumps;

                if (p.type === 'moving' && p.move) player.x += p.move.dir * p.move.speed;
                if (p.type === 'bounce') { player.vy = -16.5; spawnParticles(player.x + 14, player.y + 35, 10, '#facc15', 'spark'); }
                if (p.type === 'crumbling' && p.van) p.van.touched = true;
            }
        }
    });

    hazards.forEach(h => {
        // More forgiving hitbox for lava blocks (need to really touch it to die)
        if (player.x + player.width - 5 > h.x && player.x + 5 < h.x + h.w &&
            player.y + player.height > h.y + 5 && player.y + 5 < h.y + h.h) {
            handleDeath();
        }
    });

    checkpointsList.forEach(cp => {
        if (!cp.reached && player.x + player.width > cp.x && player.x < cp.x + cp.w &&
            player.y + player.height > cp.y && player.y < cp.y + cp.h) {
            cp.reached = true;
            checkpoint = { x: cp.x, y: cp.y - 10 };
            spawnParticles(cp.x, cp.y, 12, '#fde047', 'spark');
        }
    });

    coinsList.forEach(c => {
        if (!c.collected && Math.hypot((player.x + 14) - c.x, (player.y + 19) - c.y) < 22) {
            c.collected = true; coins++; saveProgress();
            coinCounterUI.innerText = `🪙 ${coins}`; playSFX('coin');
            spawnParticles(c.x, c.y, 8, '#facc15', 'spark');
        }
    });

    lasers.forEach(l => {
        l.angle += l.speed;
        let lx = l.cx + Math.cos(l.angle) * l.length;
        let ly = l.cy + Math.sin(l.angle) * l.length;
        if (Math.hypot((player.x + 14) - lx, (player.y + 19) - ly) < 18) handleDeath();
    });

    if (player.y > canvas.height + 60) handleDeath();

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

// 🎯 GEOMETRIC BACKGROUND FROM SCREENSHOTS
function drawBackground() {
    bgTimer += 0.03;

    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, currentTheme.sky[0]);
    skyGrad.addColorStop(1, currentTheme.sky[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.08; 
    const offset = (cameraX * 0.15) % 120;
    ctx.translate(-offset, 0);
    
    const size = 60;
    for(let y = 0; y < canvas.height + size; y += size) {
        for(let x = 0; x < canvas.width + 300; x += size) {
            let isEven = ((x/size + y/size) % 2 === 0);
            ctx.beginPath();
            if (isEven) {
                ctx.moveTo(x, y); ctx.lineTo(x + size, y + size); ctx.lineTo(x, y + size);
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.moveTo(x, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + size);
                ctx.fillStyle = '#000000';
            }
            ctx.fill();
        }
    }
    ctx.restore();
}

// 🎯 LAVA BLOCKS FROM SCREENSHOTS
function drawLavaBlock(h) {
    // Outer translucent glow
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(h.x - 2, h.y - 2, h.w + 4, h.h + 4);
    
    // Core lava block
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    
    // Shadow depth
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(h.x, h.y + h.h - 5, h.w, 5);
    ctx.fillRect(h.x + h.w - 5, h.y, 5, h.h);
    
    // Cracked texture lines
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h.x + 5, h.y + 5); ctx.lineTo(h.x + 15, h.y + 15);
    ctx.moveTo(h.x + h.w - 10, h.y + 5); ctx.lineTo(h.x + h.w - 5, h.y + 10);
    ctx.stroke();
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    ctx.translate(-Math.floor(cameraX), 0);

    platforms.forEach(p => {
        if (p.type === 'crumbling' && p.van && p.van.destroyed) return;

        // Base platform colors
        ctx.fillStyle = (p.type === 'bounce') ? '#facc15' : currentTheme.platform;
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.fillStyle = (p.type === 'bounce') ? '#ca8a04' : currentTheme.base;
        ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);

        // 🎯 DIAMOND-PLATE / BLOCK TEXTURE overlay (from images)
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000000';
        for (let tx = p.x; tx < p.x + p.w; tx += 12) {
            for (let ty = p.y; ty < p.y + 24; ty += 12) {
                if ((tx + ty) % 24 === 0) ctx.fillRect(tx, ty, 6, 6);
            }
        }
        ctx.restore();

        // Edge highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(p.x + p.w - 3, p.y, 3, p.h);
    });

    checkpointsList.forEach(cp => {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(cp.x, cp.y, 4, cp.h);
        ctx.fillStyle = cp.reached ? '#22c55e' : '#cbd5e1';
        ctx.beginPath(); ctx.moveTo(cp.x + 4, cp.y); ctx.lineTo(cp.x + 20, cp.y + 5); ctx.lineTo(cp.x + 4, cp.y + 12); ctx.fill();
    });

    coinsList.forEach(c => {
        if (!c.collected) {
            let pulse = Math.sin(bgTimer * 5) * 1.5;
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(c.x, c.y, 7 + pulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x - 2, c.y - 2, 3, 3);
        }
    });

    // 🎯 DRAW LAVA BLOCKS INSTEAD OF SPIKES
    hazards.forEach(h => drawLavaBlock(h));

    lasers.forEach(l => {
        let lx = l.cx + Math.cos(l.angle) * l.length;
        let ly = l.cy + Math.sin(l.angle) * l.length;
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(l.cx, l.cy); ctx.lineTo(lx, ly); ctx.stroke();
    });

    ctx.fillStyle = '#f59e0b'; ctx.fillRect(exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Arial'; ctx.fillText('EXIT', exitDoor.x + 8, exitDoor.y + 36);

    particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1.0;
    });

    drawTCharacter(player.x, player.y);
    ctx.restore();

    if (isGameWon) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
        ctx.fillText('ALL 15 STAGES CLEARED!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff'; ctx.font = '18px Arial';
        ctx.fillText(`Total Deaths: ${deaths} | Time: ${timerDisplayUI.innerText}`, canvas.width / 2, canvas.height / 2 + 20);
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

loadProgress();
coinCounterUI.innerText = `🪙 ${coins}`;
loadLevel(currentLevel);
gameLoop();

function setupMobileControls() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');
    if (!btnLeft || !btnRight || !btnJump) return;

    function attachButtonEvent(element, onPressStart, onPressEnd) {
        element.style.touchAction = 'none';
        const handleStart = (e) => { if (e.cancelable) e.preventDefault(); initAudio(); onPressStart(); };
        const handleEnd = (e) => { if (e.cancelable) e.preventDefault(); if (onPressEnd) onPressEnd(); };
        element.addEventListener('pointerdown', handleStart, { passive: false });
        element.addEventListener('pointerup', handleEnd, { passive: false });
        element.addEventListener('pointercancel', handleEnd, { passive: false });
    }

    attachButtonEvent(btnLeft, () => { keys['arrowleft'] = true; }, () => { keys['arrowleft'] = false; });
    attachButtonEvent(btnRight, () => { keys['arrowright'] = true; }, () => { keys['arrowright'] = false; });
    attachButtonEvent(btnJump, () => { keys['space'] = true; triggerJump(); }, () => { keys['space'] = false; });
}
setupMobileControls();