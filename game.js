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

// 🌟 NEW CHARACTER SKINS ADDED HERE
const SKINS = [
    { id: 'king', name: 'King', cost: 0, color: '#fde047', dark: '#ca8a04', type: 'king' },
    { id: 'knight', name: 'Knight', cost: 10, color: '#84cc16', dark: '#4d7c0f', type: 'knight' },
    { id: 'wizard', name: 'Wizard', cost: 25, color: '#3b82f6', dark: '#1d4ed8', type: 'wizard' },
    { id: 'ninja', name: 'Ninja', cost: 50, color: '#a855f7', dark: '#7e22ce', type: 'ninja' },
    { id: 'archer', name: 'Archer', cost: 75, color: '#f97316', dark: '#c2410c', type: 'archer' },
    { id: 'chef', name: 'Chef', cost: 100, color: '#f8fafc', dark: '#94a3b8', type: 'chef' },
    { id: 'pink', name: 'Bow Girl', cost: 150, color: '#f472b6', dark: '#be185d', type: 'pink' },
    { id: 'gent', name: 'Gentleman', cost: 200, color: '#06b6d4', dark: '#0e7490', type: 'gent' },
    { id: 'rapper', name: 'Rapper', cost: 250, color: '#94a3b8', dark: '#475569', type: 'rapper' },
    { id: 'builder', name: 'Builder', cost: 300, color: '#b45309', dark: '#78350f', type: 'builder' }
];

let unlockedSkins = ['king'];
let equippedSkin = SKINS[0];
let coins = 0;
let maxUnlockedLevel = 1;

function loadProgress() {
    coins = parseInt(localStorage.getItem('obby_coins') || '0');
    maxUnlockedLevel = parseInt(localStorage.getItem('obby_maxLevel') || '1');
    unlockedSkins = JSON.parse(localStorage.getItem('obby_skins') || '["king"]');
    const equippedId = localStorage.getItem('obby_equippedSkin') || 'king';
    equippedSkin = SKINS.find(s => s.id === equippedId) || SKINS[0];
}

function saveProgress() {
    localStorage.setItem('obby_coins', coins.toString());
    localStorage.setItem('obby_maxLevel', maxUnlockedLevel.toString());
    localStorage.setItem('obby_skins', JSON.stringify(unlockedSkins));
    localStorage.setItem('obby_equippedSkin', equippedSkin.id);
}

// Global Game State
let isStartMenu = true;
let currentLevel = 1;
const TOTAL_LEVELS = 15; 
let deaths = 0;
let startTime = Date.now();
let isGameWon = false;
let isPaused = false;
let screenShake = 0;
let bgTimer = 0;
let cameraX = 0;

let bgParticles = [];
function initBgParticles() {
    bgParticles = [];
    for (let i = 0; i < 40; i++) {
        bgParticles.push({
            x: Math.random() * canvas.width * 2,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + 1,
            speedY: Math.random() * 1.5 + 0.5,
            speedX: (Math.random() - 0.5) * 0.8,
            alpha: Math.random()
        });
    }
}
initBgParticles();

const player = {
    x: 50, y: 350, width: 28, height: 38,
    vx: 0, vy: 0, speed: 5.0, jumpForce: -11.5, // slightly buffed for mobile ease
    grounded: false, jumpsLeft: 2, maxJumps: 2,
    facingRight: true, scaleX: 1, scaleY: 1
};

let checkpoint = { x: 50, y: 350 };
const GRAVITY = 0.52;
const FRICTION = 0.80; // better handling
let keys = {};

let platforms = [];
let hazards = [];
let coinsList = [];
let checkpointsList = [];
let lasers = [];
let particles = [];
let exitDoor = { x: 880, y: 300, w: 45, h: 65 };

