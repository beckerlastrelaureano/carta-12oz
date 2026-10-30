/* =========================================================
   RENDIMIENTO.JS — decide cuánto 3D aguanta el teléfono
   Se carga en el <head>, antes que todo.

   Niveles (el fondo es la foto del capítulo, desenfocada y oscura):
   - "alto"  : fondo animado completo (bokeh, vapor, motas de luz)
   - "medio" : fondo animado liviano (menos resolución)
   - "bajo"  : sin WebGL. El fondo NO queda vacío: es una foto fija
               desenfocada (la pone css/escena.css con body::before).
   Si el fondo animado anda lento, js/escena.js se simplifica solo
   y como mucho baja a "medio": nunca se apaga por lentitud.

   Para probar un nivel a mano, agregá al link:
   ?nivel=alto   ?nivel=medio   ?nivel=bajo
   No hace falta editar este archivo.
   ========================================================= */

// La carta siempre abre desde arriba al recargar
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

window.CARTA_PERF = (function () {
  // ?nivel=... (para probar) muestra el movimiento completo; ?quieto=1 simula "reducir movimiento"
  const params = new URLSearchParams(location.search);
  const reducir = params.has('quieto') || (matchMedia('(prefers-reduced-motion: reduce)').matches && !params.has('nivel'));
  // "Ahorro de datos": solo lo informan Chrome/Android. Si está, se respeta;
  // si no existe (Safari, Firefox) se decide con lo demás.
  const ahorro = !!(navigator.connection && navigator.connection.saveData === true);
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 4;          // en GB (solo Chrome lo informa)
  const tactil = matchMedia('(pointer: coarse)').matches;

  const webgl = (function () {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  })();

  let nivel = 'alto';
  if (ahorro || !webgl || memoria <= 1) nivel = 'bajo';
  else if (nucleos <= 4 || memoria <= 3 || (tactil && nucleos <= 6)) nivel = 'medio';

  const forzado = params.get('nivel');
  if (['alto', 'medio', 'bajo'].includes(forzado)) nivel = forzado;

  document.documentElement.dataset.nivel = nivel;
  if (reducir) document.documentElement.classList.add('reducir');

  return {
    nivel,
    tactil,
    // reducir: sin animaciones de scroll ni scroll suave
    reducir,
    // quieto: el 3D no se mueve solo; solo gira si lo arrastrás con el dedo
    quieto: reducir,
    // Si el fondo anda lento, se baja de nivel en el momento.
    // Por defecto no pasa de "medio" (así el fondo animado sigue);
    // bajar(true) permite llegar a "bajo".
    bajar(hastaBajo) {
      this.nivel = this.nivel === 'alto' ? 'medio' : (hastaBajo ? 'bajo' : this.nivel);
      document.documentElement.dataset.nivel = this.nivel;
      return this.nivel;
    }
  };
})();
