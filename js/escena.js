/* =========================================================
   ESCENA.JS — la "toma única" de la carta, con fotos reales
   Cada capítulo tiene la foto de su plato (img/platos/) y un mapa
   de profundidad (*-prof.jpg: blanco = cerca, negro = lejos).
   Con eso la foto se mueve como 3D y la cámara viaja con el scroll:
     portada   -> baja hacia la taza y se acerca
     capítulos -> empuja hacia adelante y el plato nuevo aparece
                  de adelante hacia atrás
   Encima: vapor animado en las bebidas calientes, partículas de luz,
   viñeta y grano de película.

   - Se dibuja solo mientras se ve (se pausa en el cierre).
   - Si el teléfono anda lento, se simplifica o se apaga solo.
   - Con "reducir movimiento": queda quieta y salta de foto en foto.
   No hace falta editar este archivo.
   ========================================================= */

const perf = window.CARTA_PERF;
const estado = window.CARTA_ESTADO;
const carta = window.CARTA || { categorias: [] };
const canvas = document.getElementById('escena');
const vivo = perf.quieto ? 0 : 1;
const FOTO = location.search.includes('foto');   // solo para capturas de prueba: cámara sin suavizado

const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
if (!gl) throw new Error('Sin WebGL');

/* ---------- Dónde está el plato y de dónde sale el vapor en cada foto ----------
   Coordenadas de la foto: x de izquierda a derecha, y de arriba hacia abajo (0 a 1). */
const PUNTOS = {
  portada:    { foco: [.44, .62], vapor: [.44, .53], fuerza: 1 },
  barra:      { foco: [.52, .62], vapor: [.51, .48], fuerza: 1 },
  cafe:       { foco: [.40, .64], vapor: [.38, .60], fuerza: .8 },
  especiales: { foco: [.47, .60], vapor: [.47, .44], fuerza: .7 },
  frios:      { foco: [.42, .60], vapor: null },
  pasteleria: { foco: [.45, .66], vapor: null },
  salado:     { foco: [.50, .68], vapor: [.52, .60], fuerza: .35 },
  combos:     { foco: [.45, .66], vapor: [.27, .52], fuerza: .45 }
};

