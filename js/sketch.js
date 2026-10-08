// ═══════════════════════════════════════════════════════════════════════════════
//  Laboratorio de Órbitas — sketch.js
//  Modos: Newton | Sistema Solar | Leyes de Kepler | Estrellas Binarias
// ═══════════════════════════════════════════════════════════════════════════════

// ── SHARED PHYSICS ─────────────────────────────────────────────────────────────
const GM_EARTH_KM = 3.986e5;    // km³ s⁻²
const GM_SUN_KM   = 1.327e11;   // km³ s⁻²
const EARTH_R_KM  = 6371;

// ── SHARED VISUAL ──────────────────────────────────────────────────────────────
const STAR_COUNT  = 160;

// ── SHARED STATE ───────────────────────────────────────────────────────────────
let cx, cy;          // canvas center
let stars  = [];
let bgGrad = null;   // cached background gradient

// ── MODE ROUTING ───────────────────────────────────────────────────────────────
const MODES = {};
let activeMode = null;

function switchMode(name) {
    if (activeMode && activeMode.exit) activeMode.exit();
    bgGrad = null;
    let container = document.getElementById('mode-ui');
    container.innerHTML = '';
    activeMode = MODES[name];
    if (activeMode && activeMode.enter) activeMode.enter(container);
}

// ── P5 SETUP / DRAW ────────────────────────────────────────────────────────────
function setup() {
    let frame = document.getElementById('sim-frame');
    let cnv   = createCanvas(frame.offsetWidth, frame.offsetHeight);
    cnv.parent('sim-frame');
    cx = width / 2;  cy = height / 2;
    generateStars();

    let sel = document.getElementById('mode-select');
    sel.addEventListener('change', () => switchMode(sel.value));
    switchMode(sel.value);

    window.addEventListener('resize', () => {
        let f = document.getElementById('sim-frame');
        resizeCanvas(f.offsetWidth, f.offsetHeight);
        cx = width / 2;  cy = height / 2;
        bgGrad = null;
        generateStars();
        if (activeMode && activeMode.onResize) activeMode.onResize();
    });
}

function draw() {
    drawBackground();
    if (activeMode && activeMode.draw) activeMode.draw();
}

// ── SHARED UTILITIES ───────────────────────────────────────────────────────────
function generateStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({ x: random(width), y: random(height),
            r: random(0.5, 1.8), bri: random(120, 255), tw: random(TWO_PI) });
    }
}

