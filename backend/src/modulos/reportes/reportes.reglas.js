// Reglas puras del modulo de reportes (RF26, RF27 y RF28).
// No importan Sequelize ni Express; todas las agregaciones y reglas de
// visibilidad se prueban sin levantar base de datos.

import { puedeVerCosto } from '../catalogo/catalogo.reglas.js'
import { aCentavos, aPesos } from '../ventas/ventas.reglas.js'
import { fechaIso } from '../servicio/servicio.reglas.js'

/** Rango predeterminado: del primer dia del mes en curso hasta hoy (hora local). */
export const rangoMesEnCurso = (hoy = new Date()) => ({
  desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
  hasta: fechaIso(hoy),
})

/** Verifica coherencia del periodo sin consultar la base. */
/**
 * Instante -> texto UTC para una consulta SQL cruda. La sesion de MySQL esta en
 * UTC, pero `sequelize.query` escribe un Date de las replacements en hora
 * local: el limite de "el dia 1" (03:00 UTC) llegaba como "00:00" y corria el
 * periodo tres horas hacia atras. Los modelos convierten solos; aca no.
 */
export const instanteUtc = (fecha) => fecha.toISOString().slice(0, 19).replace('T', ' ')

export const rangoValido = ({ desde, hasta }) => {
  if (!desde || !hasta) return { valido: false, motivo: 'Tenés que indicar las dos fechas del período.' }
  if (desde > hasta) return { valido: false, motivo: 'La fecha "desde" no puede ser posterior a "hasta".' }
  return { valido: true }
}

/**
 * RF26.1 y RF26.2 — arma la respuesta del reporte comercial a partir de las
 * agregaciones devueltas por MySQL.
 */
export const resumirVentasPeriodo = ({ totalesPorEstado = [], porDia = [], porMedioPago = [] }) => {
  const confirmada = totalesPorEstado.find((fila) => fila.estado === 'CONFIRMADA')
  const anulada = totalesPorEstado.find((fila) => fila.estado === 'ANULADA')

  const operaciones = Number(confirmada?.operaciones ?? 0)
  const totalCentavos = aCentavos(confirmada?.importe ?? 0)
  const totalVendido = Number(aPesos(totalCentavos))
  const ticketPromedio = operaciones > 0
    ? Number(aPesos(Math.round(totalCentavos / operaciones)))
    : 0

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
    porMedioPago: porMedioPago.map((fila) => ({
      idMedioPago: fila.idMedioPago != null ? Number(fila.idMedioPago) : null,
      medioPago: String(fila.medioPago ?? 'Sin medio'),
      operaciones: Number(fila.operaciones ?? 0),
      importe: Number(aPesos(aCentavos(fila.importe ?? 0))),
    })),
  }
}

/**
 * RF27.2 y RF04.2 — valorizacion del inventario por categoria con fila de total.
 * Reusa `puedeVerCosto` de catalogo.reglas.js para ocultar `valorCosto` a los
 * perfiles sin acceso a precios de costo.
 */
export const valorizacionVisible = (filas = [], perfil) => {
  const veCostos = puedeVerCosto(perfil)

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

