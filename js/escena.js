/* =========================================================
   ESCENA.JS — la "toma única" 3D de la carta (Three.js)
   Una barra larga de madera oscura con un plato por capítulo.
   La cámara viaja sin cortes guiada por el scroll:
     portada   -> taza de 12 oz con latte art, vapor y granos flotando
     capítulos -> espresso, especial, frío, pastelería, salado,
                  combo y bebidas (según "escena" en data/carta.json)
   Todo es geometría propia (sin modelos descargados).

   - Se dibuja solo mientras se ve (se pausa en el cierre).
   - Si el teléfono anda lento, se simplifica o se apaga solo.
   - Con "reducir movimiento": la escena queda quieta y la cámara
     salta de plato en plato; solo gira si la arrastrás con el dedo.
   No hace falta editar este archivo.
   ========================================================= */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

const perf = window.CARTA_PERF;
const estado = window.CARTA_ESTADO;
const carta = window.CARTA || { categorias: [] };
const canvas = document.getElementById('escena');
let alto = perf.nivel === 'alto';
const vivo = perf.quieto ? 0 : 1;
const FOTO = location.search.includes('foto');   // solo para capturas de prueba: cámara sin suavizado

const COLOR_FONDO = 0x14110e;
const SEP = 7;   // distancia entre platos sobre la barra

/* ---------- Renderizador, escena y cámara ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: alto, powerPreference: 'high-performance' });
let dprMax = alto ? 1.75 : 1.25;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprMax));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;
renderer.setClearColor(COLOR_FONDO, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLOR_FONDO, 9, 27);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

scene.add(new THREE.HemisphereLight(0xffe2c2, 0x1a120c, 0.7));
const luzClave = new THREE.DirectionalLight(0xffd7ab, 1.7);
luzClave.position.set(4, 7, 5);
scene.add(luzClave);
const luzBorde = new THREE.DirectionalLight(0xffc285, 2.4);
luzBorde.position.set(-5, 3.5, -6);
scene.add(luzBorde);
// "Foco" cálido que sigue al plato del momento: arma un círculo de luz sobre la barra
const foco = new THREE.SpotLight(0xffd2a0, 95, 16, 0.55, 1, 1.4);
scene.add(foco, foco.target);

/* ---------- Texturas dibujadas a mano (canvas) ---------- */
function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h || w;
  dibujar(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const azar = (a, b) => a + Math.random() * (b - a);

// Latte art: rosetta sobre café con leche
const texLatte = lienzo(512, 512, (g, w) => {
  const c = w / 2;
  const gr = g.createRadialGradient(c, c, 0, c, c, c);
  gr.addColorStop(0, '#a46a3c'); gr.addColorStop(.55, '#8c552e'); gr.addColorStop(.88, '#6a3d1f'); gr.addColorStop(1, '#4a2914');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
  g.filter = 'blur(2px)';
  g.strokeStyle = '#f3e6cf'; g.lineCap = 'round';
  // hojas de la rosetta (curvas en "U" apiladas)
  for (let k = 0; k < 9; k++) {
    const y = 360 - k * 27, ancho = 150 - k * 13, alto2 = 34 - k * 1.6;
    g.lineWidth = 15 - k * .9;
    g.beginPath();
    g.moveTo(c - ancho, y - alto2);
    g.quadraticCurveTo(c, y + alto2 * 1.25, c + ancho, y - alto2);
    g.stroke();
  }
  // corazón de arriba
  g.fillStyle = '#f3e6cf';
  g.beginPath(); g.ellipse(c, 112, 40, 30, 0, 0, Math.PI * 2); g.fill();
  // el corte que atraviesa la rosetta
  g.strokeStyle = '#8c552e'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(c, 88); g.lineTo(c, 420); g.stroke();
  // borde de espuma
  g.strokeStyle = 'rgba(243,230,207,.45)'; g.lineWidth = 12;
  g.beginPath(); g.arc(c, c, 236, 0, Math.PI * 2); g.stroke();
});

// Crema del espresso
const texCrema = lienzo(256, 256, (g, w) => {
  const c = w / 2;
  const gr = g.createRadialGradient(c * .9, c * .9, 0, c, c, c);
  gr.addColorStop(0, '#d29457'); gr.addColorStop(.5, '#a8662f'); gr.addColorStop(.85, '#6e3a18'); gr.addColorStop(1, '#3f200d');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < .5 ? 'rgba(255,220,170,.10)' : 'rgba(40,18,6,.12)';
    g.beginPath(); g.arc(Math.random() * w, Math.random() * w, Math.random() * 2.2, 0, 7); g.fill();
  }
});

// Veta de madera de la barra
const texMadera = lienzo(1024, 256, (g, w, h) => {
  g.fillStyle = '#2a1e16'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * h;
    g.strokeStyle = `rgba(${Math.random() < .5 ? '70,48,32' : '18,12,8'},${azar(.15, .45)})`;
    g.lineWidth = azar(.6, 2.6);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * .006 + i) * azar(1, 5));
    g.stroke();
  }
});
texMadera.wrapS = texMadera.wrapT = THREE.RepeatWrapping;
texMadera.repeat.set(14, 5);

// Marcas de plancha del tostado
const texTostado = lienzo(256, 256, (g, w) => {
  g.fillStyle = '#c98943'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() < .5 ? 'rgba(120,64,24,.12)' : 'rgba(255,230,180,.1)';
    g.fillRect(Math.random() * w, Math.random() * w, 2, 2);
  }
  g.filter = 'blur(4px)';
  g.strokeStyle = 'rgba(92,46,16,.75)'; g.lineWidth = 12;
  for (let x = -w; x < w * 2; x += 46) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, w); g.stroke(); }
});
texTostado.wrapS = texTostado.wrapT = THREE.RepeatWrapping;

