// Reglas puras de recepcion de mercaderia y extraccion OCR (RF10 / S04).

const DESCARTE_INICIO = /^(?:sub\s*-?\s*total|total(?:\s+general|\s+a\s+pagar|\s+neto)?|iva(?:\s+\d+(?:[.,]\d+)?%?)?|c\.?u\.?i\.?t\.?|c\.?u\.?i\.?l\.?|d\.?n\.?i\.?|ingresos?\s+brutos|i\.?i\.?b\.?b\.?|fecha|hora|c\.?a\.?e\.?|vto\.?|vio\.?\s*cae|vencimiento|condici[oó]n(?:\s+de)?\s+venta|forma\s+de\s+pago|medio\s+de\s+pago|efectivo|transferencia|tarjeta|cambio|vuelto|descuento|recargo|bonificaci[oó]n|percepci[oó]n|retenci[oó]n|impuesto|env[ií]o|flete|saldo|cliente|domicilio|direcci[oó]n|localidad|raz[oó]n\s+social|factura(?:\s+[abc])?|remito|ticket|nro\.?|n[uú]mero|comprobante|punto\s+de\s+venta|cant\.?(?:idad)?|descripci[oó]n|detalle|art[ií]culo|producto|c[oó]digo|precio|p\.?\s*unit\.?|p\.?\s*total|importe|p[aá]gina)\b/i

const PALABRAS_VACIAS = new Set(['para', 'con', 'sin', 'por', 'los', 'las', 'del', 'una', 'uno', 'tipo', 'modelo'])

// Patron tolerante a puntos/comas de miles y decimales (ej: 12.990,00 / 7,500,00 / 1500.50 / 1.500)
const MONTO = '\\d+(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?'
const RX_MULT_INICIO = new RegExp(`^(\\d{1,4})\\.?\\s*[xX×]\\s*(?:u\\.?|un\\.?|u\\/)?\\s*\\$?\\s*(${MONTO})\\s+(.+)$`)
const RX_MULT_FINAL = new RegExp(`^(.*?)\\s+\\$?\\s*(${MONTO})$`)
const RX_MULT_DESC = new RegExp(`^(.+?)\\s+(\\d{1,4})\\.?\\s*[xX×]\\s*\\$?\\s*(${MONTO})(?:\\s+\\$?\\s*(${MONTO}))?$`)
const RX_TABULAR = new RegExp(`^(\\d{1,4})\\.?(?:\\s*(?:u\\.?|un\\.?|uni\\.?|pza\\.?|pz\\.?))?\\s+(.+?)\\s+(?:\\$?\\s*(${MONTO})\\s+)?\\$?\\s*(${MONTO})$`)
const RX_DESC_CANT = new RegExp(`^(.+?)\\s+(\\d{1,4})(?:\\s*(?:u\\.?|un\\.?|uni\\.?|pza\\.?|pz\\.?))?\\s+\\$?\\s*(${MONTO})(?:\\s+\\$?\\s*(${MONTO}))?$`)
const RX_DOS_MONTOS = new RegExp(`^(.+?)\\s+\\$?\\s*(${MONTO})\\s+\\$?\\s*(${MONTO})$`)

const redondear2 = (n) => Math.round(n * 100) / 100

/**
 * Convierte un importe en formato argentino o con ruido OCR de separadores
 * ($ 1.234,50 / 7,500,00 / 12.990.00 / 850,25 / 1.500) a Number.
 */
export const parsearNumeroAr = (crudo) => {
  if (!crudo) return null
  const limpio = String(crudo).replace(/[$\s]/g, '').trim()
  if (!limpio || !/\d/.test(limpio)) return null

  let normalizado = limpio
  const conDecimales = limpio.match(/^(\d+(?:[.,]\d{3})*)[.,](\d{1,2})$/)
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(limpio)) {
    // 1.500 o 1,500 o 1.234.567 -> separadores de miles sin decimales
    normalizado = limpio.replace(/[.,]/g, '')
  } else if (conDecimales) {
    // El ultimo bloque de 1-2 digitos tras punto o coma es la parte decimal
    // (cubre "12.990,00", "7,500,00", "7.500.00" y "850,25").
    normalizado = `${conDecimales[1].replace(/[.,]/g, '')}.${conDecimales[2]}`
  }

  const valor = Number(normalizado)
  return Number.isFinite(valor) && valor >= 0 ? redondear2(valor) : null
}

