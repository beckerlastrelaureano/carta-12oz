/* =========================================================
   APP.JS — arma la carta y maneja todo lo que no es 3D
   1. Lee data/carta.json y dibuja categorías, productos y horarios
   2. Barra de categorías que marca dónde estás
   3. Scroll suave (Lenis) y animaciones (GSAP + ScrollTrigger)
   4. Ficha del producto (bottom sheet)
   5. Carga la escena 3D (js/escena.js) si el teléfono la aguanta
   6. Tarjetas de video (las arma js/medios.js; acá se animan)

   Los textos de la carta se editan en data/carta.json,
   no hace falta tocar este archivo.
   ========================================================= */

(function () {
  const perf = window.CARTA_PERF || { nivel: 'bajo', reducir: true };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;

  // Lo que la escena 3D lee en cada cuadro
  const estado = window.CARTA_ESTADO = { t: 0, fin: 0, cap: -1, pulso: 0 };

  // Portada sin animación de scroll (ver estadoScroll y .portada-simple en el CSS)
  const portadaSimple = perf.reducir || !(window.gsap && window.ScrollTrigger);
  if (portadaSimple) html.classList.add('portada-simple');

  if (!location.hash) scrollTo(0, 0);

  /* ---------- Pantalla de carga ---------- */
  const carga = $('#carga');
  const avance = v => carga && carga.style.setProperty('--avance', v);
  let cargaFuera = false;
  function sacarCarga() {
    if (cargaFuera) return;
    cargaFuera = true;
    avance(1);
    setTimeout(() => {
      carga.classList.add('fuera');
      html.classList.add('cargado');
      revelarPortada();
    }, 350);
  }
  // Pase lo que pase, a los 7 segundos la carta se muestra
  setTimeout(sacarCarga, 7000);

  /* ---------- Utilidades ---------- */
  const precio = n => '$' + Number(n).toLocaleString('es-AR');
  const dosCifras = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Separa un texto en palabras con máscara (para que "suban" al aparecer)
  function partirPalabras(el) {
    if (!el || el.dataset.partido) return;
    const texto = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', texto);
    el.innerHTML = texto.split(' ').map(p =>
      `<span class="palabra-m" aria-hidden="true"><span>${esc(p)}</span></span>`).join(' ');
    el.dataset.partido = '1';
  }

  /* ---------- 1. Carta ---------- */
  fetch('data/carta.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(iniciar)
    .catch(err => {
      console.error('No se pudo leer data/carta.json', err);
      $('#capitulos').innerHTML = '<p class="error-carta">No pudimos cargar la carta. Recargá la página o pedila en la barra.</p>';
      sacarCarga();
    });

  function iniciar(carta) {
    window.CARTA = carta;
    avance(.35);
    dibujarCapitulos(carta);
    dibujarCierre(carta.negocio || {});
    prepararFicha(carta);
    medir();
    estadoScroll();

    if (perf.nivel !== 'bajo') {
      import('./escena.js?v=5')
        .then(() => avance(.7))
        .catch(err => { console.warn('El 3D no se pudo cargar; queda la carta sin escena.', err); html.dataset.nivel = 'bajo'; sacarCarga(); });
      addEventListener('escena:lista', sacarCarga, { once: true });
      addEventListener('escena:apagada', () => { html.dataset.nivel = 'bajo'; sacarCarga(); }, { once: true });
    } else {
      setTimeout(sacarCarga, 900);   // deja ver el logo dibujándose
    }

    animaciones();
  }

  function dibujarCapitulos(carta) {
    const cats = carta.categorias || [];
    const total = dosCifras(cats.length);
    const cont = $('#capitulos');
    cont.innerHTML = cats.map((c, i) => {
      const n = dosCifras(i + 1);
      // Tarjeta de video: en compu alterna izquierda / derecha; en celular siempre a la derecha
      const lado = i % 2 === 0 ? 'izq' : 'der';
      const medio = `<figure class="medio medio-${lado}" data-lado="${lado}" data-num="${n}"` +
        (c.video ? ` data-video="${esc(c.video)}"` : '') +
        (c.foto ? ` data-foto="${esc(c.foto)}"` : '') +
        ` data-pie="${esc(c.pieVideo || c.pie || '')}"></figure>`;
      const filas = (c.productos || []).map((p, j) => `
        <li class="producto">
          <button class="prod-btn" type="button" data-cat="${i}" data-prod="${j}">
            <span class="prod-nombre">${esc(p.nombre)}</span>
            <span class="prod-precio">${precio(p.precio)}</span>
            ${p.desc ? `<span class="prod-desc">${esc(p.desc)}</span>` : ''}
            ${(p.etiquetas || []).length ? `<span class="prod-tags">${p.etiquetas.map(etiqueta).join('')}</span>` : ''}
          </button>
        </li>`).join('');
      return `
      <section class="capitulo" id="${esc(c.id)}" data-i="${i}" aria-labelledby="t-${esc(c.id)}">
        <div class="cap-intro">
          <span class="cap-fondo" aria-hidden="true">${n}</span>
          ${medio}
          <p class="cap-num">${n} / ${total}</p>
          <h2 class="cap-titulo" id="t-${esc(c.id)}">${esc(c.titulo)}</h2>
          ${c.bajada ? `<p class="cap-bajada">${esc(c.bajada)}</p>` : ''}
        </div>
        <div class="cap-lista">
          ${i === 0 ? '<p class="ayuda-tocar">Tocá un producto para ver el detalle.</p>' : ''}
          <ul>${filas}</ul>
        </div>
        <div class="cap-espacio" aria-hidden="true"></div>
      </section>`;
    }).join('');

    if (window.CARTA_MEDIOS) { CARTA_MEDIOS.armar(cont); CARTA_MEDIOS.observar(cont); }

    // Barra de categorías
    $('#pills').innerHTML = cats.map(c =>
      `<a class="pill" href="#${esc(c.id)}">${esc(c.titulo)}</a>`).join('') +
      '<a class="pill" href="#info">Horarios</a>';
  }

  function etiqueta(t) {
    const casa = /casa|nuevo/i.test(t);
    return `<span class="tag${casa ? ' tag-casa' : ''}">${esc(t)}</span>`;
  }

  function dibujarCierre(neg) {
    if (neg.direccion) $('#direccion').textContent = neg.direccion;
    if (neg.maps) { $('#btn-maps').href = neg.maps; $('#btn-maps').hidden = false; }
    if (neg.instagram) {
      $('#btn-ig').href = 'https://www.instagram.com/' + neg.instagram.replace('@', '') + '/';
      $('#ig-usuario').textContent = '@' + neg.instagram.replace('@', '');
      $('#btn-ig').hidden = false;
    }
    const wa = String(neg.whatsapp || '').replace(/\D/g, '');
    if (wa) {
      const b = $('#btn-wa');
      b.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hola, quería hacerles una consulta.');
      b.hidden = false;
    }
    const hs = neg.horarios || [];
    $('#horarios').innerHTML = hs.map(h =>
      `<dt>${esc(h.dias)}</dt><dd>${esc(hora(h.desde))} a ${esc(hora(h.hasta))} h</dd>`).join('');
    $('#nota-horario').hidden = !neg.horarioDeEjemplo;

    // ¿Está abierto ahora? (con la hora del teléfono)
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const aMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
    const hoy = hs.find(h => (h.numeros || []).includes(ahora.getDay()));
    const est = $('#estado');
    if (hs.length) {
      const abierto = hoy && min >= aMin(hoy.desde) && min < aMin(hoy.hasta);
      est.textContent = abierto ? `Abierto ahora, hasta las ${hora(hoy.hasta)} h` : 'Cerrado ahora';
      est.classList.toggle('abierto', !!abierto);
      est.hidden = false;
    }
  }
  const hora = s => { const [h, m] = String(s).split(':'); return Number(h) + (m && m !== '00' ? ':' + m : ''); };

  /* ---------- 2. Posición del scroll (para el 3D y la barra) ---------- */
  let medidas = null;
  function medir() {
    const y = scrollY;
    const top = el => el.getBoundingClientRect().top + y;
    const portada = $('#inicio');
    medidas = {
      vh: innerHeight,
      portadaTop: top(portada),
      portadaH: portada.offsetHeight,
      caps: $$('.capitulo').map(top),
      info: top($('#info'))
    };
  }
  const limitar = v => Math.max(0, Math.min(1, v));

  let pillActiva = -2;
  function estadoScroll() {
    if (!medidas) return;
    const y = scrollY, m = medidas, vh = m.vh;
    // t: 0 a 1 en la portada; después suma 1 por cada capítulo que entra
    let t = limitar((y - m.portadaTop) / Math.max(1, m.portadaH - vh));
    m.caps.forEach(c => { t += limitar((y + vh - c) / vh); });
    estado.t = t;
    estado.fin = limitar((y + vh - m.info) / vh);

    // Capítulo activo
    let act = -1;
    const ref = y + vh * .45;
    m.caps.forEach((c, i) => { if (c <= ref) act = i; });
    if (m.info <= ref) act = m.caps.length;
    estado.cap = act;
    // Sin animaciones (reducir movimiento o sin GSAP): la portada cambia de golpe,
    // primero logo y lugar, después el titular. Así nunca se pisan los textos.
    if (portadaSimple) {
      const p = limitar((y - m.portadaTop) / Math.max(1, m.portadaH - vh));
      html.classList.toggle('portada-2', p >= .5);
    }
    html.classList.toggle('en-portada', y < vh * .6);
    html.classList.toggle('en-cierre', y + 60 > m.info);
    if (act !== pillActiva) marcarPill(act);
  }

  function marcarPill(i) {
    pillActiva = i;
    const pills = $$('.pill');
    pills.forEach((p, j) => p.setAttribute('aria-current', j === i ? 'true' : 'false'));
    const p = pills[i];
    const barra = $('#pills');
    if (p && barra) {
      const izq = p.offsetLeft - barra.clientWidth / 2 + p.offsetWidth / 2;
      barra.scrollTo({ left: izq, behavior: perf.reducir ? 'auto' : 'smooth' });
    } else if (i < 0 && barra) {
      // De vuelta en la portada: la barra vuelve a mostrar las primeras categorías
      barra.scrollTo({ left: 0, behavior: perf.reducir ? 'auto' : 'smooth' });
    }
  }

  addEventListener('scroll', estadoScroll, { passive: true });
  // Si cambia el alto de la página (fuentes, imágenes), se vuelve a medir
  if ('ResizeObserver' in window) {
    let pend = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(pend);
      pend = requestAnimationFrame(() => { if (medidas) { medir(); estadoScroll(); } });
    }).observe(document.body);
  }
  let anchoPrevio = innerWidth;
  addEventListener('resize', () => {
    // En el celular la barra del navegador cambia el alto: solo se re-mide si cambia mucho
    if (Math.abs(innerWidth - anchoPrevio) > 2 || Math.abs(innerHeight - (medidas ? medidas.vh : 0)) > 120) {
      anchoPrevio = innerWidth;
      medir(); estadoScroll();
    }
  });

  /* ---------- 3. Scroll suave y animaciones ---------- */
  let lenis = null;
  function irA(destino) {
    const el = typeof destino === 'string' ? $(destino) : destino;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.8 });
    else el.scrollIntoView({ behavior: perf.reducir ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const el = $(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    irA(el);
    history.replaceState(null, '', a.getAttribute('href'));
  });

  let hayGsap = false;
  function animaciones() {
    hayGsap = !!(window.gsap && window.ScrollTrigger) && !perf.reducir;

    // Filas de productos: la línea se dibuja y el texto aparece (una vez)
    const filas = $$('.producto');
    if (!perf.reducir && 'IntersectionObserver' in window) {
      html.classList.add('filas-anim');
      const io = new IntersectionObserver(ents => {
        ents.forEach(en => {
          if (!en.isIntersecting) return;
          const hermanos = [...en.target.parentNode.children];
          en.target.style.setProperty('--d', (hermanos.indexOf(en.target) % 4) * 70 + 'ms');
          en.target.classList.add('visto');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      filas.forEach(f => io.observe(f));
    }

    if (!hayGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    // En el celular la barra del navegador cambia el alto: que no recalcule todo por eso
    ScrollTrigger.config({ ignoreMobileResize: true });
    html.classList.add('gsap-on');

    if (window.Lenis) {
      lenis = window.CARTA_LENIS = new Lenis({ duration: 1.15, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', () => { ScrollTrigger.update(); estadoScroll(); });
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    const suave = perf.tactil ? 0.5 : true;

    // Portada: el cuadrado del logo crece hasta que la cámara "pasa" a través de él
    const titular = $('.titular');
    partirPalabras(titular);
    const pal = $$('.palabra-m > span', titular);
    gsap.set(pal, { yPercent: 115 });
    gsap.set('.portada-sub', { opacity: 0, y: 18 });
    const logo = $('.portada-logo');
    const marco = logo.querySelector('path');
    const letras = $$('path', logo).slice(1);
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom bottom', scrub: suave }
    })
      .to('.deslizar', { opacity: 0, duration: .08 }, 0)
      .to('.portada-lugar', { opacity: 0, y: -14, duration: .14 }, 0)
      .to(letras, { opacity: 0, y: 10, duration: .2, stagger: .02 }, .02)
      .to(marco, { scale: 9, svgOrigin: '55 50', duration: .42, ease: 'power2.in' }, .04)
      .to(marco, { opacity: 0, duration: .1 }, .36)
      .to(pal, { yPercent: 0, duration: .22, stagger: .03, ease: 'power3.out' }, .5)
      .to('.portada-sub', { opacity: 1, y: 0, duration: .14 }, .74)
      .to({}, { duration: .1 })    // un respiro al final antes del primer capítulo
      .add(entradaTarjeta($('.medio-portada'), true, .3), .38);

    // Portada: la tarjeta sube un poco más lento que el resto (parallax)
    const mueveP = $('.medio-portada .medio-mueve');
    if (mueveP) gsap.fromTo(mueveP, { y: 0 }, {
      y: () => innerHeight * -.08, ease: 'none',
      scrollTrigger: { trigger: '#inicio', start: 'bottom bottom', end: 'bottom top', scrub: suave, invalidateOnRefresh: true }
    });

    // Títulos de capítulo: las palabras suben desde una máscara
    $$('.capitulo').forEach(cap => {
      const titulo = $('.cap-titulo', cap), bajada = $('.cap-bajada', cap), num = $('.cap-num', cap);
      partirPalabras(titulo); partirPalabras(bajada);
      const t1 = $$('.palabra-m > span', titulo);
      const t2 = bajada ? $$('.palabra-m > span', bajada) : [];
      gsap.timeline({
        scrollTrigger: { trigger: $('.cap-intro', cap), start: 'top 62%', toggleActions: 'play none none reverse' }
      })
        .fromTo(num, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: .8, ease: 'power3.out' }, 0)
        .fromTo(t1, { yPercent: 118, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.2, ease: 'expo.out', stagger: .06 }, .05)
        .fromTo(t2, { yPercent: 118 }, { yPercent: 0, duration: .9, ease: 'expo.out', stagger: .018 }, .3);

      // Tarjeta de video: entra de costado cuando llega el capítulo
      const fig = $('.medio', cap);
      if (fig) {
        const desdeDerecha = innerWidth < 960 || fig.dataset.lado === 'der';
        gsap.timeline({
          scrollTrigger: { trigger: $('.cap-intro', cap), start: 'top 72%', toggleActions: 'play none none reverse', invalidateOnRefresh: true }
        }).add(entradaTarjeta(fig, desdeDerecha, 1.1));
        // Parallax: la tarjeta se mueve un poco más lento que el texto
        const mueve = $('.medio-mueve', fig);
        if (innerWidth < 960) {
          gsap.fromTo(mueve, { y: -50 }, {
            y: 0, ease: 'none',
            scrollTrigger: { trigger: $('.cap-intro', cap), start: 'top bottom', end: 'top top', scrub: suave }
          });
        } else {
          gsap.fromTo(mueve, { y: -36 }, {
            y: 28, ease: 'none',
            scrollTrigger: { trigger: cap, start: 'top bottom', end: 'bottom top', scrub: suave }
          });
        }
      }

      // El título se aleja con profundidad cuando sube la lista (solo celular)
      if (innerWidth < 960) {
        gsap.to($('.cap-intro', cap).children, {
          y: -60, opacity: .15, ease: 'none', stagger: .02,
          scrollTrigger: { trigger: $('.cap-lista', cap), start: 'top 90%', end: 'top 35%', scrub: suave }
        });
      }
    });

    // Cierre: el logo se arma trazo por trazo con el scroll
    const trazos = $$('.cierre-logo path');
    gsap.set(trazos, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(trazos, {
      strokeDashoffset: 0, ease: 'none', stagger: .12,
      scrollTrigger: { trigger: '.cierre', start: 'top 85%', end: 'top 20%', scrub: suave }
    });
    const tCierre = $('.cierre-titulo');
    partirPalabras(tCierre);
    gsap.fromTo($$('.palabra-m > span', tCierre), { yPercent: 118 }, {
      yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .06,
      scrollTrigger: { trigger: tCierre, start: 'top 85%', toggleActions: 'play none none reverse' }
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ScrollTrigger.refresh(); medir(); estadoScroll(); });
    ScrollTrigger.addEventListener('refresh', () => { medir(); estadoScroll(); });
  }

  /* Entrada de una tarjeta de video: llega de costado desde fuera de la pantalla,
     con un leve giro que se endereza y el video que se "acomoda" (escala).
     En compu además se abre con un barrido (clip-path); en pantallas táctiles
     se usa un fundido en su lugar (Safari en iPhone anima mejor solo transform y opacity). */
  function entradaTarjeta(fig, desdeDerecha, dur) {
    const tl = gsap.timeline();
    if (!fig) return tl;
    const marco = $('.medio-marco', fig), lienzo = $('.medio-lienzo', fig);
    const borde = $('.medio-borde', fig), pie = $('.medio-pie', fig);
    const fuera = () => {
      const r = fig.getBoundingClientRect();
      return desdeDerecha ? innerWidth - r.left + 40 : -(r.right + 40);
    };
    const barrido = !perf.tactil;
    const desde = { x: fuera, rotate: desdeDerecha ? 7 : -7, transformOrigin: desdeDerecha ? '0% 100%' : '100% 100%' };
    const hasta = { x: 0, rotate: 0, duration: dur, ease: 'expo.out' };
    if (barrido) {
      desde.clipPath = desdeDerecha ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
      hasta.clipPath = 'inset(0% 0% 0% 0%)';
    } else {
      desde.opacity = 0; hasta.opacity = 1;
    }
    tl.fromTo(marco, desde, hasta, 0)
      .fromTo(lienzo, { scale: 1.3 }, { scale: 1, duration: dur * 1.3, ease: 'expo.out' }, 0);
    if (borde) tl.fromTo(borde, { clipPath: 'inset(0% 100% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur * 1.1, ease: 'power2.inOut' }, dur * .3);
    if (pie) tl.fromTo(pie, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: dur * .7, ease: 'power3.out' }, dur * .4);
    return tl;
  }

  // Al terminar la carga, el logo de la portada aparece con un pequeño "respiro"
  function revelarPortada() {
    if (!hayGsap) return;
    gsap.fromTo('.portada-logo', { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'expo.out' });
    // El lugar y "Deslizá" aparecen con CSS (.portada-intro): si se animaran acá,
    // pisarían la animación del scroll cuando alguien desliza apenas carga.
  }

  /* ---------- 4. Ficha del producto ---------- */
  function prepararFicha(carta) {
    const ficha = $('#ficha');
    const panel = $('.ficha-panel', ficha);
    let origen = null, cierreT = 0;

    document.addEventListener('click', e => {
      const b = e.target.closest('.prod-btn');
      if (!b) return;
      abrir(+b.dataset.cat, +b.dataset.prod, b);
    });
    // Pasar el mouse por un producto hace girar el plato 3D de ese capítulo
    document.addEventListener('pointerover', e => {
      const b = e.target.closest('.prod-btn');
      if (b && e.pointerType === 'mouse') { estado.pulso = 1; }
    });

    function abrir(ci, pi, boton) {
      const c = carta.categorias[ci], p = c && c.productos[pi];
      if (!p) return;
      origen = boton;
      $('#ficha-cat').textContent = `${dosCifras(ci + 1)} ${c.titulo}`;
      $('#ficha-nombre').textContent = p.nombre;
      $('#ficha-desc').textContent = p.desc || '';
      $('#ficha-tags').innerHTML = (p.etiquetas || []).map(t => `<li>${etiqueta(t)}</li>`).join('');
      $('#ficha-precio').textContent = precio(p.precio);
      clearTimeout(cierreT);
      ficha.hidden = false;
      panel.style.removeProperty('--arrastre');
      requestAnimationFrame(() => requestAnimationFrame(() => ficha.classList.add('abierta')));
      if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
      estado.pulso = 1;
      panel.focus({ preventScroll: true });
    }
    function cerrar() {
      if (ficha.hidden) return;
      ficha.classList.remove('abierta');
      panel.style.removeProperty('--arrastre');
      if (lenis) lenis.start(); else document.body.style.overflow = '';
      cierreT = setTimeout(() => { ficha.hidden = true; }, 560);
      if (origen) origen.focus({ preventScroll: true });
    }
    ficha.addEventListener('click', e => { if (e.target.closest('[data-cerrar]')) cerrar(); });
    document.addEventListener('keydown', e => {
      if (ficha.hidden) return;
      if (e.key === 'Escape') cerrar();
      if (e.key === 'Tab') { e.preventDefault(); $('.ficha-cerrar').focus(); }
    });

    // Deslizar la ficha hacia abajo para cerrarla
    let y0 = null, dy = 0;
    panel.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || panel.scrollTop > 0 || e.target.closest('button')) return;
      y0 = e.clientY; dy = 0;
      ficha.classList.add('arrastrando');
    });
    addEventListener('pointermove', e => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      panel.style.setProperty('--arrastre', dy + 'px');
    }, { passive: true });
    const soltar = () => {
      if (y0 === null) return;
      y0 = null;
      ficha.classList.remove('arrastrando');
      if (dy > 90) cerrar(); else panel.style.removeProperty('--arrastre');
    };
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
  }
})();