// Rodaja de cítrico (naranja o limón)
const rodaja = (piel, pulpa) => lienzo(256, 256, (g, w) => {
  const c = w / 2;
  g.fillStyle = piel; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
  g.fillStyle = '#fbf3df'; g.beginPath(); g.arc(c, c, c * .9, 0, 7); g.fill();
  g.fillStyle = pulpa;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    g.beginPath(); g.moveTo(c + Math.cos(a + .04) * 8, c + Math.sin(a + .04) * 8);
    g.arc(c, c, c * .84, a + .05, a + Math.PI * 2 / 10 - .05);
    g.closePath(); g.fill();
  }
});
const texNaranja = rodaja('#e8781a', '#f59a2c');
const texLimon = rodaja('#e5c93a', '#f2e27a');

// Sombra de contacto (mancha suave debajo de cada plato)
const texSombra = lienzo(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
// Puntito suave para partículas
const texPunto = lienzo(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

/* ---------- Materiales ---------- */
const fisico = o => alto ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(
  Object.fromEntries(Object.entries(o).filter(([k]) => !/^(clearcoat|ior|sheen|transmission|thickness)/.test(k))));
const M = {
  ceramica: fisico({ color: 0xf1eadf, roughness: .3, clearcoat: 1, clearcoatRoughness: .14 }),
  esmalte: fisico({ color: 0xa8652f, roughness: .26, clearcoat: 1, clearcoatRoughness: .1 }),
  vidrio: fisico({ color: 0xffffff, roughness: .05, metalness: 0, transparent: true, opacity: .12, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
  hielo: fisico({ color: 0xeef7fb, roughness: .12, transparent: true, opacity: .55, clearcoat: 1, depthWrite: false }),
  gota: fisico({ color: 0xffffff, roughness: 0, transparent: true, opacity: .55, clearcoat: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xd9d2c7, metalness: 1, roughness: .22 }),
  latte: new THREE.MeshStandardMaterial({ map: texLatte, roughness: .45 }),
  crema: new THREE.MeshStandardMaterial({ map: texCrema, roughness: .35 }),
  grano: fisico({ color: 0x3a2214, roughness: .38, clearcoat: .6, clearcoatRoughness: .3 }),
  liquido: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35 }),
  masa: fisico({ vertexColors: true, roughness: .55, clearcoat: .35, clearcoatRoughness: .4 }),
  canela: new THREE.MeshStandardMaterial({ color: 0x7b4422, roughness: .85 }),
  caramelo: fisico({ color: 0xc27a35, roughness: .15, clearcoat: 1 }),
  sorbete: new THREE.MeshStandardMaterial({ color: 0xe8dcc5, roughness: .7 }),
  madera: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: .7 }),
  bandeja: new THREE.MeshStandardMaterial({ color: 0xe6ddcf, roughness: .55 }),
  pan: [new THREE.MeshStandardMaterial({ map: texTostado, roughness: .8 }), new THREE.MeshStandardMaterial({ color: 0x9a5a28, roughness: .85 })],
  jamon: new THREE.MeshStandardMaterial({ color: 0xd88d86, roughness: .55 }),
  queso: fisico({ color: 0xf0bd4a, roughness: .35, clearcoat: .5 }),
  galleta: new THREE.MeshStandardMaterial({ color: 0xc28750, roughness: .8 }),
  chocolate: new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: .5 }),
  jugo: new THREE.MeshStandardMaterial({ color: 0xf08a1a, roughness: .22, emissive: 0x5a2200, emissiveIntensity: .35 }),
  limonada: new THREE.MeshStandardMaterial({ color: 0xe2dc8a, roughness: .2, transparent: true, opacity: .78, emissive: 0x2a2810, emissiveIntensity: .3 }),
  menta: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: .6, side: THREE.DoubleSide }),
  naranja: [new THREE.MeshStandardMaterial({ color: 0xe8781a, roughness: .5 }), new THREE.MeshStandardMaterial({ map: texNaranja, roughness: .4 }), new THREE.MeshStandardMaterial({ map: texNaranja, roughness: .4 })],
  limon: [new THREE.MeshStandardMaterial({ color: 0xe5c93a, roughness: .5 }), new THREE.MeshStandardMaterial({ map: texLimon, roughness: .4 }), new THREE.MeshStandardMaterial({ map: texLimon, roughness: .4 })],
  sombra: new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false })
};

/* ---------- Vapor (shader con ruido) ---------- */
const tiempo = { value: 0 };
const vapores = [];
const VAPOR_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const VAPOR_FRAG = `
  uniform float uT; uniform float uA; uniform float uS; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = .5; for (int i = 0; i < 4; i++){ v += a*n(p); p *= 2.03; a *= .5; } return v; }
  void main(){
    vec2 uv = vUv; float t = uT * .32 + uS;
    float x = uv.x - .5 + (fbm(vec2(uv.y*2.2 - t*.7, uS)) - .5) * .55 * uv.y;
    float ancho = mix(.07, .3, uv.y);
    float forma = smoothstep(ancho, 0.0, abs(x));
    float hum = fbm(vec2(x*5.0 + uS, uv.y*3.2 - t*1.5));
    float a = forma * smoothstep(0.0, .22, uv.y) * smoothstep(1.0, .4, uv.y) * smoothstep(.32, .78, hum);
    gl_FragColor = vec4(vec3(1.0, .95, .88), a * uA);
  }`;
