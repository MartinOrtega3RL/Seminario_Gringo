// Reglas puras del plan de cuotas y su cobro (RF20 / S10).

import { aCentavos, aPesos } from './ventas.reglas.js'

const dosDigitos = (n) => String(n).padStart(2, '0')

/** Extrae [anio, mes0, dia] en hora local del comercio sin correr por UTC. */
const partesLocales = (fechaVenta) => {
  if (typeof fechaVenta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaVenta)) {
    const [anio, mes, dia] = fechaVenta.split('-').map(Number)
    return { anio, mes: mes - 1, dia }
  }
  const fecha = fechaVenta instanceof Date ? fechaVenta : new Date(fechaVenta)
  return {
    anio: fecha.getFullYear(),
    mes: fecha.getMonth(),
    dia: fecha.getDate(),
  }
}

const sumarMesesIso = ({ anio, mes, dia }, meses) => {
  const totalMeses = mes + meses
  const anioDestino = anio + Math.floor(totalMeses / 12)
  const mesDestino = totalMeses % 12
  const ultimoDia = new Date(anioDestino, mesDestino + 1, 0).getDate()
  const diaDestino = Math.min(dia, ultimoDia)
  return `${anioDestino}-${dosDigitos(mesDestino + 1)}-${dosDigitos(diaDestino)}`
}

/**
 * RF20.1 / S10 — genera el plan de cuotas de importe fijo (sin recargo).
 * La diferencia de redondeo en centavos se asigna a la ultima cuota para que
 * la suma coincida exactamente con el total.
 */
export const generarPlan = ({ total, cantidadCuotas, fechaVenta }) => {
  if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1) {
    throw new Error('La cantidad de cuotas tiene que ser al menos 1.')
  }

  const totalCentavos = aCentavos(total)
  const baseCentavos = Math.floor(totalCentavos / cantidadCuotas)
  const restoCentavos = totalCentavos - baseCentavos * cantidadCuotas
  const base = partesLocales(fechaVenta)

  return Array.from({ length: cantidadCuotas }, (_, indice) => {
    const numeroCuota = indice + 1
    const centavos = numeroCuota === cantidadCuotas
      ? baseCentavos + restoCentavos
      : baseCentavos

    return {
      numeroCuota,
      importe: aPesos(centavos),
      fechaVencimiento: sumarMesesIso(base, numeroCuota),
    }
  })
}

export {
  MODALIDADES_PAGO,
  CUOTAS_MAXIMAS,
  recargoFinanciacionValido,
} from './ventas.reglas.js'

/** RF20.3 — estado derivado de una cuota respecto de hoy (fecha local AAAA-MM-DD). */
export const estadoCuota = (cuota, hoyIso) => {
  if (cuota.fechaCobro) return 'COBRADA'
  const vencimiento = String(cuota.fechaVencimiento).slice(0, 10)
  return vencimiento < hoyIso ? 'VENCIDA' : 'PENDIENTE'
}

/** Dias corridos de atraso respecto de hoy cuando la cuota esta vencida. */
export const diasAtrasoCuota = (cuota, hoyIso) => {
  if (estadoCuota(cuota, hoyIso) !== 'VENCIDA') return 0
  const [aV, mV, dV] = String(cuota.fechaVencimiento).slice(0, 10).split('-').map(Number)
  const [aH, mH, dH] = hoyIso.slice(0, 10).split('-').map(Number)
  const msV = Date.UTC(aV, mV - 1, dV)
  const msH = Date.UTC(aH, mH - 1, dH)
  return Math.max(0, Math.round((msH - msV) / 86_400_000))
}

