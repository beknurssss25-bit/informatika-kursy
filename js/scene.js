/* Scroll-driven 3D hero: a laptop built procedurally from Three.js primitives (no external models/textures).
   Three.js is vendored in js/vendor/three.min.js; GSAP + ScrollTrigger + Lenis are loaded as classic scripts. */
import * as THREE from './vendor/three.min.js';
import { createScreen } from './screen.js?v=2';

const root = document.documentElement;
function fail(why) {
  console.warn('[3d] fallback to static hero:', why);
  root.classList.remove('gl'); root.classList.add('no-gl');
}

(function boot() {
  if (!root.classList.contains('gl')) return;                       // decided in <head>
  if (!window.gsap || !window.ScrollTrigger) return fail('gsap missing');
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  const story = document.getElementById('top'), stage = story.querySelector('.stage'), canvas = document.getElementById('gl');
  const heroText = document.getElementById('heroText'), hint = document.getElementById('scrollHint'), steps = document.getElementById('steps');
  const params = new URLSearchParams(location.search);

  /* ---------- quality tier ---------- */
  const small = innerWidth < 768, coarse = matchMedia('(pointer:coarse)').matches;
  const lowCpu = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let tier = (small || coarse || lowCpu) ? 'low' : 'high';
  if (params.get('q') === 'low' || params.get('q') === 'high') tier = params.get('q');
  const adaptive = params.get('q') !== 'high' && params.get('q') !== 'low';
  const Q = tier === 'low'
    ? { dprMax: 1.25, particles: 260, glyphs: 6, tex: [1024, 640], texFps: 18, aa: false }
    : { dprMax: 1.75, particles: 1400, glyphs: 12, tex: [1600, 1000], texFps: 30, aa: true };

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return fail(e); }
  if (!renderer.getContext()) return fail('no context');
  let dpr = Math.min(window.devicePixelRatio || 1, Q.dprMax);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('context lost'); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  /* ---------- small texture helpers ---------- */
  function canvasTex(w, h, fn, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const radialTex = (stops) => canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, w, h);
  });

  /* ---------- laptop (all procedural) ---------- */
  const laptop = new THREE.Group(); scene.add(laptop);
  const BW = 3.4, BD = 2.3, BT = 0.14, LT = 0.07, KEYH = 0.035;
  const silver = new THREE.MeshStandardMaterial({ color: 0xaab0bd, metalness: 1, roughness: 0.34 });
  const silverDark = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, metalness: 1, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x07090f, metalness: 0.3, roughness: 0.55 });

  const base = new THREE.Mesh(new THREE.RoundedBoxGeometry(BW, BT, BD, 4, 0.05), silver);
  base.position.y = BT / 2; laptop.add(base);
  // keyboard well + backlight (gradient shows between the keys)
  const well = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.004, 1.2), black); well.position.set(0, BT + 0.001, -0.4); laptop.add(well);
  const glowTex = canvasTex(256, 4, (g, w, h) => { const l = g.createLinearGradient(0, 0, w, 0); l.addColorStop(0, '#7C5CFF'); l.addColorStop(.55, '#4D8DFF'); l.addColorStop(1, '#22D3EE'); g.fillStyle = l; g.fillRect(0, 0, w, h); });
  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.12), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.0, toneMapped: false }));
  backlight.rotation.x = -Math.PI / 2; backlight.position.set(0, BT + 0.0045, -0.4); laptop.add(backlight);
  const pad = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.3, 0.008, 0.8, 2, 0.003), silverDark);
  pad.position.set(0, BT + 0.001, 0.72); laptop.add(pad);
  const padEdge = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 }));
  padEdge.rotation.x = -Math.PI / 2; padEdge.position.set(0, BT + 0.0065, 0.72); laptop.add(padEdge);

  // keys: InstancedMesh, 6 rows x 15 units
  const ROWS = [
    { h: 0.1, w: Array(15).fill(1) },
    { h: 0.16, w: [...Array(13).fill(1), 2] },
    { h: 0.16, w: [1.5, ...Array(12).fill(1), 1.5] },
    { h: 0.16, w: [1.75, ...Array(11).fill(1), 2.25] },
    { h: 0.16, w: [2.25, ...Array(10).fill(1), 2.75] },
    { h: 0.16, w: [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25] },
  ];
  const keyDefs = []; { const u = 3.0 / 15, gap = 0.03; let z = -0.97;
    ROWS.forEach(r => { let x = -1.5; r.w.forEach(w => { keyDefs.push({ x: x + (w * u) / 2, z: z + r.h / 2, sx: w * u - gap, sz: r.h }); x += w * u; }); z += r.h + gap; }); }
  const keyGeo = new THREE.RoundedBoxGeometry(1, 1, 1, 2, 0.14);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55 });
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, keyDefs.length);
  const keyBase = new THREE.Color(0x151824), keyHot = new THREE.Color(0x6f5bff), keyCol = new THREE.Color(), dummy = new THREE.Object3D();
  const keyGlow = new Float32Array(keyDefs.length);
  function setKey(i) { const k = keyDefs[i]; dummy.position.set(k.x, BT + KEYH / 2 - keyGlow[i] * 0.012, k.z); dummy.scale.set(k.sx, KEYH, k.sz); dummy.updateMatrix(); keys.setMatrixAt(i, dummy.matrix);
    keyCol.copy(keyBase).lerp(keyHot, keyGlow[i]); keys.setColorAt(i, keyCol); }
  keyDefs.forEach((_, i) => setKey(i)); keys.instanceMatrix.needsUpdate = true; keys.instanceColor.needsUpdate = true; laptop.add(keys);

  // lid (pivots at the hinge on the back edge)
  const hingeY = BT + 0.03, hingeZ = -BD / 2;
  const lid = new THREE.Group(); lid.position.set(0, hingeY, hingeZ); laptop.add(lid);
  const lidShell = new THREE.Mesh(new THREE.RoundedBoxGeometry(BW, LT, BD, 4, 0.03), silver); lidShell.position.set(0, LT / 2, BD / 2); lid.add(lidShell);
  const SW = 3.12, SH = 1.95, SZ = 0.15 + SH / 2;                      // screen size and z-center within the lid
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.1, SH + 0.1), black); bezel.rotation.x = Math.PI / 2; bezel.position.set(0, -0.0008, SZ); lid.add(bezel);
  const screenCv = createScreen(Q.tex[0], Q.tex[1]);
  const screenTex = new THREE.CanvasTexture(screenCv.canvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter; screenTex.generateMipmaps = false; screenTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.rotation.x = Math.PI / 2; screen.position.set(0, -0.0016, SZ); lid.add(screen);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), new THREE.MeshBasicMaterial({ color: 0x1b2340 }));
  cam.rotation.x = Math.PI / 2; cam.position.set(0, -0.0018, BD - 0.1); lid.add(cam);
  // glowing logo on the outside of the lid
  const logoTex = canvasTex(256, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, w, h); l.addColorStop(0, '#9B87FF'); l.addColorStop(1, '#3FD8F5');
    g.strokeStyle = l; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.arc(w / 2, h / 2, 86, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(98, 100); g.lineTo(70, 128); g.lineTo(98, 156); g.moveTo(158, 100); g.lineTo(186, 128); g.lineTo(158, 156); g.stroke();
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }));
  logo.rotation.x = -Math.PI / 2; logo.position.set(0, LT + 0.0012, BD / 2); lid.add(logo);
  // hinge barrel
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 20), silverDark); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, hingeY + 0.02, hingeZ + 0.03); laptop.add(hinge);
  // light that the screen throws on the keyboard
  const screenLight = new THREE.PointLight(0x8f86ff, 0, 5, 1.6); screenLight.position.set(0, -0.6, SZ - 0.3); lid.add(screenLight);

  /* ---------- environment decor: glow, floor, particles, glyphs ---------- */
  const glowBack = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(124,92,255,.85)'], [.45, 'rgba(60,110,255,.28)'], [1, 'rgba(34,211,238,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glowBack.position.set(0, 1.4, -7); glowBack.scale.set(26, 18, 1);   // far behind: a big billboard must never intersect the laptop scene.add(glowBack);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(124,92,255,.55)'], [.4, 'rgba(34,211,238,.16)'], [1, 'rgba(10,15,31,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = -0.02; scene.add(floorGlow);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.2), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,.75)'], [.55, 'rgba(0,0,0,.32)'], [1, 'rgba(0,0,0,0)']]), depthWrite: false, transparent: true }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.015; scene.add(shadow);

  const key1 = new THREE.DirectionalLight(0xb8a8ff, 1.1); key1.position.set(-4, 5, 3); scene.add(key1);
  const key2 = new THREE.DirectionalLight(0x4fe0ff, 1.0); key2.position.set(5, 3, -3); scene.add(key2);

  // particles (custom shader: drift is computed on the GPU)
  const PN = Q.particles, pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN), pSize = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const r = 2.6 + Math.pow(Math.random(), 0.7) * 9, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
    pPos[i * 3] = r * Math.sin(ph) * Math.cos(th); pPos[i * 3 + 1] = r * Math.cos(ph) * 0.65 + 1.2; pPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    pSeed[i] = Math.random(); pSize[i] = 0.5 + Math.random() * 1.6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: dpr }, uOpacity: { value: 1 } },
    vertexShader: `attribute float aSeed; attribute float aSize; uniform float uTime; uniform float uPR; varying vec3 vCol; varying float vTw;
      void main(){ vec3 p = position; float s = aSeed*6.2831;
        p.x += sin(uTime*.25+s)*.35; p.y += sin(uTime*.21+s*1.7)*.32; p.z += cos(uTime*.23+s*1.3)*.35;
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = min(aSize*uPR*(16./-mv.z), 26.*uPR);
        gl_Position = projectionMatrix*mv;
        vCol = mix(vec3(.55,.42,1.), vec3(.15,.85,.95), fract(aSeed*7.3));
        vTw = .55 + .45*sin(uTime*1.3 + s*3.); }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vCol; varying float vTw;
      void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d); a *= a; gl_FragColor = vec4(vCol, a*vTw*uOpacity); }`,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);

  // floating code glyphs
  const glyphGroup = new THREE.Group(); scene.add(glyphGroup);
  const GLY = ['{ }', '</>', 'Py', '01', 'def', '#', 'λ', '=>', 'if', '∑', '[ ]', '10'];
  const glyphs = [];
  for (let i = 0; i < Q.glyphs; i++) {
    const g = GLY[i % GLY.length], col = i % 2 ? '#5EE1F7' : '#B69CFF';
    const tex = canvasTex(128, 128, (c, w, h) => { c.font = '700 54px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 18; c.fillStyle = col; c.fillText(g, w / 2, h / 2); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = (i / Q.glyphs) * 6.283 + Math.random(), r = 3.4 + Math.random() * 2.2;
    sp.userData = { a, r, y: 0.3 + Math.random() * 3.2, sp: 0.15 + Math.random() * 0.2, ph: Math.random() * 6 };
    sp.scale.setScalar(0.38 + Math.random() * 0.3); glyphGroup.add(sp); glyphs.push(sp);
  }

  /* ---------- state driven by the scroll timeline ---------- */
  const S = { lid: 0, shift: 1, orbit: 0, zoom: 0, type: 0, run: 0, slide: 0, fade: 0 };
  const OPEN = 1.9;                                                       // ~109 degrees
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const T0 = V(0, 0.12, 0), T1 = V(0, 1.0, 0);
  const finalC = new THREE.Vector3(), finalN = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let W = 1, Hh = 1, fit = {}, vis = false, reduceMotion = false;
  const isNarrow = () => W / Hh < 1.0;

  function computeFinal() {
    const keep = lid.rotation.x; lid.rotation.x = -OPEN; laptop.updateMatrixWorld(true);
    screen.getWorldPosition(finalC);
    const q = new THREE.Quaternion(); screen.getWorldQuaternion(q); finalN.set(0, 0, 1).applyQuaternion(q).normalize();
    lid.rotation.x = keep; laptop.updateMatrixWorld(true);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), a = W / Hh;
    const dH = (SH / 2) / t, dW = (SW / 2) / (t * a);
    fit.slide = (isNarrow() ? dW : Math.max(dW, dH) * 1.1);                            // whole screen (almost) fills the viewport
    fit.end = Math.min(dH, dW) * 0.8;                                      // screen covers everything
    fit.R0 = ((BW / (isNarrow() ? 0.74 : 0.40)) / 2) / (t * a);            // hero distance so the closed laptop has a sensible size
    fit.R0 = Math.max(fit.R0, 6.2);
  }
  function resize() {
    const r = stage.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); Hh = Math.max(1, Math.round(r.height));
    renderer.setSize(W, Hh, false); camera.aspect = W / Hh; camera.updateProjectionMatrix(); computeFinal(); need = true;
    screenCv.compact = isNarrow(); lastTex = -1;
  }
  let need = true;
  new ResizeObserver(() => resize()).observe(stage);

  /* ---------- scroll timeline ---------- */
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true } });
  /* Timeline units (total ~9.9 -> hero = 400vh desktop / 380vh mobile, i.e. ~300vh of scrolling):
     0-0.9   lid opens fully (first ~9% of the scroll)      1.0-4.4  program is typed (scroll-driven)
     0.4-4.0 camera shifts, orbits and flies into the screen 4.6-5.9  "Запустить" -> output appears
     6.4-9.0 slides: О курсах / Тарифы / Запись              9.2-9.9  short hold on the booking slide, then the sticky stage releases straight into the page (no blank hold) */
  tl.to(S, { lid: 1, ease: 'power2.out', duration: 0.9 }, 0)
    .to(heroText, { opacity: 0, y: -50, duration: 0.8, ease: 'power1.in' }, 0.1)
    .to(hint, { opacity: 0, duration: 0.3 }, 0)
    .to(S, { shift: 0, ease: 'power2.inOut', duration: 2.2 }, 0.4)
    .to(S, { orbit: 1, ease: 'power1.inOut', duration: 2.6 }, 0.6)
    .to(S, { zoom: 1, ease: 'power3.inOut', duration: 2.4 }, 1.6)
    .to(S, { type: 1, duration: 3.4 }, 1.0)
    .to(S, { run: 1, duration: 1.3 }, 4.6)
    .to(S, { slide: 3, duration: 2.6 }, 6.4)
    .to(S, { fade: 1, ease: 'power1.inOut', duration: 0.7 }, 9.2);
  const smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const stepped = s => { const i = Math.floor(Math.min(s, 2.9999)), f = s - i; return s >= 3 ? 3 : i + smooth(0.55, 1, f); };

  /* ---------- UI reflecting scroll state ---------- */
  const stepEls = [...steps.children]; let uiState = '';
  function updateUI() {
    const hide = heroText.style.opacity !== '' && +heroText.style.opacity < 0.05;
    heroText.style.visibility = hide ? 'hidden' : '';
    const show = S.zoom > 0.6, idx = Math.round(stepped(S.slide)), key = show + ':' + idx;
    if (key !== uiState) { uiState = key; steps.classList.toggle('show', show); stepEls.forEach((e, i) => e.classList.toggle('on', i === idx)); }
  }

  /* ---------- pointer parallax (fine pointers only) ---------- */
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!coarse) addEventListener('pointermove', e => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* ---------- render loop ---------- */
  let lastTex = -1, lastKey = 0, frames = 0, slow = 0, ema = 16, level = 0, lastT = 0;
  const texFont = Promise.all([document.fonts && document.fonts.load('800 80px Onest'), document.fonts && document.fonts.load('700 30px "JetBrains Mono"'), document.fonts && document.fonts.ready]).catch(() => {});
  texFont.then(() => { lastTex = -1; need = true; });

  function frame(timeMs) {
    if (!vis || document.hidden) return;
    const t = timeMs / 1000, dt = lastT ? t - lastT : 0.016; lastT = t;
    if (adaptive && dt < 0.5) {                                         // adaptive quality: drop pixel ratio / particles when frames are slow
      ema += (dt * 1000 - ema) * 0.08; if (++frames > 60 && ema > 42 && level < 2) { level++; frames = 0; ema = 16; degrade(level); }
    }
    // lid + lights
    const lidE = S.lid, ang = -OPEN * lidE;
    lid.rotation.x = ang;
    screenLight.intensity = 5.5 * smooth(0.05, 1, lidE);
    backlight.material.opacity = 0.55 * smooth(0.3, 1, lidE);
    glowBack.material.opacity = 0.2 + 0.7 * lidE; floorGlow.material.opacity = 0.55 + 0.4 * lidE;
    // idle motion (fades out as the camera commits to the screen)
    const idle = 1 - S.zoom;
    laptop.position.y = Math.sin(t * 0.9) * 0.035 * idle;
    laptop.rotation.y = Math.sin(t * 0.35) * 0.06 * (1 - S.orbit) + ptr.sx * 0.22 * idle;
    laptop.rotation.x = ptr.sy * 0.07 * idle;
    shadow.material.opacity = 1 - 0.3 * Math.abs(Math.sin(t * 0.9)) * idle;
    // camera
    ptr.sx += (ptr.x - ptr.sx) * 0.05; ptr.sy += (ptr.y - ptr.sy) * 0.05;
    const o = S.orbit, az = THREE.MathUtils.lerp(0.62, -0.5, o) + Math.sin(t * 0.25) * 0.03 + ptr.sx * 0.2 * idle, el = THREE.MathUtils.lerp(0.4, 0.2, o) - ptr.sy * 0.1 * idle;
    const R = fit.R0 * THREE.MathUtils.lerp(1, 0.78, o);
    camLook.lerpVectors(T0, T1, lidE);
    camPos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(R).add(camLook);
    if (S.zoom > 0) {
      const ez = S.zoom, d = THREE.MathUtils.lerp(fit.slide, fit.end, S.fade * 0.0);
      tmp.copy(finalN).multiplyScalar(d).add(finalC); camPos.lerp(tmp, ez); camLook.lerp(finalC, ez);
    }
    camera.position.copy(camPos); camera.lookAt(camLook);
    const sh = S.shift;                                                    // hero composition: laptop to the right (desktop) / lower part (mobile)
    const dy = (isNarrow() ? Hh * 0.05 : -34) * S.zoom;               // keep the screen's top bar clear of the fixed nav
    if (sh > 0.001 || dy) camera.setViewOffset(W, Hh, isNarrow() ? 0 : -W * 0.17 * sh, (isNarrow() ? -Hh * 0.03 * sh : 0) + dy, W, Hh); else camera.clearViewOffset();
    // decor
    pMat.uniforms.uTime.value = t; pMat.uniforms.uOpacity.value = 1 - 0.95 * smooth(0.2, 0.9, S.zoom);
    points.rotation.y = t * 0.02;
    glyphGroup.visible = S.zoom < 0.85;
    if (glyphGroup.visible) glyphs.forEach(g => { const u = g.userData, a = u.a + t * u.sp * 0.3; g.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.8 + u.ph) * 0.25, Math.sin(a) * u.r); g.material.opacity = 0.62 * (1 - smooth(0.1, 0.8, S.zoom)) * smooth(2.2, 5, g.position.distanceTo(camera.position)); });
    // keyboard "typing"
    if (lidE > 0.6 && S.zoom < 0.95) {
      if (t - lastKey > 0.07) { lastKey = t; keyGlow[(Math.random() * keyDefs.length) | 0] = 1; }
      for (let i = 0; i < keyDefs.length; i++) if (keyGlow[i] > 0) { keyGlow[i] = Math.max(0, keyGlow[i] - dt * 3.2); setKey(i); }
      keys.instanceMatrix.needsUpdate = true; keys.instanceColor.needsUpdate = true;
    }
    // screen texture
    if (lidE > 0.02 && (t - lastTex > 1 / Q.texFps || lastTex < 0)) {
      lastTex = t; screenCv.draw(t, stepped(S.slide), 0, S.type, S.run); screenTex.needsUpdate = true;
    }
    updateUI();
    renderer.render(scene, camera);
  }
  function degrade(l) {
    console.info('[3d] low fps → quality level', l);
    dpr = Math.max(1, dpr * 0.75); renderer.setPixelRatio(dpr); pMat.uniforms.uPR.value = dpr; renderer.setSize(W, Hh, false);
    pGeo.setDrawRange(0, Math.floor(PN * (l === 1 ? 0.55 : 0.3)));
    if (l >= 2) { glyphs.forEach((g, i) => { g.visible = i < 3; }); Q.texFps = 12; }
  }
  if (tier === 'low') pGeo.setDrawRange(0, PN);

  // run only while the hero is on screen
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) lastT = 0; }, { rootMargin: '100px' }).observe(story);
  gsap.ticker.add((t) => frame(t * 1000));
  document.addEventListener('visibilitychange', () => { lastT = 0; });

  /* ---------- smooth scrolling (Lenis) + anchor links ---------- */
  let lenis = null;
  if (window.Lenis && !coarse) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const el = id === '#top' ? document.body : document.querySelector(id); if (!el) return;
    e.preventDefault();
    const y = id === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - 68;
    if (lenis) lenis.scrollTo(y, { duration: Math.min(2.4, 0.6 + Math.abs(y - scrollY) / 4000) });
    else scrollTo({ top: y, behavior: 'smooth' });
    history.replaceState(null, '', id);
  });

  // boot
  resize(); ScrollTrigger.config({ ignoreMobileResize: true });
  addEventListener('load', () => ScrollTrigger.refresh());
  root.classList.add('gl-ready');
  window.__scene = { scene, glowBack, floorGlow, shadow, points, glyphGroup, S, tier, renderer, camera, level: () => level, tl, lenis, ScrollTrigger };
})();