function vapor(padre, x, y, z, escala = 1, fuerza = .55) {
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.8),
      new THREE.ShaderMaterial({
        uniforms: { uT: tiempo, uA: { value: fuerza * (i ? .7 : 1) }, uS: { value: Math.random() * 50 } },
        vertexShader: VAPOR_VERT, fragmentShader: VAPOR_FRAG, transparent: true, depthWrite: false, fog: false
      }));
    m.scale.setScalar(escala * (i ? .8 : 1));
    m.position.set(x + (i ? .05 : -.03) * escala, y + .9 * escala * (i ? .8 : 1), z);
    m.renderOrder = 5;
    padre.add(m);
    vapores.push(m);
  }
}

/* ---------- Piezas ---------- */
const V2 = (r, y) => new THREE.Vector2(r, y);
const seg = alto ? 72 : 44;
const torno = (perfil, mat) => new THREE.Mesh(new THREE.LatheGeometry(perfil.map(p => V2(p[0], p[1])), seg), mat);

function sombra(padre, ancho, prof = ancho, op = .8) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.sombra.clone());
  s.material.opacity = op;
  s.rotation.x = -Math.PI / 2;
  s.scale.set(ancho, prof, 1);
  s.position.y = .004;
  padre.add(s);
}
function asa(radio, grosor, x, y, mat) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radio, grosor, 12, 36, Math.PI * 1.15), mat);
  m.rotation.z = -Math.PI * .575;
  m.scale.y = 1.15;
  m.position.set(x, y, 0);
  return m;
}
function plato(r = 1, mat = M.ceramica) {
  return torno([[0, 0], [.5 * r, 0], [.82 * r, .05], [.96 * r, .1], [.94 * r, .115], [.78 * r, .08], [.45 * r, .045], [0, .045]], mat);
}
// Líquido con degradé de colores (de abajo hacia arriba)
function liquido(rArriba, rAbajo, alto2, colores, ondas = 0) {
  const g = new THREE.CylinderGeometry(rArriba, rAbajo, alto2, seg, 30);
  const pos = g.attributes.position, col = [];
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / alto2 + .5;
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    let k = Math.min(.999, Math.max(0, y + Math.sin(a * 3 + y * 9) * ondas));
    const f = k * (colores.length - 1), j = Math.floor(f);
    c.set(colores[j]).lerp(tmp.set(colores[Math.min(j + 1, colores.length - 1)]), f - j);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.translate(0, alto2 / 2, 0);
  return new THREE.Mesh(g, M.liquido);
}

// Grano de café: óvalo con una cara plana y el surco en "S"
const geoGrano = (function () {
  const g = new THREE.SphereGeometry(1, alto ? 22 : 14, alto ? 16 : 10);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.z > 0) {
      v.z *= .5;
      const d = v.x - .14 * Math.sin(v.y * 2.6);
      v.z -= .32 * Math.exp(-(d * d) / .01) * (1 - Math.abs(v.y) * .6);
    }
    p.setXYZ(i, v.x * .66, v.y * .9, v.z * .5);
  }
  g.computeVertexNormals();
  return g;
})();
function granosSueltos(padre, n, cx, cz, radio) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geoGrano, M.grano);
    const a = Math.random() * 7, r = Math.sqrt(Math.random()) * radio;
    m.position.set(cx + Math.cos(a) * r, .045, cz + Math.sin(a) * r);
    m.rotation.set(-Math.PI / 2 + azar(-.3, .3), 0, Math.random() * 7);
    if (Math.random() < .3) m.rotation.x = Math.PI / 2;
    m.scale.setScalar(.085);
    padre.add(m);
  }
}

