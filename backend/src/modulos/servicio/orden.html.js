import { escapar, fechaLegible } from '../../http/html.js'

// RF21.9 — la orden de servicio, en HTML listo para imprimir en HOJA A4, que es
// la impresora que tiene el comercio. Es la hoja que el cliente se lleva y la
// que tiene que exhibir para retirar el equipo (H09).
//
// Las condiciones que figuran abajo son las tres que el comercio ya tiene
// escritas en su ficha de papel (H07, H08 y H09). No se agregan clausulas: lo
// que no esta relevado no se inventa en un documento que el cliente firma. Los
// plazos y el porcentaje no estan en esta plantilla: llegan de
// parametro_sistema con la orden, asi que si el comercio los cambia, la hoja
// cambia con ellos.
//
// La tinta se raciona, como en el comprobante: el ambar del encabezado es el
// unico fondo pleno de la hoja.

const ETIQUETA_SELLOS = {
  INTACTOS: 'Intactos',
  VIOLADOS: 'Rotos o cortados',
  SIN_SELLO: 'Sin sello colocado',
}

const ESTILO = `
    @page { size: A4; margin: 16mm 15mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: #fff; color: #17181a;
      font: 400 10.5pt/1.4 'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .hoja { max-width: 180mm; margin: 0 auto; }

    .chapa {
      border: 2.5pt solid #17181a; background: #f0b429;
      padding: 4.5mm 6mm; display: flex; justify-content: space-between;
      align-items: flex-start; gap: 8mm;
    }
    .marca { margin: 0; font: 400 22pt/0.9 'Archivo Black', 'Archivo', sans-serif; text-transform: uppercase; letter-spacing: -0.01em; }
    .marca span { display: block; font-size: 0.58em; color: #b3211c; margin-top: 1mm; }
    .sello { text-align: right; }
    .sello p { margin: 0; }
    .sello .rotulo { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; }
    .sello .numero { font: 400 19pt/1 'Archivo Black', 'Archivo', sans-serif; font-variant-numeric: tabular-nums; margin-top: 1.5mm; }

    .filete { height: 2mm; margin: 3.5mm 0 3mm; }
    .filete i { display: block; }
    .filete i:first-child { height: 1.1mm; background: #e4322b; }
    .filete i:last-child { height: 0.4mm; background: #f0b429; margin-top: 0.5mm; }

    h2 { margin: 5mm 0 2mm; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: #55554f; border-bottom: 0.5pt solid #17181a; padding-bottom: 1mm; }
    dl { display: flex; flex-wrap: wrap; gap: 2.5mm 9mm; margin: 0; font-size: 10pt; }
    dl div { min-width: 40mm; }
    dt { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #55554f; }
    dd { margin: 0.4mm 0 0; font-weight: 600; }
    dl .ancho { flex-basis: 100%; }
    .texto { margin: 0; white-space: pre-wrap; font-size: 10.5pt; }
    .vacio { color: #55554f; font-style: italic; }

    .marcado { display: inline-block; border: 1.5pt solid #17181a; padding: 0.4mm 2mm; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; }
    .marcado.alerta { border-color: #b3211c; color: #b3211c; }

    .condiciones { margin: 0; padding: 0; list-style: none; font-size: 9.5pt; }
    .condiciones li { padding: 1.6mm 0; border-bottom: 0.3pt solid #c9c7bf; }
    .condiciones li:last-child { border-bottom: none; }
    .condiciones strong { font-weight: 700; }

    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 16mm; }
    .firmas div { border-top: 0.8pt solid #17181a; padding-top: 1.5mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.12em; color: #55554f; }

    .pie { margin-top: 6mm; font-size: 8pt; color: #55554f; display: flex; justify-content: space-between; gap: 6mm; }

    .barra { margin: 8mm 0 0; text-align: center; }
    .barra button {
      font: 600 10pt 'Archivo', sans-serif; text-transform: uppercase; letter-spacing: 0.1em;
      background: #e4322b; color: #f5f1e6; border: 2pt solid #17181a; border-radius: 2pt;
      padding: 3mm 8mm; cursor: pointer;
    }
    @media print { .barra { display: none } }`

const dato = (rotulo, valor, clase = '') =>
  `<div${clase ? ` class="${clase}"` : ''}><dt>${rotulo}</dt><dd>${valor}</dd></div>`

