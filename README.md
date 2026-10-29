# Carta digital 12oz (12 Onzas Café, General Pico)

Carta web que se abre desde el QR o el chip NFC de la mesa. Escena 3D en tiempo real
(Three.js) que la cámara recorre con el scroll, un plato por capítulo.

> **Importante: la carta, los precios, las descripciones y el horario son DE EJEMPLO.**
> Hay que reemplazarlos por los reales antes de publicar (ver "Cómo editar").

## Cómo editar la carta

Todo está en **`data/carta.json`**. Se abre con cualquier editor de texto (Bloc de notas sirve).

- **Precio:** número sin `$` ni puntos. Ejemplo: `"precio": 3200`.
- **Producto nuevo:** copiá un bloque `{ "nombre": ..., "precio": ..., "desc": ..., "etiquetas": [...] }`,
  pegalo debajo y separalo del anterior con una coma.
- **Sacar un producto:** borrá su bloque `{ ... }` entero y la coma que lo separa.
- **Etiquetas:** texto libre, por ejemplo `["Vegano", "Sin TACC"]`. "De la casa" y "Nuevo" salen en color caramelo.
- **Categorías:** cada una tiene `titulo`, `bajada` (la frase en itálica) y `escena`
  (el dibujo 3D: `espresso`, `especial`, `frio`, `pasteleria`, `salado`, `combo`, `bebidas`).
  El orden del archivo es el orden de la carta y de la barra de arriba.
- **Negocio:** dirección, Instagram, link de Google Maps, WhatsApp y horarios.
  - `whatsapp`: número con código de país, sin `+` ni espacios (ej. `5492302000000`).
    **Mientras esté vacío, el botón de WhatsApp no aparece.**
  - `horarioDeEjemplo`: ponelo en `false` cuando cargues el horario real (saca el aviso).
  - `numeros` de cada horario: 0 = domingo, 1 = lunes ... 6 = sábado. Se usan para "Abierto ahora".

Si el JSON queda mal escrito (por ejemplo, falta una coma), la carta muestra un aviso.
Podés revisarlo pegándolo en https://jsonlint.com

Los textos fijos de la portada y el cierre están en `index.html`, marcados con comentarios.

## Probarla en la compu

Desde la carpeta `BECKER`, en la vista previa de Claude con la configuración `carta-12oz`
(puerto 5192), o con `npx http-server carta-12oz -p 5192`. Abrí http://localhost:5192

Para probar a mano:
- `?nivel=alto`, `?nivel=medio`, `?nivel=bajo` fuerza la calidad del 3D (bajo = sin 3D).
- `?quieto=1` simula "reducir movimiento" del teléfono.

## Cada vez que cambies algo

GitHub Pages guarda copias unos 10 minutos. En `index.html` subí el número `?v=N` del archivo
que cambiaste (por ejemplo `css/carta.css?v=1` pasa a `?v=2`). `data/carta.json` se pide siempre nuevo.

## Archivos

- `index.html`: estructura y textos fijos.
- `css/carta.css`: estilos (colores en `:root`, arriba de todo).
- `js/rendimiento.js`: decide la calidad según el teléfono.
- `js/app.js`: arma la carta desde el JSON, barra de categorías, animaciones, ficha del producto.
- `js/escena.js`: la escena 3D (todo dibujado con código, sin modelos externos).
- `data/carta.json`: la carta.
- `img/`: logo, favicon e imagen para compartir (`og.png`).

## Pendiente antes de publicar

- Carta, precios y horario reales.
- Dirección exacta y número de WhatsApp.
- Confirmar la dirección web final: hoy los meta tags, `robots.txt` y `sitemap.xml`
  apuntan a `https://beckerlastrelaureano.github.io/carta-12oz/`.
