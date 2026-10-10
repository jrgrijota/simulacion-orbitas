// Traducciones al inglés (se usan con ?lang=en). Ver js/i18n.js.
window.I18N_EN = {
    // Cabecera y selector de modo
    'Laboratorio de Órbitas': 'Orbits Lab',
    'Mecánica Orbital · Newton · Kepler': 'Orbital Mechanics · Newton · Kepler',
    'Bala de Cañón de Newton': "Newton's Cannonball",
    'Sistema Solar': 'Solar System',
    'Leyes de Kepler': "Kepler's Laws",
    'Estrellas Binarias': 'Binary Stars',

    // Controles comunes
    'Control': 'Controls',
    'Velocidad': 'Speed',
    '⏸ Pausar': '⏸ Pause',
    '▶ Reanudar': '▶ Resume',
    '↺ Reiniciar': '↺ Reset',
    'Pausar': 'Pause',
    'Reiniciar': 'Reset',
    'Espacio': 'Space',

    // Bala de cañón de Newton
    'Velocidad Inicial': 'Launch Speed',
    '▶ Disparar': '▶ Fire',
    'Disparar': 'Fire',
    'Estado Orbital': 'Orbital Status',
    'Sin proyectil activo': 'No projectile in flight',
    '💥 Impacto con la Tierra': '💥 Hit the Earth',
    'Órbitas completas: {n}': 'Complete orbits: {n}',
    '🚀 Escape gravitatorio': '🚀 Escaped Earth’s gravity',
    'Energía mecánica positiva — sin retorno': 'Positive mechanical energy — no return',
    'Órbitas': 'Orbits',
    'Altitud': 'Altitude',
    'Trayectoria': 'Trajectory',
    'Energía ε': 'Energy ε',
    'Perigeo': 'Perigee',
    'Apogeo': 'Apogee',
    'Período': 'Period',
    'Vel. de escape': 'Escape velocity',
    'Suborbital': 'Suborbital',
    'Órbita circular': 'Circular orbit',
    'Órbita elíptica': 'Elliptical orbit',
    'P': 'W',   // flecha del peso (weight)
    'Experimento mental de Newton': "Newton's thought experiment",
    'info-newton':
        '<p>Newton imagined that if a cannonball were fired horizontally from a very high mountain, fast enough, the curve of its fall would match the curvature of the Earth, keeping it in permanent <em>orbit</em>.</p>' +
        '<p>The <em>specific orbital energy</em> ε = v²/2 − GM/r decides the type of path: <b>ε &lt; 0</b> → bound orbit (elliptical or circular); <b>ε ≥ 0</b> → escape. The <b>perigee</b> (closest point) decides whether the cannonball hits the Earth.</p>' +
        '<p>Yellow marker = perigee · Blue = apogee · Green circle = reference circular orbit.</p>',

    // Sistema Solar
    'Planetas': 'Planets',
    'Mercurio': 'Mercury',
    'Venus': 'Venus',
    'Tierra': 'Earth',
    'Marte': 'Mars',
    'Júpiter': 'Jupiter',
    'Saturno': 'Saturn',
    'Urano': 'Uranus',
    'Neptuno': 'Neptune',
    '{a} AU · {T} a': '{a} AU · {T} yr',
    'T = {T} años': 'T = {T} years',
    'Ley de Kepler III (T² ∝ a³)': "Kepler's Third Law (T² ∝ a³)",
    'info-kepler3':
        '<p>For every planet in the Solar System: <b>T² = a³</b> (with T in years and a in AU). This relationship follows directly from Newton’s law of universal gravitation.</p>' +
        '<p>Click any planet in the list to see its orbital parameters and check the law.</p>' +
        '<p>Note: from Jupiter outwards the orbits are drawn closer in than they really are so that they fit on the screen; the data in the list are the real values.</p>',

    // Leyes de Kepler
    'Ley de Kepler': "Kepler's Law",
    '1ª Ley': '1st Law',
    '2ª Ley': '2nd Law',
    '3ª Ley': '3rd Law',
    'Parámetros Orbitales': 'Orbital Parameters',
    'Semieje mayor (a)': 'Semi-major axis (a)',
    'Excentricidad (e)': 'Eccentricity (e)',
    'Perihelio': 'Perihelion',
    'Afelio': 'Aphelion',
    '1ª Ley: Órbitas elípticas con el Sol en uno de los focos.': '1st Law: Orbits are ellipses with the Sun at one focus.',
    '2ª Ley: El radio vector barre áreas iguales en tiempos iguales.': '2nd Law: The radius vector sweeps out equal areas in equal times.',
    '3ª Ley: T² ∝ a³  — Varía la excentricidad y el semieje mayor.': '3rd Law: T² ∝ a³  — Change the eccentricity and the semi-major axis.',
    'Las 3 Leyes de Kepler': "Kepler's 3 Laws",
    'info-kepler':
        '<p><b>1st:</b> Every planet moves in an elliptical orbit with the Sun at one of the two foci.</p>' +
        '<p><b>2nd:</b> The line joining the planet to the Sun sweeps out equal areas in equal times (a consequence of conservation of angular momentum).</p>' +
        '<p><b>3rd:</b> The square of the orbital period is proportional to the cube of the semi-major axis: <em>T² ∝ a³</em>.</p>',

    // Estrellas binarias
    'Masas (en M☉)': 'Masses (in M☉)',
    'Estrella 1 (naranja)': 'Star 1 (orange)',
    'Estrella 2 (azul)': 'Star 2 (blue)',
    'Separación': 'Separation',
    'Ec = {k}  |  Ep = {p}  |  E = {e}': 'Ek = {k}  |  Ep = {p}  |  E = {e}',
    'Centro de Masa y Sistemas Binarios': 'Centre of Mass and Binary Systems',
    'info-binary':
        '<p>In a two-body system, both stars orbit the <em>centre of mass</em> (CM, green marker ✛). The more massive star moves in a smaller orbit.</p>' +
        '<p>The ratio of the orbital radii is the inverse of the ratio of the masses: <b>r₁/r₂ = M₂/M₁</b>. The system’s <b>total energy is conserved</b> (shown on screen).</p>' +
        '<p>Change the masses and watch how the position of the CM and the size of each orbit change.</p>'
};
