// Reglas puras del modulo de reportes (RF26, RF27 y RF28).
// No importan Sequelize ni Express; todas las agregaciones y reglas de
// visibilidad se prueban sin levantar base de datos.

import { puedeVerCosto } from '../catalogo/catalogo.reglas.js'
import { aCentavos, aPesos, MODALIDADES_PAGO } from '../ventas/ventas.reglas.js'
import { fechaIso } from '../servicio/servicio.reglas.js'

/** Rango predeterminado: del primer dia del mes en curso hasta hoy (hora local). */
export const rangoMesEnCurso = (hoy = new Date()) => ({
  desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
  hasta: fechaIso(hoy),
})

/** Verifica coherencia del periodo sin consultar la base. */
export const rangoValido = ({ desde, hasta }) => {
  if (!desde || !hasta) return { valido: false, motivo: 'Tenés que indicar las dos fechas del período.' }
  if (desde > hasta) return { valido: false, motivo: 'La fecha "desde" no puede ser posterior a "hasta".' }
  return { valido: true }
}

/**
 * RF26.1 y RF26.2 — arma la respuesta del reporte comercial a partir de las
 * agregaciones devueltas por MySQL.
 */
export const resumirVentasPeriodo = ({
  totalesPorEstado = [],
  porDia = [],
  porModalidad = [],
  pagosAlVender = [],
  cuotasCobradas = [],
}) => {
  const confirmada = totalesPorEstado.find((fila) => fila.estado === 'CONFIRMADA')
  const anulada = totalesPorEstado.find((fila) => fila.estado === 'ANULADA')

  const operaciones = Number(confirmada?.operaciones ?? 0)
  const totalCentavos = aCentavos(confirmada?.importe ?? 0)
  const totalVendido = Number(aPesos(totalCentavos))
  const ticketPromedio = operaciones > 0
    ? Number(aPesos(Math.round(totalCentavos / operaciones)))
    : 0

  // RF26.2 — lo que entro por cada medio: lo cobrado al vender mas las cuotas
  // cobradas en el periodo. Las dos consultas traen idMedioPago, medioPago e importe.
  const mediosMap = new Map()
  const acumular = (filas, campo) => {
    for (const fila of filas) {
      const id = Number(fila.idMedioPago)
      if (!mediosMap.has(id)) {
        mediosMap.set(id, { idMedioPago: id, medioPago: String(fila.medioPago), alVenderCentavos: 0, cuotasCentavos: 0 })
      }
      mediosMap.get(id)[campo] += aCentavos(fila.importe)
    }
  }
  acumular(pagosAlVender, 'alVenderCentavos')
  acumular(cuotasCobradas, 'cuotasCentavos')

  const ingresosPorMedioPago = Array.from(mediosMap.values())
    .map((item) => {
      const alVender = Number(aPesos(item.alVenderCentavos))
      const cuotas = Number(aPesos(item.cuotasCentavos))
      const total = Number(aPesos(item.alVenderCentavos + item.cuotasCentavos))
      return {
        idMedioPago: item.idMedioPago,
        medioPago: item.medioPago,
        alVender,
        cuotasCobradas: cuotas,
        total,
      }
    })
    .sort((a, b) => b.total - a.total || a.medioPago.localeCompare(b.medioPago))

  return {
    operaciones,
    totalVendido,
    ticketPromedio,
    anuladas: {
      cantidad: Number(anulada?.operaciones ?? 0),
      importe: Number(aPesos(aCentavos(anulada?.importe ?? 0))),
    },
    porDia: porDia.map((fila) => ({
      fecha: String(fila.fecha),
      operaciones: Number(fila.operaciones ?? 0),
      importe: Number(aPesos(aCentavos(fila.importe ?? 0))),
    })),
    porModalidad: porModalidad.map((fila) => ({
      modalidadPago: String(fila.modalidadPago),
      nombre: MODALIDADES_PAGO[fila.modalidadPago]?.nombre ?? String(fila.modalidadPago),
      operaciones: Number(fila.operaciones ?? 0),
      importe: Number(aPesos(aCentavos(fila.importe ?? 0))),
    })),
    ingresosPorMedioPago,
  }
}

/**
 * RF27.2 y RF04.2 — valorizacion del inventario por categoria con fila de total.
 * Reusa `puedeVerCosto` de catalogo.reglas.js para ocultar `valorCosto` a los
 * usuarios sin lectura en REPORTES.
 */
export const valorizacionVisible = (filas = [], permisos) => {
  const veCostos = puedeVerCosto(permisos)

  let articulosTotal = 0
  let unidadesTotal = 0
  let ventaCentavosTotal = 0
  let costoCentavosTotal = 0

  const categorias = filas.map((fila) => {
    const articulos = Number(fila.articulos ?? 0)
    const unidades = Number(fila.unidades ?? 0)
    const ventaCentavos = aCentavos(fila.valorVenta ?? 0)
    const costoCentavos = aCentavos(fila.valorCosto ?? 0)

    articulosTotal += articulos
    unidadesTotal += unidades
    ventaCentavosTotal += ventaCentavos
    costoCentavosTotal += costoCentavos

    const registro = {
      categoria: String(fila.categoria ?? ''),
      articulos,
      unidades,
      valorVenta: Number(aPesos(ventaCentavos)),
    }
    if (veCostos) registro.valorCosto = Number(aPesos(costoCentavos))
    return registro
  })

  const total = {
    articulos: articulosTotal,
    unidades: unidadesTotal,
    valorVenta: Number(aPesos(ventaCentavosTotal)),
  }
  if (veCostos) total.valorCosto = Number(aPesos(costoCentavosTotal))

  return {
    incluyeCosto: veCostos,
    categorias,
    total,
  }
}

/**
 * RF28 — arma el reporte de servicio tecnico del periodo.
 */
export const resumirServicioPeriodo = ({ porEstado = [], totales = {}, noRetiradas = [] }) => ({
  porEstado: porEstado.map((fila) => ({
    codigo: String(fila.codigo),
    nombre: String(fila.nombre),
    esFinal: Boolean(fila.esFinal),
    cantidad: Number(fila.cantidad ?? 0),
    monto: Number(aPesos(aCentavos(fila.monto ?? 0))),
  })),
  totales: {
    ingresadas: Number(totales.ingresadas ?? 0),
    entregadas: Number(totales.entregadas ?? 0),
    noRetiradas: noRetiradas.length,
    recargosCobrados: Number(aPesos(aCentavos(totales.recargosCobrados ?? 0))),
    montoTotal: Number(aPesos(aCentavos(totales.montoTotal ?? 0))),
  },
  noRetiradas: noRetiradas.map((fila) => ({
    idOrden: Number(fila.idOrden),
    numeroOrden: String(fila.numeroOrden),
    cliente: String(fila.cliente),
    telefonoWhatsapp: fila.telefonoWhatsapp ?? null,
    fechaNotificacion: fila.fechaNotificacion,
    diasDesdeNotificacion: Number(fila.diasDesdeNotificacion ?? 0),
    montoTotal: Number(aPesos(aCentavos(fila.montoTotal ?? 0))),
    recargoSugerido: Number(aPesos(aCentavos(fila.recargoSugerido ?? 0))),
  })),
})

