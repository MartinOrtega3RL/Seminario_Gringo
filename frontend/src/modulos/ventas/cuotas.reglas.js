// Reglas puras del plan de cuotas y su cobro en interfaz (RF20 / S10).

const dosDigitos = (n) => String(n).padStart(2, '0')
const aCentavos = (monto) => Math.round(Number(monto) * 100)
const aPesos = (centavos) => Math.round(centavos) / 100

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

/** RF20.1 / S10 — calcula la vista previa del plan de cuotas sin recargo. */
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
  cuotasCoherentes,
  recargoFinanciacionValido,
  importeCobradoAlVender,
  resumenCuotas,
} from './ventas.reglas.js'

/** Formato AAAA-MM-DD -> DD/MM/AAAA sin pasar por Date UTC. */
export const formatearFechaCuota = (iso) => {
  if (!iso) return '—'
  const texto = String(iso).slice(0, 10)
  const partes = texto.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto
}