// Medialuna / croissant: un "tubo" curvo con gajos
function geoMedialuna(R, grosor, arco, gajos) {
  const U = alto ? 110 : 64, Vn = alto ? 26 : 16;
  const forma = (u, v) => {
    const s = u * 2 - 1, a = s * arco / 2;
    let r = grosor * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 2.2)), .55) + .02;
    const k = Math.abs(Math.sin((s * .5 + .5) * Math.PI * gajos));
    r *= .8 + .2 * Math.pow(k, .6);
    return { a, r, k };
  };
  const g = new ParametricGeometry((u, v, out) => {
    const { a, r } = forma(u, v);
    const th = v * Math.PI * 2;
    const nx = Math.sin(a), nz = Math.cos(a);
    let y = Math.sin(th) * r * .78;
    if (y < 0) y *= .35;
    out.set(Math.sin(a) * R + nx * Math.cos(th) * r, y + r * .27, Math.cos(a) * R - R + nz * Math.cos(th) * r);
  }, U, Vn);
  // Color: dorado oscuro arriba, más claro en los costados y en las uniones de los gajos
  const col = [], c = new THREE.Color();
  const tope = new THREE.Color(0x6e320e), lado = new THREE.Color(0xb86f2e), base = new THREE.Color(0xd9a462);
  for (let i = 0; i <= Vn; i++) for (let j = 0; j <= U; j++) {
    const { k } = forma(j / U, i / Vn);
    const s = Math.sin(i / Vn * Math.PI * 2);
    c.copy(lado).lerp(s > 0 ? tope : base, Math.abs(s) * (s > 0 ? .85 : .7)).lerp(base, (1 - Math.pow(k, .5)) * .45);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const geoCroissant = geoMedialuna(.52, .27, 2.3, 7);
const geoMedialunita = geoMedialuna(.36, .17, 3.1, 5);

/* ---------- Platos de cada capítulo ---------- */
// Cada uno devuelve { grupo, vista } ; vista = cómo lo mira la cámara
function tazaLatte() {
  const g = new THREE.Group();
  g.add(plato(1.05));
  const taza = new THREE.Group();
  taza.position.y = .05;
  taza.add(torno([[0, 0], [.34, 0], [.39, .03], [.44, .2], [.52, .6], [.6, .95], [.62, 1], [.6, 1.02], [.57, 1], [.5, .6], [.41, .2], [.3, .08], [0, .08]], M.ceramica));
  const disco = new THREE.Mesh(new THREE.CircleGeometry(.556, 64), M.latte);
  disco.rotation.x = -Math.PI / 2; disco.position.y = .93;
  taza.add(disco, asa(.21, .045, .6, .55, M.ceramica));
  g.add(taza);
  // cucharita
  const cuch = new THREE.Group();
  const mango = new THREE.Mesh(new THREE.BoxGeometry(.5, .012, .045), M.metal);
  const copa = new THREE.Mesh(new THREE.SphereGeometry(.07, 20, 12), M.metal);
  copa.scale.set(1.3, .25, 1); copa.position.x = -.3;
  cuch.add(mango, copa);
  cuch.position.set(.35, .1, .7); cuch.rotation.y = .6;
  g.add(cuch);
  vapor(g, 0, 1, 0, 1.05, .6);
  sombra(g, 2.6);
  granosSueltos(g, 9, -1.3, .6, .5);
  return { grupo: g, vista: { y: .5, az: .12, dist: 5.4, h: 2.7 } };
}

function tazaEspresso(conVapor = true) {
  const g = new THREE.Group();
  g.add(plato(.62));
  const t = torno([[0, 0], [.2, 0], [.23, .03], [.29, .25], [.32, .47], [.325, .52], [.3, .53], [.29, .5], [.26, .27], [.19, .08], [0, .08]], M.esmalte);
  t.position.y = .04;
  const crema = new THREE.Mesh(new THREE.CircleGeometry(.285, 48), M.crema);
  crema.rotation.x = -Math.PI / 2; crema.position.y = .5;
  g.add(t, crema, asa(.11, .028, .31, .3, M.esmalte));
  if (conVapor) vapor(g, 0, .55, 0, .6, .5);
  sombra(g, 1.5);
  return g;
}
function escenaEspresso() {
  const g = new THREE.Group();
  g.add(tazaEspresso());
  // vasito de soda, como se sirve acá
  const soda = new THREE.Group();
  soda.add(torno([[0, 0], [.17, 0], [.19, .45], [.17, .45], [.155, .03], [0, .03]], M.vidrio));
  const agua = liquido(.168, .152, .36, ['#9fb7bd', '#c9dade']);
  agua.material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .16, roughness: .05, depthWrite: false });
  agua.position.y = .03;
  soda.add(agua);
  soda.position.set(-.85, 0, -.35);
  sombra(soda, .7);
  g.add(soda);
  granosSueltos(g, 14, .85, .35, .4);
  return { grupo: g, vista: { y: .32, az: -.32, dist: 3.3, h: 1.05 } };
}

function escenaEspecial() {
  const g = new THREE.Group();
  const vaso = torno([[0, 0], [.4, 0], [.44, .04], [.46, 1.3], [.435, 1.3], [.415, .06], [0, .06]], M.vidrio);
  vaso.renderOrder = 3;
  const liq = liquido(.43, .405, 1.16, ['#3a2112', '#4e2c16', '#9a6a40', '#c79a6a', '#e9d8bd', '#f3e7d2'], .025);
  liq.position.y = .06;
  // hilos de caramelo en espiral sobre la espuma
  const pts = [];
  for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 6, r = .04 + i / 120 * .32; pts.push(new THREE.Vector3(Math.cos(a) * r, 1.235 + Math.sin(i * .5) * .004, Math.sin(a) * r)); }
  const hilo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, .011, 6), M.caramelo);
  g.add(liq, hilo, vaso, asa(.24, .04, .5, .65, M.vidrio));
  // ramitas de canela cruzadas
  [[.85, .3, .5], [.95, .45, -.2]].forEach(([x, z, r]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .95, 12), M.canela);
    c.rotation.set(Math.PI / 2, 0, r); c.position.set(x, .045, z);
    g.add(c);
  });
  vapor(g, 0, 1.25, 0, .8, .4);
  sombra(g, 1.9);
  granosSueltos(g, 6, -.9, .4, .35);
  return { grupo: g, vista: { y: .72, az: .3, dist: 3.7, h: 1.15 } };
}

let gotas = null;
function escenaFrio() {
  const g = new THREE.Group();
  const perfil = [[0, 0], [.4, 0], [.42, .03], [.52, 1.7], [.495, 1.7], [.395, .05], [0, .05]];
  const vaso = torno(perfil, M.vidrio);
  vaso.renderOrder = 3;
  const liq = liquido(.475, .398, 1.25, ['#e8d6b6', '#e2cba5', '#b98652', '#6e4325', '#4a2a16'], .06);
  liq.position.y = .05;
  g.add(liq);
  // cubos de hielo
  const geoHielo = new RoundedBoxGeometry(.3, .3, .3, 3, .06);
  [[.1, 1.22, .05], [-.16, 1.12, -.1], [.08, 1.42, -.14], [-.1, 1.4, .14], [.18, .98, -.12], [-.02, 1.6, .02]].forEach(p => {
    const h = new THREE.Mesh(geoHielo, M.hielo);
    h.position.set(...p); h.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    h.renderOrder = 4;
    g.add(h);
  });
  // sorbete de papel
  const sorb = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.2, 16), M.sorbete);
  sorb.position.set(.12, 1.45, .05); sorb.rotation.z = -.22;
  g.add(sorb, vaso);
  // gotas de condensación sobre el vaso
  const n = alto ? 260 : 110;
  gotas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M.gota, n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const y = azar(.12, 1.28), a = Math.random() * Math.PI * 2;
    const r = .42 + (.52 - .42) * (y / 1.7) + .006;
    d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    d.lookAt(0, y, 0);
    const s = azar(.008, .026);
    d.scale.set(s, s * azar(1.1, 1.6), s * .45);
    d.updateMatrix();
    gotas.setMatrixAt(i, d.matrix);
  }
  gotas.renderOrder = 4;
  g.add(gotas);
  sombra(g, 1.7);
  return { grupo: g, vista: { y: .92, az: -.26, dist: 4.4, h: 1.05 } };
}