function drawBackground() {
    background(5, 8, 20);
    if (!bgGrad) {
        bgGrad = drawingContext.createRadialGradient(cx, cy, 40, cx, cy, min(width, height) * 0.55);
        bgGrad.addColorStop(0, 'rgba(30, 60, 120, 0.16)');
        bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    drawingContext.fillStyle = bgGrad;
    drawingContext.fillRect(0, 0, width, height);
    noStroke();
    for (let s of stars) {
        let tw = 0.75 + 0.25 * sin(frameCount * 0.02 + s.tw);
        fill(s.bri, s.bri, s.bri + 20, s.bri * tw);
        circle(s.x, s.y, s.r * 2);
    }
}

function uiRow(label, value, valueColor = '#eef2f8') {
    return `<span style="color:#9aa6bd">${label}</span>` +
           `<span style="float:right;color:${valueColor};font-weight:600">${value}</span><br>`;
}

function card(innerHTML, collapsed = false) {
    let el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = innerHTML;
    return el;
}

function collapsibleCard(title, bodyHTML, expanded = true) {
    let div = document.createElement('div');
    div.className = 'card' + (expanded ? ' is-expanded' : '');
    div.innerHTML = `
        <button class="card-trigger">${title} <span class="card-chevron">▼</span></button>
        <div class="card-body"><div class="info-section">${bodyHTML}</div></div>`;
    div.querySelector('.card-trigger').addEventListener('click', () => div.classList.toggle('is-expanded'));
    return div;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODE 1 — BALA DE CAÑÓN DE NEWTON
// ═══════════════════════════════════════════════════════════════════════════════
MODES['newton'] = (() => {
    const EARTH_R    = 120;
    const MOUNTAIN_H = 38;
    const LAUNCH_R_PX = EARTH_R + MOUNTAIN_H;
    const SCALE       = EARTH_R_KM / EARTH_R;          // km / px
    const LAUNCH_R_KM = LAUNCH_R_PX * SCALE;
    const V_CIRC      = Math.sqrt(GM_EARTH_KM / LAUNCH_R_KM); // ≈ 6.89 km/s
    const V_ESC       = V_CIRC * Math.SQRT2;                   // ≈ 9.74 km/s
    const V_MAX       = V_ESC * 1.18;
    const SUBSTEPS    = 10;
    const MAX_TRAIL   = 800;
    const BASE_DT     = 1500 / 60;   // sim-s per frame at 1× speed

    let bullet = null, running = false, paused = false;
    let trail = [], orbitCount = 0, lastAngle = null;
    let timeMultiplier = 1;
    let statusDirty = true;   // throttle DOM updates

    // ── orbital elements from current state ────────────────────────────────
    function orbitalElements(b) {
        let r   = Math.sqrt(b.x * b.x + b.y * b.y);
        let v2  = b.vx * b.vx + b.vy * b.vy;
        let eps = v2 / 2 - GM_EARTH_KM / r;
        let L   = b.x * b.vy - b.y * b.vx;
        let e2  = 1 + (2 * eps * L * L) / (GM_EARTH_KM * GM_EARTH_KM);
        let e   = e2 >= 0 ? Math.sqrt(e2) : 0;
        let a   = eps < -1e-9 ? -GM_EARTH_KM / (2 * eps) : Infinity;
        let rP  = eps < -1e-9 ? a * (1 - e) : (L * L / GM_EARTH_KM) / (1 + e);
        let rA  = (eps < -1e-9 && e < 1) ? a * (1 + e) : Infinity;
        let T   = (a < Infinity) ? 2 * Math.PI * Math.sqrt(a * a * a / GM_EARTH_KM) : Infinity;
        let vCurrent = Math.sqrt(GM_EARTH_KM / r); // V_circ at current r

        let type, col;
        if (eps >= -1e-9)             { type = 'Vel. de escape';  col = '#a78bfa'; }
        else if (rP < EARTH_R_KM)     { type = 'Suborbital';      col = '#f97316'; }
        else if (e < 0.04)            { type = 'Órbita circular';  col = '#10b981'; }
        else                          { type = 'Órbita elíptica';  col = '#3b82f6'; }

        return { r, v: Math.sqrt(v2), eps, e, a, rP, rA, T, vCurrent, type, col };
    }

    // ── Velocity Verlet (Störmer) integration ──────────────────────────────
    function accel(x, y) {
        let r2 = x * x + y * y, r = Math.sqrt(r2);
        let f  = GM_EARTH_KM / (r2 * r);
        return { ax: -f * x, ay: -f * y };
    }

    function updatePhysics() {
        let dt  = BASE_DT * timeMultiplier / SUBSTEPS;
        for (let i = 0; i < SUBSTEPS; i++) {
            let { ax, ay } = accel(bullet.x, bullet.y);
            // Velocity Verlet step 1: half-kick
            bullet.vx += ax * dt * 0.5;
            bullet.vy += ay * dt * 0.5;
            // Drift
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            // Recompute acceleration
            let a2 = accel(bullet.x, bullet.y);
            // Velocity Verlet step 2: half-kick
            bullet.vx += a2.ax * dt * 0.5;
            bullet.vy += a2.ay * dt * 0.5;

            // Collision check AFTER position update
            let r = Math.sqrt(bullet.x * bullet.x + bullet.y * bullet.y);
            if (r <= EARTH_R_KM) {
                let ang = Math.atan2(bullet.y, bullet.x);
                bullet.x = EARTH_R_KM * Math.cos(ang);
                bullet.y = EARTH_R_KM * Math.sin(ang);
                bullet.crashed = true;
                endSim(); return;
            }
        }

        // Trail
        trail.push({ x: bullet.x, y: bullet.y });
        if (trail.length > MAX_TRAIL) trail.shift();

        // Orbit counter
        let angle = Math.atan2(bullet.y, bullet.x);
        if (lastAngle !== null) {
            let d = angle - lastAngle;
            if (d >  Math.PI) d -= 2 * Math.PI;
            if (d < -Math.PI) d += 2 * Math.PI;
            bullet._totalAngle = (bullet._totalAngle || 0) + d;
            let nc = Math.floor(Math.abs(bullet._totalAngle) / (2 * Math.PI));
            if (nc > orbitCount) { orbitCount = nc; bullet._flash = 40; }
        }
        lastAngle = angle;
        if (bullet._flash > 0) bullet._flash--;

        // Escape: energy ≥ 0 AND far away
        let el = orbitalElements(bullet);
        if (el.eps >= -1e-9 && el.r > EARTH_R_KM * 15) {
            bullet.escaped = true; endSim(); return;
        }

        statusDirty = true;
    }

    // ── draw ───────────────────────────────────────────────────────────────
    function draw() {
        if (running && !paused) updatePhysics();
        drawRefOrbit();
        drawTrail();
        drawEarth();
        if (bullet) drawBullet();
        if (statusDirty) { updateBox(); statusDirty = false; }
    }

    function drawRefOrbit() {
        noFill();
        stroke(16, 185, 129, 55);
        strokeWeight(1);
        drawingContext.setLineDash([4, 7]);
        circle(cx, cy, LAUNCH_R_PX * 2);
        drawingContext.setLineDash([]);
        noStroke();
    }

    function drawTrail() {
        if (trail.length < 2) return;
        let crashed = bullet && bullet.crashed;
        let [r, g, b] = crashed ? [220, 80, 60] : [80, 200, 255];
        const BANDS = 14;
        let n = trail.length;
        drawingContext.save();
        drawingContext.lineJoin = 'round'; drawingContext.lineCap = 'round';
        let bs = Math.ceil(n / BANDS);
        for (let band = 0; band < BANDS; band++) {
            let s = band * bs, e2 = Math.min(s + bs + 1, n);
            if (s >= n - 1) break;
            let t = (band + 0.5) / BANDS;
            drawingContext.beginPath();
            drawingContext.moveTo(cx + trail[s].x / SCALE, cy - trail[s].y / SCALE);
            for (let i = s + 1; i < e2; i++)
                drawingContext.lineTo(cx + trail[i].x / SCALE, cy - trail[i].y / SCALE);
            drawingContext.strokeStyle = `rgba(${r},${g},${b},${t * t * 0.82})`;
            drawingContext.lineWidth   = 0.4 + t * 2.0;
            drawingContext.stroke();
        }
        drawingContext.restore(); noStroke();
    }

    function drawEarth() {
        push(); translate(cx, cy);
        let atm = drawingContext.createRadialGradient(0, 0, EARTH_R, 0, 0, EARTH_R + 22);
        atm.addColorStop(0, 'rgba(56,130,220,0.35)');
        atm.addColorStop(1, 'rgba(56,130,220,0)');
        drawingContext.fillStyle = atm;
        drawingContext.beginPath(); drawingContext.arc(0, 0, EARTH_R + 22, 0, TWO_PI); drawingContext.fill();
        noStroke(); fill(15, 55, 120); circle(0, 0, EARTH_R * 2);
        fill(34, 90, 50);
        ellipse(-28,-18,52,38); ellipse(36,-10,44,52); ellipse(-50,30,36,28);
        ellipse(20,52,40,22);  ellipse(-12,40,28,18);
        fill(200, 220, 255, 180);
        ellipse(0,-EARTH_R+10,38,18); ellipse(0,EARTH_R-8,30,14);
        let hl = drawingContext.createRadialGradient(-30,-35,0,-30,-35,EARTH_R*1.1);
        hl.addColorStop(0,'rgba(120,180,255,0.18)'); hl.addColorStop(0.6,'rgba(0,0,0,0)');
        drawingContext.fillStyle = hl;
        drawingContext.beginPath(); drawingContext.arc(0,0,EARTH_R,0,TWO_PI); drawingContext.fill();
        noFill(); stroke(80,130,200,140); strokeWeight(1.5); circle(0,0,EARTH_R*2);
        drawMountain(); pop();
    }

    function drawMountain() {
        let baseY = -EARTH_R, hw = 18, mh = MOUNTAIN_H;
        fill(90,100,115); noStroke();
        triangle(-hw,baseY,hw,baseY,0,baseY-mh);
        fill(220,230,245); triangle(-7,baseY-mh+13,7,baseY-mh+13,0,baseY-mh);
        fill(180,160,120); stroke(100,90,70); strokeWeight(0.8);
        push(); translate(0,baseY-mh-4); rect(2,-3,18,6,2); pop();
        noStroke(); fill(80,70,55); circle(4,baseY-mh+2,7);
    }

    function drawBullet() {
        let sx = cx + bullet.x / SCALE, sy = cy - bullet.y / SCALE;
        noStroke();
        if (bullet.crashed) {
            fill(255,80,60,50);  circle(sx,sy,24);
            fill(255,100,60,150);circle(sx,sy,14);
            fill(255,140,80);    circle(sx,sy,6);
        } else {
            fill(255,220,80,40); circle(sx,sy,18);
            fill(255,220,80,100);circle(sx,sy,11);
            fill(255,235,110);   circle(sx,sy,5);
            // velocity arrow
            let sp = Math.sqrt(bullet.vx*bullet.vx + bullet.vy*bullet.vy);
            let nx = bullet.vx/sp, ny = -bullet.vy/sp;
            stroke(255,235,110,170); strokeWeight(1.5);
            line(sx,sy,sx+nx*24,sy+ny*24); noStroke();
        }

        // Periapsis / apoapsis markers when in stable orbit
        if (!bullet.crashed && !bullet.escaped) {
            let el = orbitalElements(bullet);
            if (el.eps < -1e-9 && el.rP >= EARTH_R_KM) {
                // Periapsis direction: towards -a_vec (closest approach)
                let ang = Math.atan2(bullet.y, bullet.x);
                let L   = bullet.x * bullet.vy - bullet.y * bullet.vx;
                let dir = L > 0 ? 1 : -1;    // orbit direction
                // Periapsis is along eccentricity vector
                let ex = bullet.vx * L / GM_EARTH_KM - bullet.x / el.r;
                let ey = bullet.vy * L / GM_EARTH_KM - bullet.y / el.r;
                let em = Math.sqrt(ex*ex + ey*ey);
                if (em > 1e-9) {
                    let px2 = cx + (-ex/em) * (el.rP / SCALE);
                    let py2 = cy - (-ey/em) * (el.rP / SCALE);
                    noStroke(); fill(255, 180, 50, 180); circle(px2, py2, 6);
                    let ax2 = cx + (ex/em) * (el.rA / SCALE);
                    let ay2 = cy - (ey/em) * (el.rA / SCALE);
                    if (el.rA < EARTH_R_KM * 50) { fill(80, 160, 255, 160); circle(ax2, ay2, 6); }
                }
            }
        }
    }

    function updateBox() {
        let box = document.getElementById('n-estado');
        if (!box) return;
        if (!bullet) { box.innerHTML = '<span class="ui-empty">Sin proyectil activo</span>'; return; }
        if (bullet.crashed) {
            box.innerHTML = '<span style="color:#ef4444;font-weight:700">💥 Impacto con la Tierra</span><br>' +
                `<span style="color:#9aa6bd;font-size:10px">Órbitas completas: ${orbitCount}</span>`; return;
        }
        if (bullet.escaped) {
            box.innerHTML = '<span style="color:#a78bfa;font-weight:700">🚀 Escape gravitatorio</span><br>' +
                '<span style="color:#9aa6bd;font-size:10px">Energía mecánica positiva — sin retorno</span>'; return;
        }
        let el = orbitalElements(bullet);
        let altStr  = Math.round(el.r - EARTH_R_KM).toLocaleString() + ' km';
        let periStr = Math.round(el.rP - EARTH_R_KM).toLocaleString() + ' km';
        let apoStr  = el.rA < 1e8 ? Math.round(el.rA - EARTH_R_KM).toLocaleString() + ' km' : '∞';
        let perStr  = el.T < Infinity ? (el.T / 60).toFixed(1) + ' min' : '—';
        let epsSign = el.eps >= 0 ? '+' : '';
        let epsCol  = el.eps < 0 ? '#60a5fa' : '#a78bfa';
        let orbRow  = (el.type !== 'Suborbital' && el.type !== 'Vel. de escape')
            ? uiRow('Órbitas', orbitCount + (bullet._flash > 0 ? ' ✓' : ''),
                    bullet._flash > 0 ? '#10b981' : '#eef2f8') : '';
        box.innerHTML =
            uiRow('Velocidad',   el.v.toFixed(2) + ' km/s') +
            uiRow('Altitud',     altStr) +
            uiRow('Trayectoria', el.type, el.col) +
            uiRow('Energía ε',   epsSign + el.eps.toFixed(1) + ' km²/s²', epsCol) +
            uiRow('Perigeo',     periStr, el.rP < EARTH_R_KM + 100 ? '#f97316' : '#9aa6bd') +
            uiRow('Apogeo',      apoStr, '#9aa6bd') +
            uiRow('Período',     perStr, '#9aa6bd') +
            orbRow;
    }

    // ── control ────────────────────────────────────────────────────────────
    function fire() {
        let pct = parseInt(document.getElementById('n-slider').value);
        let v0  = (pct / 100) * V_MAX;
        bullet = { x: 0, y: LAUNCH_R_KM, vx: v0, vy: 0 };
        trail = []; orbitCount = 0; lastAngle = null;
        running = true; paused = false; statusDirty = true;
        document.getElementById('n-fire').disabled  = true;
        document.getElementById('n-pause').disabled = false;
        document.getElementById('n-slider').disabled = true;
    }

    function pause() {
        paused = !paused;
        document.getElementById('n-pause').textContent = paused ? '▶ Reanudar' : '⏸ Pausar';
    }

    function reset() {
        bullet = null; trail = []; orbitCount = 0; lastAngle = null;
        running = false; paused = false; statusDirty = true;
        let p = document.getElementById('n-pause');
        if (p) { p.disabled = true; p.textContent = '⏸ Pausar'; }
        let f = document.getElementById('n-fire');
        if (f) f.disabled = false;
        let s = document.getElementById('n-slider');
        if (s) s.disabled = false;
        updateBox();
    }

    function endSim() {
        running = false; statusDirty = true;
        document.getElementById('n-fire').disabled   = false;
        document.getElementById('n-pause').disabled  = true;
        document.getElementById('n-slider').disabled = false;
        updateBox();
    }

    function setPreset(v) {
        let pct = Math.round((v / V_MAX) * 100);
        let sl  = document.getElementById('n-slider');
        if (sl) { sl.value = pct; updateVelLabel(); }
    }

    function setSpeed(mult) {
        timeMultiplier = mult;
        document.querySelectorAll('.n-speed-btn').forEach(b => {
            b.classList.toggle('speed-btn-active', parseInt(b.dataset.mult) === mult);
        });
    }

    function updateVelLabel() {
        let pct  = parseInt(document.getElementById('n-slider').value);
        let vKms = (pct / 100) * V_MAX;
        document.getElementById('n-vel-label').textContent = vKms.toFixed(2) + ' km/s';
        let cls, txt;
        if      (vKms < V_CIRC * 0.97) { cls = 'traj-suborbital'; txt = 'Suborbital'; }
        else if (vKms < V_CIRC * 1.03) { cls = 'traj-circular';   txt = 'Órbita circular'; }
        else if (vKms < V_ESC  * 0.99) { cls = 'traj-elliptical'; txt = 'Órbita elíptica'; }
        else                            { cls = 'traj-escape';     txt = 'Vel. de escape'; }
        let el = document.getElementById('n-vel-type');
        el.className = 'traj-label ' + cls; el.textContent = txt;
    }

    function buildMarks() {
        let c = document.getElementById('n-marks'); if (!c) return; c.innerHTML = '';
        [{ v: V_CIRC, label: 'Vc', color: '#10b981' }, { v: V_ESC, label: 'Ve', color: '#a78bfa' }]
        .forEach(m => {
            let pct = Math.min(96, Math.max(4, (m.v / V_MAX) * 100));
            let el  = document.createElement('span');
            el.className = 'slider-mark'; el.textContent = m.label;
            el.style.left = pct + '%'; el.style.color = m.color;
            c.appendChild(el);
        });
    }

    // ── keyboard ───────────────────────────────────────────────────────────
    let _onKey;
    function enter(container) {
        reset();
        container.innerHTML = '';

        // Velocity card
        let vc = document.createElement('div'); vc.className = 'card';
        vc.innerHTML = `
            <div class="atom-card-label">Velocidad Inicial</div>
            <div class="card-body-static">
                <div class="slider-row">
                    <input type="range" id="n-slider" min="5" max="110" value="60" step="1">
                </div>
                <div class="slider-meta">
                    <span id="n-vel-label">—</span>
                    <span id="n-vel-type" class="traj-label">—</span>
                </div>
                <div class="slider-marks" id="n-marks"></div>
                <div class="preset-row">
                    <button class="btn-preset-circ" id="n-preset-circ">Vc ≈ ${V_CIRC.toFixed(2)} km/s</button>
                    <button class="btn-preset-esc"  id="n-preset-esc" >Ve ≈ ${V_ESC.toFixed(2)} km/s</button>
                </div>
            </div>`;
        container.appendChild(vc);

        // Control card
        let cc = document.createElement('div'); cc.className = 'card';
        cc.innerHTML = `
            <div class="atom-card-label">Control</div>
            <div class="card-body-static">
                <div class="btn-group">
                    <button id="n-fire" class="btn-primary">▶ Disparar</button>
                    <button id="n-pause" disabled>⏸ Pausar</button>
                </div>
                <div class="reset-row" style="margin-top:5px">
                    <button id="n-reset">↺ Reiniciar</button>
                </div>
                <div class="speed-row" style="margin-top:5px">
                    <span>Velocidad</span>
                    <div class="btn-group">
                        <button class="n-speed-btn speed-btn-active" data-mult="1">1×</button>
                        <button class="n-speed-btn" data-mult="2">2×</button>
                        <button class="n-speed-btn" data-mult="4">4×</button>
                    </div>
                </div>
                <div class="kbd-hint" style="margin-top:4px">
                    <span class="kbd">Enter</span> Disparar &nbsp;
                    <span class="kbd">Espacio</span> Pausar &nbsp;
                    <span class="kbd">R</span> Reiniciar
                </div>
            </div>`;
        container.appendChild(cc);

        // Status card
        let sc = document.createElement('div'); sc.className = 'card';
        sc.innerHTML = `<div class="atom-card-label">Estado Orbital</div>
            <div class="card-body-static"><div id="n-estado" class="status-box">
            <span class="ui-empty">Sin proyectil activo</span></div></div>`;
        container.appendChild(sc);

        // Info card
        container.appendChild(collapsibleCard('Experimento mental de Newton',
            `<p>Newton imaginó que si se dispara una bala horizontalmente desde una montaña muy alta, con suficiente velocidad, la curvatura de su caída igualaría la curvatura de la Tierra, manteniéndola en <em>órbita</em> permanente.</p>
            <p>La <em>energía específica orbital</em> ε = v²/2 − GM/r determina el tipo de trayectoria: <b>ε &lt; 0</b> → órbita ligada (elíptica o circular); <b>ε ≥ 0</b> → escape. El <b>perigeo</b> (punto más cercano) determina si la bala choca con la Tierra.</p>
            <p>Marcador amarillo = perigeo · Azul = apogeo · Círculo verde = órbita circular de referencia.</p>`,
            false));

        // Events
        document.getElementById('n-slider').addEventListener('input', updateVelLabel);
        document.getElementById('n-fire').addEventListener('click', fire);
        document.getElementById('n-pause').addEventListener('click', pause);
        document.getElementById('n-reset').addEventListener('click', reset);
        document.getElementById('n-preset-circ').addEventListener('click', () => setPreset(V_CIRC));
        document.getElementById('n-preset-esc').addEventListener('click',  () => setPreset(V_ESC));
        document.querySelectorAll('.n-speed-btn').forEach(b =>
            b.addEventListener('click', () => setSpeed(parseInt(b.dataset.mult))));

        _onKey = e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.code === 'Space') { e.preventDefault(); if (running) pause(); }
            if (e.code === 'KeyR')  reset();
            if (e.code === 'Enter') { e.preventDefault(); if (!running) fire(); }
        };
        document.addEventListener('keydown', _onKey);
        buildMarks(); updateVelLabel();
    }

    function exit() {
        reset();
        if (_onKey) { document.removeEventListener('keydown', _onKey); _onKey = null; }
    }

    return { enter, exit, draw };
})();


