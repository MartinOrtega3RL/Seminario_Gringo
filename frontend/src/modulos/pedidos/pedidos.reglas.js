// Reglas de presentacion del modulo de pedidos pendientes (RF19).

export const ETIQUETAS_ESTADO = {
  PENDIENTE: 'Pendiente',
  DISPONIBLE: 'Disponible',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

export const ACCIONES_ESTADO = {
  DISPONIBLE: 'Marcar disponible',
  ENTREGADO: 'Marcar entregado',
  CANCELADO: 'Cancelar pedido',
}

export const tonoEstadoPedido = (estado) => {
  if (estado === 'DISPONIBLE') return 'destacado'
  if (estado === 'CANCELADO') return 'alerta'
  return 'neutro'
}

export const nombrePedido = (pedido) =>
  pedido?.producto?.denominacion || pedido?.descripcionPedido || 'Pedido sin detalle'

/**
 * H11 — arma el enlace https://wa.me/<numero> con solo digitos para avisar al
 * cliente cuando su pedido pasa a DISPONIBLE.
 */
export const enlaceWhatsapp = (numero, mensaje) => {
  const digitos = String(numero ?? '').replace(/\D/g, '')
  if (!digitos) return null
  const consulta = mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''
  return `https://wa.me/${digitos}${consulta}`
}

export const mensajePedidoDisponible = (pedido) =>
  `Hola ${pedido?.cliente?.apellidoNombre ?? ''}, ya está disponible tu pedido de ${nombrePedido(pedido)} en El Gringo Celulares.`.trim()