function medialuna(chica = false) {
  const m = new THREE.Mesh(chica ? geoMedialunita : geoCroissant, M.masa);
  return m;
}
function galleta() {
  const geo = new THREE.CylinderGeometry(.32, .3, .07, 40, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, p.getY(i) + (p.getY(i) > 0 ? Math.sin(x * 23) * Math.cos(z * 19) * .012 : 0));
    const k = 1 + Math.sin(Math.atan2(z, x) * 7) * .025;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const base = new THREE.Mesh(geo, M.galleta);
  base.position.y = .035;
  g.add(base);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(.06, .035, .05), M.chocolate);
    const a = Math.random() * 7, r = Math.sqrt(Math.random()) * .24;
    c.position.set(Math.cos(a) * r, .075, Math.sin(a) * r);
    c.rotation.set(azar(-.3, .3), Math.random() * 3, azar(-.3, .3));
    g.add(c);
  }
  return g;
}
function escenaPasteleria() {
  const g = new THREE.Group();
  g.add(plato(1.1));
  const c = medialuna(); c.position.set(-.3, .05, .3); c.rotation.y = .25;
  const m = medialuna(true); m.position.set(.5, .05, -.3); m.rotation.y = -.9;
  g.add(c, m);
  const gal = galleta(); gal.position.set(1.25, 0, .55);
  g.add(gal);
  const gal2 = galleta(); gal2.position.set(1.05, .02, 1.05); gal2.rotation.set(.12, 1, .05);
  g.add(gal2);
  sombra(g, 2.6);
  sombra(gal, .9);
  return { grupo: g, vista: { y: .2, az: .34, dist: 4.3, h: 2.2 } };
}

// Triángulo de pan con las puntas redondeadas
function triangulo(lado, r = .06) {
  const s = new THREE.Shape();
  s.moveTo(r, 0); s.lineTo(lado - r, 0); s.quadraticCurveTo(lado, 0, lado - r * .7, r * .7);
  s.lineTo(r * .7, lado - r * .7); s.quadraticCurveTo(0, lado, 0, lado - r);
  s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
  return s;
}
function capa(forma, prof, mat, escala = 1) {
  const geo = new THREE.ExtrudeGeometry(forma, { depth: prof, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2, curveSegments: 8 });
  geo.center();
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(escala, escala, 1);
  return m;
}
function tostado() {
  const g = new THREE.Group();
  const f = triangulo(.95);
  texTostado.repeat.set(1.6, 1.6);
  const pan1 = capa(f, .1, M.pan); pan1.position.y = .07;
  const jamon = capa(f, .035, M.jamon, 1.04); jamon.position.y = .145;
  const queso = capa(f, .03, M.queso, 1.07); queso.position.y = .18;
  const pan2 = capa(f, .1, M.pan); pan2.position.y = .265;
  g.add(pan1, jamon, queso, pan2);
  // queso que se derrite por los bordes
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), M.queso);
    d.scale.set(1, 1.6, .7);
    d.position.set(azar(-.3, .3), .14, .32 + azar(-.02, .02));
    g.add(d);
  }
  return g;
}
function escenaSalado() {
  const g = new THREE.Group();
  const tabla = new THREE.Mesh(new RoundedBoxGeometry(2.1, .08, 1.3, 4, .03), M.madera);
  tabla.position.y = .04;
  g.add(tabla);
  const a = tostado(); a.position.set(-.28, .08, .05); a.rotation.y = .25;
  const b = tostado(); b.position.set(.38, .08, -.1); b.rotation.y = .25 + Math.PI; b.rotation.z = .12;
  g.add(a, b);
  sombra(g, 2.8, 1.9);
  return { grupo: g, vista: { y: .25, az: -.3, dist: 4.4, h: 2.1 } };
}