// ═══════════════════════════════════════════════════════════════════════════════
//  MODE 2 — SISTEMA SOLAR
// ═══════════════════════════════════════════════════════════════════════════════
MODES['planets'] = (() => {
    // Distances in AU, scaled to pixels for display
    // Real semi-major axes (AU): Mercury 0.387, Venus 0.723, Earth 1.0,
    //   Mars 1.524, Jupiter 5.203, Saturn 9.537, Uranus 19.19, Neptune 30.07
    // Scale: 1 AU = 55 px (Neptune at ~1654 px — we'll use a logarithmic-ish scale)
    // a: semieje mayor REAL (UA), el que se muestra y cumple T² = a³ con T real.
    // aDib: radio de dibujo (UA de pantalla); de Júpiter hacia fuera se comprime
    // para que quepan todos, pero solo afecta al dibujo, nunca a los datos.

    const AU_PX = 55;   // 1 AU in pixels at default zoom
    const SUN_R = 22;   // px

    const PLANETS = [
        { name: 'Mercurio', a: 0.387,  aDib: 0.387, T: 0.241,  r: 3,  color: '#b0a090', ring: false },
        { name: 'Venus',    a: 0.723,  aDib: 0.723, T: 0.615,  r: 5,  color: '#e8c890', ring: false },
        { name: 'Tierra',   a: 1.000,  aDib: 1.000, T: 1.000,  r: 5,  color: '#4090d8', ring: false },
        { name: 'Marte',    a: 1.524,  aDib: 1.524, T: 1.881,  r: 4,  color: '#c05030', ring: false },
        { name: 'Júpiter',  a: 5.203,  aDib: 3.20,  T: 11.86,  r: 12, color: '#c8a060', ring: false },
        { name: 'Saturno',  a: 9.537,  aDib: 4.40,  T: 29.46,  r: 10, color: '#d4c080', ring: true  },
        { name: 'Urano',    a: 19.19,  aDib: 5.50,  T: 84.01,  r: 7,  color: '#90d0d8', ring: false },
        { name: 'Neptuno',  a: 30.07,  aDib: 6.50,  T: 164.8,  r: 7,  color: '#4060c8', ring: false },
    ];

    // Compute angular speeds: ω = 2π / T_years, in rad per sim-year
    // Sim time: we advance TIME_SCALE_YR years per real second
    const TIME_SCALE_YR = 0.8;  // years per real second at 1×
    const BASE_DT_YR    = TIME_SCALE_YR / 60;

    let angles = PLANETS.map(() => 0);
    let timeMultiplier = 1;
    let paused = false;
    let trails = PLANETS.map(() => []);
    const MAX_TRAIL_PTS = 300;
    let selectedPlanet = null;
    let zoom = 1.0;

    function update() {
        if (paused) return;
        let dt = BASE_DT_YR * timeMultiplier;
        for (let i = 0; i < PLANETS.length; i++) {
            let omega = 2 * Math.PI / PLANETS[i].T;
            angles[i] += omega * dt;
            let x = cx + Math.cos(angles[i]) * PLANETS[i].aDib * AU_PX * zoom;
            let y = cy + Math.sin(angles[i]) * PLANETS[i].aDib * AU_PX * zoom;
            trails[i].push({ x, y });
            if (trails[i].length > MAX_TRAIL_PTS) trails[i].shift();
        }
    }

    function draw() {
        update();
        drawOrbits();
        drawSun();
        drawPlanets();
        if (selectedPlanet !== null) drawPlanetInfo();
    }

    function drawOrbits() {
        noFill();
        for (let i = 0; i < PLANETS.length; i++) {
            let r = PLANETS[i].aDib * AU_PX * zoom;
            stroke(60, 70, 100, 80);
            strokeWeight(0.7);
            drawingContext.setLineDash([3, 5]);
            circle(cx, cy, r * 2);
            drawingContext.setLineDash([]);
        }
        noStroke();
    }

    function drawSun() {
        // Glow
        let sg = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, SUN_R * 3.5);
        sg.addColorStop(0, 'rgba(255,200,80,0.55)');
        sg.addColorStop(0.4, 'rgba(255,160,40,0.18)');
        sg.addColorStop(1, 'rgba(255,120,0,0)');
        drawingContext.fillStyle = sg;
        drawingContext.fillRect(cx - SUN_R*4, cy - SUN_R*4, SUN_R*8, SUN_R*8);
        // Core
        noStroke(); fill(255, 210, 80); circle(cx, cy, SUN_R * 2);
        fill(255, 240, 150, 180); circle(cx - SUN_R*0.3, cy - SUN_R*0.3, SUN_R * 0.9);
    }

    function drawPlanets() {
        noStroke();
        // Trails first
        for (let i = 0; i < PLANETS.length; i++) {
            let t = trails[i], n = t.length;
            if (n < 2) continue;
            let [r, g, b] = hexToRgb(PLANETS[i].color);
            drawingContext.save();
            drawingContext.lineJoin = 'round'; drawingContext.lineCap = 'round';
            const BANDS = 8;
            let bs = Math.ceil(n / BANDS);
            for (let band = 0; band < BANDS; band++) {
                let s = band * bs, e = Math.min(s + bs + 1, n);
                if (s >= n - 1) break;
                let tf = (band + 0.5) / BANDS;
                drawingContext.beginPath();
                drawingContext.moveTo(t[s].x, t[s].y);
                for (let j = s + 1; j < e; j++) drawingContext.lineTo(t[j].x, t[j].y);
                drawingContext.strokeStyle = `rgba(${r},${g},${b},${tf * tf * 0.6})`;
                drawingContext.lineWidth = 0.5 + tf * 1.2;
                drawingContext.stroke();
            }
            drawingContext.restore();
        }
        // Planets
        for (let i = 0; i < PLANETS.length; i++) {
            let p = PLANETS[i];
            let x = cx + Math.cos(angles[i]) * p.aDib * AU_PX * zoom;
            let y = cy + Math.sin(angles[i]) * p.aDib * AU_PX * zoom;
            let isSelected = selectedPlanet === i;

            // Selection ring
            if (isSelected) {
                noFill(); stroke(255, 255, 255, 80); strokeWeight(1.5);
                circle(x, y, (p.r + 6) * 2); noStroke();
            }

            // Saturn ring
            if (p.ring) {
                noFill(); stroke(212, 192, 128, 130); strokeWeight(2.5);
                drawingContext.setLineDash([]);
                ellipse(x, y, (p.r + 9) * 2, (p.r + 4) * 0.6);
                noStroke();
            }

            fill(p.color); circle(x, y, p.r * 2);
            // Highlight
            fill(255, 255, 255, 60); circle(x - p.r * 0.3, y - p.r * 0.3, p.r * 0.6);
        }
    }

    function drawPlanetInfo() {
        let p = PLANETS[selectedPlanet];
        let x = cx + Math.cos(angles[selectedPlanet]) * p.aDib * AU_PX * zoom;
        let y = cy + Math.sin(angles[selectedPlanet]) * p.a * AU_PX * zoom;
        // Small label near planet
        let lx = x + p.r + 8, ly = y - 4;
        // Keep in canvas
        if (lx + 90 > width)  lx = x - p.r - 95;
        if (ly - 12 < 10)     ly = y + p.r + 14;
        noStroke(); fill(20, 28, 48, 210);
        rect(lx - 4, ly - 14, 92, 36, 5);
        fill(200, 215, 240); textSize(10); textAlign(LEFT, TOP);
        text(p.name, lx, ly - 11);
        fill(140, 155, 180); textSize(9);
        text(`a = ${p.a.toFixed(3)} AU`, lx, ly + 1);
        text(`T = ${p.T.toFixed(3)} años`, lx, ly + 12);
        textAlign(LEFT, BASELINE);
    }

    function hexToRgb(hex) {
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16);
        return [r, g, b];
    }

    function enter(container) {
        angles = PLANETS.map((p, i) => random(TWO_PI));
        trails = PLANETS.map(() => []);
        paused = false; selectedPlanet = null; zoom = 1.0;

        // Legend card
        let lc = document.createElement('div'); lc.className = 'card';
        let rows = PLANETS.map((p, i) =>
            `<div class="planet-row" data-idx="${i}">
                <div class="planet-dot" style="background:${p.color}"></div>
                <span class="planet-name">${p.name}</span>
                <span class="planet-stat">${p.a.toFixed(3)} AU · ${p.T.toFixed(2)} a</span>
            </div>`).join('');
        lc.innerHTML = `<div class="atom-card-label">Planetas</div>
            <div class="card-body-static"><div class="planet-legend">${rows}</div></div>`;
        container.appendChild(lc);

        // Control card
        let cc = document.createElement('div'); cc.className = 'card';
        cc.innerHTML = `
            <div class="atom-card-label">Control</div>
            <div class="card-body-static">
                <div class="btn-group">
                    <button id="p-pause">⏸ Pausar</button>
                    <button id="p-reset">↺ Reiniciar</button>
                </div>
                <div class="speed-row" style="margin-top:6px">
                    <span>Velocidad</span>
                    <div class="btn-group">
                        <button class="p-speed-btn speed-btn-active" data-mult="1">1×</button>
                        <button class="p-speed-btn" data-mult="3">3×</button>
                        <button class="p-speed-btn" data-mult="8">8×</button>
                        <button class="p-speed-btn" data-mult="20">20×</button>
                    </div>
                </div>
                <div class="speed-row" style="margin-top:4px">
                    <span>Zoom</span>
                    <div class="btn-group">
                        <button class="p-zoom-btn" data-z="0.6">−</button>
                        <button class="p-zoom-btn" data-z="1.0">1:1</button>
                        <button class="p-zoom-btn" data-z="1.5">+</button>
                    </div>
                </div>
            </div>`;
        container.appendChild(cc);

        // Kepler III card
        container.appendChild(collapsibleCard('Ley de Kepler III (T² ∝ a³)',
            `<p>Para todos los planetas del Sistema Solar: <b>T² = a³</b> (con T en años y a en UA). Esta relación es consecuencia directa de la ley de gravitación universal de Newton.</p>
            <p>Pulsa sobre cualquier planeta de la lista para ver sus parámetros orbitales y verificar la ley.</p>
            <p>Ojo: de Júpiter hacia fuera las órbitas están dibujadas más cerca de lo que les corresponde para que quepan en la pantalla; los datos de la lista son los reales.</p>`, false));

        // Events: planet legend clicks
        container.querySelectorAll('.planet-row').forEach(row => {
            row.addEventListener('click', () => {
                let idx = parseInt(row.dataset.idx);
                selectedPlanet = (selectedPlanet === idx) ? null : idx;
                container.querySelectorAll('.planet-row').forEach((r, i) =>
                    r.classList.toggle('active', i === selectedPlanet));
                if (selectedPlanet !== null) {
                    let p = PLANETS[selectedPlanet];
                    let t2a3 = (p.T * p.T / (p.a * p.a * p.a)).toFixed(4);
                    row.querySelector('.planet-stat').textContent =
                        `${p.a.toFixed(3)} AU · T²/a³=${t2a3}`;
                }
            });
        });

        document.getElementById('p-pause').addEventListener('click', () => {
            paused = !paused;
            document.getElementById('p-pause').textContent = paused ? '▶ Reanudar' : '⏸ Pausar';
        });
        document.getElementById('p-reset').addEventListener('click', () => {
            angles = PLANETS.map(() => random(TWO_PI));
            trails = PLANETS.map(() => []);
        });
        document.querySelectorAll('.p-speed-btn').forEach(b =>
            b.addEventListener('click', () => {
                timeMultiplier = parseFloat(b.dataset.mult);
                document.querySelectorAll('.p-speed-btn').forEach(x =>
                    x.classList.toggle('speed-btn-active', x === b));
            }));
        document.querySelectorAll('.p-zoom-btn').forEach(b =>
            b.addEventListener('click', () => {
                let z = parseFloat(b.dataset.z);
                if (z === 0.6) zoom = Math.max(0.3, zoom * 0.75);
                else if (z === 1.5) zoom = Math.min(3.0, zoom * 1.33);
                else zoom = 1.0;
                trails = PLANETS.map(() => []); // clear trails on zoom
            }));
    }

    function exit() { paused = false; selectedPlanet = null; }

    return { enter, exit, draw };
})();


