// Reglas de presentacion del servicio tecnico. Que se puede hacer en cada estado
// NO esta aca: lo decide el servidor y llega en `orden.operaciones` y
// `orden.cambios`. Repetir esa tabla en el navegador seria dos lugares que
// pueden discrepar, y el que gana siempre es el que no se actualizo.

export const SELLOS = {
  INTACTOS: 'Intactos',
  VIOLADOS: 'Rotos o cortados',
  SIN_SELLO: 'Sin sello colocado',
}

export const MEDIOS_NOTIFICACION = {
  WHATSAPP: 'WhatsApp',
  LLAMADA: 'Llamada',
  PRESENCIAL: 'En persona',
  CORREO: 'Correo',
}

export const MOMENTOS_FOTO = {
  INGRESO: 'Al ingresar',
  PROCESO: 'Durante la reparación',
  ENTREGA: 'Al entregar',
}

/**
 * Tono de la marca de estado. El escarlata es del sistema para lo accionable, asi
 * que solo lo llevan las dos cosas que piden que alguien haga algo: un equipo
 * fuera de plazo de retiro y una orden anulada. El resto distingue por texto.
 */
export const tonoDeEstado = (codigo, noRetirada = false) => {
  if (noRetirada || codigo === 'ANULADA') return 'alerta'
  if (['PRESUPUESTADO', 'REPARADO', 'NOTIFICADO'].includes(codigo)) return 'destacado'
  return 'neutro'
}

/** "Apple iPhone 13", o lo que haya si falta la marca. */
export const nombreEquipo = (dispositivo) =>
  [dispositivo?.modelo?.marca?.nombre, dispositivo?.modelo?.denominacion].filter(Boolean).join(' ') || 'Equipo sin identificar'

// --- Fechas ---------------------------------------------------------------------

const dosDigitos = (n) => String(n).padStart(2, '0')

/** 23/10/26 18:45, en hora local. Llegan en UTC y se muestran en la del comercio. */
export const fechaHora = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
}

export const fechaCorta = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Una fecha sin hora ("2026-11-10", como viene el vencimiento de la garantia) se
 * arma con sus partes. `new Date("2026-11-10")` es medianoche UTC y en Formosa,
 * a tres horas, mostraria el 9 de noviembre: la garantia parecería vencer un
 * dia antes de lo que dice la ficha.
 */
export const soloFecha = (texto) => {
  const partes = SOLO_FECHA.exec(String(texto ?? ''))
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : ''
}

export const pesos = (valor) =>
  Number(valor ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const hoyIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

export const haceDiasIso = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/** "queda 1 día", "quedan 18 días", "vence hoy". */
export const diasRestantes = (dias) => {
  if (dias === 0) return 'vence hoy'
  if (dias === 1) return 'queda 1 día'
  return `quedan ${dias} días`
}
