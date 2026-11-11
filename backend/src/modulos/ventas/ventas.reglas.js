// Reglas de la venta que se deciden sin consultar la base. Son funciones de
// datos a datos: no importan Sequelize ni Express, y se prueban sin levantar nada.

import { generarPlan } from './cuotas.reglas.js'

// El dinero se calcula en centavos enteros. Sumar decimales en punto flotante
// arrastra errores de redondeo que en una factura se ven.
export const aCentavos = (valor) => Math.round(Number(valor) * 100)
export const aPesos = (centavos) => (centavos / 100).toFixed(2)

/**
 * RF16.8 / H27 / S10 / S11 — estructura común de las modalidades de pago.
 * Única fuente de la verdad para el comportamiento financiero de la venta.
 */
export const MODALIDADES_PAGO = {
  CONTADO:             { nombre: 'Contado',             financia: null,       enCuotas: false, admiteRecargo: false, cobraAlVender: true },
  TARJETA_CUOTAS:      { nombre: 'Tarjeta en cuotas',   financia: 'TERCERO',  enCuotas: true,  admiteRecargo: true,  cobraAlVender: true },
  GO_CUOTAS:           { nombre: 'GO Cuotas',           financia: 'TERCERO',  enCuotas: true,  admiteRecargo: true,  cobraAlVender: true },
  FINANCIACION_PROPIA: { nombre: 'Financiación propia', financia: 'COMERCIO', enCuotas: true,  admiteRecargo: false, cobraAlVender: false },
}
export const CUOTAS_MAXIMAS = 24

/**
 * RF16.5 — la clasificacion del cliente determina la lista aplicable.
 * Sin cliente asociado (venta de mostrador) rige la minorista.
 */
export const resolverLista = (cliente) => cliente?.tipoCliente?.listaPrecioAplicable ?? 'MINORISTA'

/** Precio del producto segun la lista resuelta. */
export const precioSegunLista = (producto, lista) =>
  lista === 'MAYORISTA' ? producto.precioMayorista : producto.precioMinorista

/**
 * Total de la venta, en centavos.
 * @param {{cantidad:number, precioUnitario:number|string}[]} lineas
 */
export const calcularTotal = (lineas) =>
  lineas.reduce((total, linea) => total + aCentavos(linea.precioUnitario) * linea.cantidad, 0)

/**
 * RF18.2 — una venta ya anulada no se anula de nuevo.
 * @returns {{admite:boolean, motivo?:string}}
 */
export const admiteAnulacion = (venta) => {
  if (!venta) return { admite: false, motivo: 'La venta no existe.' }
  if (venta.estado === 'ANULADA') return { admite: false, motivo: 'La venta ya fue anulada.' }
  return { admite: true }
}

/**
 * RF16.8 — la base exige que CONTADO no lleve cuotas y que el resto lleve al
 * menos una y hasta un maximo de CUOTAS_MAXIMAS (24).
 */
export const cuotasCoherentes = ({ modalidadPago, cantidadCuotas }) => {
  const modalidad = MODALIDADES_PAGO[modalidadPago]
  if (!modalidad) return false
  if (!modalidad.enCuotas) return cantidadCuotas == null
  return Number.isInteger(cantidadCuotas) && cantidadCuotas >= 1 && cantidadCuotas <= CUOTAS_MAXIMAS
}

/**
 * Se acepta recargo > 0 solo si la modalidad lo admite.
 * En financiacion propia el rechazo cita expresamente S10.
 */
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

/**
 * Devuelve total + recargo, o null si la modalidad no cobra al vender.
 */
export const importeCobradoAlVender = ({ modalidadPago, total, recargoFinanciacion = 0 }) => {
  if (!MODALIDADES_PAGO[modalidadPago]?.cobraAlVender) return null
  return aPesos(aCentavos(total) + aCentavos(recargoFinanciacion || 0))
}

/**
 * Importe aproximado de cada cuota, usando generarPlan sobre total + recargo.
 */
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

/** RF17.3 — el envio a domicilio obliga a informar el domicilio. */
export const entregaCoherente = ({ modalidadEntrega, domicilioEntrega }) =>
  modalidadEntrega !== 'ENVIO_DOMICILIO' || Boolean(domicilioEntrega?.trim())

/** El numero de comprobante se deriva del identificador que asigna la base. */
export const formatearComprobante = (idVenta, puntoVenta = '0001') =>
  `${puntoVenta}-${String(idVenta).padStart(8, '0')}`
