// Reglas de venta compartidas con el frontend (RF16 / RF20 / S10 / S11).

import { generarPlan } from './cuotas.reglas.js'

export const aCentavos = (valor) => Math.round(Number(valor) * 100)
export const aPesos = (centavos) => (centavos / 100).toFixed(2)

export const MODALIDADES_PAGO = {
  CONTADO:             { nombre: 'Contado',             financia: null,       enCuotas: false, admiteRecargo: false, cobraAlVender: true },
  TARJETA_CUOTAS:      { nombre: 'Tarjeta en cuotas',   financia: 'TERCERO',  enCuotas: true,  admiteRecargo: true,  cobraAlVender: true },
  GO_CUOTAS:           { nombre: 'GO Cuotas',           financia: 'TERCERO',  enCuotas: true,  admiteRecargo: true,  cobraAlVender: true },
  FINANCIACION_PROPIA: { nombre: 'Financiación propia', financia: 'COMERCIO', enCuotas: true,  admiteRecargo: false, cobraAlVender: false },
}
export const CUOTAS_MAXIMAS = 24

export const cuotasCoherentes = ({ modalidadPago, cantidadCuotas }) => {
  const modalidad = MODALIDADES_PAGO[modalidadPago]
  if (!modalidad) return false
  if (!modalidad.enCuotas) return cantidadCuotas == null
  return Number.isInteger(cantidadCuotas) && cantidadCuotas >= 1 && cantidadCuotas <= CUOTAS_MAXIMAS
}

export const recargoFinanciacionValido = ({ modalidadPago, recargoFinanciacion = 0 }) => {
  const modalidad = MODALIDADES_PAGO[modalidadPago]
  const valorRecargo = Number(recargoFinanciacion || 0)
  if (valorRecargo < 0) {
    return { valido: false, motivo: 'El recargo no puede ser negativo.' }
  }
  if (valorRecargo > 0) {
    if (!modalidad || !modalidad.admiteRecargo) {
      if (modalidadPago === 'FINANCIACION_PROPIA') {
        return {
          valido: false,
          motivo: 'La financiación propia del comercio no lleva recargo sobre el precio de contado (S10).',
        }
      }
      return {
        valido: false,
        motivo: `La modalidad ${modalidad?.nombre ?? modalidadPago} no admite recargo.`,
      }
    }
  }
  return { valido: true }
}

export const importeCobradoAlVender = ({ modalidadPago, total, recargoFinanciacion = 0 }) => {
  if (!MODALIDADES_PAGO[modalidadPago]?.cobraAlVender) return null
  return aPesos(aCentavos(total) + aCentavos(recargoFinanciacion || 0))
}

/**
 * Texto de la condicion de pago para listados y comprobantes. Las modalidades
 * que no cobran al vender no tienen medio: cada cuota registra el suyo al
 * cobrarse (RF20.2).
 */
export const textoCuotas = (cantidad) => `${cantidad} ${Number(cantidad) === 1 ? 'cuota' : 'cuotas'}`

export const condicionDePago = ({ modalidadPago, cantidadCuotas, medioPago }) => {
  const modalidad = MODALIDADES_PAGO[modalidadPago]
  const nombre = modalidad?.nombre ?? modalidadPago
  const conCuotas = modalidad?.enCuotas && cantidadCuotas ? `${nombre} — ${textoCuotas(cantidadCuotas)}` : nombre
  return modalidad?.cobraAlVender === false ? conCuotas : `${conCuotas} · ${medioPago ?? 'sin medio de pago'}`
}

export const resumenCuotas = ({ modalidadPago, total, recargoFinanciacion = 0, cantidadCuotas }) => {
  if (!MODALIDADES_PAGO[modalidadPago]?.enCuotas || !cantidadCuotas || cantidadCuotas < 1) return null
  const totalConRecargo = aPesos(aCentavos(total) + aCentavos(recargoFinanciacion || 0))
  const plan = generarPlan({
    total: totalConRecargo,
    cantidadCuotas,
    fechaVenta: '2026-01-01',
  })
  return plan[0]?.importe ?? null
}