function vasoJugo() {
  const g = new THREE.Group();
  const vaso = torno([[0, 0], [.33, 0], [.35, .03], [.4, 1.05], [.378, 1.05], [.33, .05], [0, .05]], M.vidrio);
  vaso.renderOrder = 3;
  const j = new THREE.Mesh(new THREE.CylinderGeometry(.37, .328, .82, seg), M.jugo);
  j.position.y = .05 + .41;
  const r = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .04, 40), M.naranja);
  r.rotation.set(Math.PI / 2, 0, .3); r.position.set(.36, 1.0, .05);
  g.add(j, vaso, r);
  sombra(g, 1.1);
  return g;
}
function vasoLimonada() {
  const g = new THREE.Group();
  const vaso = torno([[0, 0], [.3, 0], [.32, .03], [.34, 1.4], [.32, 1.4], [.3, .05], [0, .05]], M.vidrio);
  vaso.renderOrder = 3;
  const l = new THREE.Mesh(new THREE.CylinderGeometry(.315, .3, 1.1, seg), M.limonada);
  l.position.y = .6;
  g.add(l);
  const geoHielo = new RoundedBoxGeometry(.24, .24, .24, 3, .05);
  [[.06, 1.05, .04], [-.08, 1.2, -.05], [.05, 1.3, -.06]].forEach(p => {
    const h = new THREE.Mesh(geoHielo, M.hielo);
    h.position.set(...p); h.rotation.set(Math.random() * 3, Math.random() * 3, 0); h.renderOrder = 4;
    g.add(h);
  });
  for (let i = 0; i < 5; i++) {
    const hoja = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), M.menta);
    hoja.scale.set(.55, .12, 1);
    hoja.position.set(azar(-.12, .12), 1.42 + i * .02, azar(-.12, .12));
    hoja.rotation.set(azar(-.6, .6), Math.random() * 6, azar(-.4, .4));
    g.add(hoja);
  }
  const r = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .035, 40), M.limon);
  r.rotation.set(Math.PI / 2, 0, -.3); r.position.set(-.3, 1.36, .05);
  g.add(r, vaso);
  sombra(g, 1);
  return g;
}
function escenaBebidas() {
  const g = new THREE.Group();
  const a = vasoJugo(); a.position.set(-.45, 0, .2);
  const b = vasoLimonada(); b.position.set(.5, 0, -.25);
  g.add(a, b);
  // media naranja apoyada en la barra
  const m = new THREE.Mesh(new THREE.SphereGeometry(.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.naranja[0]);
  m.rotation.x = Math.PI; m.position.set(-1.1, .26, .75);
  const cara = new THREE.Mesh(new THREE.CircleGeometry(.26, 40), M.naranja[1]);
  cara.rotation.x = -Math.PI / 2; cara.position.set(-1.1, .262, .75);
  g.add(m, cara);
  sombra(g, 2.4);
  return { grupo: g, vista: { y: .6, az: -.2, dist: 5, h: 1.5 } };
}

function escenaCombo() {
  const g = new THREE.Group();
  const bandeja = new THREE.Mesh(new RoundedBoxGeometry(2.7, .06, 1.7, 4, .03), M.bandeja);
  bandeja.position.y = .03;
  g.add(bandeja);
  const e = tazaEspresso(false); e.scale.setScalar(.9); e.position.set(-.75, .06, .2);
  const p = plato(.6); p.position.set(.15, .06, .25);
  const m1 = medialuna(true); m1.position.set(.05, .1, .35); m1.rotation.y = .4;
  const m2 = medialuna(true); m2.position.set(.3, .1, .05); m2.rotation.y = 3;
  const j = vasoJugo(); j.scale.setScalar(.8); j.position.set(.9, .06, -.3);
  g.add(e, p, m1, m2, j);
  vapor(g, -.75, .55, .2, .55, .5);
  sombra(g, 3.4, 2.3, .9);
  return { grupo: g, vista: { y: .3, az: .22, dist: 5.6, h: 3.1 } };
}

const CONSTRUCTORES = {
  espresso: escenaEspresso, especial: escenaEspecial, frio: escenaFrio, pasteleria: escenaPasteleria,
  salado: escenaSalado, combo: escenaCombo, bebidas: escenaBebidas
};

/* ---------- La barra con todos los platos ---------- */
const piso = new THREE.Mesh(new THREE.PlaneGeometry(220, 60),
  new THREE.MeshStandardMaterial({ map: texMadera, color: 0x9a8070, roughness: .5, metalness: 0 }));
piso.rotation.x = -Math.PI / 2;
piso.position.set(60, 0, -10);
scene.add(piso);

const estaciones = [];
function agregar({ grupo, vista }, i) {
  const x = i * SEP, z = i % 2 ? -.4 : .3;
  grupo.position.set(x, 0, z);
  grupo.userData.giroBase = (i % 2 ? -1 : 1) * .25;
  grupo.rotation.y = grupo.userData.giroBase;
  scene.add(grupo);
  estaciones.push({ grupo, vista, x, z, giro: 0, vel: 0 });
}
agregar(tazaLatte(), 0);
(carta.categorias || []).forEach((c, i) => agregar((CONSTRUCTORES[c.escena] || escenaEspresso)(), i + 1));

/* ---------- Granos flotando y polvo en el aire ---------- */
const NG = alto ? 46 : 22;
const granos = new THREE.InstancedMesh(geoGrano, M.grano, NG);
const datosGrano = [];
for (let i = 0; i < NG; i++) {
  const a = Math.random() * Math.PI * 2, r = azar(1.3, 3.6);
  datosGrano.push({
    x: Math.cos(a) * r + (i % 3 === 0 ? azar(2, 6) : 0), y: azar(.5, 3.2), z: Math.sin(a) * r * .8 - .5,
    rx: Math.random() * 7, ry: Math.random() * 7, vx: azar(-.6, .6), vy: azar(-.6, .6), f: Math.random() * 7, s: azar(.07, .12)
  });
}
scene.add(granos);
const tmpObj = new THREE.Object3D();

const NP = alto ? 260 : 110;
const posPolvo = new Float32Array(NP * 3);
for (let i = 0; i < NP; i++) {
  posPolvo[i * 3] = azar(-5, estaciones.length * SEP);
  posPolvo[i * 3 + 1] = azar(.2, 4);
  posPolvo[i * 3 + 2] = azar(-3, 3);
}
const geoPolvo = new THREE.BufferGeometry();
geoPolvo.setAttribute('position', new THREE.BufferAttribute(posPolvo, 3));
const polvo = new THREE.Points(geoPolvo, new THREE.PointsMaterial({
  size: .035, map: texPunto, color: 0xffd9a8, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending
}));
scene.add(polvo);

// Luces lejanas del local, fuera de foco (bokeh)
const NB = 46;
const posB = new Float32Array(NB * 3), colB = new Float32Array(NB * 3);
const paleta = [0xffb066, 0xffd6a1, 0xf3e6d2, 0xe38d45];
for (let i = 0; i < NB; i++) {
  posB.set([azar(-12, estaciones.length * SEP + 8), azar(1.2, 7), azar(-24, -14)], i * 3);
  const c = new THREE.Color(paleta[i % paleta.length]);
  colB.set([c.r, c.g, c.b], i * 3);
}
const geoB = new THREE.BufferGeometry();
geoB.setAttribute('position', new THREE.BufferAttribute(posB, 3));
geoB.setAttribute('color', new THREE.BufferAttribute(colB, 3));
const bokeh = new THREE.Points(geoB, new THREE.PointsMaterial({
  size: 1.6, map: texPunto, vertexColors: true, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
}));
scene.add(bokeh);

/* ---------- Cámara: de dónde mira en cada momento ---------- */
const N = estaciones.length - 1;   // cantidad de capítulos
const INICIO = { y: .45, az: .95, dist: 8.8, h: 6.6 };   // toma general alta de la portada
function vista(i) { const e = estaciones[i]; return { x: e.x, z: e.z, ...e.vista }; }
const pA = new THREE.Vector3(), pB = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
function ubicar(v, az, pos, obj) {
  obj.set(v.x, v.y, v.z);
  pos.set(v.x + Math.sin(az) * v.dist, v.y + v.h, v.z + Math.cos(az) * v.dist);
}
const suavizar = k => k * k * k * (k * (k * 6 - 15) + 10);   // arranca y frena suave
const mezclar = (a, b, k) => a + (b - a) * k;

const camPos = new THREE.Vector3(), camObj = new THREE.Vector3();
function calcularCamara(t, reloj) {
  let fov = 32, onda = Math.sin(reloj * .22) * .05 * vivo;
  if (t < 1) {
    // Portada: baja en espiral desde arriba hasta la taza
    const k = suavizar(Math.max(0, t));
    const v0 = vista(0);
    const v = { x: v0.x, z: v0.z, y: mezclar(INICIO.y, v0.y, k), dist: mezclar(INICIO.dist, v0.dist, k), h: mezclar(INICIO.h, v0.h, k) };
    ubicar(v, mezclar(INICIO.az, v0.az, k) + onda, camPos, camObj);
  } else {
    const s = Math.min(t - 1, N);
    const i = Math.min(Math.floor(s), N - 1 < 0 ? 0 : N - 1);
    const k = suavizar(Math.min(1, s - i));
    const a = vista(i), b = vista(Math.min(i + 1, N));
    ubicar(a, a.az + onda, pA, tA);
    ubicar(b, b.az + onda, pB, tB);
    camPos.lerpVectors(pA, pB, k);
    camObj.lerpVectors(tA, tB, k);
    const arco = Math.sin(Math.PI * k);
    camPos.y += arco * .9;         // la cámara se eleva un poco entre plato y plato
    camPos.z += arco * 1.4;
    fov += arco * 6;               // y abre el lente: sensación de viaje
  }
  return fov;
}

/* ---------- Tamaño y encuadre ---------- */
let ancho = 0, altoPx = 0;
function medir() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h || (w === ancho && Math.abs(h - altoPx) < 2)) return;
  ancho = w; altoPx = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
}
function encuadre(t) {
  // Celular: el plato queda arriba (abajo va el título).
  // Escritorio: el plato a la izquierda (la lista va a la derecha).
  const lim = v => Math.min(1, Math.max(0, v));
  const k = lim((t - .6) / .6);
  const escritorio = ancho >= 960;
  let ox = 0, oy;
  if (escritorio) {
    // Portada: la taza termina a la derecha (el titular va a la izquierda);
    // en los capítulos el plato pasa a la izquierda con un barrido.
    const kp = suavizar(lim(t / 1)), kc = suavizar(lim((t - 1) / .85));
    ox = mezclar(mezclar(0, -ancho * .17, kp), ancho * .2, kc);
    // Arranque: la taza más abajo, lejos del texto "Carta de 12 Onzas Café".
    // Capítulos: el plato más arriba, para que no lo pise el título grande.
    oy = mezclar(-altoPx * .16, altoPx * .14, k);
  } else {
    // La taza sube antes de que aparezca el titular de la portada,
    // así "Doce onzas de café..." queda debajo del plato y no encima.
    const km = suavizar(lim((t - .3) / .62));
    oy = mezclar(-altoPx * .14, altoPx * .15, km);
  }
  camera.setViewOffset(ancho, altoPx, ox, oy, ancho, altoPx);
  // En celular se aleja un poco para que entre el plato (y en pantallas bajas no lo pise el texto)
  return escritorio ? 1.5 : Math.min(1.75, Math.max(1.6, .8 / (ancho / altoPx)));
}
medir();
addEventListener('resize', medir);

