import bwipjs from 'bwip-js/node'
import { registroDe } from '../../../registro.js'

const log = registroDe('etiqueta')

// Implementacion vigente: pliego A4 con etiquetas repetidas, para recortar.
// Es lo que se puede imprimir con la impresora comun que tiene el comercio.

const escapar = (valor) => String(valor ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const pesos = (valor) => Number(valor).toLocaleString('es-AR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})

/**
 * Code 128 en SVG. Va incrustado y no como archivo aparte para que la etiqueta
 * sea un solo documento: se abre, se imprime y no hay nada mas que cargar.
 */
const codigoDeBarras = async (codigo) => {
  try {
    return await bwipjs.toSVG({
      bcid: 'code128',
      text: codigo,
      scale: 2,
      height: 9,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    })
  } catch (error) {
    // Una etiqueta sin barras sigue sirviendo: el codigo va impreso debajo en
    // texto. Fallar entera por esto seria peor que entregarla incompleta.
    log.warn({ codigo, err: error }, 'no se pudo generar el codigo de barras')
    return ''
  }
}

const ESTILO = `
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 400 10pt/1.3 'Archivo', system-ui, sans-serif; color: #17181a; background: #fff; }
    .pliego { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .etiqueta {
      border: 0.4pt dashed #9a968c; padding: 4mm 3mm; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 1.5mm;
      break-inside: avoid; min-height: 34mm; justify-content: center;
    }
    .denominacion { font-size: 8.5pt; font-weight: 600; line-height: 1.2; min-height: 2.4em; }
    .barras svg { display: block; height: 13mm; width: auto; max-width: 100%; }
    .codigo { font-size: 7pt; letter-spacing: .08em; font-variant-numeric: tabular-nums; color: #55554f; }
    .precio {
      font: 400 15pt/1 'Archivo Black', 'Archivo', sans-serif;
      font-variant-numeric: tabular-nums; margin-top: .5mm;
    }
    .precio small { font-size: .55em; font-weight: 400; vertical-align: .25em; opacity: .7; }
    .barra { text-align: center; margin: 0 0 6mm; }
    .barra button {
      font: 600 10pt 'Archivo', sans-serif; text-transform: uppercase; letter-spacing: .1em;
      background: #e4322b; color: #f5f1e6; border: 2pt solid #17181a; border-radius: 2pt;
      padding: 3mm 8mm; cursor: pointer;
    }
    @media print { .barra { display: none } }`

const unaEtiqueta = (producto, barras) => `
      <div class="etiqueta">
        <div class="denominacion">${escapar(producto.denominacion)}</div>
        <div class="barras">${barras}</div>
        <div class="codigo">${escapar(producto.codigoInterno)}</div>
        <div class="precio"><small>$</small>${pesos(producto.precioMinorista)}</div>
      </div>`

/** @type {import('./etiqueta.puerto.js').GeneradorEtiqueta} */
export const generadorEtiquetaHtml = {
  formato: 'html-a4-pliego',

  generar: async (producto, cantidad = 12) => {
    const barras = await codigoDeBarras(producto.codigoInterno)
    const total = Math.min(Math.max(Number(cantidad) || 12, 1), 60)

    const contenido = `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <title>Etiquetas ${escapar(producto.codigoInterno)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Archivo+Black&display=swap" rel="stylesheet">
  <style>${ESTILO}</style>
</head>
<body>
  <div class="barra"><button type="button" onclick="window.print()">Imprimir</button></div>
  <div class="pliego">${Array.from({ length: total }, () => unaEtiqueta(producto, barras)).join('')}</div>
  <script>
    const imprimir = () => setTimeout(() => window.print(), 150)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(imprimir)
    else window.addEventListener('load', imprimir)
  </script>
</body>
</html>`

    return {
      contenido,
      tipoMime: 'text/html; charset=utf-8',
      nombreArchivo: `etiquetas-${producto.codigoInterno}.html`,
    }
  },
}
