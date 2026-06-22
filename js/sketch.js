// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EARTH_R_KM  = 6371;
const SCALE       = EARTH_R_KM / 120;       // km per pixel ≈ 53.09
const GM_KM       = 6.674e-11 * 5.972e24 * 1e-9;  // km³ s⁻²  ≈ 398 600

const EARTH_R     = 120;   // px — visual Earth radius
const MOUNTAIN_H  = 38;    // px — exaggerated mountain height
const LAUNCH_R_PX = EARTH_R + MOUNTAIN_H;              // 158 px from center to cannon tip
const LAUNCH_R_KM = LAUNCH_R_PX * SCALE;               // km

// Orbital reference speeds at the launch altitude
const V_CIRC      = Math.sqrt(GM_KM / LAUNCH_R_KM);   // ≈ 6.89 km/s
const V_ESC       = V_CIRC * Math.SQRT2;               // ≈ 9.74 km/s
const V_MAX       = V_ESC * 1.18;                      // slider ceiling

const TIME_SCALE  = 1500;              // sim-seconds per real second
const DT          = TIME_SCALE / 60;   // sim-seconds per frame ≈ 25 s

const STAR_COUNT  = 160;

// ─── STATE ────────────────────────────────────────────────────────────────────
let cx, cy;
let stars   = [];
let bullet  = null;   // null = no active projectile
let running = false;
let paused  = false;

// ─── P5 SETUP ─────────────────────────────────────────────────────────────────
function setup() {
    let frame = document.getElementById('sim-frame');
    let cnv   = createCanvas(frame.offsetWidth, frame.offsetHeight);
    cnv.parent('sim-frame');
    cx = width / 2;
    cy = height / 2;

    generateStars();
    updateVelLabel();

    document.getElementById('vel-slider').addEventListener('input', updateVelLabel);
    document.getElementById('btn-fire').addEventListener('click',  onFire);
    document.getElementById('btn-pause').addEventListener('click', onPause);
    document.getElementById('btn-reset').addEventListener('click', onReset);

    window.addEventListener('resize', () => {
        let f = document.getElementById('sim-frame');
        resizeCanvas(f.offsetWidth, f.offsetHeight);
        cx = width / 2;
        cy = height / 2;
        generateStars();
    });
}

// ─── DRAW LOOP ─────────────────────────────────────────────────────────────────
function draw() {
    if (running && !paused) updatePhysics();
    drawBackground();
    drawEarth();
    if (bullet) drawBullet();
    if (bullet) updateEstadoBox();
}

// ─── PHYSICS: Step 2 — straight line (no gravity) ─────────────────────────────
function updatePhysics() {
    bullet.x += bullet.vx * DT;
    bullet.y += bullet.vy * DT;

    // Stop if bullet is far off-screen (> 3× canvas diagonal in km)
    let sx = cx + bullet.x / SCALE;
    let sy = cy - bullet.y / SCALE;
    let offscreen = sx < -width || sx > width * 2 || sy < -height || sy > height * 2;
    if (offscreen) endSimulation();
}

// ─── DRAW BULLET ──────────────────────────────────────────────────────────────
function drawBullet() {
    let sx = cx + bullet.x / SCALE;
    let sy = cy - bullet.y / SCALE;

    noStroke();
    fill(255, 220, 80, 45);
    circle(sx, sy, 16);
    fill(255, 220, 80, 110);
    circle(sx, sy, 10);
    fill(255, 235, 110);
    circle(sx, sy, 5);
}

// ─── STATUS BOX ───────────────────────────────────────────────────────────────
function updateEstadoBox() {
    let r_km  = Math.sqrt(bullet.x * bullet.x + bullet.y * bullet.y);
    let alt   = (r_km - EARTH_R_KM).toFixed(0);
    let speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);

    let traj, col;
    if (speed < V_CIRC * 0.97) {
        traj = 'Suborbital';        col = '#f97316';
    } else if (speed < V_CIRC * 1.03) {
        traj = 'Órbita circular';   col = '#10b981';
    } else if (speed < V_ESC  * 0.99) {
        traj = 'Órbita elíptica';   col = '#3b82f6';
    } else {
        traj = 'Vel. de escape';    col = '#a78bfa';
    }

    document.getElementById('estado-box').innerHTML =
        row('Velocidad',   speed.toFixed(2) + ' km/s', '#eef2f8') +
        row('Altitud',     Number(alt).toLocaleString() + ' km',   '#eef2f8') +
        row('Trayectoria', traj, col);
}

function row(label, value, valueColor) {
    return `<span style="color:#9aa6bd">${label}</span>` +
           `<span style="float:right;color:${valueColor};font-weight:600">${value}</span><br>`;
}

// ─── SIMULATION CONTROL ───────────────────────────────────────────────────────
function onFire() {
    let pct = parseInt(document.getElementById('vel-slider').value);
    let v0  = (pct / 100) * V_MAX;

    // Physics coords: x = east (right), y = north (up)
    // Launch from north pole top of mountain → (0, +LAUNCH_R_KM)
    // Initial velocity: eastward (+x), no vertical component
    bullet  = { x: 0, y: LAUNCH_R_KM, vx: v0, vy: 0 };
    running = true;
    paused  = false;

    document.getElementById('btn-fire').disabled   = true;
    document.getElementById('btn-pause').disabled  = false;
    document.getElementById('vel-slider').disabled = true;
}