const THEMES = [
    { id: 'neon', name: "Neon Synthwave", sky: ["#1e1b4b", "#311042"], platform: "#22d3ee", base: "#0891b2" }, 
    { id: 'lava', name: "Lava Core", sky: ["#450a0a", "#180202"], platform: "#dc2626", base: "#7f1d1d" },
    { id: 'space', name: "Cosmic Void", sky: ["#020617", "#0f172a"], platform: "#38bdf8", base: "#0284c7" },
    { id: 'cyber', name: "Cyber Matrix", sky: ["#022c22", "#064e3b"], platform: "#34d399", base: "#059669" },
    { id: 'geo', name: "Geometric Gold", sky: ["#291e0a", "#451a03"], platform: "#fbbf24", base: "#b45309" }
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

    const addP = (x, y, w, h, type = 'normal', move = null, van = null) => platforms.push({ x, y, w, h, type, move, van });
    const addH = (type, x, y, w, h) => hazards.push({ type, x, y, w, h, rotation: 0 });
    const addC = (x, y) => checkpointsList.push({ x, y, w: 20, h: 30, reached: false });
    const addCoin = (x, y) => coinsList.push({ x, y, collected: false });
    const addL = (cx, cy, length, speed) => lasers.push({ cx, cy, length, angle: 0, speed });

    addP(20, 400, 120, 200);
    let cx = 160; let cy = 400;

    switch (levelNum) {
        case 1: 
            addP(180, 400, 140, 200); addH('spike', 230, 380, 40, 20);
            addP(370, 360, 120, 200); addC(410, 330);
            addP(540, 360, 140, 200); addH('spike', 580, 340, 50, 20);
            addP(730, 380, 120, 200); addC(770, 350);
            addP(900, 380, 140, 200); addH('lava', 940, 340, 40, 40);
            addP(1090, 400, 140, 200);
            cx = 1280; cy = 400; break;
        case 2: 
            addP(180, 400, 120, 200); addH('saw', 320, 340, 45, 45);
            addP(380, 400, 120, 200); addC(420, 370);
            addP(550, 360, 120, 200); addH('spike', 580, 340, 60, 20);
            addP(720, 320, 120, 200); addH('saw', 860, 260, 45, 45);
            addC(900, 290); addP(900, 320, 120, 200);
            addP(1070, 360, 120, 200); addH('spike', 1100, 340, 50, 20);
            addP(1240, 400, 140, 200);
            cx = 1430; cy = 400; break;
        case 3: 
            for (let i = 0; i < 5; i++) {
                addP(180 + (i * 90), 400, 75, 200, 'crumbling', null, { touched: false, timer: 35, destroyed: false });
                if (i === 2) addCoin(180 + (i * 90) + 25, 350);
            }
            addC(650, 370); addP(630, 400, 120, 200);
            addH('saw', 780, 350, 50, 50); addP(860, 400, 120, 200);
            for (let i = 0; i < 4; i++) {
                addP(1020 + (i * 90), 400, 75, 200, 'crumbling', null, { touched: false, timer: 30, destroyed: false });
            }
            addC(1400, 370); addP(1380, 400, 140, 200);
            addH('spike', 1420, 380, 60, 20); addP(1570, 400, 140, 200);
            cx = 1760; cy = 400; break;
        case 4: 
            addP(180, 400, 100, 20, 'moving', { axis: 'x', dir: 1, range: 60, startX: 180, speed: 1.2 });
            addP(380, 350, 100, 200); addC(410, 320);
            addP(530, 350, 90, 20, 'moving', { axis: 'y', dir: -1, range: 70, startY: 350, speed: 1 });
            addP(670, 240, 110, 200); addH('spike', 700, 220, 50, 20);
            addC(800, 210);
            addP(830, 240, 100, 20, 'moving', { axis: 'x', dir: 1, range: 70, startX: 830, speed: 1.5 });
            addP(1050, 280, 120, 200); addH('saw', 1200, 240, 50, 50);
            addP(1280, 350, 140, 200);
            cx = 1470; cy = 350; break;
        case 5: 
            addP(180, 450, 80, 200, 'bounce'); addP(320, 280, 100, 200);
            addH('spike', 340, 260, 40, 20); addC(360, 250);
            addP(460, 450, 80, 200, 'bounce'); addP(600, 240, 100, 200);
            addH('saw', 730, 200, 50, 50); addC(820, 210);
            addP(800, 240, 100, 200); addP(940, 450, 80, 200, 'bounce');
            addP(1080, 250, 140, 200);
            cx = 1270; cy = 250; break;
        case 6: 
            addH('lava', 120, 480, 1400, 100); addP(180, 400, 80, 20);
            addP(310, 380, 80, 20, 'moving', { axis: 'x', dir: 1, range: 50, startX: 310, speed: 1.2 });
            addC(430, 350); addP(430, 380, 80, 20);
            addH('saw', 550, 320, 45, 45); addP(630, 380, 80, 20);
            addC(750, 350);
            addP(750, 380, 80, 20, 'moving', { axis: 'y', dir: -1, range: 60, startY: 380, speed: 1 });
            addP(890, 280, 80, 20);
            addP(1030, 320, 80, 20, 'moving', { axis: 'x', dir: -1, range: 60, startX: 1030, speed: 1.5 });
            addP(1200, 380, 140, 200);
            cx = 1390; cy = 380; break;
        case 7: 
            addP(180, 400, 160, 200); addL(260, 300, 80, 0.025);
            addC(360, 370); addP(380, 400, 160, 200);
            addL(460, 300, 80, -0.025); addP(580, 400, 160, 200);
            addH('spike', 620, 380, 80, 20); addC(760, 370);
            addP(780, 400, 160, 200); addL(860, 300, 90, 0.03);
            addP(990, 400, 140, 200);
            cx = 1180; cy = 400; break;
        case 8: 
            addP(180, 400, 60, 200); addH('spike', 240, 380, 60, 20);
            addP(300, 400, 60, 200); addC(310, 370);
            for (let i = 0; i < 3; i++) { addP(400 + (i * 80), 400, 60, 200, 'crumbling', null, { touched: false, timer: 25, destroyed: false }); }
            addC(660, 370); addP(650, 400, 80, 200);
            addH('saw', 760, 340, 50, 50); addP(840, 400, 60, 200); 
            addH('spike', 900, 380, 60, 20); addP(960, 400, 120, 200);
            cx = 1130; cy = 400; break;
        case 9: 
            addP(180, 400, 80, 20, 'moving', { axis: 'y', dir: -1, range: 90, startY: 330, speed: 0.8 });
            addP(310, 220, 100, 200); addL(360, 140, 70, 0.03);
            addC(340, 190); addP(460, 220, 80, 20, 'moving', { axis: 'x', dir: 1, range: 60, startX: 460, speed: 1.2 });
            addP(640, 260, 100, 200); addH('saw', 770, 220, 50, 50);
            addC(860, 230); addP(850, 260, 80, 20, 'moving', { axis: 'y', dir: 1, range: 80, startY: 320, speed: 1 });
            addP(1000, 380, 140, 200);
            cx = 1190; cy = 380; break;
        case 10: 
            addP(180, 400, 80, 20, 'crumbling', null, { touched: false, timer: 30, destroyed: false });
            addP(290, 400, 60, 20, 'bounce');
            addP(400, 250, 100, 200); addH('spike', 430, 230, 40, 20); addC(430, 220);
            addP(540, 250, 80, 20, 'moving', { axis: 'x', dir: 1, range: 60, startX: 540, speed: 1.2 });
            addL(680, 180, 75, 0.035); addP(750, 250, 100, 200); addC(780, 220);
            addP(890, 450, 80, 200, 'bounce'); addP(1030, 280, 140, 200);
            cx = 1220; cy = 280; break;
        case 11: 
            addP(180, 400, 120, 200); addH('saw', 320, 330, 55, 55);
            addP(400, 400, 120, 200); addC(440, 370);
            addH('saw', 540, 330, 55, 55); addP(620, 400, 120, 200);
            addH('saw', 760, 330, 55, 55); addC(840, 370);
            addP(840, 400, 120, 200); addH('saw', 980, 330, 55, 55);
            addP(1060, 400, 140, 200);
            cx = 1250; cy = 400; break;
        case 12: 
            addP(180, 400, 100, 200, 'moving', { axis: 'x', dir: 1, range: 50, startX: 180, speed: 1.2 });
            addL(230, 300, 75, 0.03); addC(360, 370);
            addP(350, 400, 120, 200); addH('spike', 380, 380, 60, 20);
            addP(510, 400, 100, 200, 'moving', { axis: 'x', dir: -1, range: 50, startX: 510, speed: 1.2 });
            addL(560, 300, 75, -0.03); addC(700, 370);
            addP(690, 400, 120, 200); addH('saw', 830, 320, 50, 50);
            addP(910, 400, 140, 200);
            cx = 1100; cy = 400; break;
        case 13: 
            addP(180, 450, 70, 20, 'bounce'); addP(280, 300, 80, 20);
            addP(390, 200, 80, 20, 'moving', { axis: 'x', dir: 1, range: 40, startX: 390, speed: 1 });
            addC(500, 170); addP(500, 200, 100, 200);
            addH('spike', 520, 180, 50, 20); addP(640, 350, 70, 20, 'bounce');
            addP(750, 220, 80, 20, 'moving', { axis: 'y', dir: -1, range: 60, startY: 220, speed: 1 });
            addP(880, 160, 140, 200);
            cx = 1070; cy = 160; break;
        case 14: 
            addP(180, 420, 80, 200); addL(220, 370, 45, 0.04);
            addP(300, 360, 80, 200); addH('saw', 400, 300, 50, 50);
            addC(430, 330); addP(430, 360, 80, 20, 'crumbling', null, { touched: false, timer: 20, destroyed: false });
            addH('spike', 530, 340, 60, 20); addP(610, 360, 80, 200);
            addC(640, 330); addP(730, 360, 70, 20, 'bounce');
            addP(840, 220, 140, 200);
            cx = 1030; cy = 220; break;
        case 15: 
            addP(160, 400, 80, 20); addH('saw', 260, 340, 50, 50);
            addP(320, 400, 60, 20, 'crumbling', null, { touched: false, timer: 25, destroyed: false });
            addP(430, 450, 60, 20, 'bounce'); addC(540, 250);
            addP(520, 280, 100, 200); addH('spike', 540, 260, 50, 20);
            addP(660, 280, 80, 20, 'moving', { axis: 'x', dir: 1, range: 50, startX: 660, speed: 1.5 });
            addL(780, 200, 65, 0.05); addC(880, 250);
            addP(860, 280, 80, 200); addH('saw', 970, 220, 55, 55);
            addP(1050, 280, 60, 20, 'crumbling', null, { touched: false, timer: 20, destroyed: false });
            addP(1160, 280, 140, 200);
            cx = 1350; cy = 280; break;
    }

    // 🌟 END PLATFORM & NEW EXIT SPIKES
    addP(cx, cy, 150, 200);
    // Spikes protecting the final door
    addH('spike', cx + 15, cy - 20, 40, 20); 
    exitDoor = { x: cx + 75, y: cy - 65, w: 45, h: 65 };
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
            if (p.move.axis === 'y') {
                p.y += p.move.dir * p.move.speed;
                if (p.y > p.move.startY + p.move.range || p.y < p.move.startY - p.move.range) p.move.dir *= -1;
            } else {
                p.x += p.move.dir * p.move.speed;
                if (p.x > p.move.startX + p.move.range || p.x < p.move.startX - p.move.range) p.move.dir *= -1;
            }
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

                if (p.type === 'moving' && p.move) {
                    if (!p.move.axis || p.move.axis === 'x') player.x += p.move.dir * p.move.speed;
                }
                if (p.type === 'bounce') { player.vy = -16.5; spawnParticles(player.x + 14, player.y + 35, 10, '#facc15', 'spark'); }
                if (p.type === 'crumbling' && p.van) p.van.touched = true;
            }
        }
    });

    hazards.forEach(h => {
        h.rotation = (h.rotation || 0) + 0.1;
        if (player.x + player.width - 6 > h.x && player.x + 6 < h.x + h.w &&
            player.y + player.height > h.y + 4 && player.y + 4 < h.y + h.h) {
            handleDeath();
        }
    });

    // 🌟 PERFECT CHECKPOINT POSITIONING FIX
    checkpointsList.forEach(cp => {
        if (!cp.reached && player.x + player.width > cp.x && player.x < cp.x + cp.w &&
            player.y + player.height > cp.y && player.y < cp.y + cp.h) {
            cp.reached = true;
            checkpoint = { x: cp.x + 4, y: cp.y + cp.h - player.height - 2 }; // Anchors spawn safely to the floor
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

    if (player.y > canvas.height + 150) handleDeath();

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

function drawAdvancedBackground() {
    bgTimer += 0.03;
    let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, currentTheme.sky[0]);
    skyGrad.addColorStop(1, currentTheme.sky[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (currentTheme.id === 'neon') {
        let sunGrad = ctx.createRadialGradient(canvas.width / 2, 220, 10, canvas.width / 2, 220, 120);
        sunGrad.addColorStop(0, '#fde047'); sunGrad.addColorStop(1, 'rgba(236, 72, 153, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath(); ctx.arc(canvas.width / 2, 220, 120, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)'; ctx.lineWidth = 1.5;
        for (let y = 220; y < canvas.height; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
        for (let x = -200; x < canvas.width + 200; x += 40) { ctx.beginPath(); ctx.moveTo(canvas.width / 2 + (x - canvas.width / 2) * 0.1, 220); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    } else if (currentTheme.id === 'lava') {
        bgParticles.forEach(p => {
            p.y -= p.speedY; if (p.y < 0) p.y = canvas.height;
            ctx.fillStyle = `rgba(249, 115, 22, ${p.alpha})`; ctx.fillRect(p.x - cameraX * 0.2, p.y, p.size, p.size);
        });
    } else if (currentTheme.id === 'space') {
        bgParticles.forEach((p, idx) => {
            let px = (p.x - cameraX * 0.1) % canvas.width; if (px < 0) px += canvas.width;
            let tw = Math.sin(bgTimer * 3 + idx) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * tw})`; ctx.fillRect(px, p.y, p.size, p.size);
        });
    } else if (currentTheme.id === 'cyber') {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.15)';
        bgParticles.forEach(p => {
            p.y += p.speedY * 1.5; if (p.y > canvas.height) p.y = 0;
            let px = (p.x - cameraX * 0.2) % canvas.width; if (px < 0) px += canvas.width;
            ctx.fillRect(px, p.y, p.size * 2, p.size * 6);
        });
    } else if (currentTheme.id === 'geo') {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            let sx = ((i * 180) - cameraX * 0.2) % (canvas.width + 200);
            let sy = 100 + Math.sin(bgTimer + i) * 30;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(bgTimer * 0.5 + i); ctx.strokeRect(-20, -20, 40, 40); ctx.restore();
        }
    }
    ctx.restore();
}

function drawHazard(h) {
    if (h.type === 'spike') {
        ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
        let count = Math.floor(h.w / 15); let spikeW = h.w / count;
        for (let i = 0; i < count; i++) {
            ctx.beginPath(); ctx.moveTo(h.x + (i * spikeW), h.y + h.h);
            ctx.lineTo(h.x + (i * spikeW) + (spikeW / 2), h.y);
            ctx.lineTo(h.x + ((i + 1) * spikeW), h.y + h.h);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    } else if (h.type === 'saw') {
        ctx.save(); ctx.translate(h.x + h.w / 2, h.y + h.h / 2); ctx.rotate(h.rotation);
        ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            let a = (i * Math.PI / 4); ctx.lineTo(Math.cos(a) * (h.w / 2), Math.sin(a) * (h.h / 2));
            let a2 = a + Math.PI / 8; ctx.lineTo(Math.cos(a2) * (h.w / 4), Math.sin(a2) * (h.h / 4));
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else if (h.type === 'lava') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; ctx.fillRect(h.x - 2, h.y - 2, h.w + 4, h.h + 4);
        ctx.fillStyle = '#dc2626'; ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(h.x, h.y + h.h - 5, h.w, 5); ctx.fillRect(h.x + h.w - 5, h.y, 5, h.h);
    }
}

// 🌟 NEW DETAILED CHARACTER DRAWING LOGIC
function drawTCharacter(x, y) {
    ctx.save();
    ctx.translate(x + 14, y + 38);
    ctx.scale(player.facingRight ? player.scaleX : -player.scaleX, player.scaleY);
    
    // Base Body
    ctx.fillStyle = equippedSkin.color;
    ctx.fillRect(-8, -38, 16, 12); // Head
    ctx.fillRect(-14, -26, 28, 9); // Arms/Chest
    ctx.fillRect(-7, -17, 14, 17); // Legs

    // Shading
    ctx.fillStyle = equippedSkin.dark;
    ctx.fillRect(4, -38, 4, 12);
    ctx.fillRect(9, -26, 5, 9);
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(-4, -34, 3, 3);
    ctx.fillRect(2, -34, 3, 3);

    // 🌟 ACCESSORIES BASED ON SELECTION
    const type = equippedSkin.type;
    
    if (type === 'king') {
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(-9, -42, 18, 4); // Crown Base
        ctx.fillRect(-9, -45, 4, 3); ctx.fillRect(-2, -45, 4, 3); ctx.fillRect(5, -45, 4, 3); // Spikes
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-1, -44, 2, 2); // Gem
    } 
    else if (type === 'knight') {
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(-16, -38, 4, 18); // Sword Blade
        ctx.fillStyle = '#78350f'; ctx.fillRect(-18, -20, 8, 3); // Hilt
        ctx.fillRect(-15, -17, 2, 6); // Handle
    }
    else if (type === 'wizard') {
        ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.moveTo(-12, -38); ctx.lineTo(12, -38); ctx.lineTo(0, -50); ctx.fill(); // Hat
        ctx.fillStyle = '#facc15'; ctx.fillRect(-2, -44, 4, 4); // Star on hat
        ctx.fillStyle = '#78350f'; ctx.fillRect(-16, -30, 4, 30); // Staff
        ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(-14, -33, 4, 0, Math.PI * 2); ctx.fill(); // Orb
    }
    else if (type === 'ninja') {
        ctx.fillStyle = '#000000'; ctx.fillRect(-9, -36, 18, 6); // Mask
        ctx.fillRect(9, -35, 6, 4); // Tie tails
        ctx.fillStyle = equippedSkin.color; ctx.fillRect(-4, -34, 8, 3); // Eye slot
        ctx.fillStyle = '#000000'; ctx.fillRect(-3, -34, 2, 2); ctx.fillRect(1, -34, 2, 2); // Eyes over mask
    }
    else if (type === 'archer') {
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(6, -17); ctx.lineWidth = 3; ctx.stroke(); // Strap
        ctx.fillStyle = '#e5e5e5'; ctx.fillRect(10, -32, 2, 10); ctx.fillRect(13, -30, 2, 8); // Arrows in back
    }
    else if (type === 'chef') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-10, -48, 20, 10); // Tall Hat
        ctx.fillRect(-12, -52, 24, 6); // Hat Top puffy
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-8, -26, 16, 4); ctx.fillRect(-2, -22, 4, 6); // Red Scarf
        ctx.fillStyle = '#64748b'; ctx.fillRect(-16, -20, 6, 8); // Spatula Head
        ctx.fillStyle = '#78350f'; ctx.fillRect(-14, -12, 2, 10); // Spatula Handle
    }
    else if (type === 'pink') {
        ctx.fillStyle = '#e11d48'; ctx.fillRect(2, -44, 8, 8); ctx.fillRect(-8, -44, 8, 8); // Bow loops
        ctx.fillStyle = '#f43f5e'; ctx.fillRect(-3, -41, 6, 6); // Bow center
    }
    else if (type === 'gent') {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(-11, -38, 22, 3); // Hat Brim
        ctx.fillRect(-8, -48, 16, 10); // Hat Top
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-8, -40, 16, 2); // Hat Ribbon
        ctx.fillStyle = '#0f172a'; ctx.fillRect(-2, -24, 4, 3); ctx.fillRect(-4, -24, 8, 1); // Bowtie
        ctx.fillStyle = '#78350f'; ctx.fillRect(-16, -20, 4, 20); // Cane
        ctx.fillRect(-18, -20, 6, 3); // Cane Top
    }
    else if (type === 'rapper') {
        ctx.fillStyle = '#000000'; ctx.fillRect(-9, -35, 18, 5); // Sunglasses
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(-7, -26); ctx.lineTo(0, -18); ctx.lineTo(7, -26); ctx.lineWidth = 2; ctx.stroke(); // Chain
        ctx.fillRect(-2, -19, 4, 4); // Medallion
    }
    else if (type === 'builder') {
        ctx.fillStyle = '#facc15'; ctx.fillRect(-10, -42, 20, 6); // Hard Hat
        ctx.fillRect(-12, -38, 24, 2); // Brim
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(-9, -17, 18, 4); // Tool belt
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(10, -26, 4, 6); // Hammer head
        ctx.fillStyle = '#78350f'; ctx.fillRect(11, -20, 2, 10); // Hammer handle
    }

    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAdvancedBackground();

    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    ctx.translate(-Math.floor(cameraX), 0);

    platforms.forEach(p => {
        if (p.type === 'crumbling' && p.van && p.van.destroyed) return;

        ctx.fillStyle = (p.type === 'bounce') ? '#facc15' : currentTheme.platform;
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.fillStyle = (p.type === 'bounce') ? '#ca8a04' : currentTheme.base;
        ctx.fillRect(p.x, p.y + 8, p.w, p.h - 8);

        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000000';
        for (let tx = p.x; tx < p.x + p.w; tx += 12) {
            for (let ty = p.y; ty < p.y + 24; ty += 12) {
                if ((tx + ty) % 24 === 0) ctx.fillRect(tx, ty, 6, 6);
            }
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(p.x + p.w - 3, p.y, 3, p.h);
    });

    checkpointsList.forEach(cp => {
        ctx.fillStyle = '#64748b'; ctx.fillRect(cp.x, cp.y, 4, cp.h);
        ctx.fillStyle = cp.reached ? '#22c55e' : '#cbd5e1';
        ctx.beginPath(); ctx.moveTo(cp.x + 4, cp.y); ctx.lineTo(cp.x + 20, cp.y + 5); ctx.lineTo(cp.x + 4, cp.y + 12); ctx.fill();
    });

    coinsList.forEach(c => {
        if (!c.collected) {
            let pulse = Math.sin(bgTimer * 5) * 1.5;
            ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(c.x, c.y, 7 + pulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x - 2, c.y - 2, 3, 3);
        }
    });

    hazards.forEach(h => drawHazard(h));

    lasers.forEach(l => {
        let lx = l.cx + Math.cos(l.angle) * l.length; let ly = l.cy + Math.sin(l.angle) * l.length;
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