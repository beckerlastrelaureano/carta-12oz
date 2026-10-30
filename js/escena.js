/* =========================================================
   ESCENA.JS — el AMBIENTE de fondo de la carta
   Detrás de los textos y de las tarjetas de video va la foto del
   capítulo actual, muy desenfocada y oscura, como una cafetería de
   noche vista sin foco: manchas de luz cálida (bokeh), un poco de
   vapor sobre las bebidas calientes y motas de luz que flotan.
   La cámara viaja suave con el scroll y cambia de foto en cada capítulo.

   - El desenfoque se hace UNA vez por foto (en un lienzo chico),
     así el dibujo de cada cuadro es muy liviano.
   - Si el teléfono anda lento NO se apaga: baja la resolución,
     saca vapor y motas y, como último paso, dibuja a 30 cuadros.
     Solo se apaga si no hay WebGL o si las fotos no cargan.
   - Se pausa cuando la pestaña no se ve y cuando el cierre tapa todo;
     con una tarjeta de video en pantalla dibuja a la mitad de cuadros.
   - Con "reducir movimiento": queda quieta y solo cambia de foto.
   - Si el navegador pierde el WebGL (pasa en iPhone al cambiar de app),
     se ve el fondo fijo de css/escena.css hasta que vuelve.
   No hace falta editar este archivo.
   ========================================================= */

const perf = window.CARTA_PERF;
const estado = window.CARTA_ESTADO;
const carta = window.CARTA || { categorias: [] };
const canvas = document.getElementById('escena');
const vivo = perf.quieto ? 0 : 1;
const FOTO = location.search.includes('foto');   // solo para capturas de prueba: cámara sin suavizado
const LUZ = 0.42;                                  // cuánta luz tiene la foto de fondo (0 a 1)

const apagar = motivo => {
  console.warn('Escena apagada:', motivo);
  canvas.classList.remove('lista');
  dispatchEvent(new Event('escena:apagada'));
};

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

/* ---------- WebGL ---------- */
const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'default' })
  || canvas.getContext('experimental-webgl');