const plantilla = (orden) => {
  const persona = orden.cliente?.persona
  const modelo = orden.dispositivo?.modelo
  const equipo = [modelo?.marca?.nombre, modelo?.denominacion].filter(Boolean).join(' ')
  const { garantiaDias, plazoRetiroDias, recargoPct } = orden.reglas

  const sellosRotos = orden.estadoSellos === 'VIOLADOS'

  return `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <title>Orden de servicio ${escapar(orden.numeroOrden)}</title>
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
        <p class="rotulo">Orden de servicio técnico</p>
        <p class="numero">${escapar(orden.numeroOrden)}</p>
      </div>
    </header>

    <div class="filete" aria-hidden="true"><i></i><i></i></div>

    <dl>
      ${dato('Fecha de ingreso', fechaLegible(orden.fechaIngreso))}
      ${dato('Recibió', escapar(orden.recibidoPor?.nombreUsuario ?? '-'))}
      ${orden.ordenAnterior ? dato('Reingreso por garantía de', escapar(orden.ordenAnterior.numeroOrden)) : ''}
    </dl>

    <h2>Cliente</h2>
    <dl>
      ${dato('Apellido y nombre', escapar(persona?.apellidoNombre ?? '-'), 'ancho')}
      ${persona?.numeroDocumento ? dato('Documento', `${escapar(persona.tipoDocumento)} ${escapar(persona.numeroDocumento)}`) : ''}
      ${dato('WhatsApp', escapar(persona?.telefonoWhatsapp ?? 'Sin cargar'))}
    </dl>

    <h2>Equipo</h2>
    <dl>
      ${dato('Marca y modelo', escapar(equipo || '-'))}
      ${dato('IMEI o n.º de serie', escapar(orden.dispositivo?.imeiSerie ?? 'No se pudo leer'))}
      ${orden.dispositivo?.color ? dato('Color', escapar(orden.dispositivo.color)) : ''}
      ${dato('Accesorios entregados', escapar(orden.accesoriosRecibidos ?? 'Ninguno'))}
    </dl>

    <h2>Falla declarada por el cliente</h2>
    <p class="texto">${escapar(orden.fallaDeclarada)}</p>

    <h2>Estado del equipo al ingresar</h2>
    <p class="texto">${escapar(orden.estadoIngreso)}</p>

    <h2>Sellos del comercio</h2>
    <p class="texto"><span class="marcado${sellosRotos ? ' alerta' : ''}">${escapar(ETIQUETA_SELLOS[orden.estadoSellos] ?? orden.estadoSellos)}</span></p>

    <h2>Condiciones</h2>
    <ul class="condiciones">
      <li><strong>Garantía:</strong> ${garantiaDias} días corridos desde la entrega, sobre lo reparado. Se anula si los sellos o precintos colocados por el comercio se presentan rasgados o cortados.</li>
      <li><strong>Retiro:</strong> el equipo debe retirarse dentro de los ${plazoRetiroDias} días de notificado. Pasado ese plazo se aplica un recargo del ${recargoPct}% sobre el monto de la reparación.</li>
      <li><strong>Para retirar el equipo es obligatorio exhibir esta orden.</strong></li>
    </ul>

    <div class="firmas">
      <div>Firma y aclaración del cliente</div>
      <div>Por El Gringo Celulares</div>
    </div>

    <div class="pie">
      <span>Orden ${escapar(orden.numeroOrden)} · ${fechaLegible(orden.fechaIngreso)}</span>
      <span>Documento interno, no válido como factura</span>
    </div>

    <div class="barra">
      <button type="button" onclick="window.print()">Imprimir</button>
    </div>
  </div>

  <script>
    // Se espera a que carguen las fuentes: imprimir antes deja la hoja con la
    // letra de reemplazo y los anchos cambiados.
    const imprimir = () => setTimeout(() => window.print(), 120)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(imprimir)
    else window.addEventListener('load', imprimir)
  </script>
</body>
</html>`
}

/** @param {object} orden la que devuelve detalleOrden: ya trae las reglas vigentes */
export const generarDocumentoOrden = (orden) => ({
  contenido: plantilla(orden),
  tipoMime: 'text/html; charset=utf-8',
  nombreArchivo: `orden-${orden.numeroOrden}.html`,
})
