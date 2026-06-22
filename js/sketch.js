// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Physics scale: 1 px = SCALE km  (Earth R = 6371 km → 120 px)
const EARTH_R_KM   = 6371;
const SCALE        = EARTH_R_KM / 120;          // km per pixel
const G_REAL       = 6.674e-11;                 // m³ kg⁻¹ s⁻²
const M_EARTH      = 5.972e24;                  // kg
const GM           = G_REAL * M_EARTH;          // m³ s⁻²
const GM_KM        = GM * 1e-9;                 // km³ s⁻²  (G·M in km units)

// Orbital reference speeds (km/s) at Earth surface
const V_CIRCULAR   = Math.sqrt(GM_KM / EARTH_R_KM);  // ≈ 7.91 km/s
const V_ESCAPE     = V_CIRCULAR * Math.SQRT2;          // ≈ 11.19 km/s

// Visual
const EARTH_R      = 120;   // px — visual Earth radius
const MOUNTAIN_H   = 38;    // px — exaggerated mountain height
const STAR_COUNT   = 160;

// ─── STATE ────────────────────────────────────────────────────────────────────
let cx, cy;          // canvas center
let stars = [];      // background stars

// ─── P5 SETUP ─────────────────────────────────────────────────────────────────
function setup() {
    let frame = document.getElementById('sim-frame');
    let cnv   = createCanvas(frame.offsetWidth, frame.offsetHeight);
    cnv.parent('sim-frame');

    cx = width  / 2;
    cy = height / 2;

    generateStars();
    updateVelLabel();

    document.getElementById('vel-slider').addEventListener('input', updateVelLabel);
    document.getElementById('btn-fire').addEventListener('click',  onFire);
    document.getElementById('btn-pause').addEventListener('click', onPause);
    document.getElementById('btn-reset').addEventListener('click', onReset);

    // Resize handler
    window.addEventListener('resize', () => {
        let f = document.getElementById('sim-frame');
        resizeCanvas(f.offsetWidth, f.offsetHeight);
        cx = width  / 2;
        cy = height / 2;
        generateStars();
    });
}

// ─── DRAW LOOP ─────────────────────────────────────────────────────────────────
function draw() {
    drawBackground();
    drawEarth();
}

// ─── BACKGROUND ───────────────────────────────────────────────────────────────
function generateStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x:    random(width),
            y:    random(height),
            r:    random(0.5, 1.8),
            bri:  random(120, 255),
            twinkleOffset: random(TWO_PI)
        });
    }
}

function drawBackground() {
    background(5, 8, 20);

    // Subtle radial glow around Earth
    let g = drawingContext.createRadialGradient(cx, cy, EARTH_R * 0.8, cx, cy, EARTH_R * 3.5);
    g.addColorStop(0,   'rgba(30, 60, 120, 0.18)');
    g.addColorStop(1,   'rgba(0,  0,   0,  0)');
    drawingContext.fillStyle = g;
    drawingContext.fillRect(0, 0, width, height);

    // Stars
    noStroke();
    for (let s of stars) {
        let twinkle = 0.75 + 0.25 * sin(frameCount * 0.02 + s.twinkleOffset);
        fill(s.bri, s.bri, s.bri + 20, s.bri * twinkle);
        circle(s.x, s.y, s.r * 2);
    }
}

// ─── EARTH ────────────────────────────────────────────────────────────────────
function drawEarth() {
    push();
    translate(cx, cy);

    // Atmosphere glow
    let atm = drawingContext.createRadialGradient(0, 0, EARTH_R, 0, 0, EARTH_R + 22);
    atm.addColorStop(0,   'rgba(56, 130, 220, 0.35)');
    atm.addColorStop(1,   'rgba(56, 130, 220, 0)');
    drawingContext.fillStyle = atm;
    drawingContext.beginPath();
    drawingContext.arc(0, 0, EARTH_R + 22, 0, TWO_PI);
    drawingContext.fill();

    // Ocean base
    noStroke();
    fill(15, 55, 120);
    circle(0, 0, EARTH_R * 2);

    // Continent patches (static, decorative)
    fill(34, 90, 50);
    ellipse(-28, -18, 52, 38);   // pseudo-Europe/Africa
    ellipse( 36, -10, 44, 52);   // pseudo-Asia
    ellipse(-50,  30, 36, 28);   // pseudo-Americas
    ellipse( 20,  52, 40, 22);   // pseudo-Antarctica area
    ellipse(-12,  40, 28, 18);

    // Ice caps
    fill(200, 220, 255, 180);
    ellipse(0, -EARTH_R + 10, 38, 18);
    ellipse(0,  EARTH_R - 8,  30, 14);

    // Subtle highlight
    let hl = drawingContext.createRadialGradient(-30, -35, 0, -30, -35, EARTH_R * 1.1);
    hl.addColorStop(0,   'rgba(120, 180, 255, 0.18)');
    hl.addColorStop(0.6, 'rgba(0,   0,   0,  0)');
    drawingContext.fillStyle = hl;
    drawingContext.beginPath();
    drawingContext.arc(0, 0, EARTH_R, 0, TWO_PI);
    drawingContext.fill();

    // Border
    noFill();
    stroke(80, 130, 200, 140);
    strokeWeight(1.5);
    circle(0, 0, EARTH_R * 2);

    drawMountain();

    pop();
}

function drawMountain() {
    // Mountain sits at the north pole: (0, -EARTH_R) in Earth-local coords
    // The cannon fires to the right (east), so mountain faces right
    let baseY = -EARTH_R;
    let hw    = 18;   // half-base width
    let mh    = MOUNTAIN_H;

    // Mountain body
    fill(90, 100, 115);
    noStroke();
    triangle(-hw, baseY, hw, baseY, 0, baseY - mh);

    // Snow cap
    fill(220, 230, 245);
    triangle(-7, baseY - mh + 13, 7, baseY - mh + 13, 0, baseY - mh);

    // Cannon barrel (small rectangle pointing right from the peak)
    let px = 0, py = baseY - mh;
    fill(180, 160, 120);
    stroke(100, 90, 70);
    strokeWeight(0.8);
    push();
    translate(px, py - 4);
    rotate(0);   // horizontal → east
    rect(2, -3, 18, 6, 2);
    pop();

    // Cannon wheel hint
    noStroke();
    fill(80, 70, 55);
    circle(4, baseY - mh + 2, 7);
}

// ─── UI CALLBACKS (stubs for now) ─────────────────────────────────────────────
function onFire()  { /* Step 2 */ }
function onPause() { /* Step 2 */ }
function onReset() { /* Step 2 */ }

// ─── VELOCITY LABEL ───────────────────────────────────────────────────────────
function updateVelLabel() {
    let pct  = parseInt(document.getElementById('vel-slider').value);  // 1–110
    // Map slider 1–110% → 0 to ~1.1 × V_ESCAPE
    let vKms = (pct / 100) * V_ESCAPE * 1.05;

    let label = document.getElementById('vel-label');
    let type  = document.getElementById('vel-type');

    label.textContent = vKms.toFixed(2) + ' km/s';

    let cls, txt;
    if (vKms < V_CIRCULAR * 0.97) {
        cls = 'traj-suborbital'; txt = 'Suborbital';
    } else if (vKms < V_CIRCULAR * 1.03) {
        cls = 'traj-circular';   txt = 'Órbita circular';
    } else if (vKms < V_ESCAPE * 0.99) {
        cls = 'traj-elliptical'; txt = 'Órbita elíptica';
    } else {
        cls = 'traj-escape';     txt = 'Velocidad de escape';
    }

    type.className = 'traj-label ' + cls;
    type.textContent = txt;
}
