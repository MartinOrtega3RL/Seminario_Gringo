// Reglas puras de la bitacora de operaciones (RF05).
// Limpia credenciales, recorta cadenas largas y deja solo lo que cambio.

export const ACCIONES_BITACORA = [
  'ALTA', 'MODIFICACION', 'BAJA', 'ANULACION', 'LOGIN', 'LOGOUT', 'AJUSTE',
]

const MAX_TEXTO = 200
const MAX_DETALLE = 300

const CLAVES_SENSIBLES = new Set([
  'contrasena',
  'contrasenahash',
  'contrasenaactual',
  'contrasenanueva',
  'password',
  'passwordhash',
])

const esClaveSensible = (clave) => {
  const normal = String(clave).toLowerCase()
  return CLAVES_SENSIBLES.has(normal) || normal.startsWith('token')
}

const recortarTexto = (texto, maximo = MAX_TEXTO) => {
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, maximo - 1)}…`
}

const limpiarValor = (valor) => {
  if (valor === undefined || valor === null) return null
  if (typeof valor === 'string') return recortarTexto(valor)
  if (valor instanceof Date) return valor.toISOString()
  if (Array.isArray(valor)) return valor.map(limpiarValor)
  if (typeof valor === 'object') return limpiarObjeto(valor)
  return valor
}

export const limpiarObjeto = (objeto) => {
  if (!objeto || typeof objeto !== 'object') return null
  const plano = typeof objeto.get === 'function' ? objeto.get({ plain: true }) : objeto
  const limpio = {}

  for (const [clave, valor] of Object.entries(plano)) {
    if (esClaveSensible(clave) || valor === undefined || typeof valor === 'function') continue
    limpio[clave] = limpiarValor(valor)
  }

  return Object.keys(limpio).length > 0 ? limpio : null
}

const iguales = (a, b) => {
  if (a === b) return true
  if (a == null && b == null) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * RF05 — prepara `datosAntes`, `datosDespues` y `detalle` para persistir en
 * `bitacora`. Quita credenciales/tokens, recorta strings largos y, cuando hay
 * estado previo y posterior, conserva unicamente los campos que cambiaron.
 */
export const limpiarDatosBitacora = ({ antes = null, despues = null, detalle = null } = {}) => {
  const previo = limpiarObjeto(antes)
  const posterior = limpiarObjeto(despues)
  const detalleLimpio = detalle?.trim() ? recortarTexto(detalle.trim(), MAX_DETALLE) : null

  if (!previo && !posterior) {
    return { datosAntes: null, datosDespues: null, detalle: detalleLimpio }
  }

  if (!previo || !posterior) {
    return { datosAntes: previo, datosDespues: posterior, detalle: detalleLimpio }
  }

  const claves = new Set([...Object.keys(previo), ...Object.keys(posterior)])
  const diffAntes = {}
  const diffDespues = {}

  for (const clave of claves) {
    const valAntes = clave in previo ? previo[clave] : null
    const valDespues = clave in posterior ? posterior[clave] : null
    if (!iguales(valAntes, valDespues)) {
      diffAntes[clave] = valAntes
      diffDespues[clave] = valDespues
    }
  }

  return {
    datosAntes: Object.keys(diffAntes).length > 0 ? diffAntes : null,
    datosDespues: Object.keys(diffDespues).length > 0 ? diffDespues : null,
    detalle: detalleLimpio,
  }
}

