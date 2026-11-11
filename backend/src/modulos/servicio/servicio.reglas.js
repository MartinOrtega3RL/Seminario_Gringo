// Reglas del servicio tecnico que se deciden sin consultar la base. Son
// funciones de datos a datos: no importan Sequelize ni Express, y se prueban
// sin levantar nada.
//
// Las tres reglas de negocio que el comercio ya tiene escritas en su ficha de
// papel viven aca y no en el servicio: garantia de 30 dias corridos (H07),
// retiro dentro de los 10 dias de notificado bajo recargo del 15% (H08) y la
// exhibicion de la orden como condicion de retiro (H09). Los numeros no se
// escriben en el codigo: llegan de parametro_sistema.

import { aCentavos } from '../ventas/ventas.reglas.js'

// --- Ciclo de vida (RF22.6) ----------------------------------------------------

// Cada clave es un estado y su valor, a donde puede ir. Todo lo que no figura
// aca esta prohibido: es mas seguro enumerar lo permitido que lo vedado.
//
// RECHAZADO puede ir directo a NOTIFICADO o ENTREGADO: el cliente dijo que no
// al presupuesto y lo unico que queda es devolverle el equipo sin repararlo.
const TRANSICIONES = {
  RECIBIDO: ['EN_DIAGNOSTICO', 'ANULADA'],
  EN_DIAGNOSTICO: ['PRESUPUESTADO', 'NO_REPARABLE', 'ANULADA'],
  PRESUPUESTADO: ['APROBADO', 'RECHAZADO', 'ANULADA'],
  APROBADO: ['EN_REPARACION', 'ANULADA'],
  RECHAZADO: ['NOTIFICADO', 'ENTREGADO'],
  EN_REPARACION: ['REPARADO', 'NO_REPARABLE'],
  REPARADO: ['NOTIFICADO', 'ENTREGADO'],
  NO_REPARABLE: ['NOTIFICADO', 'ENTREGADO'],
  NOTIFICADO: ['ENTREGADO'],
  ENTREGADO: [],
  ANULADA: [],
}

// Los estados que se alcanzan solo por una operacion que carga datos propios:
// el presupuesto lleva un monto, la notificacion un medio, la entrega la
// conformidad. Cambiarlos "a mano" dejaria la orden con el estado y sin el dato.
const POR_OPERACION_PROPIA = new Set(['PRESUPUESTADO', 'APROBADO', 'RECHAZADO', 'NOTIFICADO', 'ENTREGADO'])

export const transicionPermitida = (desde, hacia) => TRANSICIONES[desde]?.includes(hacia) ?? false

export const siguientesEstados = (codigo) => TRANSICIONES[codigo] ?? []

/** RF22.6 — los cambios de estado que el tecnico elige directamente. */
export const cambiosManuales = (codigo) =>
  siguientesEstados(codigo).filter((destino) => !POR_OPERACION_PROPIA.has(destino))

// En que estados tiene sentido cada operacion. La interfaz recibe la lista ya
// calculada y no repite esta tabla: un solo lugar decide que se puede hacer.
const ESTADOS_PARA = {
  diagnosticar: ['RECIBIDO', 'EN_DIAGNOSTICO'],
  presupuestar: ['EN_DIAGNOSTICO', 'PRESUPUESTADO'],
  responder: ['PRESUPUESTADO'],
  tareas: ['EN_DIAGNOSTICO', 'EN_REPARACION'],
  repuestos: ['EN_REPARACION'],
  notificar: ['REPARADO', 'NO_REPARABLE', 'RECHAZADO', 'NOTIFICADO'],
  entregar: ['REPARADO', 'NO_REPARABLE', 'RECHAZADO', 'NOTIFICADO'],
}

export const admite = (operacion, codigoEstado) => ESTADOS_PARA[operacion]?.includes(codigoEstado) ?? false

export const operacionesDisponibles = (codigoEstado) =>
  Object.keys(ESTADOS_PARA).filter((operacion) => admite(operacion, codigoEstado))

/** H09 — identificador unico y legible que el cliente exhibe para retirar. */
export const formatearNumeroOrden = (idOrden) => `OS-${String(idOrden).padStart(6, '0')}`

/**
 * RF22.6 — pasar a REPARADO exige haber registrado lo que se hizo. Son las
 * tareas las que delimitan que cubre la garantia (H07): una orden "reparada"
 * sin tareas dejaria una garantia sin alcance definido.
 */
export const puedeDarseComoReparada = ({ cantidadTareas }) =>
  cantidadTareas > 0
    ? { admite: true }
    : { admite: false, motivo: 'Registrá las tareas realizadas antes de dar la orden por reparada: son las que cubre la garantía.' }

// --- Fechas --------------------------------------------------------------------

const inicioDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())

const dosDigitos = (n) => String(n).padStart(2, '0')