// Algunos teléfonos (iPhone viejos) no tienen "highp" en el fragment shader
const PRECISION = gl && (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT) || {}).precision > 0 ? 'highp' : 'mediump';
// con mediump el tiempo se reinicia más seguido para no perder precisión
const PERIODO = PRECISION === 'highp' ? 1000 : 120;

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
// detalle = 1: con vapor y motas de luz; 0: versión liviana para teléfonos lentos
const FRAG = detalle => `precision ${PRECISION} float;
  #define DETALLE ${detalle}
  #define CAPAS ${detalle ? 2 : 1}
  varying vec2 vUv;
  uniform sampler2D uA, uB;
  uniform vec4 uCamA, uCamB;      // xy = centro de la foto en pantalla, zw = parte visible
  uniform vec3 uVap;              // xy = punto del vapor en pantalla, z = fuerza
  uniform float uMix, uT, uAsp, uLuz;
  uniform vec2 uMira;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 tomar(sampler2D img, vec4 cam, vec2 uv){ return texture2D(img, clamp(cam.xy + (uv - .5) * cam.zw, .002, .998)).rgb; }
  #if DETALLE
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++){ v += a*n(p); p *= 2.03; a *= .5; } return v; }
  // Vapor suave que sube desde la taza (en coordenadas de pantalla)
  float vapor(vec2 uv){
    if (uVap.z <= 0.) return 0.;
    vec2 d = (uv - uVap.xy) * vec2(uAsp, 1.);
    float alto = d.y / .34;
    if (alto < 0. || alto > 1.) return 0.;
    float t = uT * .35;
    float x = d.x + (fbm(vec2(alto * 2. - t * .5, 3.1)) - .5) * .16 * alto;
    float forma = smoothstep(mix(.03, .12, alto), 0., abs(x));
    float hum = fbm(vec2(x * 14., alto * 3.5 - t * 1.2));
    return forma * smoothstep(0., .2, alto) * smoothstep(1., .3, alto) * smoothstep(.3, .75, hum) * uVap.z;
  }
  #endif
  void main(){
    // la foto se mueve apenas con el mouse / el dedo (lejos)
    vec2 uv = vUv + uMira * .012;
    vec3 a = tomar(uA, uCamA, uv), b = tomar(uB, uCamB, uv);
    // cambio de capítulo: las luces de la foto nueva llegan primero
    float k = smoothstep(0., 1., uMix * 1.6 - (1. - dot(b, vec3(.3, .59, .11))) * .6);
    vec3 foto = mix(a, b, k);
    float lum = dot(foto, vec3(.3, .59, .11));
    vec3 col = foto * uLuz * vec3(1.06, .97, .86);   // oscura y cálida

    // bokeh: discos de luz donde la foto es clara (se mueven más que la foto: están "cerca")
    vec2 base = vec2(vUv.x * uAsp, vUv.y);
    float claro = smoothstep(.16, .7, lum);
    for (int i = 0; i < CAPAS; i++){
      float fi = float(i);
      float esc = 3. + fi * 2.4;
      vec2 s = base * esc + vec2(uT * .010, uT * .016) * (1. + fi * .6) - uMira * (.3 + fi * .25);
      vec2 c = floor(s), f = fract(s) - .5;
      float r = h(c + fi * 13.7);
      float tam = mix(.16, .3, h(c + 8.1));
      // el disco entra entero en su celda (si no, se ve cortado con un borde recto)
      vec2 pos = (vec2(h(c + 1.7), h(c + 4.3)) - .5) * 2. * (.48 - tam);
      float d = length(f - pos);
      float disco = smoothstep(tam, tam * .86, d);
      float aro = smoothstep(tam * .5, tam * .92, d) * disco;
      float brillo = step(.48, r) * (.75 + .25 * sin(uT * (.25 + r * .5) + r * 40.));
      col += foto * (disco * .5 + aro * .45) * claro * brillo * (.6 - fi * .18);
    }

    #if DETALLE
    // motas de luz que flotan
    vec2 s = base * 11.;
    s.y -= uT * .05; s.x += sin(uT * .04 + s.y * .3) * .3;
    vec2 c = floor(s), f = fract(s) - .5;
    float r = h(c);
    vec2 pos = vec2(h(c + 3.1), h(c + 7.7)) - .5;
    float mota = smoothstep(.06, 0., length(f - pos * .7)) * step(.88, r) * (.5 + .5 * sin(uT * (1. + r * 2.) + r * 40.));
    col += vec3(1., .8, .55) * mota * .1;
    col += vec3(1., .95, .88) * vapor(uv) * .09;
    #endif

    // viñeta y un poco de ruido para que los oscuros no se vean "en escalones"
    vec2 v = vUv - .5;
    col *= 1. - dot(v * vec2(min(uAsp, 1.6), 1.), v) * 1.1;
    col += (h(gl_FragCoord.xy + fract(uT * 7.)) - .5) / 128.;
    gl_FragColor = vec4(col, 1.);
  }`;

const NOMBRES = ['uA', 'uB', 'uCamA', 'uCamB', 'uVap', 'uMix', 'uT', 'uAsp', 'uLuz', 'uMira'];
let programas = {}, prog = null, perdido = false;

function compilar(detalle) {
  const sh = (tipo, src) => {
    const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG(detalle)));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  NOMBRES.forEach(n => (u[n] = gl.getUniformLocation(p, n)));
  gl.useProgram(p);
  gl.uniform1i(u.uA, 0); gl.uniform1i(u.uB, 1);
  return { p, u };
}
function usar(detalle) {
  if (!programas[detalle]) programas[detalle] = compilar(detalle);
  prog = programas[detalle];
  gl.useProgram(prog.p);
}
// Arma todo lo de WebGL (al empezar y cuando el navegador devuelve el contexto)
function prepararGL() {
  programas = {};
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  usar(calidad.detalle);
  medir(true);
}

/* ---------- Fotos desenfocadas ----------
   Se usa la foto chica (540 px): se achica a ~180 px y se desenfoca con
   3 pasadas de "caja" (queda igual que un desenfoque gaussiano).
   El resultado se guarda en un lienzo para poder rearmar la textura. */