const limpiarDescripcion = (texto) =>
  String(texto ?? '')
    .replace(/\s+/g, ' ')
    // Restos del borde izquierdo de la tabla: "= Bateria", "=//. + Cables",
    // "De > Pin", ") - a Modulo". Los simbolos no empiezan una descripcion.
    .replace(/^(?:(?:[A-Za-z]{1,2}\s*)?[=|>)\]/.+_<-]+\s*)+/, '')
    .replace(/^[a-z]\s+(?=[A-ZÁÉÍÓÚÑ])/, '')
    .replace(/^[-–—•·*:\s]+|[-–—•·*:\s]+$/g, '')
    .slice(0, 200)

const descripcionValida = (desc) =>
  desc.length >= 2 &&
  !DESCARTE_INICIO.test(desc) &&
  /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{2,}/.test(desc)

const normalizarLineaOcr = (cruda) =>
  cruda
    .replace(/[|[\]{}—–_]+/g, ' ')
    // Barra del borde derecho pegada al importe: "$1.500,00/"
    .replace(/(\d[.,]\d{1,2})\/+/g, '$1')
    // Separador de miles leido como espacio: "$1 500.00"
    .replace(/\$\s?(\d{1,3}) (\d{3}[.,]\d{1,2})\b/g, '$$$1$2')
    // Quita guiones heredados de bordes pegados al signo pesos
    .replace(/-\s*\$/g, '$')
    .replace(/\s+/g, ' ')
    .trim()
    // Quita ruido corto al inicio producido por bordes o fondo oscuro antes de la cantidad
    .replace(/^(?:[.,;:<>+•_*=]+\s*|(?:[a-zA-Z]{1,2}\s+){1,2})(?=\d{1,4}\.?\s+[A-Za-zÁÉÍÓÚÑ])/, '')
    // Quita restos cortos sin importe real al final de la fila (p. ej. "— B", "PE")
    .replace(/(\d[.,]\d{1,2})\s+(?:[^0-9]{1,12}|(?:[a-zA-Z0-9<>]{1,3}\s*){1,4})$/, '$1')
    .trim()

/** Quita un eventual codigo/SKU inicial de factura mayorista antes de la linea. */
const sinCodigoInicial = (linea) =>
  linea.replace(/^(?:[A-Z]{2,5}[-/]?\d{2,}|0\d{3,}|\d{5,12})\s+/i, '')

