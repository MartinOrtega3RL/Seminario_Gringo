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

// --- El recorrido de la orden ---------------------------------------------------

// La base guarda los nombres sin tilde ("En diagnostico"); en pantalla van bien
// escritos y en el idioma del mostrador.
const NOMBRES_ESTADO = {
  RECIBIDO: 'Recibido',
  EN_DIAGNOSTICO: 'En diagnóstico',
  PRESUPUESTADO: 'Presupuestado',
  APROBADO: 'Presupuesto aprobado',
  RECHAZADO: 'Presupuesto rechazado',
  EN_REPARACION: 'En reparación',
  REPARADO: 'Reparado',
  NO_REPARABLE: 'Sin arreglo',
  NOTIFICADO: 'Cliente avisado',
  ENTREGADO: 'Entregado',
  ANULADA: 'Anulada',
}

/** @param {{codigo: string, nombre?: string}} estado */
export const nombreEstado = (estado) => NOMBRES_ESTADO[estado?.codigo] ?? estado?.nombre ?? ''

/**
 * Las seis etapas que ve el técnico. Los once estados de la base son el detalle;
 * para saber dónde está el equipo alcanza con estas.
 */
export const ETAPAS = [
  { clave: 'recepcion', titulo: 'Recepción', estados: ['RECIBIDO'] },
  { clave: 'diagnostico', titulo: 'Diagnóstico', estados: ['EN_DIAGNOSTICO'] },
  { clave: 'presupuesto', titulo: 'Presupuesto', estados: ['PRESUPUESTADO', 'APROBADO', 'RECHAZADO'] },
  { clave: 'reparacion', titulo: 'Reparación', estados: ['EN_REPARACION', 'REPARADO', 'NO_REPARABLE'] },
  { clave: 'aviso', titulo: 'Aviso al cliente', estados: ['NOTIFICADO'] },
  { clave: 'entrega', titulo: 'Entrega', estados: ['ENTREGADO'] },
]

// En qué etapa está el trabajo pendiente para cada estado. Las anteriores ya
// pasaron (o se saltearon); 6 quiere decir que no queda nada.
const ETAPA_PENDIENTE = {
  RECIBIDO: 1,
  EN_DIAGNOSTICO: 1,
  PRESUPUESTADO: 2,
  APROBADO: 3,
  EN_REPARACION: 3,
  RECHAZADO: 4,
  REPARADO: 4,
  NO_REPARABLE: 4,
  NOTIFICADO: 5,
  ENTREGADO: 6,
}

// Cómo terminó una etapa cuando no fue el camino normal.
const DESENLACE = {
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  NO_REPARABLE: 'Sin arreglo',
}

/**
 * Estado de cada etapa a partir del estado actual y del historial.
 * - hecha: ya pasó, con la fecha y quién la cerró;
 * - actual: es donde está el trabajo ahora;
 * - salteada: quedó atrás sin hacerse (presupuesto rechazado, equipo sin arreglo);
 * - pendiente: todavía no llegó.
 * @returns {null | Array<{clave, titulo, situacion, paso?, desenlace?}>} null si la orden se anuló
 */
export const etapasDeOrden = (codigoEstado, historial = []) => {
  const pendiente = ETAPA_PENDIENTE[codigoEstado]
  if (pendiente === undefined) return null

  return ETAPAS.map((etapa, indice) => {
    const pasos = historial.filter((paso) => etapa.estados.includes(paso.estado.codigo))
    const ultimo = pasos.at(-1)
    const desenlace = pasos.map((paso) => DESENLACE[paso.estado.codigo]).filter(Boolean).at(-1)

    let situacion = 'pendiente'
    if (indice === pendiente) situacion = 'actual'
    else if (indice < pendiente) situacion = pasos.length > 0 ? 'hecha' : 'salteada'

    // La reparación de un equipo sin arreglo o rechazado no se hizo, aunque
    // haya quedado atrás: se marca como salteada con su motivo.
    if (situacion === 'hecha' && etapa.clave === 'reparacion' && !pasos.some((p) => p.estado.codigo !== 'NO_REPARABLE')) {
      situacion = 'salteada'
    }

    return { clave: etapa.clave, titulo: etapa.titulo, situacion, paso: ultimo, desenlace }
  })
}

/**
 * Qué toca hacer ahora y a quién, en palabras del local. Es lo primero que ve
 * quien abre la ficha.
 */
const MOMENTO = {
  RECIBIDO: { turno: 'Técnico', que: 'Tomar la orden para revisar el equipo' },
  EN_DIAGNOSTICO: { turno: 'Técnico', que: 'Anotar qué tiene el equipo y cuánto sale' },
  PRESUPUESTADO: { turno: 'Cliente', que: 'Esperar la respuesta del cliente al presupuesto' },
  APROBADO: { turno: 'Técnico', que: 'Empezar la reparación' },
  EN_REPARACION: { turno: 'Técnico', que: 'Reparar el equipo y anotar lo que se hace' },
  REPARADO: { turno: 'Mostrador', que: 'Avisarle al cliente que ya puede retirarlo' },
  NO_REPARABLE: { turno: 'Mostrador', que: 'Avisarle al cliente que no tiene arreglo' },
  RECHAZADO: { turno: 'Mostrador', que: 'Avisarle al cliente que pase a retirar el equipo' },
  NOTIFICADO: { turno: 'Cliente', que: 'Esperar que el cliente pase a retirarlo' },
  ENTREGADO: { turno: null, que: 'El equipo ya se entregó. La orden está cerrada' },
  ANULADA: { turno: null, que: 'La orden se anuló y no admite más cambios' },
}

export const momentoDeOrden = (codigoEstado) => MOMENTO[codigoEstado] ?? { turno: null, que: '' }

/**
 * Lo que acaba de quedar registrado, para confirmarlo en pantalla. Sin esto, el
 * técnico guarda y no sabe si la orden avanzó o si el clic se perdió.
 * @returns {string|null}
 */
export const describirCambio = (antes, despues) => {
  if (!antes || !despues) return null
  if (antes.estado.codigo !== despues.estado.codigo) {
    return `Guardado. La orden pasó a «${nombreEstado(despues.estado)}».`
  }
  if (despues.tareas.length > antes.tareas.length) return 'Guardado. La tarea quedó anotada en la orden.'
  if (despues.repuestos.length > antes.repuestos.length) return 'Guardado. El repuesto se cargó y se descontó del stock.'
  if (despues.repuestos.length < antes.repuestos.length) return 'Guardado. El repuesto se quitó y volvió al stock.'
  if (despues.fotos.length > antes.fotos.length) return 'Guardado. La foto quedó en la orden.'
  if (despues.diagnosticoTecnico !== antes.diagnosticoTecnico) return 'Guardado. El diagnóstico quedó actualizado.'
  if (despues.montoPresupuestado !== antes.montoPresupuestado) return 'Guardado. El presupuesto quedó actualizado.'
  if (despues.historial.length > antes.historial.length) return 'Guardado. Quedó registrado en el historial.'
  return null
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