/* ---------- Shader ---------- */
const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
  varying vec2 vUv;
  uniform sampler2D uA, uDA, uB, uDB;
  uniform vec4 uCamA, uCamB;      // xy = centro de la foto en pantalla, zw = parte visible
  uniform vec3 uVapA, uVapB;      // xy = punto del vapor, z = fuerza
  uniform float uMix, uT, uAsp, uVivo;
  uniform vec2 uMira;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a*n(p); p *= 2.03; a *= .5; } return v; }

  // Vapor que sube desde la taza, pegado a la foto (se mueve con la profundidad)
  float vapor(vec2 q, vec3 v){
    if (v.z <= 0.) return 0.;
    vec2 d = q - v.xy;
    float alto = d.y / .26;
    if (alto < 0. || alto > 1.) return 0.;
    float t = uT * .5;
    float x = d.x + (fbm(vec2(alto * 2.4 - t * .6, v.x * 9.)) - .5) * .11 * alto;
    float ancho = mix(.018, .075, alto);
    float forma = smoothstep(ancho, 0., abs(x));
    float hum = fbm(vec2(x * 26. + v.x * 7., alto * 4.5 - t * 1.6));
    return forma * smoothstep(0., .18, alto) * smoothstep(1., .35, alto) * smoothstep(.35, .8, hum) * v.z;
  }
  vec3 tomar(sampler2D img, sampler2D prof, vec4 cam, vec3 vap, out float d){
    vec2 base = cam.xy + (vUv - .5) * cam.zw;
    d = texture2D(prof, base).r;
    vec2 corr = uMira * .02 * cam.zw;
    vec2 q = base + corr * (d - .45);
    d = texture2D(prof, q).r;
    q = base + corr * (d - .45);
    q = clamp(q, .001, .999);
    vec3 c = texture2D(img, q).rgb;
    c += vec3(1., .96, .9) * vapor(q, vap) * .38 * uVivo;
    return c;
  }
  void main(){
    float dA, dB;
    vec3 a = tomar(uA, uDA, uCamA, uVapA, dA);
    vec3 b = tomar(uB, uDB, uCamB, uVapB, dB);
    // el plato nuevo aparece de adelante hacia atrás
    float m = smoothstep(0., 1., uMix * 1.7 - (1. - dB) * .7);
    vec3 col = mix(a, b, m);
    // partículas de luz que flotan delante de la cámara
    vec2 s = vec2(vUv.x * uAsp, vUv.y) * 9.;
    s.y -= uT * .12; s.x += sin(uT * .05 + s.y * .3) * .4;
    vec2 cel = floor(s), f = fract(s) - .5;
    float r = h(cel);
    vec2 pos = vec2(h(cel + 3.1), h(cel + 7.7)) - .5;
    float mota = smoothstep(.09, 0., length(f - pos * .7)) * step(.82, r) * (.5 + .5 * sin(uT * (1. + r * 2.) + r * 40.));
    col += vec3(1., .78, .5) * mota * .22 * uVivo;
    // viñeta y grano de película
    vec2 v = vUv - .5;
    col *= 1. - dot(v * vec2(uAsp, 1.) / max(uAsp, 1.), v) * .9;
    col += (h(vUv * 911. + fract(uT)) - .5) * .03;
    gl_FragColor = vec4(col, 1.);
  }`;

const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = n => gl.getUniformLocation(prog, n);
const u = { A: U('uA'), DA: U('uDA'), B: U('uB'), DB: U('uDB'), camA: U('uCamA'), camB: U('uCamB'), vapA: U('uVapA'), vapB: U('uVapB'),
  mix: U('uMix'), t: U('uT'), asp: U('uAsp'), vivo: U('uVivo'), mira: U('uMira') };
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.uniform1i(u.A, 0); gl.uniform1i(u.DA, 1); gl.uniform1i(u.B, 2); gl.uniform1i(u.DB, 3);
gl.uniform1f(u.vivo, vivo);

/* ---------- Fotos ---------- */
const alto = perf.nivel === 'alto';
const grande = alto && (innerWidth >= 960 || devicePixelRatio > 2.5);
const cache = {};
const cargarImg = src => new Promise((ok, mal) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = mal; i.src = src; });
function textura(img) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const listas = {};
function foto(id) {
  if (!cache[id]) cache[id] = Promise.all([
    cargarImg(`img/platos/${id}${grande || id === 'barra' ? '' : '-chica'}.jpg`), cargarImg(`img/platos/${id}-prof.jpg`)
  ]).then(([img, prof]) => (listas[id] = { img: textura(img), prof: textura(prof), asp: img.width / img.height, ...(PUNTOS[id] || PUNTOS.portada) }));
  return cache[id];
}

// Estaciones del viaje: la portada y un plato por capítulo
let ancho = 0, altoPx = 0;
const escritorio = () => ancho >= 960;
const portadaId = () => (ancho / Math.max(1, altoPx) > 1.1 ? 'barra' : 'portada');
const estaciones = () => [portadaId(), ...(carta.categorias || []).map(c => c.foto || 'portada')];

/* ---------- Tamaño ---------- */
let dpr = Math.min(devicePixelRatio || 1, alto ? 1.5 : 1.25);
function medir() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  ancho = w; altoPx = h;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
}
medir();
addEventListener('resize', medir);

/* ---------- Cámara ----------
   Para cada foto se calcula qué parte se ve y dónde queda el plato en pantalla. */
const lim = (v, a, b) => Math.min(b, Math.max(a, v));
const suavizar = k => k * k * k * (k * (k * 6 - 15) + 10);   // arranca y frena suave
const mezclar = (a, b, k) => a + (b - a) * k;
function camara(f, pantallaX, pantallaY, zoom) {
  const R = ancho / altoPx, I = f.asp;
  const kx = (R > I ? 1 : R / I) / zoom, ky = (R > I ? I / R : 1) / zoom;
  const fx = f.foco[0], fy = 1 - f.foco[1];
  const cx = lim(fx - (pantallaX - .5) * kx, kx / 2, 1 - kx / 2);
  const cy = lim(fy - (pantallaY - .5) * ky, ky / 2, 1 - ky / 2);
  return [cx, cy, kx, ky];
}
// Dónde va el plato: en la portada a la derecha del titular (compu) o arriba (celular);
// en los capítulos a la izquierda de la lista (compu) o arriba del título (celular).
function encuadre(t) {
  const kp = suavizar(lim(t, 0, 1));
  if (escritorio()) {
    const kc = suavizar(lim((t - 1) / .85, 0, 1));
    return t < 1
      ? { x: mezclar(.5, .68, kp), y: mezclar(.4, .44, kp), z: mezclar(1.0, 1.12, kp) }
      : { x: mezclar(.68, .3, kc), y: mezclar(.44, .56, kc), z: mezclar(1.12, 1.16, kc) };
  }
  const km = suavizar(lim((t - .3) / .62, 0, 1));
  // la taza sube y se acerca antes del titular, para que el texto quede debajo
  const zp = mezclar(1.0, 1.42, km);
  return { x: .5, y: mezclar(.42, .74, km), z: t < 1 ? zp : mezclar(1.42, 1.18, suavizar(lim(t - 1, 0, 1))) };
}

/* ---------- Mouse, dedo e inclinación ---------- */
const mira = { x: 0, y: 0, ox: 0, oy: 0, empuje: 0 };
let tocado = 0, arr = null;
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mira.ox = e.clientX / innerWidth * 2 - 1; mira.oy = e.clientY / innerHeight * 2 - 1; tocado = performance.now();
}, { passive: true });
const zonaLibre = e => !e.target.closest('.cap-lista, .barra, .ficha, .cierre, a, button');
addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && zonaLibre(e)) arr = { x: e.clientX, y: e.clientY }; }, { passive: true });
addEventListener('pointermove', e => {
  if (!arr) return;
  mira.ox = lim((e.clientX - arr.x) / 110, -1.4, 1.4);
  mira.oy = lim((e.clientY - arr.y) / 220, -1, 1);
  tocado = performance.now();
}, { passive: true });
addEventListener('pointerup', () => { arr = null; });
addEventListener('pointercancel', () => { arr = null; });
addEventListener('deviceorientation', e => {
  if (e.gamma == null || arr) return;
  mira.ox = lim(e.gamma / 25, -1, 1); mira.oy = lim((e.beta - 45) / 30, -1, 1); tocado = performance.now();
}, { passive: true });

/* ---------- Animación ---------- */
let tS = 0, primera = true, inicio = performance.now();
const camA = [0, 0, 1, 1], camB = [0, 0, 1, 1];
function cuadro(ahora) {
  const r = (ahora - inicio) / 1000;
  const dt = Math.min(.05, (ahora - (cuadro.ult || ahora)) / 1000); cuadro.ult = ahora;

  const objetivo = perf.quieto ? Math.round(estado.t) : estado.t;
  tS = primera || perf.quieto || FOTO ? objetivo : tS + (objetivo - tS) * Math.min(1, dt * 5);
  primera = false;
  if (estado.fin >= .999) return;   // el cierre tapa todo

  const est = estaciones();
  const N = est.length - 1;
  // estación de origen y destino del tramo (la 0 es la portada)
  let ia = 0, ib = 0, k = 0;
  if (tS >= 1 && N > 0) {
    const s = lim(tS - 1, 0, N);
    ia = Math.min(Math.floor(s), N - 1); ib = ia + 1;
    k = suavizar(lim(s - ia, 0, 1));
  }
  const fa = listas[est[ia]], fb = listas[est[ib]] || fa;
  // se piden las fotos de este tramo y las siguientes
  [ia, ib, Math.min(ib + 1, N)].forEach(j => foto(est[j]));
  if (!fa) return;

  // Quieto un rato: el plato "respira" solo
  if (vivo && ahora - tocado > 2500) { mira.ox = Math.sin(r * .35) * .5; mira.oy = Math.cos(r * .27) * .3; }
  mira.x += (mira.ox - mira.x) * .06;
  mira.y += (mira.oy - mira.y) * .06;
  if (estado.pulso) { mira.empuje = 1; estado.pulso = 0; }
  mira.empuje *= Math.pow(.05, dt);

  const e = encuadre(tS);
  const arco = Math.sin(Math.PI * k) * (tS >= 1 ? 1 : 0);
  const respiro = 1 + Math.sin(r * .23) * .01 * vivo + mira.empuje * .04;
  // el tramo viejo empuja hacia adelante; el nuevo llega desde un poco más cerca
  camA.splice(0, 4, ...camara(fa, e.x, e.y + arco * .04, e.z * respiro * (1 + k * .5)));
  camB.splice(0, 4, ...camara(fb, e.x, e.y + arco * .04, e.z * respiro * (1.22 - k * .22)));
  const mezcla = fb === fa ? 0 : k;

  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fa.img);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fa.prof);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fb.img);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, fb.prof);
  gl.uniform4fv(u.camA, camA); gl.uniform4fv(u.camB, camB);
  const vap = f => (f.vapor ? [f.vapor[0], 1 - f.vapor[1], f.fuerza] : [0, 0, 0]);
  gl.uniform3fv(u.vapA, vap(fa)); gl.uniform3fv(u.vapB, vap(fb));
  gl.uniform1f(u.mix, mezcla);
  gl.uniform1f(u.t, r);
  gl.uniform1f(u.asp, ancho / altoPx);
  gl.uniform2f(u.mira, mira.x * vivo, -mira.y * vivo);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  controlarFluidez(dt);
}

/* ---------- Control de fluidez ---------- */
let cuadros = 0, suma = 0, revisado = false, apagado = false;
function controlarFluidez(dt) {
  if (revisado) return;
  cuadros++;
  if (cuadros < 40) return;
  suma += dt;
  if (cuadros < 160) return;
  revisado = true;
  const fps = 120 / suma;
  if (fps < 20) {
    apagado = true;
    detener();
    perf.bajar(); perf.bajar();
    canvas.classList.remove('lista');
    dispatchEvent(new Event('escena:apagada'));
  } else if (fps < 40) {
    perf.bajar();
    dpr = 1; medir();
  }
}

/* ---------- Arranque ---------- */
let andando = false;
function bucle(t) { if (!andando) return; cuadro(t); requestAnimationFrame(bucle); }
function arrancar() { if (!andando && !apagado && !document.hidden) { andando = true; requestAnimationFrame(bucle); } }
function detener() { andando = false; }
document.addEventListener('visibilitychange', () => (document.hidden ? detener() : arrancar()));

// Primero la foto de la portada; las demás se bajan de a una cuando el teléfono está libre
foto(portadaId()).then(() => {
  cuadro(performance.now());
  arrancar();
  requestAnimationFrame(() => {
    canvas.classList.add('lista');
    dispatchEvent(new Event('escena:lista'));
  });
  const resto = () => estaciones().forEach((id, j) => setTimeout(() => foto(id), j * 250));
  ('requestIdleCallback' in window) ? requestIdleCallback(resto) : setTimeout(resto, 1200);
}).catch(() => dispatchEvent(new Event('escena:apagada')));

// Para revisar desde la consola del navegador (no afecta a la carta)
window.CARTA_ESCENA = { get tS() { return tS; }, listas };
