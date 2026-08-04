# 🎮 PixelPlay Arena - Obby Stage Rush

our multi-game hub is live at:
👉 [https://tspratham09-hue.github.io/PixelPlay-Arena/]

Welcome to **Obby Stage Rush**, a fast-paced, multi-stage 2D platformer game built with HTML5, CSS3, and JavaScript! Complete challenging obstacle courses (obbies), dodge hazards, collect coins, unlock new character skins, and beat the clock across 15 custom neon-themed stages.

---

## ✨ Features

* 🏃 **15 Unique Stages:** Progressively challenging levels ranging from synthwave jump puzzles to precision platforming.
* 🛍️ **In-Game Shop & Skins:** Earn coins by playing and unlock custom character skins and colors in the shop.
* ⏱️ **Speedrun Timer & Death Counter:** Track your time and attempt zero-death speedruns on every stage.
* 💾 **Persistent Progress:** Your level unlocks, coin balance, high scores, and selected character skins save automatically in `localStorage`.
* 🎨 **Neon Synthwave Aesthetic:** Clean canvas-rendered graphics with modern HUD design and responsive layout.

---

## 🕹️ How to Play

### Controls
* **Move Left:** `A` or `Left Arrow`
* **Move Right:** `D` or `Right Arrow`
* **Jump / Double Jump:** `W`, `Spacebar`, or `Up Arrow`
* **Pause / Menu:** `Esc`

### Gameplay Objective
1. Navigate across platforms and clear dangerous gaps.
2. Reach the **flag checkpoint** to finish the stage.
3. Collect golden coins along the way to spend in the **Shop**.
4. Try to clear stages as quickly as possible with 0 deaths!

---

## 📁 File Structure

```text
PixelPlay-Arena/
│
├── index.html        # Main Hub / Landing Page
├── obby.html         # Obby Game Page (Canvas & UI Container)
├── css/
│   ├── style.css     # General styles & Hub UI
│   └── obby.css      # Obby stage HUD, Shop overlays & Canvas styling
└── js/
    ├── game.js       # Game loop, physics engine, and player controls
    ├── levels.js     # Level definitions and platform coordinates
    └── shop.js       # Shop logic, skin manager & LocalStorage handler
