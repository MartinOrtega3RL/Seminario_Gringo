// Reglas puras del modulo de pedidos pendientes (RF19).
// No importan Sequelize ni Express; se prueban sin levantar nada.

export const ESTADOS_PEDIDO = ['PENDIENTE', 'DISPONIBLE', 'ENTREGADO', 'CANCELADO']
export const ESTADOS_NO_FINALES = ['PENDIENTE', 'DISPONIBLE']
const ESTADOS_FINALES = new Set(['ENTREGADO', 'CANCELADO'])

const TRANSICIONES = {
  PENDIENTE: ['DISPONIBLE', 'CANCELADO'],
  DISPONIBLE: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
}

/** RF19.2 — siguientes estados validos para un pedido. */
export const siguientesEstadosPedido = (estado) => TRANSICIONES[estado] ?? []

export const transicionPedidoPermitida = (desde, hacia) =>
  siguientesEstadosPedido(desde).includes(hacia)

export const esEstadoFinalPedido = (estado) => ESTADOS_FINALES.has(estado)

/**
 * RF19.2 — valida el cambio de estado y resuelve la fecha de resolucion
 * cuando el pedido alcanza un estado final.
 */
export const evaluarCambioEstadoPedido = (estadoActual, nuevoEstado, ahora = new Date()) => {
  if (!ESTADOS_PEDIDO.includes(nuevoEstado)) {
    return { admite: false, motivo: 'El estado indicado no es válido.' }
  }
  if (!transicionPedidoPermitida(estadoActual, nuevoEstado)) {
    return {
      admite: false,
      motivo: esEstadoFinalPedido(estadoActual)
        ? `El pedido ya está ${estadoActual.toLowerCase()} y no admite más cambios.`
        : `Un pedido ${estadoActual.toLowerCase()} no puede pasar a ${nuevoEstado.toLowerCase()}.`,
    }
  }
  return {
    admite: true,
    fechaResolucion: esEstadoFinalPedido(nuevoEstado) ? ahora : null,
  }
}

/**
 * RF19.1 / ck_pedido_identificacion — exige un producto del catalogo o una
 * descripcion libre (al menos uno de los dos).
 */
export const identificacionValida = ({ idProducto, descripcionPedido }) =>
  Boolean(idProducto || descripcionPedido?.trim())

/** RF19 — forma plana del pedido para las respuestas del servicio. */
export const formatearPedido = (pedido) => ({
  idPedido: pedido.idPedido,
  idCliente: pedido.idCliente,
  cliente: pedido.cliente
    ? {
        idCliente: pedido.cliente.idCliente,
        apellidoNombre: pedido.cliente.persona?.apellidoNombre ?? 'Sin nombre',
        telefonoWhatsapp: pedido.cliente.persona?.telefonoWhatsapp ?? null,
      }
    : null,
  idProducto: pedido.idProducto ?? null,
  producto: pedido.producto
    ? {
        idProducto: pedido.producto.idProducto,
        codigoInterno: pedido.producto.codigoInterno,
        denominacion: pedido.producto.denominacion,
        stockActual: pedido.producto.stockActual,
      }
    : null,
  descripcionPedido: pedido.descripcionPedido ?? null,
  cantidad: Number(pedido.cantidad),
  fechaSolicitud: pedido.fechaSolicitud,
  fechaResolucion: pedido.fechaResolucion ?? null,
  estado: pedido.estado,
  siguientesEstados: siguientesEstadosPedido(pedido.estado),
  esFinal: esEstadoFinalPedido(pedido.estado),
  observacion: pedido.observacion ?? null,
  usuario: pedido.usuario
    ? { idUsuario: pedido.usuario.idUsuario, nombreUsuario: pedido.usuario.nombreUsuario }
    : null,
})

