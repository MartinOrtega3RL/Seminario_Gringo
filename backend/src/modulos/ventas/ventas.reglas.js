// Reglas de la venta que se deciden sin consultar la base. Son funciones de
// datos a datos: no importan Sequelize ni Express, y se prueban sin levantar nada.

// El dinero se calcula en centavos enteros. Sumar decimales en punto flotante
// arrastra errores de redondeo que en una factura se ven.
export const aCentavos = (valor) => Math.round(Number(valor) * 100)
export const aPesos = (centavos) => (centavos / 100).toFixed(2)

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
 * menos una. Verificarlo antes evita que la restriccion salte como error tecnico.
 */
export const cuotasCoherentes = ({ modalidadPago, cantidadCuotas }) => {
  if (modalidadPago === 'CONTADO') return cantidadCuotas == null
  return Number.isInteger(cantidadCuotas) && cantidadCuotas >= 1
}

/** RF17.3 — el envio a domicilio obliga a informar el domicilio. */
export const entregaCoherente = ({ modalidadEntrega, domicilioEntrega }) =>
  modalidadEntrega !== 'ENVIO_DOMICILIO' || Boolean(domicilioEntrega?.trim())

/** El numero de comprobante se deriva del identificador que asigna la base. */
export const formatearComprobante = (idVenta, puntoVenta = '0001') =>
  `${puntoVenta}-${String(idVenta).padStart(8, '0')}`
