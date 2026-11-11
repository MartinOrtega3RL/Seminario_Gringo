// Reglas de presentacion de la bitacora de operaciones (RF05).

export const ACCIONES_BITACORA = [
  'ALTA', 'MODIFICACION', 'BAJA', 'ANULACION', 'LOGIN', 'LOGOUT', 'AJUSTE',
]

export const ENTIDADES_BITACORA = [
  { valor: 'usuario', texto: 'Usuario' },
  { valor: 'producto', texto: 'Producto' },
  { valor: 'categoria', texto: 'Categoría' },
  { valor: 'marca', texto: 'Marca' },
  { valor: 'movimiento_stock', texto: 'Movimiento de stock' },
  { valor: 'cliente', texto: 'Cliente' },
  { valor: 'proveedor', texto: 'Proveedor' },
  { valor: 'venta', texto: 'Venta' },
  { valor: 'orden_servicio', texto: 'Orden de servicio' },
  { valor: 'pedido_pendiente', texto: 'Pedido pendiente' },
]

export const tonoAccionBitacora = (accion) => {
  if (accion === 'BAJA' || accion === 'ANULACION') return 'alerta'
  if (accion === 'MODIFICACION' || accion === 'AJUSTE') return 'destacado'
  return 'neutro'
}

export const tieneCambiosExpandibles = (registro) =>
  Boolean(
    (registro?.datosAntes && Object.keys(registro.datosAntes).length > 0) ||
    (registro?.datosDespues && Object.keys(registro.datosDespues).length > 0),
  )

/** Lista los pares (clave, antes, despues) para mostrar al expandir un renglon. */
export const paresDeCambio = (antes, despues) => {
  const previo = antes ?? {}
  const posterior = despues ?? {}
  const claves = [...new Set([...Object.keys(previo), ...Object.keys(posterior)])]

  return claves.map((clave) => ({
    clave,
    antes: clave in previo ? previo[clave] : null,
    despues: clave in posterior ? posterior[clave] : null,
  }))
}