// ═══════════════════════════════════════════════════════════════════════════════
//  MODE 3 — LEYES DE KEPLER
// ═══════════════════════════════════════════════════════════════════════════════
MODES['kepler'] = (() => {
    const GM   = 1.0;    // normalized units
    const SUN_X = 0;     // sun at focus
    const BASE_DT = 0.5 / 60;

    let a = 1.0;     // semi-major axis (normalized)
    let e = 0.6;     // eccentricity
    let angle = 0;   // true anomaly
    let omega = 0;   // angular velocity (varies by Kepler II)
    let paused = false;
    let activeLaw = 1;   // which law to visualize: 1, 2, or 3
    let sweptAreas = []; // for Law II: list of recent sector triangles
    let timeMultiplier = 1;

    // Compute position from orbital elements
    function trueAnomalyToPos(nu) {
        let r = a * (1 - e * e) / (1 + e * Math.cos(nu));
        // Focus at origin, periapsis along +x
        let x = r * Math.cos(nu);
        let y = r * Math.sin(nu);
        return { x, y, r };
    }

    function angularMomentum() {
        return Math.sqrt(GM * a * (1 - e * e));
    }

    function updatePhysics() {
        if (paused) return;
        let L  = angularMomentum();
        let p2 = trueAnomalyToPos(angle);
        let r  = p2.r;
        // ṙ = L / r²
        let dAngle = (L / (r * r)) * BASE_DT * timeMultiplier;
        angle += dAngle;
        if (angle > 2 * Math.PI) angle -= 2 * Math.PI;
    }

    // Convert normalized coords to screen
    function toScreen(x, y) {
        let scale = min(width, height) * 0.28;
        return { sx: cx + x * scale, sy: cy - y * scale };
    }

    function draw() {
        updatePhysics();
        drawOrbit();
        drawSun();
        drawBody();
        drawLawVisual();
        drawLawLabel();
    }

    function drawOrbit() {
        // Draw the ellipse: cx_ellipse = -a*e (focus at origin, center at -ae)
        // In screen coords: center of ellipse is at (cx - ae*scale, cy)
        let scale = min(width, height) * 0.28;
        let b     = a * Math.sqrt(1 - e * e);
        let ecx   = cx - a * e * scale;   // ellipse center x (focus-shifted)
        noFill(); stroke(60, 100, 160, 120); strokeWeight(1.2);
        drawingContext.setLineDash([4, 5]);
        ellipse(ecx, cy, a * 2 * scale, b * 2 * scale);
        drawingContext.setLineDash([]);
        noStroke();

        // Semi-axes labels
        if (activeLaw === 1 || activeLaw === 3) {
            // Mark foci
            let f = a * e * scale;
            fill(255, 200, 80, 200); noStroke();
            circle(cx, cy, 8);       // sun (focus 1) — already drawn
            fill(80, 120, 200, 120);
            circle(ecx + a * e * scale * 2, cy, 7);   // empty focus
            // Label semi-major axis
            stroke(100, 140, 200, 100); strokeWeight(1);
            drawingContext.setLineDash([3, 4]);
            line(ecx, cy, ecx + a * scale, cy);   // to periapsis
            drawingContext.setLineDash([]);
            noStroke();
            fill(180, 200, 230, 200); textSize(10); textAlign(CENTER, TOP);
            text('a = ' + a.toFixed(2), ecx + a * scale * 0.5, cy + 6);
            textAlign(LEFT, BASELINE);

            // Periapsis / Apoapsis markers
            let peri = toScreen(a * (1 - e), 0);
            let apo  = toScreen(-a * (1 + e), 0);
            fill(255, 180, 60, 200); circle(peri.sx, peri.sy, 7);
            fill(80, 160, 255, 180); circle(apo.sx, apo.sy, 7);
            fill(200, 215, 240, 180); textSize(9); textAlign(LEFT, CENTER);
            text('Perihelio', peri.sx + 6, peri.sy);
            text('Afelio', apo.sx + 6, apo.sy);
            textAlign(LEFT, BASELINE);
        }
    }

    function drawSun() {
        let { sx, sy } = toScreen(0, 0);
        let sg = drawingContext.createRadialGradient(sx, sy, 0, sx, sy, 28);
        sg.addColorStop(0, 'rgba(255,200,80,0.6)');
        sg.addColorStop(1, 'rgba(255,120,0,0)');
        drawingContext.fillStyle = sg;
        drawingContext.fillRect(sx - 30, sy - 30, 60, 60);
        noStroke(); fill(255, 210, 80); circle(sx, sy, 20);
        fill(255, 240, 150, 180); circle(sx - 4, sy - 4, 8);
    }

    function drawBody() {
        let pos = trueAnomalyToPos(angle);
        let { sx, sy } = toScreen(pos.x, pos.y);
        noStroke(); fill(100, 200, 255, 40); circle(sx, sy, 18);
        fill(100, 200, 255, 100); circle(sx, sy, 11);
        fill(160, 220, 255); circle(sx, sy, 6);
    }

    function drawLawVisual() {
        let pos = trueAnomalyToPos(angle);
        let { sx: bx, sy: by } = toScreen(pos.x, pos.y);
        let { sx: sunX, sy: sunY } = toScreen(0, 0);

        if (activeLaw === 1) {
            // Draw radius vector
            stroke(255, 220, 100, 180); strokeWeight(1.5);
            line(sunX, sunY, bx, by); noStroke();
            fill(255, 220, 100, 100);
            let rPx = dist(sunX, sunY, bx, by);
            textSize(10); fill(200, 215, 240); textAlign(LEFT, BASELINE);
            let mid = { x: (sunX+bx)/2+8, y: (sunY+by)/2 };
            text('r = ' + pos.r.toFixed(3), mid.x, mid.y);
            textAlign(LEFT, BASELINE);
        }

        if (activeLaw === 2) {
            // Shade recent swept area
            const SECTOR_FRAMES = 40;
            let sectors = [];
            // Se recorre hacia atrás la misma ley que mueve el planeta (dθ = L/r²·dt):
            // el sector es el área barrida en los últimos SECTOR_FRAMES fotogramas,
            // que es la misma en cualquier punto de la órbita.
            let dt = BASE_DT * timeMultiplier;
            let L = angularMomentum();
            let ang = angle;
            for (let i = 0; i < SECTOR_FRAMES; i++) {
                let r = trueAnomalyToPos(ang).r;
                ang -= (L / (r * r)) * dt;
                ang = (ang + TWO_PI) % TWO_PI;
                let p = trueAnomalyToPos(ang);
                sectors.push(toScreen(p.x, p.y));
            }
            // Draw fan polygon from Sun
            fill(255, 200, 80, 30); noStroke();
            beginShape();
            vertex(sunX, sunY);
            for (let s of sectors) vertex(s.sx, s.sy);
            endShape(CLOSE);
            // Current swept area near periapsis (smaller sector, same time → smaller area)
            // Also show at apoapsis: recompute at opposite side
            stroke(255, 200, 80, 80); strokeWeight(1);
            line(sunX, sunY, bx, by); noStroke();
        }

        if (activeLaw === 3) {
            // Show T² / a³
            let T  = 2 * Math.PI / 1.0 * Math.sqrt(a * a * a / GM);
            let ratio = (T * T) / (a * a * a);
            noStroke(); fill(200, 215, 240); textSize(11); textAlign(CENTER, TOP);
            text(`T = ${T.toFixed(3)}  |  a = ${a.toFixed(2)}  |  T²/a³ = ${ratio.toFixed(2)}`, cx, 16);
            textAlign(LEFT, BASELINE);
        }
    }

    function drawLawLabel() {
        const labels = [
            '1ª Ley: Órbitas elípticas con el Sol en uno de los focos.',
            '2ª Ley: El radio vector barre áreas iguales en tiempos iguales.',
            '3ª Ley: T² ∝ a³  — Varía la excentricidad y el semieje mayor.'
        ];
        fill(160, 175, 200, 200); noStroke(); textSize(10.5); textAlign(LEFT, BOTTOM);
        text(labels[activeLaw - 1], 12, height - 10);
        textAlign(LEFT, BASELINE);
    }

    function enter(container) {
        a = 1.0; e = 0.5; angle = 0; paused = false; activeLaw = 1; timeMultiplier = 1;

        // Law selector
        let lc = document.createElement('div'); lc.className = 'card';
        lc.innerHTML = `
            <div class="atom-card-label">Ley de Kepler</div>
            <div class="card-body-static">
                <div class="btn-group">
                    <button class="k-law-btn speed-btn-active" data-law="1">1ª Ley</button>
                    <button class="k-law-btn" data-law="2">2ª Ley</button>
                    <button class="k-law-btn" data-law="3">3ª Ley</button>
                </div>
            </div>`;
        container.appendChild(lc);

        // Sliders
        let sc = document.createElement('div'); sc.className = 'card';
        sc.innerHTML = `
            <div class="atom-card-label">Parámetros Orbitales</div>
            <div class="card-body-static">
                <label style="font-size:10.5px;color:var(--text-muted)">
                    Semieje mayor (a) <span id="k-a-val">1.00</span>
                </label>
                <div class="slider-row" style="margin-top:4px">
                    <input type="range" id="k-a" min="40" max="130" value="100" step="1">
                </div>
                <label style="font-size:10.5px;color:var(--text-muted);margin-top:6px;display:block">
                    Excentricidad (e) <span id="k-e-val">0.50</span>
                </label>
                <div class="slider-row" style="margin-top:4px">
                    <input type="range" id="k-e" min="0" max="90" value="50" step="1">
                </div>
            </div>`;
        container.appendChild(sc);

        // Controls
        let cc = document.createElement('div'); cc.className = 'card';
        cc.innerHTML = `
            <div class="atom-card-label">Control</div>
            <div class="card-body-static">
                <div class="btn-group">
                    <button id="k-pause">⏸ Pausar</button>
                    <button id="k-reset">↺ Reiniciar</button>
                </div>
                <div class="speed-row" style="margin-top:5px">
                    <span>Velocidad</span>
                    <div class="btn-group">
                        <button class="k-speed-btn speed-btn-active" data-mult="1">1×</button>
                        <button class="k-speed-btn" data-mult="3">3×</button>
                        <button class="k-speed-btn" data-mult="8">8×</button>
                    </div>
                </div>
            </div>`;
        container.appendChild(cc);

        // Info
        container.appendChild(collapsibleCard('Las 3 Leyes de Kepler',
            `<p><b>1ª:</b> Todos los planetas siguen órbitas elípticas con el Sol en uno de los dos focos.</p>
            <p><b>2ª:</b> La línea que une el planeta con el Sol barre áreas iguales en tiempos iguales (consecuencia de la conservación del momento angular).</p>
            <p><b>3ª:</b> El cuadrado del período orbital es proporcional al cubo del semieje mayor: <em>T² ∝ a³</em>.</p>`, false));

        // Events
        document.querySelectorAll('.k-law-btn').forEach(b =>
            b.addEventListener('click', () => {
                activeLaw = parseInt(b.dataset.law);
                document.querySelectorAll('.k-law-btn').forEach(x =>
                    x.classList.toggle('speed-btn-active', x === b));
            }));
        document.getElementById('k-a').addEventListener('input', () => {
            a = parseInt(document.getElementById('k-a').value) / 100;
            document.getElementById('k-a-val').textContent = a.toFixed(2);
            angle = 0;
        });
        document.getElementById('k-e').addEventListener('input', () => {
            e = parseInt(document.getElementById('k-e').value) / 100;
            document.getElementById('k-e-val').textContent = e.toFixed(2);
            angle = 0;
        });
        document.getElementById('k-pause').addEventListener('click', () => {
            paused = !paused;
            document.getElementById('k-pause').textContent = paused ? '▶ Reanudar' : '⏸ Pausar';
        });
        document.getElementById('k-reset').addEventListener('click', () => { angle = 0; });
        document.querySelectorAll('.k-speed-btn').forEach(b =>
            b.addEventListener('click', () => {
                timeMultiplier = parseFloat(b.dataset.mult);
                document.querySelectorAll('.k-speed-btn').forEach(x =>
                    x.classList.toggle('speed-btn-active', x === b));
            }));
    }

    function exit() { paused = false; }
    return { enter, exit, draw };
})();


