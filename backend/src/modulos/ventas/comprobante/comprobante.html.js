import { aPesos, aCentavos } from '../ventas.reglas.js'

// Implementacion vigente del contrato: comprobante interno no fiscal (S05),
// en HTML listo para imprimir en HOJA A4, que es la impresora que tiene el
// comercio. No es un ticket de rollo: hay ancho para columnas y encabezado.
//
// La tinta se raciona: el ambar del encabezado es el unico fondo pleno de la
// hoja. Todo lo demas es negro sobre blanco, que es lo que imprime bien en
// cualquier impresora y no gasta un cartucho por venta.

const escapar = (valor) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const pesos = (valor) => aPesos(aCentavos(valor))

const fechaLegible = (fecha) => new Date(fecha).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

const MODALIDADES = {
  CONTADO: 'Contado',
  FINANCIACION_PROPIA: 'Financiacion del comercio',
  TARJETA_CUOTAS: 'Tarjeta en cuotas',
  GO_CUOTAS: 'Go Cuotas',
}

const filaDetalle = (linea) => `
        <tr>
          <td class="cod">${escapar(linea.producto?.codigoInterno ?? '')}</td>
          <td>${escapar(linea.producto?.denominacion ?? '')}</td>
          <td class="n">${linea.cantidad}</td>
          <td class="n">${pesos(linea.precioUnitario)}</td>
          <td class="n">${aPesos(aCentavos(linea.precioUnitario) * linea.cantidad)}</td>
        </tr>`

const ESTILO = `
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: #fff; color: #17181a;
      font: 400 11pt/1.45 'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .hoja { max-width: 178mm; margin: 0 auto; }
    .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cod { font-variant-numeric: tabular-nums; color: #55554f; font-size: 9pt; }

    /* El unico fondo pleno de la hoja. */
    .chapa {
      border: 2.5pt solid #17181a; background: #f0b429;
      padding: 5mm 6mm; display: flex; justify-content: space-between;
      align-items: flex-start; gap: 8mm;
    }
    .marca { font: 400 24pt/0.9 'Archivo Black', 'Archivo', sans-serif; text-transform: uppercase; letter-spacing: -0.01em; }
    .marca span { display: block; font-size: 0.58em; color: #b3211c; margin-top: 1mm; }
    .sello { text-align: right; }
    .sello .rotulo { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; }
    .sello .numero { font: 400 17pt/1 'Archivo Black', 'Archivo', sans-serif; font-variant-numeric: tabular-nums; margin-top: 1.5mm; }

    /* El filete: unico ornamento, y solo como remate de encabezado. */
    .filete { height: 2mm; margin: 4mm 0 3mm; }
    .filete i { display: block; }
    .filete i:first-child { height: 1.1mm; background: #e4322b; }
    .filete i:last-child { height: 0.4mm; background: #f0b429; margin-top: 0.5mm; }

    .datos { display: flex; flex-wrap: wrap; gap: 3mm 10mm; font-size: 9.5pt; }
    .datos div { min-width: 42mm; }
    .datos dt { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #55554f; }
    .datos dd { margin: 0.5mm 0 0; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; margin-top: 6mm; }
    thead th {
      text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.14em; padding: 0 0 2mm; border-bottom: 1.5pt solid #17181a;
    }
    thead th.n { text-align: right; }
    tbody td { padding: 2.2mm 0; border-bottom: 0.3pt solid #c9c7bf; vertical-align: top; }

    .totales { margin-top: 5mm; margin-left: auto; width: 78mm; }
    .totales tr td { border: none; padding: 1.2mm 0; font-size: 10pt; }
    .totales .total td {
      border-top: 1.5pt solid #17181a; padding-top: 3mm;
      font: 400 20pt/1 'Archivo Black', 'Archivo', sans-serif; font-variant-numeric: tabular-nums;
    }
    .totales .total td:first-child { font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; vertical-align: bottom; padding-bottom: 1.5mm; }

    .pie { margin-top: 12mm; border-top: 0.5pt solid #c9c7bf; padding-top: 3mm; font-size: 8.5pt; color: #55554f; display: flex; justify-content: space-between; gap: 6mm; }
    .aviso { font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: #17181a; }

    .barra { margin: 8mm 0 0; text-align: center; }
    .barra button {
      font: 600 10pt 'Archivo', sans-serif; text-transform: uppercase; letter-spacing: 0.1em;
      background: #e4322b; color: #f5f1e6; border: 2pt solid #17181a; border-radius: 2pt;
      padding: 3mm 8mm; cursor: pointer;
    }
    @media print { .barra { display: none } }`