/* ---------- Dedo y mouse ---------- */
const mira = { x: 0, y: 0, cx: 0, cy: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mira.x = e.clientX / innerWidth * 2 - 1;
  mira.y = e.clientY / innerHeight * 2 - 1;
}, { passive: true });
// Arrastrar de costado sobre la escena hace girar el plato
let arr = null;
const zonaLibre = e => !e.target.closest('.cap-lista, .barra, .ficha, .cierre, a, button');
addEventListener('pointerdown', e => { if (zonaLibre(e)) arr = { x: e.clientX, y: e.clientY, ult: e.clientX, horizontal: null }; }, { passive: true });
addEventListener('pointermove', e => {
  if (!arr) return;
  if (arr.horizontal === null && Math.hypot(e.clientX - arr.x, e.clientY - arr.y) > 8)
    arr.horizontal = Math.abs(e.clientX - arr.x) > Math.abs(e.clientY - arr.y);
  if (arr.horizontal) {
    const e0 = estaciones[actual()];
    e0.vel += (e.clientX - arr.ult) * .006;
  }
  arr.ult = e.clientX;
}, { passive: true });
addEventListener('pointerup', () => { arr = null; });
addEventListener('pointercancel', () => { arr = null; });

/* ---------- Animación ---------- */
const reloj = new THREE.Clock();
const wp = new THREE.Vector3(), qp = new THREE.Quaternion(), ep = new THREE.Euler();
let tS = 0, primera = true;
const actual = () => Math.max(0, Math.min(N, Math.round(tS - 1)));