// ═══════════════════════════════════════════════════════════════════════════════
//  MODE 4 — ESTRELLAS BINARIAS
// ═══════════════════════════════════════════════════════════════════════════════
MODES['binary'] = (() => {
    const G  = 1.0;   // normalized
    const BASE_DT = 0.4 / 60;

    let m1 = 2.0, m2 = 1.0;  // masses (normalized)
    let separation = 1.6;     // initial distance
    let paused = false;
    let timeMultiplier = 1;

    // State: positions and velocities of both stars
    let s1 = {}, s2 = {};
    let trail1 = [], trail2 = [], trailCM = [];
    const MAX_TRAIL = 600;

    function init() {
        let M  = m1 + m2;
        let mu = G * M;
        // Place stars symmetrically around center of mass
        // CM at origin; s1 at -r2 from CM, s2 at r1 from CM
        let r1 = separation * m2 / M;  // s1 distance from CM
        let r2 = separation * m1 / M;  // s2 distance from CM
        // Circular orbit velocity: v = sqrt(G*M/separation) for reduced mass
        let v  = Math.sqrt(G * M / separation);
        let v1 = v * m2 / M;   // speed of s1
        let v2 = v * m1 / M;   // speed of s2
        s1 = { x: -r1, y: 0, vx: 0, vy: -v1 };
        s2 = { x:  r2, y: 0, vx: 0, vy:  v2 };
        trail1 = []; trail2 = []; trailCM = [];
    }

    function updatePhysics() {
        if (paused) return;
        let dt = BASE_DT * timeMultiplier;
        const STEPS = 6;
        let h = dt / STEPS;
        for (let i = 0; i < STEPS; i++) {
            let dx = s2.x - s1.x, dy = s2.y - s1.y;
            let r2 = dx*dx + dy*dy, r = Math.sqrt(r2);
            let f  = G * m1 * m2 / r2;
            let fx = f * dx / r, fy = f * dy / r;
            s1.vx += (fx / m1) * h; s1.vy += (fy / m1) * h;
            s2.vx -= (fx / m2) * h; s2.vy -= (fy / m2) * h;
            s1.x  += s1.vx * h;    s1.y  += s1.vy * h;
            s2.x  += s2.vx * h;    s2.y  += s2.vy * h;
        }
        let M   = m1 + m2;
        let cmx = (m1 * s1.x + m2 * s2.x) / M;
        let cmy = (m1 * s1.y + m2 * s2.y) / M;
        let sc  = min(width, height) * 0.22;

        trail1.push({ x: cx + s1.x * sc, y: cy - s1.y * sc });
        trail2.push({ x: cx + s2.x * sc, y: cy - s2.y * sc });
        trailCM.push({ x: cx + cmx * sc, y: cy - cmy * sc });
        if (trail1.length > MAX_TRAIL) trail1.shift();
        if (trail2.length > MAX_TRAIL) trail2.shift();
        if (trailCM.length > MAX_TRAIL) trailCM.shift();
    }

    function toScreen(px, py) {
        let sc = min(width, height) * 0.22;
        return { sx: cx + px * sc, sy: cy - py * sc };
    }

    function drawOneTrail(pts, r, g, b) {
        let n = pts.length; if (n < 2) return;
        const BANDS = 10;
        let bs = Math.ceil(n / BANDS);
        drawingContext.save();
        drawingContext.lineJoin = 'round'; drawingContext.lineCap = 'round';
        for (let band = 0; band < BANDS; band++) {
            let s = band * bs, e = Math.min(s + bs + 1, n);
            if (s >= n - 1) break;
            let t = (band + 0.5) / BANDS;
            drawingContext.beginPath();
            drawingContext.moveTo(pts[s].x, pts[s].y);
            for (let j = s + 1; j < e; j++) drawingContext.lineTo(pts[j].x, pts[j].y);
            drawingContext.strokeStyle = `rgba(${r},${g},${b},${t * t * 0.65})`;
            drawingContext.lineWidth = 0.5 + t * 1.5;
            drawingContext.stroke();
        }
        drawingContext.restore(); noStroke();
    }

    function draw() {
        updatePhysics();

        let M   = m1 + m2;
        let cmx = (m1 * s1.x + m2 * s2.x) / M;
        let cmy = (m1 * s1.y + m2 * s2.y) / M;
        let { sx: cm_sx, sy: cm_sy } = toScreen(cmx, cmy);
        let { sx: x1, sy: y1 } = toScreen(s1.x, s1.y);
        let { sx: x2, sy: y2 } = toScreen(s2.x, s2.y);

        // Trails
        drawOneTrail(trail1, 255, 160, 60);
        drawOneTrail(trail2, 80, 160, 255);
        drawOneTrail(trailCM, 120, 255, 120);

        // CM marker
        noFill(); stroke(100, 240, 100, 130); strokeWeight(1.2);
        line(cm_sx - 7, cm_sy, cm_sx + 7, cm_sy);
        line(cm_sx, cm_sy - 7, cm_sx, cm_sy + 7);
        noStroke();

        // Line connecting stars (faint)
        stroke(80, 90, 120, 60); strokeWeight(0.8);
        line(x1, y1, x2, y2); noStroke();

        // Star 1 (massive, orange)
        let r1_px = 8 + m1 * 4;
        let sg1 = drawingContext.createRadialGradient(x1, y1, 0, x1, y1, r1_px * 2.5);
        sg1.addColorStop(0, 'rgba(255,160,60,0.65)');
        sg1.addColorStop(1, 'rgba(255,80,0,0)');
        drawingContext.fillStyle = sg1;
        drawingContext.fillRect(x1 - r1_px*3, y1 - r1_px*3, r1_px*6, r1_px*6);
        noStroke(); fill(255, 180, 80); circle(x1, y1, r1_px * 2);
        fill(255, 230, 160, 180); circle(x1 - r1_px*0.3, y1 - r1_px*0.3, r1_px*0.7);

        // Star 2 (lighter, blue-white)
        let r2_px = 8 + m2 * 4;
        let sg2 = drawingContext.createRadialGradient(x2, y2, 0, x2, y2, r2_px * 2.5);
        sg2.addColorStop(0, 'rgba(120,160,255,0.65)');
        sg2.addColorStop(1, 'rgba(60,80,255,0)');
        drawingContext.fillStyle = sg2;
        drawingContext.fillRect(x2 - r2_px*3, y2 - r2_px*3, r2_px*6, r2_px*6);
        noStroke(); fill(160, 200, 255); circle(x2, y2, r2_px * 2);
        fill(220, 235, 255, 180); circle(x2 - r2_px*0.3, y2 - r2_px*0.3, r2_px*0.7);

        // Labels
        fill(200, 215, 240, 200); textSize(9.5); textAlign(CENTER, TOP);
        text(`M₁ = ${m1.toFixed(1)}`, x1, y1 + r1_px + 5);
        text(`M₂ = ${m2.toFixed(1)}`, x2, y2 + r2_px + 5);
        fill(100, 240, 100, 160); text('CM', cm_sx + 10, cm_sy - 4);
        textAlign(LEFT, BASELINE);

        // Energy display
        let dx = s2.x - s1.x, dy_ = s2.y - s1.y;
        let r  = Math.sqrt(dx*dx + dy_*dy_);
        let KE = 0.5*m1*(s1.vx*s1.vx+s1.vy*s1.vy) + 0.5*m2*(s2.vx*s2.vx+s2.vy*s2.vy);
        let PE = -G * m1 * m2 / r;
        fill(160, 175, 200, 180); textSize(10); textAlign(LEFT, BOTTOM);
        text(`Ec = ${KE.toFixed(3)}  |  Ep = ${PE.toFixed(3)}  |  E = ${(KE+PE).toFixed(3)}`, 12, height - 10);
        textAlign(LEFT, BASELINE);
    }

    function enter(container) {
        m1 = 2.0; m2 = 1.0; separation = 1.6; paused = false; timeMultiplier = 1;
        init();

        // Mass sliders
        let mc = document.createElement('div'); mc.className = 'card';
        mc.innerHTML = `
            <div class="atom-card-label">Masas (en M☉)</div>
            <div class="card-body-static">
                <label style="font-size:10.5px;color:var(--text-muted)">
                    Estrella 1 (naranja) <span id="b-m1-val">2.0</span>
                </label>
                <div class="slider-row" style="margin-top:4px">
                    <input type="range" id="b-m1" min="5" max="50" value="20" step="1">
                </div>
                <label style="font-size:10.5px;color:var(--text-muted);margin-top:6px;display:block">
                    Estrella 2 (azul) <span id="b-m2-val">1.0</span>
                </label>
                <div class="slider-row" style="margin-top:4px">
                    <input type="range" id="b-m2" min="5" max="50" value="10" step="1">
                </div>
                <label style="font-size:10.5px;color:var(--text-muted);margin-top:6px;display:block">
                    Separación <span id="b-sep-val">1.6</span>
                </label>
                <div class="slider-row" style="margin-top:4px">
                    <input type="range" id="b-sep" min="8" max="30" value="16" step="1">
                </div>
            </div>`;
        container.appendChild(mc);

        // Controls
        let cc = document.createElement('div'); cc.className = 'card';
        cc.innerHTML = `
            <div class="atom-card-label">Control</div>
            <div class="card-body-static">
                <div class="btn-group">
                    <button id="b-pause">⏸ Pausar</button>
                    <button id="b-reset">↺ Reiniciar</button>
                </div>
                <div class="speed-row" style="margin-top:5px">
                    <span>Velocidad</span>
                    <div class="btn-group">
                        <button class="b-speed-btn speed-btn-active" data-mult="1">1×</button>
                        <button class="b-speed-btn" data-mult="3">3×</button>
                        <button class="b-speed-btn" data-mult="8">8×</button>
                    </div>
                </div>
            </div>`;
        container.appendChild(cc);

        // Info
        container.appendChild(collapsibleCard('Centro de Masa y Sistemas Binarios',
            `<p>En un sistema de dos cuerpos, ambas estrellas orbitan alrededor del <em>centro de masa</em> (CM, marcador verde ✛). La estrella más masiva describe una órbita más pequeña.</p>
            <p>La relación entre los radios orbitales es inversa a la relación de masas: <b>r₁/r₂ = M₂/M₁</b>. El sistema tiene <b>energía total conservada</b> (mostrada en pantalla).</p>
            <p>Varía las masas y observa cómo cambia la posición del CM y el tamaño de cada órbita.</p>`, false));

        // Events
        function reInit() {
            m1 = parseInt(document.getElementById('b-m1').value) / 10;
            m2 = parseInt(document.getElementById('b-m2').value) / 10;
            separation = parseInt(document.getElementById('b-sep').value) / 10;
            document.getElementById('b-m1-val').textContent = m1.toFixed(1);
            document.getElementById('b-m2-val').textContent = m2.toFixed(1);
            document.getElementById('b-sep-val').textContent = separation.toFixed(1);
            init();
        }
        ['b-m1','b-m2','b-sep'].forEach(id =>
            document.getElementById(id).addEventListener('input', reInit));
        document.getElementById('b-pause').addEventListener('click', () => {
            paused = !paused;
            document.getElementById('b-pause').textContent = paused ? '▶ Reanudar' : '⏸ Pausar';
        });
        document.getElementById('b-reset').addEventListener('click', init);
        document.querySelectorAll('.b-speed-btn').forEach(b =>
            b.addEventListener('click', () => {
                timeMultiplier = parseFloat(b.dataset.mult);
                document.querySelectorAll('.b-speed-btn').forEach(x =>
                    x.classList.toggle('speed-btn-active', x === b));
            }));
    }

    function exit() { paused = false; }
    return { enter, exit, draw };
})();