/** AAAA-MM-DD en hora local: lo que muestra un calendario, no UTC. */
export const fechaIso = (fecha) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`

const desdeIso = (texto) => {
  const [anio, mes, dia] = String(texto).slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/**
 * Dias corridos entre dos fechas, contando calendario y no horas: una orden
 * notificada el lunes a las 18:00 lleva un dia el martes a las 09:00, no
 * quince horas. El plazo de H08 se cuenta en dias, asi que se mide en dias.
 */
export const diasCalendario = (desde, hasta) =>
  Math.round((inicioDelDia(hasta) - inicioDelDia(desde)) / 86_400_000)

// --- Retiro y recargo (H08) ----------------------------------------------------

/**
 * RF23.2 — "superaron los diez dias desde la notificacion sin haber sido
 * retiradas". Superar es estrictamente mayor: al decimo dia todavia esta en
 * plazo, el recargo corre desde el undecimo.
 */
export const estaNoRetirada = ({ fechaNotificacion, fechaEntrega }, hoy, plazoDias) =>
  Boolean(fechaNotificacion) &&
  !fechaEntrega &&
  diasCalendario(new Date(fechaNotificacion), hoy) > plazoDias

/**
 * La misma regla, escrita como corte de fecha para poder pedirsela a la base
 * en una sola consulta: una orden esta fuera de plazo si se notifico antes de
 * este instante. Es equivalente a estaNoRetirada; hay una prueba que lo exige.
 */
export const limiteNoRetirada = (hoy, plazoDias) => {
  const limite = inicioDelDia(hoy)
  limite.setDate(limite.getDate() - plazoDias)
  return limite
}

/**
 * RF23.3 — liquidacion de la orden, en centavos enteros.
 *
 * El recargo es "sobre el monto de la reparacion": presupuesto mas repuestos,
 * antes del recargo. Si el equipo no se reparo (rechazo el presupuesto o no
 * tenia arreglo) no hay reparacion que cobrar ni sobre que recargar.
 *
 * @param {object} orden
 * @param {number|string|null} orden.montoPresupuestado
 * @param {{cantidad:number, precioUnitario:number|string}[]} orden.repuestos
 * @param {boolean} orden.huboReparacion
 * @param {boolean} orden.noRetirada
 * @param {number|string} orden.porcentajeRecargo  15 para el quince por ciento
 */
export const liquidar = ({ montoPresupuestado, repuestos = [], huboReparacion, noRetirada, porcentajeRecargo }) => {
  const presupuesto = aCentavos(montoPresupuestado ?? 0)
  const piezas = repuestos.reduce((suma, r) => suma + aCentavos(r.precioUnitario) * r.cantidad, 0)

  const reparacion = huboReparacion ? presupuesto + piezas : 0
  const recargo = noRetirada ? Math.round((reparacion * Number(porcentajeRecargo)) / 100) : 0

  return { reparacion, recargo, total: reparacion + recargo }
}

// --- Garantia (H07) ------------------------------------------------------------

/** RF24.1 — treinta dias corridos desde la entrega. */
export const vencimientoGarantia = (fechaEntrega, dias) => {
  const vence = inicioDelDia(new Date(fechaEntrega))
  vence.setDate(vence.getDate() + dias)
  return fechaIso(vence)
}

const MENSAJES_GARANTIA = {
  VIGENTE: 'La garantía está vigente.',
  VENCIDA: 'La garantía de la reparación anterior ya venció.',
  SELLOS_VIOLADOS: 'Los sellos del comercio están rotos o cortados: según la ficha, eso anula la garantía.',
  SIN_GARANTIA: 'No hay una reparación entregada con garantía para este equipo.',
}

/**
 * RF24.2 — vigencia de la garantia de una reparacion previa.
 *
 * Dos cosas la anulan, y son independientes: que pasen los 30 dias, o que el
 * equipo vuelva con los sellos del comercio rasgados o cortados. Lo que
 * dispara la exclusion es el estado del sello al reingresar, no el hecho de
 * haberlo mirado.
 *
 * @param {{fechaVencGarantia: string|null}|null} ordenPrevia
 * @param {'INTACTOS'|'VIOLADOS'|'SIN_SELLO'} estadoSellos  estado al reingresar
 * @param {Date} hoy
 */
export const evaluarGarantia = (ordenPrevia, estadoSellos, hoy) => {
  const respuesta = (motivo, extra = {}) => ({
    vigente: motivo === 'VIGENTE',
    motivo,
    mensaje: MENSAJES_GARANTIA[motivo],
    ...extra,
  })

  if (!ordenPrevia?.fechaVencGarantia) return respuesta('SIN_GARANTIA')

  const vence = String(ordenPrevia.fechaVencGarantia).slice(0, 10)
  const diasRestantes = diasCalendario(hoy, desdeIso(vence))
  const dato = { vence, diasRestantes }

  if (diasRestantes < 0) return respuesta('VENCIDA', dato)
  if (estadoSellos === 'VIOLADOS') return respuesta('SELLOS_VIOLADOS', dato)
  return respuesta('VIGENTE', dato)
}