function onPause() {
    paused = !paused;
    document.getElementById('btn-pause').textContent = paused ? '▶ Reanudar' : '⏸ Pausar';
}

function onReset() {
    bullet  = null;
    running = false;
    paused  = false;
    document.getElementById('btn-fire').disabled   = false;
    document.getElementById('btn-pause').disabled  = true;
    document.getElementById('btn-pause').textContent = '⏸ Pausar';
    document.getElementById('vel-slider').disabled  = false;
    document.getElementById('estado-box').innerHTML =
        '<span class="ui-empty">Sin proyectil activo</span>';
}

function endSimulation() {
    running = false;
    document.getElementById('btn-fire').disabled   = false;
    document.getElementById('btn-pause').disabled  = true;
    document.getElementById('vel-slider').disabled = false;
}

// ─── BACKGROUND ───────────────────────────────────────────────────────────────
function generateStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: random(width),  y: random(height),
            r: random(0.5, 1.8), bri: random(120, 255),
            tw: random(TWO_PI)
        });
    }
}

function drawBackground() {
    background(5, 8, 20);

    let g = drawingContext.createRadialGradient(cx, cy, EARTH_R * 0.8, cx, cy, EARTH_R * 3.5);
    g.addColorStop(0, 'rgba(30, 60, 120, 0.18)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    drawingContext.fillStyle = g;
    drawingContext.fillRect(0, 0, width, height);

    noStroke();
    for (let s of stars) {
        let tw = 0.75 + 0.25 * sin(frameCount * 0.02 + s.tw);
        fill(s.bri, s.bri, s.bri + 20, s.bri * tw);
        circle(s.x, s.y, s.r * 2);
    }
}

// ─── EARTH ────────────────────────────────────────────────────────────────────
function drawEarth() {
    push();
    translate(cx, cy);

    // Atmosphere glow
    let atm = drawingContext.createRadialGradient(0, 0, EARTH_R, 0, 0, EARTH_R + 22);
    atm.addColorStop(0, 'rgba(56, 130, 220, 0.35)');
    atm.addColorStop(1, 'rgba(56, 130, 220, 0)');
    drawingContext.fillStyle = atm;
    drawingContext.beginPath();
    drawingContext.arc(0, 0, EARTH_R + 22, 0, TWO_PI);
    drawingContext.fill();

    noStroke();
    fill(15, 55, 120);
    circle(0, 0, EARTH_R * 2);

    fill(34, 90, 50);
    ellipse(-28, -18, 52, 38);
    ellipse( 36, -10, 44, 52);
    ellipse(-50,  30, 36, 28);
    ellipse( 20,  52, 40, 22);
    ellipse(-12,  40, 28, 18);

    fill(200, 220, 255, 180);
    ellipse(0, -EARTH_R + 10, 38, 18);
    ellipse(0,  EARTH_R - 8,  30, 14);

    let hl = drawingContext.createRadialGradient(-30, -35, 0, -30, -35, EARTH_R * 1.1);
    hl.addColorStop(0,   'rgba(120, 180, 255, 0.18)');
    hl.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    drawingContext.fillStyle = hl;
    drawingContext.beginPath();
    drawingContext.arc(0, 0, EARTH_R, 0, TWO_PI);
    drawingContext.fill();

    noFill();
    stroke(80, 130, 200, 140);
    strokeWeight(1.5);
    circle(0, 0, EARTH_R * 2);

    drawMountain();
    pop();
}

function drawMountain() {
    let baseY = -EARTH_R;
    let hw    = 18;
    let mh    = MOUNTAIN_H;

    fill(90, 100, 115);
    noStroke();
    triangle(-hw, baseY, hw, baseY, 0, baseY - mh);

    fill(220, 230, 245);
    triangle(-7, baseY - mh + 13, 7, baseY - mh + 13, 0, baseY - mh);

    fill(180, 160, 120);
    stroke(100, 90, 70);
    strokeWeight(0.8);
    push();
    translate(0, baseY - mh - 4);
    rect(2, -3, 18, 6, 2);
    pop();

    noStroke();
    fill(80, 70, 55);
    circle(4, baseY - mh + 2, 7);
}

// ─── VELOCITY LABEL ───────────────────────────────────────────────────────────
function updateVelLabel() {
    let pct  = parseInt(document.getElementById('vel-slider').value);
    let vKms = (pct / 100) * V_MAX;

    document.getElementById('vel-label').textContent = vKms.toFixed(2) + ' km/s';

    let cls, txt;
    if (vKms < V_CIRC * 0.97) {
        cls = 'traj-suborbital'; txt = 'Suborbital';
    } else if (vKms < V_CIRC * 1.03) {
        cls = 'traj-circular';   txt = 'Órbita circular';
    } else if (vKms < V_ESC  * 0.99) {
        cls = 'traj-elliptical'; txt = 'Órbita elíptica';
    } else {
        cls = 'traj-escape';     txt = 'Velocidad de escape';
    }

    let el = document.getElementById('vel-type');
    el.className  = 'traj-label ' + cls;
    el.textContent = txt;
}
