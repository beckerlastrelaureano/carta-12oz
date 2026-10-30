/* =========================================================
   MEDIOS.JS — tarjetas de video de la portada y de cada capítulo
   1. Arma la tarjeta (video + póster + grano + brillo + viñeta + pie)
   2. Pide el póster y el video recién cuando la tarjeta está cerca
   3. Reproduce solo la tarjeta que se ve (2 como mucho al cambiar de capítulo)
   4. Con "ahorro de datos" o "reducir movimiento": solo el póster

   Qué video usa cada capítulo se elige en data/carta.json
   ("video": "cafe", ...). Los archivos están en video/:
   nombre.mp4 (el clip) y nombre.jpg (el póster, primer cuadro).
   Si una categoría no tiene video, se usa la foto de img/platos/
   ("foto": "salado") con un movimiento lento tipo cinemagraph.

   La animación de entrada (de costado) la hace js/app.js con GSAP.
   ========================================================= */

(function () {
  const perf = window.CARTA_PERF || { nivel: 'bajo', reducir: true };
  const html = document.documentElement;
  const ahorro = !!(navigator.connection && navigator.connection.saveData);
  // Sin video en movimiento: ahorro de datos o "reducir movimiento"
  const soloPoster = ahorro || perf.reducir;
  if (ahorro) html.classList.add('ahorro-datos');
  if (soloPoster) html.classList.add('medios-quietos');
  // Sin GSAP (o con "reducir movimiento") la tarjeta aparece con un fundido simple
  const conGsap = !!(window.gsap && window.ScrollTrigger) && !perf.reducir;
  if (!conGsap && 'IntersectionObserver' in window) html.classList.add('medios-fade');

  const MAX_A_LA_VEZ = 2;   // normalmente suena 1; 2 solo mientras cambia el capítulo
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 1. Armado ----------
     Convierte <figure class="medio" data-video="cafe" data-foto="cafe" data-pie="..." data-num="01" data-lado="izq">
     en la tarjeta completa. Sin data-video = foto quieta con movimiento lento. */
  function armar(raiz) {
    (raiz || document).querySelectorAll('figure.medio:not([data-armado])').forEach(fig => {
      const d = fig.dataset;
      let media;
      if (d.video) {
        const v = esc(d.video);
        // El póster va también como <img> debajo del video: se ve aunque el video no arranque
        // (iPhone en bajo consumo, datos móviles, etc.). El video no tiene autoplay:
        // lo reproduce este archivo solo cuando la tarjeta se ve.
        media = `
          <img class="medio-media medio-poster" data-src="video/${v}.jpg" alt="" width="540" height="960" decoding="async">
          <video class="medio-media medio-video" muted playsinline loop preload="none" data-poster="video/${v}.jpg"
                 disablepictureinpicture disableremoteplayback tabindex="-1">
            <source data-src="video/${v}.mp4" type="video/mp4">
          </video>`;
      } else {
        const f = esc(d.foto || 'portada');
        media = `<img class="medio-media medio-poster medio-cine" data-src="img/platos/${f}.jpg"
                   data-srcset="img/platos/${f}-chica.jpg 900w, img/platos/${f}.jpg 1800w" alt="" decoding="async">
                 <span class="medio-reflejo"></span>`;
      }
      fig.innerHTML = `
        <div class="medio-mueve">
          <div class="medio-marco">
            <div class="medio-lienzo">${media}</div>
            <span class="medio-grano"></span>
            <span class="medio-luz"></span>
            <span class="medio-vineta"></span>
            <span class="medio-borde"></span>
          </div>
          ${d.pie ? `<figcaption class="medio-pie">${d.num ? `<span class="medio-pie-num">${esc(d.num)}</span> ` : ''}<span>${esc(d.pie)}</span></figcaption>` : ''}
        </div>`;
      fig.setAttribute('aria-hidden', 'true');
      fig.dataset.armado = '1';
      if (!d.video) fig.classList.add('medio-sin-video');
    });
  }

  /* ---------- 2. Carga ---------- */
  const visibles = new Map();   // tarjeta -> cuánto se ve (0 a 1)
  let ioCerca = null, ioVer = null;

  // El póster se pide una sola vez, cuando la tarjeta está por aparecer.
  // Si el póster no existe, cae a la foto del plato (data-foto) para que nunca quede vacía.
  function cargarPoster(fig) {
    if (fig.dataset.cargado) return;
    fig.dataset.cargado = '1';
    fig.querySelectorAll('img[data-src]').forEach(img => {
      img.addEventListener('error', () => {
        const f = fig.dataset.foto;
        if (f && !img.dataset.respaldo) {
          img.dataset.respaldo = '1';
          img.removeAttribute('srcset');
          img.src = `img/platos/${f}-chica.jpg`;
        }
      });
      if (img.dataset.srcset) { img.sizes = '(min-width: 960px) 30vw, 70vw'; img.srcset = img.dataset.srcset; }
      img.src = img.dataset.src;
    });
  }

  // El video recibe su archivo cuando está a menos de una pantalla y lo suelta
  // cuando queda lejos (así el teléfono libera el decodificador).
  function conectarVideo(fig, cerca) {
    const vid = fig.querySelector('video');
    if (!vid || soloPoster || fig.classList.contains('sin-video')) return;
    const s = vid.querySelector('source');
    if (cerca && !s.getAttribute('src')) {
      if (!vid.dataset.oyentes) {
        vid.dataset.oyentes = '1';
        vid.addEventListener('playing', () => fig.classList.add('reproduce'));
        // Si el archivo falla, queda el póster y no se reintenta
        // (si el archivo se soltó a propósito por estar lejos, no es un error)
        s.addEventListener('error', () => {
          if (!s.getAttribute('src')) return;
          fig.classList.add('sin-video'); fig.classList.remove('reproduce');
        });
      }
      vid.poster = vid.dataset.poster;
      s.src = s.dataset.src;
      vid.muted = true;
      vid.load();
    } else if (!cerca && s.getAttribute('src')) {
      vid.pause();
      s.removeAttribute('src');
      vid.removeAttribute('poster');
      vid.load();
      fig.classList.remove('reproduce');
    }
  }

  /* ---------- 3. Reproducción ---------- */
  function repartir() {
    if (soloPoster) return;
    const orden = [...visibles.entries()]
      .filter(([, r]) => r >= .25)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_A_LA_VEZ)
      .map(([f]) => f);
    document.querySelectorAll('figure.medio').forEach(fig => {
      const vid = fig.querySelector('video');
      if (!vid || fig.classList.contains('sin-video')) return;
      const conArchivo = !!vid.querySelector('source').getAttribute('src');
      const debe = conArchivo && orden.includes(fig) && !document.hidden;
      if (debe && vid.paused) {
        const p = vid.play();
        // iPhone en bajo consumo o navegador que no deja: queda el póster, sin reintentar
        if (p && p.catch) p.catch(err => {
          if (err && err.name === 'AbortError') return;   // se pausó antes de arrancar: no es un error
          fig.classList.add('sin-video');
          fig.classList.remove('reproduce');
        });
      } else if (!debe && !vid.paused) {
        vid.pause();
      }
    });
  }

  function observar(raiz) {
    const figs = [...(raiz || document).querySelectorAll('figure.medio[data-armado]:not([data-observado])')];
    figs.forEach(f => { f.dataset.observado = '1'; });
    if (!('IntersectionObserver' in window)) {
      figs.forEach(f => { cargarPoster(f); f.classList.add('visto'); });
      return;
    }
    if (!ioCerca) {
      // A menos de una pantalla: póster + archivo de video. Lejos: se suelta el video.
      ioCerca = new IntersectionObserver(ents => ents.forEach(en => {
        if (en.isIntersecting) cargarPoster(en.target);
        conectarVideo(en.target, en.isIntersecting);
        repartir();
      }), { rootMargin: '100% 0px 100% 0px' });
      ioVer = new IntersectionObserver(ents => {
        ents.forEach(en => {
          if (en.isIntersecting) {
            visibles.set(en.target, en.intersectionRatio);
            en.target.classList.add('visto');   // para el fundido sin GSAP
          } else {
            visibles.delete(en.target);
          }
        });
        repartir();
      }, { threshold: [0, .25, .5, .75, 1] });
      document.addEventListener('visibilitychange', repartir);
    }
    figs.forEach(f => { ioCerca.observe(f); ioVer.observe(f); });
  }

  // La portada está en index.html: se arma apenas carga este archivo
  armar(document.querySelector('.portada'));
  observar(document.querySelector('.portada'));

  window.CARTA_MEDIOS = { armar, observar, soloPoster };
})();