const lim = (v, a, b) => Math.min(b, Math.max(a, v));
function caja(a, b, w, h, r, horizontal) {
  const n = horizontal ? w : h, filas = horizontal ? h : w;
  const paso = horizontal ? 4 : w * 4, salto = horizontal ? w * 4 : 4, div = 2 * r + 1;
  for (let j = 0; j < filas; j++) {
    const o = j * salto;
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[o + lim(i, 0, n - 1) * paso + c];
      for (let i = 0; i < n; i++) {
        b[o + i * paso + c] = s / div;
        s += a[o + Math.min(i + r + 1, n - 1) * paso + c] - a[o + Math.max(i - r, 0) * paso + c];
      }
    }
  }
}
function desenfocar(img) {
  const L = 180, asp = img.width / img.height;
  const w = asp >= 1 ? L : Math.round(L * asp), h = asp >= 1 ? Math.round(L / asp) : L;
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const x = lienzo.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, w, h);
  const datos = x.getImageData(0, 0, w, h);
  const a = datos.data, b = new Uint8ClampedArray(a);
  const r = Math.max(2, Math.round(Math.max(w, h) * .026));
  for (let k = 0; k < 3; k++) { caja(a, b, w, h, r, true); caja(b, a, w, h, r, false); }
  x.putImageData(datos, 0, 0);
  return lienzo;
}
// Texturas NPOT: compatibles con WebGL1/iPhone usando CLAMP + LINEAR y sin mipmaps
function textura(lienzo) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, lienzo);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const cache = {}, listas = {};
const cargarImg = src => new Promise((ok, mal) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = mal; i.src = src; });
function foto(id) {
  if (!cache[id]) cache[id] = cargarImg(`img/platos/${id}-chica.jpg`).then(img => {
    const lienzo = desenfocar(img);
    listas[id] = { lienzo, tex: perdido ? null : textura(lienzo), asp: img.width / img.height, ...(PUNTOS[id] || PUNTOS.portada) };
    sucio = true;
    return listas[id];
  }).catch(err => { delete cache[id]; throw err; });   // si falla, se vuelve a intentar más tarde
  return cache[id];
}

// Estaciones del viaje: la portada y un plato por capítulo
let ancho = 0, altoPx = 0;
const escritorio = () => ancho >= 960;
const portadaId = () => (ancho / Math.max(1, altoPx) > 1.1 ? 'barra' : 'portada');
const estaciones = () => [portadaId(), ...(carta.categorias || []).map(c => c.foto || 'portada')];

/* ---------- Calidad ----------
   Escalones: si va lento se pasa al siguiente. Nunca se apaga.
   dpr = resolución interna (el fondo está desenfocado, así que con menos alcanza). */
const dprBase = Math.min(devicePixelRatio || 1, perf.nivel === 'alto' ? 1 : .85);
const ESCALONES = [
  { dpr: dprBase, detalle: 1, cada: 1 },
  { dpr: Math.min(dprBase, .75), detalle: 1, cada: 1 },
  { dpr: .6, detalle: 0, cada: 1 },          // sin vapor ni motas
  { dpr: .5, detalle: 0, cada: 2 }           // último: dibuja un cuadro sí y uno no (~30 por segundo)
];
let escalon = 0;
const calidad = ESCALONES[0];

/* ---------- Tamaño ---------- */
let sucio = true;   // hay que volver a dibujar (para el modo quieto)
function medir(forzar) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  ancho = w; altoPx = h;
  const W = Math.max(1, Math.round(w * calidad.dpr)), H = Math.max(1, Math.round(h * calidad.dpr));
  if (forzar || canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
  sucio = true;
}

/* ---------- Cámara ----------
   Para cada foto se calcula qué parte se ve y dónde queda el plato en pantalla. */
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
// Dónde queda el plato: en la portada a la derecha del titular (compu) o arriba (celular);
// en los capítulos a la izquierda (compu) o arriba del título (celular).
function encuadre(t) {
  const kp = suavizar(lim(t, 0, 1));
  if (escritorio()) {
    const kc = suavizar(lim((t - 1) / .85, 0, 1));
    return t < 1
      ? { x: mezclar(.5, .68, kp), y: mezclar(.4, .44, kp), z: mezclar(1.0, 1.12, kp) }
      : { x: mezclar(.68, .3, kc), y: mezclar(.44, .56, kc), z: mezclar(1.12, 1.16, kc) };
  }
  const km = suavizar(lim((t - .3) / .62, 0, 1));
  return { x: .5, y: mezclar(.42, .62, km), z: t < 1 ? mezclar(1.0, 1.2, km) : mezclar(1.2, 1.1, suavizar(lim(t - 1, 0, 1))) };
}
// punto de la foto -> posición en pantalla (0 a 1, y hacia arriba)
const aPantalla = (cam, x, y) => [(x - cam[0]) / cam[2] + .5, (1 - y - cam[1]) / cam[3] + .5];

