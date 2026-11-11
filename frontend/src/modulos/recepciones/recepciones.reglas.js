// Reglas puras para recepciones de mercaderia y validacion OCR (RF10).

export const ESTADOS_RECEPCION = {
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  CONFIRMADA: 'Confirmada',
  ANULADA: 'Anulada',
}

export const TONOS_RECEPCION = {
  PENDIENTE_VALIDACION: 'destacado',
  CONFIRMADA: 'neutro',
  ANULADA: 'alerta',
}

export const TIPOS_COMPROBANTE = [
  ['FACTURA', 'Factura'],
  ['REMITO', 'Remito'],
  ['OTRO', 'Otro'],
]

export const ORIGENES_RECEPCION = {
  MANUAL: 'Carga manual',
  OCR: 'OCR desde foto',
}

export const calcularTotalRecepcion = (lineas = []) => {
  const centavos = lineas.reduce((acc, linea) => {
    const cantidad = Number(linea.cantidad) || 0
    const costo = Math.round((Number(linea.precioCosto) || 0) * 100)
    return acc + cantidad * costo
  }, 0)
  return centavos / 100
}

export const todasConProducto = (lineas = []) =>
  lineas.length > 0 &&
  lineas.every((l) => Boolean(l.idProducto) && Number(l.cantidad) >= 1 && Number(l.precioCosto) >= 0)

export const esLecturaDudosa = (extraccion) =>
  Boolean(extraccion) &&
  extraccion.confianzaPromedio !== null &&
  extraccion.confianzaPromedio !== undefined &&
  Number(extraccion.confianzaPromedio) < 60

export const normalizarTexto = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const PISTAS_CATEGORIA = [
  ['vidrio', ['vidrio', 'templado', 'hidrogel', 'protector']],
  ['funda', ['funda', 'silicona', 'carcasa', 'antishock']],
  ['cargador', ['cargador', 'fuente', 'carga turbo', 'carga rapida']],
  ['auricular', ['auricular', 'manos libres', 'earbud', 'headset']],
  ['repuesto', ['bateria', 'modulo', 'pantalla', 'pin de carga', 'flex', 'repuesto']],
  ['telefono', ['telefono', 'celular', 'smartphone']],
  ['accesorio', ['cable', 'soporte', 'power bank', 'powerbank', 'adaptador']],
]

const PISTAS_MARCA = [
  ['apple', ['apple', 'iphone', 'lightning', 'ipad']],
  ['motorola', ['motorola', 'moto ']],
  ['samsung', ['samsung', 'galaxy']],
  ['xiaomi', ['xiaomi', 'redmi', 'poco']],
]

/**
 * Deduce categoria y marca probables desde la descripcion leida en el
 * comprobante para evitar carga manual repetitiva al dar de alta un articulo nuevo.
 */
export const inferirClasificacion = (descripcion, categorias = [], marcas = []) => {
  const norm = ` ${normalizarTexto(descripcion)} `

  let cat = categorias.find((c) => norm.includes(normalizarTexto(c.nombre)))
  if (!cat) {
    for (const [clave, palabras] of PISTAS_CATEGORIA) {
      if (palabras.some((p) => norm.includes(p))) {
        cat = categorias.find((c) => normalizarTexto(c.nombre).includes(clave))
        if (cat) break
      }
    }
  }
  if (!cat) {
    cat = categorias.find((c) => normalizarTexto(c.nombre).includes('accesorio')) ?? categorias[0]
  }

  let marca = marcas.find((m) => norm.includes(normalizarTexto(m.nombre)))
  if (!marca) {
    for (const [clave, palabras] of PISTAS_MARCA) {
      if (palabras.some((p) => norm.includes(p))) {
        marca = marcas.find((m) => normalizarTexto(m.nombre).includes(clave))
        if (marca) break
      }
    }
  }
  if (!marca) {
    marca = marcas.find((m) => normalizarTexto(m.nombre).includes('generic')) ?? marcas[0]
  }

  return {
    idCategoria: cat?.idCategoria ?? '',
    idMarca: marca?.idMarca ?? '',
  }
}

const VACIAS = new Set(['para', 'con', 'sin', 'por', 'tipo', 'del', 'las', 'los'])

/** Extrae hasta 3 palabras clave para buscar posibles duplicados en el catalogo. */
export const palabrasParecidas = (descripcion) =>
  String(descripcion ?? '')
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !VACIAS.has(normalizarTexto(p)))
    .slice(0, 3)
    .join(' ')
