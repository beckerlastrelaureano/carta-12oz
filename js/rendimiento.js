/* =========================================================
   RENDIMIENTO.JS — decide cuánto 3D aguanta el teléfono
   Se carga en el <head>, antes que todo.

   Niveles:
   - "alto"  : 3D completo (vidrio, gotas, más granos, más nitidez)
   - "medio" : 3D liviano (menos resolución y partículas)
   - "bajo"  : sin 3D (fondo cálido y números grandes)

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
  const ahorro = !!(navigator.connection && navigator.connection.saveData);
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
    // Si el 3D anda lento, se baja de nivel en el momento
    bajar() {
      this.nivel = this.nivel === 'alto' ? 'medio' : 'bajo';
      document.documentElement.dataset.nivel = this.nivel;
      return this.nivel;
    }
  };
})();