/* ---------- Mouse, dedo e inclinación ---------- */
const mira = { x: 0, y: 0, ox: 0, oy: 0, empuje: 0 };
let tocado = 0, arr = null;
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mira.ox = e.clientX / innerWidth * 2 - 1; mira.oy = e.clientY / innerHeight * 2 - 1; tocado = performance.now();
}, { passive: true });
const zonaLibre = e => !e.target.closest('.cap-lista, .barra, .ficha, .cierre, a, button, video');
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

/* ---------- Tarjetas de video ----------
   Mientras un video se reproduce y ocupa buena parte de la pantalla, el fondo
   se dibuja a la mitad de cuadros: así el teléfono le deja la fuerza al video. */
let videoRevisado = 0, videoActivo = false;
function hayVideo(ahora) {
  if (ahora - videoRevisado < 400) return videoActivo;
  videoRevisado = ahora;
  const area = innerWidth * innerHeight;
  videoActivo = Array.prototype.some.call(document.getElementsByTagName('video'), v => {
    if (v.paused || v.ended) return false;
    const r = v.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0), h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 && w * h > area * .2;
  });
  return videoActivo;
}

/* ---------- Animación ---------- */
let tS = 0, primera = true, impar = false;
const inicio = performance.now();
let camA = [0, 0, 1, 1], camB = [0, 0, 1, 1];
function cuadro(ahora) {
  const r = (ahora - inicio) / 1000;
  const dt = Math.min(.05, (ahora - (cuadro.ult || ahora)) / 1000); cuadro.ult = ahora;

  const objetivo = perf.quieto ? Math.round(estado.t) : estado.t;
  const antes = tS;
  tS = primera || perf.quieto || FOTO ? objetivo : tS + (objetivo - tS) * Math.min(1, dt * 5);
  primera = false;
  if (Math.abs(tS - antes) > 1e-4) sucio = true;
  if (estado.fin >= .999 || perdido) return;   // el cierre tapa todo
  // modo quieto: solo se dibuja si algo cambió
  if (!vivo && !sucio) return;
  // último escalón de calidad o video en pantalla: un cuadro sí y uno no
  impar = !impar;
  if ((calidad.cada === 2 || hayVideo(ahora)) && impar) return;

  const est = estaciones();
  const N = est.length - 1;
  // estación de origen y destino del tramo (la 0 es la portada)
  let ia = 0, ib = 0, k = 0;
  if (tS >= 1 && N > 0) {
    const s = lim(tS - 1, 0, N);
    ia = Math.min(Math.floor(s), N - 1); ib = ia + 1;
    k = suavizar(lim(s - ia, 0, 1));
  }
  const fa = listas[est[ia]], fb = (listas[est[ib]] && listas[est[ib]].tex) ? listas[est[ib]] : fa;
  // se piden las fotos de este tramo y las siguientes
  [ia, ib, Math.min(ib + 1, N)].forEach(j => foto(est[j]).catch(() => {}));
  if (!fa || !fa.tex) return;

  // Quieto un rato: el fondo "respira" solo
  if (vivo && ahora - tocado > 2500) { mira.ox = Math.sin(r * .35) * .5; mira.oy = Math.cos(r * .27) * .3; }
  mira.x += (mira.ox - mira.x) * .06;
  mira.y += (mira.oy - mira.y) * .06;
  if (estado.pulso) { mira.empuje = 1; estado.pulso = 0; }
  mira.empuje *= Math.pow(.05, dt);

  const e = encuadre(tS);
  const arco = Math.sin(Math.PI * k) * (tS >= 1 ? 1 : 0);
  const respiro = 1 + Math.sin(r * .23) * .015 * vivo + mira.empuje * .03;
  // el tramo viejo empuja hacia adelante; el nuevo llega desde un poco más cerca
  camA = camara(fa, e.x, e.y + arco * .04, e.z * respiro * (1 + k * .45));
  camB = camara(fb, e.x, e.y + arco * .04, e.z * respiro * (1.2 - k * .2));
  const mezcla = fb === fa ? 0 : k;

  // vapor: se desvanece en el cambio de foto
  let vap = [0, 0, 0];
  const fv = mezcla > .5 ? fb : fa, cv = mezcla > .5 ? camB : camA;
  if (fv.vapor && vivo) vap = [...aPantalla(cv, fv.vapor[0], fv.vapor[1]), fv.fuerza * Math.abs(mezcla - .5) * 2];

  const u = prog.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fa.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fb.tex);
  gl.uniform4fv(u.uCamA, camA); gl.uniform4fv(u.uCamB, camB);
  gl.uniform3fv(u.uVap, vap);
  gl.uniform1f(u.uMix, mezcla);
  gl.uniform1f(u.uT, r % PERIODO);
  gl.uniform1f(u.uAsp, ancho / altoPx);
  gl.uniform1f(u.uLuz, LUZ);
  gl.uniform2f(u.uMira, mira.x * vivo, -mira.y * vivo);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  sucio = false;
}