function cuadro() {
  const dt = Math.min(reloj.getDelta(), .05);
  const r = reloj.elapsedTime;
  if (vivo) tiempo.value = r;

  const objetivo = perf.quieto ? Math.round(estado.t) : estado.t;
  tS = primera || perf.quieto || FOTO ? objetivo : tS + (objetivo - tS) * Math.min(1, dt * 5);
  primera = false;

  // El cierre tapa todo: no hace falta dibujar
  if (estado.fin >= .999) return;

  const zoom = encuadre(tS);
  camera.fov = calcularCamara(tS, r);
  camPos.sub(camObj).multiplyScalar(zoom).add(camObj);

  mira.cx += (mira.x - mira.cx) * .05;
  mira.cy += (mira.y - mira.cy) * .05;
  camPos.x += mira.cx * .35 * vivo;
  camPos.y -= mira.cy * .2 * vivo;
  camera.position.copy(camPos);
  camera.lookAt(camObj);
  camera.updateProjectionMatrix();

  // El foco sigue a la cámara
  foco.position.set(camObj.x + 1.2, 5.5, camObj.z + 1.8);
  foco.target.position.set(camObj.x, 0, camObj.z);

  // Platos: giro lento + impulso del dedo o del mouse
  const ia = actual();
  if (estado.pulso) { estaciones[ia].vel += 2.2 * vivo || .8; estado.pulso = 0; }
  estaciones.forEach((e, i) => {
    e.vel *= Math.pow(.04, dt);
    e.giro += e.vel * dt + (i === ia ? dt * .1 * vivo : 0);
    e.grupo.rotation.y = e.grupo.userData.giroBase + e.giro;
  });

  // El vapor siempre mira a la cámara (solo de costado)
  vapores.forEach(v => {
    v.getWorldPosition(wp);
    v.visible = Math.abs(wp.x - camObj.x) < SEP * .8;
    if (!v.visible) return;
    v.parent.getWorldQuaternion(qp);
    ep.setFromQuaternion(qp, 'YXZ');
    v.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z) - ep.y;
  });

  // Granos flotando alrededor de la taza; suben al bajar por la portada
  const sube = Math.min(1.5, tS) * 1.2;
  for (let i = 0; i < NG; i++) {
    const d = datosGrano[i];
    tmpObj.position.set(d.x, d.y + Math.sin(r * .7 + d.f) * .12 * vivo + sube * (.6 + (i % 4) * .2), d.z);
    tmpObj.rotation.set(d.rx + r * d.vx * vivo, d.ry + r * d.vy * vivo, 0);
    tmpObj.scale.setScalar(d.s);
    tmpObj.updateMatrix();
    granos.setMatrixAt(i, tmpObj.matrix);
  }
  granos.instanceMatrix.needsUpdate = true;
  polvo.position.y = Math.sin(r * .15) * .15 * vivo;
  polvo.rotation.y = Math.sin(r * .05) * .01 * vivo;

  renderer.render(scene, camera);
  controlarFluidez(dt);
}

/* ---------- Control de fluidez ---------- */
let cuadros = 0, suma = 0, revisado = false, apagado = false;
function controlarFluidez(dt) {
  if (revisado) return;
  cuadros++;
  if (cuadros < 40) return;          // los primeros cuadros siempre son lentos
  suma += dt;
  if (cuadros < 160) return;
  revisado = true;
  const fps = 120 / suma;
  if (fps < 22) {
    // Muy lento: se apaga el 3D y queda la carta con fondo cálido
    apagado = true;
    renderer.setAnimationLoop(null);
    perf.bajar(); perf.bajar();
    canvas.classList.remove('lista');
    dispatchEvent(new Event('escena:apagada'));
  } else if (fps < 45) {
    perf.bajar();
    alto = false;
    renderer.setPixelRatio(1);
    ancho = 0; medir();
    polvo.visible = false;
    if (gotas) gotas.count = Math.floor(gotas.count / 2);
  }
}

/* ---------- Arranque ---------- */
// Prepara todo antes de mostrar: así no hay tirones al llegar a cada plato
[texLatte, texCrema, texMadera, texTostado, texNaranja, texLimon, texSombra, texPunto].forEach(t => renderer.initTexture(t));
encuadre(0); camera.fov = calcularCamara(estado.t, 0); camera.position.copy(camPos); camera.lookAt(camObj); camera.updateProjectionMatrix();
renderer.compile(scene, camera);
renderer.render(scene, camera);

let andando = false;
function arrancar() { if (!andando && !apagado && !document.hidden) { andando = true; reloj.getDelta(); renderer.setAnimationLoop(cuadro); } }
function detener() { andando = false; renderer.setAnimationLoop(null); }
document.addEventListener('visibilitychange', () => (document.hidden ? detener() : arrancar()));
arrancar();

requestAnimationFrame(() => {
  canvas.classList.add('lista');
  dispatchEvent(new Event('escena:lista'));
});

// Para revisar desde la consola del navegador (no afecta a la carta)
window.CARTA_ESCENA = { estaciones, camera, get tS() { return tS; } };