const plantilla = (venta) => {
  const totalCentavos = aCentavos(venta.montoTotal)
  const recargoCentavos = aCentavos(venta.recargoFinanciacion)
  const cliente = venta.cliente?.persona?.apellidoNombre ?? 'Consumidor final'
  const documento = venta.cliente?.persona?.numeroDocumento
  const cuotas = venta.cantidadCuotas ? ` en ${venta.cantidadCuotas} cuotas` : ''

  return `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <title>Comprobante ${escapar(venta.numeroComprobante)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Archivo+Black&display=swap" rel="stylesheet">
  <style>${ESTILO}</style>
</head>
<body>
  <div class="hoja">
    <header class="chapa">
      <p class="marca">El Gringo<span>Celulares</span></p>
      <div class="sello">
        <p class="rotulo">Comprobante no fiscal</p>
        <p class="numero">${escapar(venta.numeroComprobante)}</p>
      </div>
    </header>

    <div class="filete" aria-hidden="true"><i></i><i></i></div>

    <dl class="datos">
      <div><dt>Fecha</dt><dd>${fechaLegible(venta.fechaHora)}</dd></div>
      <div><dt>Cliente</dt><dd>${escapar(cliente)}${documento ? ` · ${escapar(documento)}` : ''}</dd></div>
      <div><dt>Lista aplicada</dt><dd>${escapar(venta.listaPrecioAplicada)}</dd></div>
      <div><dt>Atendio</dt><dd>${escapar(venta.vendedor?.nombreUsuario ?? '-')}</dd></div>
    </dl>

    <table>
      <thead>
        <tr>
          <th>Codigo</th><th>Producto</th>
          <th class="n">Cant.</th><th class="n">Precio</th><th class="n">Subtotal</th>
        </tr>
      </thead>
      <tbody>${(venta.detalle ?? []).map(filaDetalle).join('')}
      </tbody>
    </table>

    <table class="totales">
      <tbody>
        <tr><td>Subtotal</td><td class="n">${aPesos(totalCentavos)}</td></tr>
        ${recargoCentavos > 0 ? `<tr><td>Recargo por financiacion</td><td class="n">${aPesos(recargoCentavos)}</td></tr>` : ''}
        <tr class="total"><td>Total</td><td class="n">$${aPesos(totalCentavos + recargoCentavos)}</td></tr>
      </tbody>
    </table>

    <div class="pie">
      <span>
        ${escapar(MODALIDADES[venta.modalidadPago] ?? venta.modalidadPago)}${escapar(cuotas)}
        · ${escapar(venta.pago?.medioPago?.nombre ?? '-')}
        <br>
        ${venta.modalidadEntrega === 'ENVIO_DOMICILIO'
          ? `Envio a ${escapar(venta.domicilioEntrega)}`
          : 'Retiro en el local'}
      </span>
      <span class="aviso">Documento no valido como factura</span>
    </div>

    <div class="barra">
      <button type="button" onclick="window.print()">Imprimir</button>
    </div>
  </div>

  <script>
    // Se espera a que carguen las fuentes: imprimir antes deja la hoja con la
    // letra de reemplazo y los anchos de columna cambiados.
    const imprimir = () => setTimeout(() => window.print(), 120)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(imprimir)
    else window.addEventListener('load', imprimir)
  </script>
</body>
</html>`
}

/** @type {import('./comprobante.puerto.js').GeneradorComprobante} */
export const generadorHtml = {
  formato: 'html-a4-no-fiscal',
  generar: async (venta) => ({
    contenido: plantilla(venta),
    tipoMime: 'text/html; charset=utf-8',
    nombreArchivo: `comprobante-${venta.numeroComprobante}.html`,
  }),
}