const esLineaDescartable = (linea) => {
  if (!linea || linea.length < 4) return true
  if (/^[-=_.*#\s]+$/.test(linea)) return true
  if (DESCARTE_INICIO.test(linea)) return true
  if (/\b(?:cuit|cuil|cae|iibb|subtotal|iva\s*\d|total\s*:?\s*\$?)\b/i.test(linea)) return true
  return false
}

/**
 * Cuando una fila trae cantidad OCR + precio unitario + precio total,
 * valida coherencia aritmetica: si un borde vertical pegado al "1" hizo leer
 * "11" pero total / unitario es un entero exacto (p. ej. 1), corrige cantidad.
 */
const resolverCantidadYCosto = (cantidadLeida, unitario, total) => {
  if (unitario === null) {
    return { cantidad: cantidadLeida, precioCosto: redondear2(total / cantidadLeida) }
  }

  const toleranciaLeida = Math.max(1, total * 0.02)
  if (Math.abs(unitario * cantidadLeida - total) <= toleranciaLeida) {
    return { cantidad: cantidadLeida, precioCosto: redondear2(total / cantidadLeida) }
  }

  if (unitario > 0 && total >= unitario) {
    const razon = total / unitario
    const entero = Math.round(razon)
    if (entero >= 1 && entero <= 9999 && Math.abs(razon - entero) <= 0.02) {
      return { cantidad: entero, precioCosto: unitario }
    }
  }

  return { cantidad: cantidadLeida, precioCosto: unitario }
}

const parsearLineaMultInicio = (linea) => {
  const m = linea.match(RX_MULT_INICIO)
  if (!m) return null
  const cantidad = Number(m[1])
  const precio = parsearNumeroAr(m[2])
  let resto = m[3].trim()
  const trailing = resto.match(RX_MULT_FINAL)
  if (trailing && parsearNumeroAr(trailing[2]) !== null) {
    resto = trailing[1]
  }
  const descripcionOriginal = limpiarDescripcion(resto)
  if (!cantidad || cantidad <= 0 || precio === null || !descripcionValida(descripcionOriginal)) return null
  return { descripcionOriginal, cantidad, precioCosto: precio }
}

const parsearLineaMultDesc = (linea) => {
  const m = linea.match(RX_MULT_DESC)
  if (!m) return null
  const descripcionOriginal = limpiarDescripcion(m[1])
  const cantidad = Number(m[2])
  const precio = parsearNumeroAr(m[3])
  if (!cantidad || cantidad <= 0 || precio === null || !descripcionValida(descripcionOriginal)) return null
  return { descripcionOriginal, cantidad, precioCosto: precio }
}

const parsearLineaTabular = (linea) => {
  const m = linea.match(RX_TABULAR)
  if (!m) return null

  const cantidadLeida = Number(m[1])
  const descripcionOriginal = limpiarDescripcion(m[2])
  const primero = m[3] ? parsearNumeroAr(m[3]) : null
  const ultimo = parsearNumeroAr(m[4])

  if (!cantidadLeida || cantidadLeida <= 0 || ultimo === null || !descripcionValida(descripcionOriginal)) return null
  const { cantidad, precioCosto } = resolverCantidadYCosto(cantidadLeida, primero, ultimo)
  return { descripcionOriginal, cantidad, precioCosto }
}

const parsearLineaDescCant = (linea) => {
  // Ej: "Funda Silicona A54   2   $ 1.500,00   $ 3.000,00"
  const m = linea.match(RX_DESC_CANT)
  if (!m) return null

  const rawDesc = m[1].trim()
  if (/[:]$/.test(rawDesc)) return null
  const descripcionOriginal = limpiarDescripcion(rawDesc)
  const cantidad = Number(m[2])
  const primero = parsearNumeroAr(m[3])
  const ultimo = m[4] ? parsearNumeroAr(m[4]) : null

  if (!cantidad || cantidad <= 0 || primero === null || !descripcionValida(descripcionOriginal)) return null

  if (ultimo !== null) {
    const tolerancia = Math.max(1, ultimo * 0.02)
    if (Math.abs(primero * cantidad - ultimo) > tolerancia) return null
    return { descripcionOriginal, cantidad, precioCosto: primero }
  }

  // Con un solo monto tras descripcion+cantidad, exigir que cantidad tenga sufijo o evitar confundir modelos (ej. "A54")
  if (!new RegExp(`\\s${cantidad}\\s*(?:u\\.?|un\\.?|uni\\.?|pza\\.?|pz\\.?)\\s`, 'i').test(linea)) {
    return null
  }
  return { descripcionOriginal, cantidad, precioCosto: primero }
}

const parsearLineaDosMontosSinCant = (linea) => {
  // Si el borde izquierdo tapa la cantidad o la convierte en "l"/"I",
  // infiere cantidad desde P. Unitario y P. Total.
  const limpiaInicio = linea.replace(/^(?:[lI]\s+)/, '')
  const m = limpiaInicio.match(RX_DOS_MONTOS)
  if (!m) return null

  const rawDesc = m[1].trim()
  if (/[:]$/.test(rawDesc)) return null
  const descripcionOriginal = limpiarDescripcion(rawDesc)
  const unitario = parsearNumeroAr(m[2])
  const total = parsearNumeroAr(m[3])

  if (!unitario || unitario <= 0 || total === null || total < unitario) return null
  if (!descripcionValida(descripcionOriginal) || descripcionOriginal.length < 3) return null

  const razon = total / unitario
  const cantidad = Math.round(razon)
  if (cantidad < 1 || cantidad > 9999 || Math.abs(razon - cantidad) > 0.03) return null

  return { descripcionOriginal, cantidad, precioCosto: unitario }
}

/**
 * RF10.2 — extrae lineas de un texto reconocido por OCR de una factura o
 * ticket argentino. Nunca lanza excepciones ante lineas ilegibles: las descarta.
 */
export const extraerLineas = (texto) => {
  if (!texto || typeof texto !== 'string') return []

  const lineas = []
  for (const cruda of texto.split(/\r?\n/)) {
    const normalizada = normalizarLineaOcr(cruda)
    if (esLineaDescartable(normalizada)) continue

    const candidata = sinCodigoInicial(normalizada)
    const parsed =
      parsearLineaMultInicio(candidata) ||
      parsearLineaMultDesc(candidata) ||
      parsearLineaTabular(candidata) ||
      parsearLineaDescCant(candidata) ||
      parsearLineaDosMontosSinCant(candidata)

    if (parsed && Number.isFinite(parsed.precioCosto) && parsed.precioCosto >= 0) {
      lineas.push(parsed)
    }
  }

  return lineas
}

/** Suma en centavos del monto total de las lineas de una recepcion. */
export const calcularTotalRecepcion = (lineas = []) => {
  const totalCentavos = lineas.reduce((acc, linea) => {
    const cantidad = Number(linea.cantidad) || 0
    const costoCentavos = Math.round((Number(linea.precioCosto) || 0) * 100)
    return acc + cantidad * costoCentavos
  }, 0)
  return totalCentavos / 100
}

/**
 * Extrae palabras significativas para buscar sugerencias sobre el indice FULLTEXT
 * del catalogo en modo booleano sin exigir coincidencia estricta de cada token.
 */
export const consultaSugerenciaProducto = (descripcion) => {
  const texto = String(descripcion ?? '')
    .replace(/tipo\s+[c€]\b/gi, 'tipo c USB')
    .replace(/[€]/g, ' ')
  const palabras = texto
    .replace(/[+\-*~<>()"@.,:/\\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((p) => (p.length >= 3 || /^\d+[wWhHmMdD]$/.test(p)) && !PALABRAS_VACIAS.has(p.toLowerCase()))

  if (palabras.length === 0) return null
  return [...new Set(palabras)].slice(0, 8).map((p) => `${p}*`).join(' ')
}

// Palabras que no distinguen un producto de otro al comparar nombres.
const PALABRAS_GENERICAS = new Set([
  'de', 'la', 'el', 'para', 'con', 'sin', 'por', 'los', 'las', 'del', 'una', 'uno',
  'tipo', 'modelo', 'compatible', 'repuesto', 'generico',
])

const palabrasDe = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/€/g, 'c')
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !PALABRAS_GENERICAS.has(p))

// Tolera plurales, generos y palabras pegadas por el OCR:
// "baterias" ~ "bateria", "rapida" ~ "rapido", "fundasilicona" ~ "funda".
const coinciden = (a, b) =>
  a === b ||
  (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) ||
  (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

/**
 * RF10.2 — decide si un producto del catalogo se puede preseleccionar para una
 * linea leida por OCR. Una sugerencia equivocada es peor que ninguna: si se
 * confirma sin revisar, suma stock al producto equivocado y le pisa el costo.
 * Exige que la linea contenga al menos dos tercios de las palabras del nombre
 * del producto (y como minimo dos), y la marca si el nombre la incluye.
 */
export const productoSugerible = (descripcionOcr, { denominacion, marca }) => {
  const linea = palabrasDe(descripcionOcr)
  const producto = [...new Set(palabrasDe(denominacion))]
  if (producto.length === 0) return false

  const estaEnLinea = (palabra) => linea.some((otra) => coinciden(palabra, otra))
  // La marca y el modelo (A54, E20, S23: letras y despues numeros) son lo que
  // distingue un repuesto de otro. Las medidas (20W, 1M, 9H) no se exigen: el
  // OCR las confunde seguido ("1M" sale "im").
  const marcaEnNombre = palabrasDe(marca).filter((p) => producto.includes(p))
  const modelos = producto.filter((p) => /^[a-z]+\d/.test(p))
  if (!marcaEnNombre.every(estaEnLinea)) return false
  // El modelo se exige exacto: "a54" no es "a5" ni "a12".
  if (!modelos.every((modelo) => linea.includes(modelo))) return false

  const presentes = producto.filter(estaEnLinea).length
  return presentes >= Math.min(2, producto.length) && presentes / producto.length >= 2 / 3
}