/* ---------- Control de fluidez ----------
   Mide los cuadros por segundo de a tandas. Si va lento, baja un escalón.
   No apaga nunca la escena por lentitud. */
const medicion = { cuadros: 0, suma: 0, espera: 90, fps: 0, lentas: 0 };
function controlarFluidez(ms) {
  if (escalon >= ESCALONES.length - 1 || !vivo) return;
  if (ms > 250) return;                         // volvió de otra pestaña: no cuenta
  if (medicion.espera > 0) { medicion.espera--; return; }
  medicion.cuadros++; medicion.suma += ms;
  if (medicion.cuadros < 60) return;
  const fps = medicion.fps = 1000 * medicion.cuadros / medicion.suma;
  medicion.cuadros = 0; medicion.suma = 0;
  // hacen falta dos tandas lentas seguidas (un tirón suelto al cargar no cuenta)
  if (fps >= 42) { medicion.lentas = 0; return; }
  if (++medicion.lentas < 2) return;
  medicion.lentas = 0;
  escalon++;
  Object.assign(calidad, ESCALONES[escalon]);
  if (perf.nivel === 'alto') perf.bajar();      // pasa a "medio", nunca a "bajo"
  if (!perdido) { usar(calidad.detalle); medir(true); }
  medicion.espera = 30;
  console.info(`Escena: ${Math.round(fps)} fps, bajo a calidad ${escalon} (dpr ${calidad.dpr})`);
}

/* ---------- Pérdida de WebGL (iPhone al cambiar de app, poca memoria) ---------- */
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();                           // pide que el navegador lo devuelva
  perdido = true;
  canvas.classList.remove('lista');             // se ve el fondo fijo de css/escena.css
  detener();
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  try {
    perdido = false;
    prepararGL();
    Object.values(listas).forEach(f => (f.tex = textura(f.lienzo)));
    canvas.classList.add('lista');
    arrancar();
  } catch (err) { apagar(err); }
}, false);

/* ---------- Arranque ---------- */
let andando = false, ultimo = 0;
function bucle(t) {
  if (!andando) return;
  if (ultimo) controlarFluidez(t - ultimo);
  ultimo = t;
  cuadro(t);
  requestAnimationFrame(bucle);
}
function arrancar() { if (!andando && !perdido && !document.hidden) { andando = true; ultimo = 0; requestAnimationFrame(bucle); } }
function detener() { andando = false; }
document.addEventListener('visibilitychange', () => (document.hidden ? detener() : arrancar()));
addEventListener('resize', () => medir());

if (!gl) {
  apagar('sin WebGL');
} else {
  try {
    prepararGL();
    // Primero la foto de la portada; las demás se bajan de a una cuando el teléfono está libre
    foto(portadaId()).then(() => {
      cuadro(performance.now());
      arrancar();
      requestAnimationFrame(() => {
        canvas.classList.add('lista');
        dispatchEvent(new Event('escena:lista'));
      });
      const resto = () => estaciones().forEach((id, j) => setTimeout(() => foto(id), j * 250));
      // Safari no tiene requestIdleCallback: ahí se espera un poco y listo
      ('requestIdleCallback' in window) ? requestIdleCallback(resto, { timeout: 2500 }) : setTimeout(resto, 1200);
    }).catch(err => apagar(err));
  } catch (err) {
    apagar(err);
  }
}

// Para revisar desde la consola del navegador (no afecta a la carta)
window.CARTA_ESCENA = {
  get tS() { return tS; },
  get escalon() { return escalon; },
  get fps() { return Math.round(medicion.fps); },
  get dpr() { return calidad.dpr; },
  listas
};
